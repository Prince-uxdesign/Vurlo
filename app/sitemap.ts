import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

/**
 * The only public, indexable pages: marketing home, privacy, terms.
 * Everything else (app, auth, short links) is noindex by metadata and
 * disallowed in robots.txt, so it stays out of the sitemap by design.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${siteConfig.url}/`, lastModified: now },
    { url: `${siteConfig.url}/privacy`, lastModified: now },
    { url: `${siteConfig.url}/terms`, lastModified: now },
  ];
}
