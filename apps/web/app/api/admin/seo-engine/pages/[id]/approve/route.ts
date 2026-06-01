// POST /api/admin/seo-engine/pages/[id]/approve
//
// Records explicit human approval for a draft/review SEO page and moves it
// to approved. The publish endpoint still re-runs quality, inventory,
// cap, and rate-limit checks before any public page goes live.

import { NextResponse, type NextRequest } from "next/server";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";
import { syncSeoPageLedger } from "@/lib/approvals/seo-ledger";
import { runFullQualityCheck } from "@/lib/seo/quality";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ApprovalBody = {
  approvalNotes?: string;
};

function asTrimmedString(value: unknown, max = 2000) {
  return typeof value === "string" ? value.trim().slice(0, max) : null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  let body: ApprovalBody = {};
  try {
    body = (await req.json()) as ApprovalBody;
  } catch {
    body = {};
  }

  const { data: page, error } = await admin.supa
    .from("seo_pages")
    .select("id, status, slug, primary_cta_url")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  type PageRow = {
    id: string;
    status: string;
    slug: string;
    primary_cta_url: string | null;
  };
  const p = page as PageRow;

  if (!["draft", "review"].includes(p.status)) {
    return NextResponse.json(
      { ok: false, error: "not_approvable_status", current_status: p.status },
      { status: 409 },
    );
  }

  const quality = await runFullQualityCheck(id, p.primary_cta_url);
  if (!quality.passed) {
    return NextResponse.json(
      { ok: false, error: "quality_check_failed", issues: quality.issues },
      { status: 409 },
    );
  }

  const nowIso = new Date().toISOString();
  const approvalNotes =
    asTrimmedString(body.approvalNotes) ??
    "Human approved this SEO page for publishing. Publish remains a separate explicit action.";

  const { data: updated, error: updateError } = await admin.supa
    .from("seo_pages")
    .update({
      status: "approved",
      approved_by: admin.adminId,
      approved_at: nowIso,
      approval_notes: approvalNotes,
      quality_check: quality,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  if (!updated) return NextResponse.json({ ok: false, error: "approval_failed" }, { status: 500 });

  const ledgerResult = await syncSeoPageLedger({
    id: String(updated.id),
    slug: String(updated.slug),
    pageType: String(updated.page_type),
    status: "approved",
    titleTag: typeof updated.title_tag === "string" ? updated.title_tag : null,
    metaDescription: typeof updated.meta_description === "string" ? updated.meta_description : null,
    h1: typeof updated.h1 === "string" ? updated.h1 : null,
    cityId: typeof updated.city_id === "string" ? updated.city_id : null,
    categoryId: typeof updated.category_id === "string" ? updated.category_id : null,
    approvedBy: typeof updated.approved_by === "string" ? updated.approved_by : null,
    approvedAt: typeof updated.approved_at === "string" ? updated.approved_at : nowIso,
    approvalNotes: typeof updated.approval_notes === "string" ? updated.approval_notes : approvalNotes,
    publishedAt: typeof updated.published_at === "string" ? updated.published_at : null,
    createdAt: typeof updated.created_at === "string" ? updated.created_at : null,
    updatedAt: typeof updated.updated_at === "string" ? updated.updated_at : null,
  }, {
    actorId: admin.adminId,
    actorLabel: "seo_page_approve",
    eventType: "seo_page_approved",
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] seo page approve sync skipped:", ledgerResult.error);
  }

  console.log(`[seo.page.approved] id=${id} slug=${p.slug} actor=${admin.adminId} at=${nowIso}`);
  return NextResponse.json({ ok: true, row: updated });
}
