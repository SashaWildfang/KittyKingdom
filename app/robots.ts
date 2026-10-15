import type { MetadataRoute } from "next";

// Public pages can be indexed; private areas and APIs can't
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/account", "/reset-password", "/forgot-password"] }],
    sitemap: "https://bear-nation.net/sitemap.xml",
    host: "https://bear-nation.net",
  };
}
