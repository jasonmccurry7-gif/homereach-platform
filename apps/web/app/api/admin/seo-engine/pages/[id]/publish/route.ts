// POST /api/admin/seo-engine/pages/[id]/publish
//
// Transitions an approved page to published. Re-runs:
//   - quality check (DB fn + CTA HEAD)
//   - inventory_ok
//   - published-cap check
//   - 24h publish rate limit
// and emits a seo.page.published log entry. Calls revalidatePath() for the
// slug so the Next.js route cache reflects the new content.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";
import { runFullQualityCheck } from "@/lib/seo/quality";
import { isInventoryAvailable } from "@/lib/seo/inventory-rules";
import { countPublished } from "@/lib/seo/registry";
import { getPublishedCap, getPublishRateLimit } from "@/lib/seo/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;

  const { data: page, error } = await admin.supa
    .from("seo_pages")
    .select("id, status, slug, city_id, category_id, primary_cta_url, content_blocks")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  type PageRow = {
    id: string;
    status: string;
    slug: string;
    city_id: string;
    category_id: string | null;
    primary_cta_url: string | null;
    content_blocks: Array<{ kind?: string }>;
  };
  const p = page as PageRow;

  if (p.status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_approved", current_status: p.status }, { status: 409 });
  }

  // Quality re-check
  const qc = await runFullQualityCheck(id, p.primary_cta_url);
  if (!qc.passed) {
    return NextResponse.json({ ok: false, error: "quality_check_failed", issues: qc.issues }, { status: 409 });
  }

  // Inventory re-check (waitlist block bypass)
  const hasWaitlist = Array.isArray(p.content_blocks) && p.content_blocks.some((b) => b?.kind === "waitlist");
  const invOk = await isInventoryAvailable(p.city_id, p.category_id);
  if (!invOk && !hasWaitlist) {
    return NextResponse.json({ ok: false, error: "inventory_locked_without_waitlist" }, { status: 409 });
  }

  // Published-cap
  const cap = getPublishedCap();
  const currentPublished = await countPublished();
  if (currentPublished >= cap) {
    return NextResponse.json({ ok: false, error: "published_cap_reached", cap, current: currentPublished }, { status: 409 });
  }

  // 24h rate limit
  const rateLimit = getPublishRateLimit();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentPublishes } = await admin.supa
    .from("seo_pages")
    .select("*", { count: "exact", head: true })
    .eq("status", "published")
    .gte("published_at", since);
  if ((recentPublishes ?? 0) >= rateLimit) {
    return NextResponse.json({ ok: false, error: "publish_rate_limit_exceeded", limit: rateLimit, window: "24h" }, { status: 429 });
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updErr } = await admin.supa
    .from("seo_pages")
    .update({ status: "published", published_at: nowIso })
    .eq("id", id)
    .select("id, slug, published_at")
    .maybeSingle();

  if (updErr || !updated) {
    return NextResponse.json({ ok: false, error: updErr?.message ?? "publish_failed" }, { status: 500 });
  }

  // Revalidate the route cache so public render reflects new state
  try {
    revalidatePath(`/${p.slug}`);
  } catch {
    // non-fatal; Next.js revalidation may fail in edge cases
  }

  console.log(`[seo.page.published] id=${id} slug=${p.slug} actor=${admin.adminId} at=${nowIso}`);

  return NextResponse.json({ ok: true, row: updated });
}
