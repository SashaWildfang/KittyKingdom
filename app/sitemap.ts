import type { MetadataRoute } from "next";
import { publishedNews } from "../lib/news";

const SITE = "https://www.kittykingdom.net";

export const dynamic = "force-dynamic";

/** Every public page plus each news post, so search engines find them. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, changeFrequency: "daily", priority: 1, lastModified: now },
    { url: `${SITE}/news`, changeFrequency: "daily", priority: 0.8, lastModified: now },
    { url: `${SITE}/faq`, changeFrequency: "weekly", priority: 0.8, lastModified: now },
    { url: `${SITE}/register`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE}/support`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE}/appeals`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.2 },
  ];
  const posts = await publishedNews({ limit: 200 }).catch(() => []);
  return [...pages, ...posts.map((p) => ({ url: `${SITE}/news/${p.id}`, lastModified: new Date(p.updatedAt ?? p.publishedAt), changeFrequency: "monthly" as const, priority: 0.6 }))];
}
