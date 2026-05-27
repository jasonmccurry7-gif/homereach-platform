import type { MetadataRoute } from "next";
import { getPublicAppBaseUrl } from "@/lib/runtime/app-url";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach robots.txt
//
// Allow public marketing + informational routes.
// Disallow admin surfaces, API endpoints, auth/intake token paths, and the
// checkout sub-pages of both funnels (the entry and step pages of the funnel
// remain crawlable; only the payment pages are hidden).
// ─────────────────────────────────────────────────────────────────────────────

export default function robots(): MetadataRoute.Robots {
  const base = getPublicAppBaseUrl();
  return {
    rules: {
      userAgent: "*",
      allow: ["/"],
      disallow: [
        "/api/",
        "/admin/",
        "/agent/",
        "/dashboard/",
        "/intake/",
        "/get-started/*/checkout",
        "/targeted/checkout",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
