const url = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function parse(value: string): URL {
  try {
    return new URL(value);
  } catch {
    return new URL("http://localhost:3000");
  }
}

const appUrl = parse(url);

// Display host for clean, compact vanity presentation (defaults to "vu", e.g. "vu/design")
const displayHost = process.env.NEXT_PUBLIC_SHORT_LINK_HOST ?? "vu";

export const siteConfig = {
  name: "Vurlo",
  tagline: "Simple to create. Powerful to manage. Useful after the click.",
  description:
    "Vurlo is a URL shortening and lightweight link management platform.",
  url,
  /** Scheme + host, e.g. "https://vurlo-app.vercel.app". Auth callbacks and short links are built on it. */
  origin: appUrl.origin,
  /** Host shown before the slug for display, e.g. "vu" in "vu/design". */
  shortLinkHost: displayHost,
} as const;

/** The absolute short URL that resolves, e.g. "https://vurlo.app/design". */
export const shortUrlFor = (slug: string) => `${siteConfig.origin}/${slug}`;

/** The short URL without its scheme, for display: "vu/design". */
export const displayUrlFor = (slug: string) => `${siteConfig.shortLinkHost}/${slug}`;
