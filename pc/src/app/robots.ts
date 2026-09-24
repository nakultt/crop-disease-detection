import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Private, per-user pages: nothing for a crawler there.
      disallow: [
        "/api/",
        "/dashboard",
        "/scan",
        "/history",
        "/settings",
        "/admin",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
