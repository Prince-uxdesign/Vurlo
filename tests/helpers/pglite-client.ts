import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { AdminClient } from "@/lib/supabase/admin";

const MIGRATIONS_DIR = new URL("../../supabase/migrations/", import.meta.url);

/** Fresh in-process Postgres with Supabase's roles/auth stubbed and ALL migrations applied. */
export async function createTestDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, created_at timestamptz not null default now());
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS_DIR).sort()) {
    await db.exec(readFileSync(new URL(file, MIGRATIONS_DIR), "utf8"));
  }
  return db;
}

type DbError = { code: string; message: string } | null;
type Row = Record<string, unknown>;

function normalize(row: Row): Row {
  return Object.fromEntries(
    Object.entries(row).map(([k, v]) => [k, v instanceof Date ? v.toISOString() : v]),
  );
}

async function run(db: PGlite, role: string, sql: string, params: unknown[]) {
  await db.exec(`set role ${role}`);
  try {
    const { rows } = await db.query<Row>(sql, params);
    return { data: rows.map(normalize), error: null as DbError };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { data: null, error: { code: err.code ?? "XX000", message: err.message ?? "" } as DbError };
  } finally {
    await db.exec("reset role");
  }
}

/**
 * Just enough of the supabase-js query builder for the code under test,
 * executing real SQL as the given Postgres role. Not a general client.
 */
export function pgliteClient(db: PGlite, role: "service_role" | "anon" = "service_role") {
  return {
    from() {
      return {
        insert(row: Row) {
          const keys = Object.keys(row).filter((k) => row[k] !== undefined);
          return {
            select: (cols: string) => ({
              single: async () => {
                const r = await run(
                  db,
                  role,
                  `insert into public.links (${keys.join(", ")})
                   values (${keys.map((_, i) => `$${i + 1}`).join(", ")}) returning ${cols}`,
                  keys.map((k) => row[k]),
                );
                return { data: r.data?.[0] ?? null, error: r.error };
              },
            }),
          };
        },
        select: (cols: string) => ({
          eq: (col: string, value: unknown) => ({
            maybeSingle: async () => {
              const r = await run(db, role, `select ${cols} from public.links where ${col} = $1 limit 1`, [value]);
              return { data: r.data?.[0] ?? null, error: r.error };
            },
          }),
        }),
      };
    },
    async rpc(fn: string, args: Record<string, unknown>) {
      const keys = Object.keys(args);
      return run(
        db,
        role,
        `select * from public.${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")})`,
        keys.map((k) => args[k]),
      );
    },
  } as unknown as AdminClient;
}
