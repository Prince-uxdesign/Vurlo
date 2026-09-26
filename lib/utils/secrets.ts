import "server-only";
import { createHash } from "node:crypto";

const DEV_SALT = "vurlo-dev-salt";
const warned = new Set<string>();

/**
 * A salt that is never public in production. Salts make stored IP and
 * visitor hashes irreversible; a well-known salt would not (the IPv4 space
 * is small enough to hash exhaustively). Order: the named variable, then a
 * value derived from the service-role key (already a server secret), and the
 * public dev constant only outside production. Missing configuration is
 * logged once per process so it gets fixed.
 */
export function serverSalt(name: "RATE_LIMIT_SALT" | "ANALYTICS_SALT", ...fallbacks: Array<string | undefined>): string {
  const direct = process.env[name] || fallbacks.find(Boolean);
  if (direct) return direct;
  if (process.env.NODE_ENV !== "production") return DEV_SALT;

  if (!warned.has(name)) {
    warned.add(name);
    console.error(JSON.stringify({ level: "error", event: "salt_not_configured", variable: name }));
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) return createHash("sha256").update(`vurlo:${name}:${key}`).digest("hex");
  // No secrets at all: the app can't reach its database either. Refuse
  // rather than hash with a public value.
  throw new Error(`${name} is not configured`);
}
