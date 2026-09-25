const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/** Short links live on the app's own origin for the MVP (no custom domains). */
function hostOf(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return "localhost:3000";
  }
}

export const siteConfig = {
  name: "Vurlo",
  tagline: "Simple to create. Powerful to manage. Useful after the click.",
  description:
    "Vurlo is a URL shortening and lightweight link management platform.",
  url,
  /** Host shown before the slug, e.g. "vurlo.app" in "vurlo.app/design". */
  shortLinkHost: hostOf(url),
} as const;

export type SiteConfig = typeof siteConfig;
