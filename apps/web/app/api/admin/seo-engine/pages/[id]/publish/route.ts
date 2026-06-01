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
import { syncSeoPageLedger } from "@/lib/approvals/seo-ledger";
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
    .select("id, status, slug, city_id, category_id, primary_cta_url, content_blocks, approved_by, approved_at")
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
    approved_by: string | null;
    approved_at: string | null;
  };
  const p = page as PageRow;

  if (p.status !== "approved") {
    return NextResponse.json({ ok: false, error: "not_approved", current_status: p.status }, { status: 409 });
  }
  if (!p.approved_by || !p.approved_at) {
    return NextResponse.json({ ok: false, error: "missing_approval_audit" }, { status: 409 });
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
    .select("*")
    .maybeSingle();

  if (updErr || !updated) {
    return NextResponse.json({ ok: false, error: updErr?.message ?? "publish_failed" }, { status: 500 });
  }

  const ledgerResult = await syncSeoPageLedger({
    id: String(updated.id),
    slug: String(updated.slug),
    pageType: String(updated.page_type),
    status: "published",
    titleTag: typeof updated.title_tag === "string" ? updated.title_tag : null,
    metaDescription: typeof updated.meta_description === "string" ? updated.meta_description : null,
    h1: typeof updated.h1 === "string" ? updated.h1 : null,
    cityId: typeof updated.city_id === "string" ? updated.city_id : null,
    categoryId: typeof updated.category_id === "string" ? updated.category_id : null,
    approvedBy: typeof updated.approved_by === "string" ? updated.approved_by : p.approved_by,
    approvedAt: typeof updated.approved_at === "string" ? updated.approved_at : p.approved_at,
    approvalNotes: typeof updated.approval_notes === "string" ? updated.approval_notes : null,
    publishedAt: typeof updated.published_at === "string" ? updated.published_at : nowIso,
    createdAt: typeof updated.created_at === "string" ? updated.created_at : null,
    updatedAt: typeof updated.updated_at === "string" ? updated.updated_at : null,
  }, {
    actorId: admin.adminId,
    actorLabel: "seo_page_publish",
    eventType: "seo_page_published",
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] seo page publish sync skipped:", ledgerResult.error);
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
