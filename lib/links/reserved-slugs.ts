/**
 * Single source of truth for slugs that must never be issued to a link.
 *
 * Two layers use this list: application validation (this file) and the
 * `public.is_reserved_slug()` database function, which enforces it with a
 * CHECK constraint. `tests/links-db.test.ts` fails if the two drift apart,
 * so change both together (new migration + this file).
 *
 * Slugs must be 3+ characters and cannot contain dots, so one- and
 * two-letter paths and file names like `robots.txt` are already impossible.
 * Their base names are listed anyway to keep intent obvious.
 */
export const RESERVED_SLUGS = [
  // Application routes (current and planned)
  "api",
  "auth",
  "app",
  "dashboard",
  "links",
  "link",
  "settings",
  "account",
  "profile",
  "login",
  "logout",
  "signin",
  "signup",
  "register",
  "admin",
  "showcase",
  "new",
  "create",
  "edit",
  "preview",
  "qr",
  "analytics",
  // Marketing / informational pages
  "about",
  "help",
  "support",
  "contact",
  "privacy",
  "terms",
  "legal",
  "security",
  "pricing",
  "features",
  "faq",
  "docs",
  "blog",
  "status",
  "changelog",
  "report",
  "abuse",
  // Framework and crawler paths
  "_next",
  "static",
  "public",
  "assets",
  "favicon",
  "icon",
  "robots",
  "sitemap",
  "manifest",
  "opengraph-image",
  "twitter-image",
  "not-found",
  "health",
  "healthz",
  // Brand and impersonation
  "vurlo",
  "www",
  "mail",
  "root",
  "null",
  "undefined",
] as const;

const reserved: ReadonlySet<string> = new Set(RESERVED_SLUGS);

export function isReservedSlug(slug: string): boolean {
  return reserved.has(slug.toLowerCase());
}
