import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * Crawlers may index the marketing page only. App, auth, and short-link
 * routes carry `robots: noindex` in their own metadata (verified in the
 * launch audit); this file states the same at the host level as backup.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/dashboard", "/links", "/account", "/settings", "/api", "/auth", "/showcase"],
      },
    ],
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
