import type { MetadataRoute } from "next";
import { createServiceClient } from "@/lib/supabase/service";
import { listGrowthServiceModules } from "@/lib/growth-execution/services";
import { listPublishedPages } from "@/lib/seo/registry";
import { listAllAuthorityRoutes } from "@/lib/seo/authority";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach sitemap
//
// Emits:
//   - Static marketing routes (constant list below)
//   - /[slug] city-category URLs for combinations that (a) have an active city
//     in the DB, (b) have a matching category in the DB, and (c) are NOT
//     currently locked in spot_assignments with status in ('pending','active').
//   - Published seo_pages URLs when ENABLE_SEO_ENGINE is on (returns [] off).
//
// The filter honors the inventory-truth rule: we do not advertise URLs that
// the hardcoded /[slug] page will render as available when the DB says the
// slot is sold. If DB reads fail we degrade to static-only (safer than
// emitting stale URLs).
//
// SLUG_CITIES / SLUG_CATEGORIES must be kept in sync with the CITIES and
// CATEGORIES objects in app/[slug]/page.tsx. Drift between them means the
// sitemap can list URLs that the /[slug] route will 404 for.
// ─────────────────────────────────────────────────────────────────────────────

const SLUG_CITIES = new Set([
  "wooster", "medina", "ashland", "mansfield", "mount-vernon",
  "coshocton", "millersburg", "loudonville", "orrville", "rittman", "dover",
]);

const SLUG_CATEGORIES = new Set([
  "roofing", "hvac", "plumbing", "landscaping", "pressure-washing",
  "painting", "electrical", "concrete-masonry", "junk-removal",
  "windows-doors", "garage-doors", "home-remodeling",
]);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`,              lastModified: now, changeFrequency: "monthly", priority: 1.0 },
    { url: `${base}/how-it-works`,  lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/shared-postcards`, lastModified: now, changeFrequency: "monthly", priority: 0.84 },
    { url: `${base}/targeted`,      lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/digital-targeting`, lastModified: now, changeFrequency: "monthly", priority: 0.82 },
    { url: `${base}/political`,     lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/ohio`,          lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/political-mail`, lastModified: now, changeFrequency: "weekly", priority: 0.86 },
    { url: `${base}/contractos`, lastModified: now, changeFrequency: "weekly", priority: 0.82 },
    { url: `${base}/contractos/dashboard`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${base}/local-growth-os`, lastModified: now, changeFrequency: "monthly", priority: 0.82 },
    { url: `${base}/inventory-purchasing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/local-visibility`, lastModified: now, changeFrequency: "monthly", priority: 0.76 },
    { url: `${base}/services/ai-website-assistant`, lastModified: now, changeFrequency: "monthly", priority: 0.76 },
    { url: `${base}/property-intelligence`, lastModified: now, changeFrequency: "monthly", priority: 0.66 },
    { url: `${base}/intelligence`,  lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/services`,      lastModified: now, changeFrequency: "monthly", priority: 0.78 },
    { url: `${base}/nonprofit`,     lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/refer`,         lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/waitlist`,      lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/privacy`,       lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/terms`,         lastModified: now, changeFrequency: "yearly",  priority: 0.2 },
    { url: `${base}/os`,            lastModified: now, changeFrequency: "monthly", priority: 0.3 },
  ];

  const serviceRoutes: MetadataRoute.Sitemap = listGrowthServiceModules()
    .filter((service) => service.publicExposure !== "admin_only")
    .map((service) => ({
      url: `${base}${service.publicPath}`,
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: service.publicExposure === "core_public" ? 0.84 : 0.72,
    }));

  let slugRoutes: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServiceClient();
    const [citiesRes, categoriesRes, assignmentsRes] = await Promise.all([
      supabase.from("cities").select("id, slug, is_active").eq("is_active", true),
      supabase.from("categories").select("id, slug"),
      supabase
        .from("spot_assignments")
        .select("city_id, category_id")
        .in("status", ["pending", "active"]),
    ]);

    const cities = (citiesRes.data ?? []).filter((c) => SLUG_CITIES.has(c.slug));
    const categories = (categoriesRes.data ?? []).filter((cat) => SLUG_CATEGORIES.has(cat.slug));

    const lockedPairs = new Set<string>();
    for (const row of assignmentsRes.data ?? []) {
      lockedPairs.add(`${row.city_id}:${row.category_id}`);
    }

    for (const city of cities) {
      for (const category of categories) {
        if (lockedPairs.has(`${city.id}:${category.id}`)) continue;
        slugRoutes.push({
          url: `${base}/${city.slug}-${category.slug}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.7,
        });
      }
    }
  } catch {
    // DB read failure: degrade to static-only. Safer than emitting stale
    // URLs that may contradict live inventory.
    slugRoutes = [];
  }

  const authorityRoutes: MetadataRoute.Sitemap = listAllAuthorityRoutes()
    .filter((route) => route.path !== "/ohio")
    .map((route) => ({
      url: `${base}${route.path}`,
      lastModified: now,
      changeFrequency: route.type === "dataset" || route.type === "guide" ? "monthly" : "weekly",
      priority: route.priority,
    }));

  // SEO engine: include published seo_pages URLs. Returns [] when
  // ENABLE_SEO_ENGINE is off, so flag-off preserves the pre-engine sitemap.
  let seoEngineRoutes: MetadataRoute.Sitemap = [];
  try {
    const published = await listPublishedPages();
    seoEngineRoutes = published.map((page) => ({
      url: `${base}/${page.slug}`,
      lastModified: page.updated_at ? new Date(page.updated_at) : now,
      changeFrequency: "weekly" as const,
      priority: page.page_type === "city_category" ? 0.9 : 0.7,
    }));
  } catch {
    seoEngineRoutes = [];
  }

  return dedupeSitemap([...staticRoutes, ...serviceRoutes, ...slugRoutes, ...authorityRoutes, ...seoEngineRoutes]);
}

function dedupeSitemap(routes: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const byUrl = new Map<string, MetadataRoute.Sitemap[number]>();
  for (const route of routes) {
    const existing = byUrl.get(route.url);
    if (!existing || Number(route.priority ?? 0) > Number(existing.priority ?? 0)) {
      byUrl.set(route.url, route);
    }
  }
  return Array.from(byUrl.values());
}
