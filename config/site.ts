export const siteConfig = {
  name: "Vurlo",
  tagline: "Simple to create. Powerful to manage. Useful after the click.",
  description:
    "Vurlo is a URL shortening and lightweight link management platform.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export type SiteConfig = typeof siteConfig;
