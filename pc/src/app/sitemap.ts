import type { MetadataRoute } from "next";
import { siteUrl } from "./lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const pages: [string, number][] = [
    ["", 1],
    ["/crops", 0.8],
    ["/about", 0.6],
    ["/sign-up", 0.5],
    ["/sign-in", 0.4],
    ["/privacy", 0.2],
    ["/terms", 0.2],
  ];
  return pages.map(([path, priority]) => ({
    url: `${base}${path}`,
    changeFrequency: "monthly",
    priority,
  }));
}
