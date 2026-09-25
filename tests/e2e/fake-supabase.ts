/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Test-only stand-in for a Supabase project: real Postgres (PGlite) with the
 * real migrations behind the slice of the PostgREST and GoTrue HTTP APIs that
 * Vurlo's supabase-js usage needs. Roles come from the apikey / JWT, so
 * privileges and RLS behave as on Supabase.
 *
 * Run: npx tsx tests/e2e/fake-supabase.ts   (listens on :54321)
 * Control endpoints (never ship): /__sql /__inbox /__expire /__revoke /__ttl
 * /__config /__google. Passwords are stored in memory in the clear: this is a
 * fake, for tests only.
 */
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { createTestDb } from "../helpers/pglite-client";

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54321);
const SERVICE_KEY = process.env.FAKE_SERVICE_KEY ?? "service-key";
const ANON_KEY = process.env.FAKE_ANON_KEY ?? "anon-key";
const JWT_SECRET = "fake-jwt-secret";
const IDENT = /^[a-z_][a-z0-9_]*$/;
const TABLES = new Set(["links", "profiles"]);

const STATUS_BY_SQLSTATE: Record<string, number> = { "23505": 409, "23503": 409, "23514": 400, "23502": 400, "42501": 403 };

// PostgREST returns bigint as a JSON number; PGlite hands us BigInt.
const toJson = (data: unknown) => JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? Number(v) : v));
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
const sign = (payload: Record<string, unknown>) => {
  const data = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${data}.${createHmac("sha256", JWT_SECRET).update(data).digest("base64url")}`;
};
const verify = (token: string): Record<string, any> | null => {
  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;
  const expected = createHmac("sha256", JWT_SECRET).update(`${h}.${p}`).digest("base64url");
  if (expected !== s) return null;
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
};

interface User { id: string; email: string; password: string; confirmed: boolean; createdAt: string; provider: string }
interface Token { email: string; type: string; hash: string; expiresAt: number; used: boolean }

async function main() {
  const db = await createTestDb();
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>) => { const n = queue.then(fn, fn); queue = n.catch(() => undefined); return n; };

  const users = new Map<string, User>(); // by email
  const byId = new Map<string, User>();
  const sessions = new Map<string, { userId: string }>(); // session_id
  const refreshTokens = new Map<string, { sessionId: string; usedAt: number | null }>();
  const tokens: Token[] = [];
  const authCodes = new Map<string, { userId: string; challenge?: string }>();
  const cfg = { confirm: true, ttl: 3600, googleEmail: "google.user@example.com", googleDeny: false, delayMs: 0, fail: false };

  const userJson = (u: User) => ({
    id: u.id, aud: "authenticated", role: "authenticated", email: u.email,
    email_confirmed_at: u.confirmed ? u.createdAt : null, phone: "", confirmed_at: u.confirmed ? u.createdAt : null,
    last_sign_in_at: new Date().toISOString(), app_metadata: { provider: u.provider, providers: [u.provider] }, user_metadata: {},
    identities: [{ identity_id: u.id, id: u.id, user_id: u.id, provider: u.provider }], created_at: u.createdAt, updated_at: u.createdAt,
  });
  const newSession = (u: User, existingSid?: string) => {
    const sid = existingSid ?? randomUUID(); sessions.set(sid, { userId: u.id });
    const rt = randomBytes(12).toString("hex"); refreshTokens.set(rt, { sessionId: sid, usedAt: null });
    const now = Math.floor(Date.now() / 1000);
    const access = sign({ aud: "authenticated", exp: now + cfg.ttl, iat: now, sub: u.id, email: u.email, role: "authenticated", session_id: sid, aal: "aal1", iss: `http://127.0.0.1:${PORT}/auth/v1` });
    return { access_token: access, token_type: "bearer", expires_in: cfg.ttl, expires_at: now + cfg.ttl, refresh_token: rt, user: userJson(u) };
  };
  const addUser = async (email: string, password: string, confirmed: boolean, provider = "email") => {
    const u: User = { id: randomUUID(), email, password, confirmed, createdAt: new Date().toISOString(), provider };
    users.set(email, u); byId.set(u.id, u);
    await serial(() => db.query("insert into auth.users (id, email, created_at) values ($1,$2,$3)", [u.id, email, u.createdAt]));
    return u;
  };
  const issueToken = (email: string, type: string) => {
    const t: Token = { email, type, hash: randomBytes(16).toString("hex"), expiresAt: Date.now() + 3600_000, used: false };
    tokens.push(t); return t;
  };

  const server = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    const url = new URL(req.url ?? "/", "http://x");
    const body = (): Record<string, any> => { try { return raw ? JSON.parse(raw) : {}; } catch { return {}; } };
    const json = (status: number, data: unknown, headers: Record<string, string> = {}) => { res.writeHead(status, { "Content-Type": "application/json", ...headers }); res.end(data === undefined ? "" : toJson(data)); };
    const authErr = (status: number, code: string, msg: string) => json(status, { code: status, error_code: code, msg });
    const bearer = () => { const m = String(req.headers["authorization"] ?? "").match(/^Bearer (.+)$/); return m ? m[1]! : null; };
    const claims = () => { const t = bearer(); return t ? verify(t) : null; };
    const apiKey = String(req.headers["apikey"] ?? "");
    const pgError = (e: unknown) => { const err = e as { code?: string; message?: string }; json(STATUS_BY_SQLSTATE[err.code ?? ""] ?? 400, { code: err.code ?? "XX000", message: err.message ?? "error", details: null, hint: null }); };

    try {
      const p = url.pathname;
      // ---------------- control endpoints ----------------
      if (p === "/__sql") { const { sql, params } = body(); return json(200, (await serial(() => db.query(sql, params ?? []))).rows); }
      if (p === "/__inbox") { const email = url.searchParams.get("email"); const type = url.searchParams.get("type"); return json(200, tokens.filter((t) => t.email === email && (!type || t.type === type)).map((t) => ({ token_hash: t.hash, type: t.type, used: t.used }))); }
      if (p === "/__expire") { const h = url.searchParams.get("token_hash"); for (const t of tokens) if (t.hash === h) t.expiresAt = 0; return json(200, {}); }
      if (p === "/__revoke") { const u = users.get(url.searchParams.get("email") ?? ""); for (const [sid, s] of sessions) if (u && s.userId === u.id) sessions.delete(sid); return json(200, {}); }
      if (p === "/__ttl") { cfg.ttl = Number(url.searchParams.get("seconds") ?? 3600); return json(200, cfg); }
      if (p === "/__config") { if (url.searchParams.has("confirm")) cfg.confirm = url.searchParams.get("confirm") === "1"; return json(200, cfg); }
      if (p === "/__fail") { cfg.fail = url.searchParams.get("on") === "1"; return json(200, cfg); }
      if (p === "/__delay") { cfg.delayMs = Number(url.searchParams.get("ms") ?? 0); return json(200, cfg); }
      if (p === "/__google") { if (url.searchParams.has("email")) cfg.googleEmail = url.searchParams.get("email")!; cfg.googleDeny = url.searchParams.get("deny") === "1"; return json(200, cfg); }

      // ---------------- GoTrue ----------------
      if (p.startsWith("/auth/v1/")) {
        const route = p.slice("/auth/v1".length);
        if (route === "/authorize") { // browser hop: pretend Google consented (or not)
          const redirectTo = new URL(url.searchParams.get("redirect_to") ?? "http://localhost:3111/");
          if (cfg.googleDeny) { redirectTo.searchParams.set("error", "access_denied"); redirectTo.searchParams.set("error_description", "User denied <script>alert(1)</script>"); }
          else {
            const u = users.get(cfg.googleEmail) ?? (await addUser(cfg.googleEmail, randomBytes(8).toString("hex"), true, "google"));
            const code = randomBytes(12).toString("hex"); authCodes.set(code, { userId: u.id, challenge: url.searchParams.get("code_challenge") ?? undefined });
            redirectTo.searchParams.set("code", code);
          }
          res.writeHead(302, { Location: redirectTo.toString() }); return res.end();
        }
        if (apiKey !== ANON_KEY && apiKey !== SERVICE_KEY) return authErr(401, "no_authorization", "No API key found in request");

        if (route === "/signup" && req.method === "POST") {
          const { email: rawEmail, password } = body(); const email = String(rawEmail ?? "").toLowerCase();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return authErr(400, "validation_failed", "Unable to validate email address: invalid format");
          if (String(password ?? "").length < 8) return authErr(422, "weak_password", "Password should be at least 8 characters.");
          if (users.has(email)) {
            if (cfg.confirm) return json(200, { ...userJson({ id: randomUUID(), email, password: "", confirmed: false, createdAt: new Date().toISOString(), provider: "email" }), identities: [] });
            return authErr(422, "user_already_exists", "User already registered");
          }
          const u = await addUser(email, password, !cfg.confirm);
          if (cfg.confirm) { issueToken(email, "signup"); return json(200, userJson(u)); }
          return json(200, newSession(u));
        }
        if (route === "/token" && req.method === "POST") {
          const grant = url.searchParams.get("grant_type"); const b = body();
          if (grant === "password") {
            const u = users.get(String(b.email ?? "").toLowerCase());
            if (!u || u.password !== b.password) return authErr(400, "invalid_credentials", "Invalid login credentials");
            if (!u.confirmed) return authErr(400, "email_not_confirmed", "Email not confirmed");
            return json(200, newSession(u));
          }
          if (grant === "refresh_token") {
            const rt = refreshTokens.get(String(b.refresh_token));
            const s = rt && sessions.get(rt.sessionId);
            if (!rt || !s) return authErr(400, "refresh_token_not_found", "Invalid Refresh Token: Refresh Token Not Found");
            // Like GoTrue: a token may be reused for 10s after rotation (parallel requests);
            // after that, reuse is treated as theft and the whole session is revoked.
            if (rt.usedAt !== null && Date.now() - rt.usedAt > 10_000) { sessions.delete(rt.sessionId); return authErr(400, "refresh_token_already_used", "Invalid Refresh Token: Already Used"); }
            rt.usedAt ??= Date.now();
            return json(200, newSession(byId.get(s.userId)!, rt.sessionId));
          }
          if (grant === "pkce") {
            const c = authCodes.get(String(b.auth_code));
            if (!c) return authErr(400, "flow_state_not_found", "invalid flow state, no valid flow state found");
            authCodes.delete(String(b.auth_code));
            if (c.challenge && createHash("sha256").update(String(b.code_verifier)).digest("base64url") !== c.challenge) return authErr(400, "bad_code_verifier", "code challenge does not match previously saved code verifier");
            return json(200, newSession(byId.get(c.userId)!));
          }
          return authErr(400, "validation_failed", "unsupported grant_type");
        }
        if (route === "/recover" && req.method === "POST") {
          const email = String(body().email ?? "").toLowerCase();
          if (users.has(email)) issueToken(email, "recovery");
          return json(200, {}); // identical whether or not the account exists
        }
        if (route === "/verify" && req.method === "POST") {
          const { token_hash, type } = body();
          const t = tokens.find((x) => x.hash === token_hash && x.type === type);
          if (!t || t.used || t.expiresAt < Date.now()) return authErr(403, "otp_expired", "Email link is invalid or has expired");
          t.used = true; const u = users.get(t.email)!; u.confirmed = true;
          return json(200, newSession(u));
        }
        if (route === "/user") {
          const c = claims(); if (!c || !sessions.has(c.session_id)) return authErr(401, "bad_jwt", "invalid JWT: unable to parse or verify signature, token is expired or session is gone");
          const u = byId.get(c.sub)!;
          if (req.method === "GET") return json(200, userJson(u));
          if (req.method === "PUT") {
            const { password } = body();
            if (password !== undefined) {
              if (String(password).length < 8) return authErr(422, "weak_password", "Password should be at least 8 characters.");
              if (password === u.password) return authErr(422, "same_password", "New password should be different from the old password.");
              u.password = password;
            }
            return json(200, userJson(u));
          }
        }
        if (route === "/logout" && req.method === "POST") {
          const c = claims(); const scope = url.searchParams.get("scope") ?? "global";
          if (c) for (const [sid, s] of sessions) { if (s.userId !== c.sub) continue; if (scope === "global" || (scope === "local" && sid === c.session_id) || (scope === "others" && sid !== c.session_id)) sessions.delete(sid); }
          return json(204, undefined);
        }
        return json(404, { msg: "not found" });
      }

      // ---------------- PostgREST ----------------
      if (cfg.delayMs) await new Promise((r) => setTimeout(r, cfg.delayMs));
      if (cfg.fail && p.startsWith("/rest/v1/")) return json(503, { code: "XX000", message: "simulated outage: relation \"secret_table\" is unavailable" });
      const jwt = claims();
      const role = apiKey === SERVICE_KEY ? "service_role" : jwt && sessions.has(jwt.session_id) ? "authenticated" : "anon";
      const accept = String(req.headers["accept"] ?? "");
      const wantsObject = accept.includes("vnd.pgrst.object");
      const run = (sql: string, params: unknown[]) => serial(async () => {
        await db.exec(`set role ${role}`);
        try {
          if (role === "authenticated") await db.query("select set_config('request.jwt.claim.sub', $1, false)", [jwt!.sub]);
          return await db.query<Record<string, unknown>>(sql, params);
        } finally { await db.exec("reset role"); }
      });
      const rows = (r: Record<string, unknown>[], status: number) => {
        if (!wantsObject) return json(status, r);
        return r.length === 1 ? json(status, r[0]) : json(406, { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: null, hint: null });
      };

      const rpc = p.match(/^\/rest\/v1\/rpc\/([a-z_]+)$/);
      if (rpc && req.method === "POST") {
        const args = body(); const keys = Object.keys(args);
        if (!keys.every((k) => IDENT.test(k))) return json(400, { message: "bad args" });
        return json(200, (await run(`select * from public.${rpc[1]}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`, keys.map((k) => args[k]))).rows);
      }
      const tbl = p.match(/^\/rest\/v1\/([a-z_]+)$/);
      if (tbl && TABLES.has(tbl[1]!)) {
        const table = tbl[1]!;
        const cols = (url.searchParams.get("select") ?? "*").split(",").map((c) => c.trim());
        if (!cols.every((c) => c === "*" || IDENT.test(c))) return json(400, { message: "bad select" });
        if (req.method === "POST") {
          const b = body(); const keys = Object.keys(b);
          if (!keys.every((k) => IDENT.test(k))) return json(400, { message: "bad columns" });
          return rows((await run(`insert into public.${table} (${keys.join(", ")}) values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning ${cols.join(", ")}`, keys.map((k) => b[k]))).rows, 201);
        }
        const buildFilters = (start: number): { where: string[]; params: unknown[] } | null => {
          const where: string[] = []; const params: unknown[] = [];
          for (const [k, v] of url.searchParams) {
            if (k === "select") continue;
            if (!IDENT.test(k)) return null;
            let m: RegExpMatchArray | null;
            if ((m = v.match(/^eq\.(.*)$/))) { params.push(m[1]); where.push(`${k} = $${start + params.length}`); }
            else if ((m = v.match(/^neq\.(.*)$/))) { params.push(m[1]); where.push(`${k} <> $${start + params.length}`); }
            else if ((m = v.match(/^in\.\((.*)\)$/))) {
              const vals = m[1]!.split(",").map((x) => x.replace(/^"|"$/g, ""));
              const ph = vals.map((x) => { params.push(x); return `$${start + params.length}`; });
              where.push(`${k} in (${ph.join(", ")})`);
            } else return null;
          }
          return { where, params };
        };
        if (req.method === "PATCH") {
          const b = body(); const keys = Object.keys(b);
          if (!keys.length || !keys.every((k) => IDENT.test(k))) return json(400, { message: "bad columns" });
          const f = buildFilters(keys.length); if (!f) return json(400, { message: "unsupported filter" });
          const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
          const r = await run(`update public.${table} set ${sets} ${f.where.length ? "where " + f.where.join(" and ") : ""} returning ${cols.join(", ")}`, [...keys.map((k) => b[k]), ...f.params]);
          return json(200, r.rows);
        }
        if (req.method === "GET" || req.method === "HEAD") {
          const f = buildFilters(0); if (!f) return json(400, { message: "unsupported filter" });
          const where = f.where; const params = f.params;
          const w = where.length ? `where ${where.join(" and ")}` : "";
          if (String(req.headers["prefer"] ?? "").includes("count=exact")) {
            const n = Number((await run(`select count(*)::int as n from public.${table} ${w}`, params)).rows[0]!.n);
            res.writeHead(200, { "Content-Type": "application/json", "Content-Range": n ? `0-${n - 1}/${n}` : "*/0" });
            return res.end(req.method === "HEAD" ? undefined : JSON.stringify([]));
          }
          return rows((await run(`select ${cols.join(", ")} from public.${table} ${w} limit 100`, params)).rows, 200);
        }
      }
      json(404, { message: "not found" });
    } catch (e) { pgError(e); }
  });
  server.listen(PORT, "127.0.0.1", () => console.log(`fake-supabase ready on :${PORT}`));
}
void main();
