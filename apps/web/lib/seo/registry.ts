// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Registry Reads
//
// Server-only. Uses Supabase service-role client (HTTP) to read seo_pages.
// Mirrors the pattern in lib/funnel/queries.ts.
//
// Every function early-returns when isSeoEngineEnabled() is false so that
// flag-off behavior is equivalent to "nothing exists".
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { isSeoEngineEnabled } from "./env";
import type { BlockInstance } from "./blocks";

export type SeoPageStatus = "draft" | "review" | "approved" | "published" | "archived";

export type SeoPage = {
  id: string;
  page_type: "city_category" | "city" | "targeted_route" | "featured";
  slug: string;
  city_id: string;
  category_id: string | null;
  tier: string | null;
  status: SeoPageStatus;
  title_tag: string | null;
  meta_description: string | null;
  h1: string | null;
  h1_slug: string | null;
  content_blocks: BlockInstance[];
  schema_ld: Record<string, unknown>[];
  internal_links: Array<{ text: string; href: string }>;
  primary_cta_url: string | null;
  quality_check: { passed: boolean; issues: string[]; checked_at: string | null };
  inventory_snapshot: Record<string, unknown>;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

function normalizeRow(row: Record<string, unknown>): SeoPage {
  return {
    id: row.id as string,
    page_type: row.page_type as SeoPage["page_type"],
    slug: row.slug as string,
    city_id: row.city_id as string,
    category_id: (row.category_id as string | null) ?? null,
    tier: (row.tier as string | null) ?? null,
    status: row.status as SeoPageStatus,
    title_tag: (row.title_tag as string | null) ?? null,
    meta_description: (row.meta_description as string | null) ?? null,
    h1: (row.h1 as string | null) ?? null,
    h1_slug: (row.h1_slug as string | null) ?? null,
    content_blocks: (row.content_blocks as BlockInstance[]) ?? [],
    schema_ld: (row.schema_ld as Record<string, unknown>[]) ?? [],
    internal_links: (row.internal_links as Array<{ text: string; href: string }>) ?? [],
    primary_cta_url: (row.primary_cta_url as string | null) ?? null,
    quality_check: (row.quality_check as SeoPage["quality_check"]) ?? { passed: false, issues: [], checked_at: null },
    inventory_snapshot: (row.inventory_snapshot as Record<string, unknown>) ?? {},
    published_at: (row.published_at as string | null) ?? null,
    created_by: (row.created_by as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

/** Fetches a single published seo_pages row by slug. Used by render routes. */
export async function getPublishedPageBySlug(slug: string): Promise<SeoPage | null> {
  if (!isSeoEngineEnabled()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error || !data) return null;
  return normalizeRow(data);
}

/** Fetches any seo_pages row by slug, regardless of status. Admin-only. */
export async function getPageBySlug(slug: string): Promise<SeoPage | null> {
  if (!isSeoEngineEnabled()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeRow(data);
}

/** Fetches any seo_pages row by id. */
export async function getPageById(id: string): Promise<SeoPage | null> {
  if (!isSeoEngineEnabled()) return null;
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeRow(data);
}

/** Lists published pages. Used by sitemap.ts once Step 10 ships. */
export async function listPublishedPages(): Promise<SeoPage[]> {
  if (!isSeoEngineEnabled()) return [];
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("seo_pages")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error || !data) return [];
  return data.map(normalizeRow);
}

/** Admin list with optional filters. */
export async function listPages(filters?: {
  status?: SeoPageStatus;
  page_type?: SeoPage["page_type"];
  city_id?: string;
  category_id?: string;
}): Promise<SeoPage[]> {
  if (!isSeoEngineEnabled()) return [];
  const supabase = createServiceClient();
  let q = supabase.from("seo_pages").select("*").order("created_at", { ascending: false });
  if (filters?.status) q = q.eq("status", filters.status);
  if (filters?.page_type) q = q.eq("page_type", filters.page_type);
  if (filters?.city_id) q = q.eq("city_id", filters.city_id);
  if (filters?.category_id) q = q.eq("category_id", filters.category_id);
  const { data, error } = await q;
  if (error || !data) return [];
  return data.map(normalizeRow);
}

/** Counts published pages. Used by the published-cap gate. */
export async function countPublished(): Promise<number> {
  if (!isSeoEngineEnabled()) return 0;
  const supabase = createServiceClient();
  const { count, error } = await supabase
    .from("seo_pages")
    .select("*", { count: "exact", head: true })
    .eq("status", "published");
  if (error) return 0;
  return count ?? 0;
}
