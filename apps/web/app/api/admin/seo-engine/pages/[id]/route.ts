// GET + PATCH + DELETE /api/admin/seo-engine/pages/[id]
//
// GET: full row by id.
// PATCH: updates mutable content fields. Accepted keys:
//   title_tag, meta_description, h1, content_blocks, schema_ld,
//   internal_links, primary_cta_url.
// DELETE: soft-delete (sets status='archived').

import { NextResponse, type NextRequest } from "next/server";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";
import { syncSeoPageLedger } from "@/lib/approvals/seo-ledger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EDITABLE_FIELDS = [
  "title_tag",
  "meta_description",
  "h1",
  "content_blocks",
  "schema_ld",
  "internal_links",
  "primary_cta_url",
] as const;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  const { data, error } = await admin.supa.from("seo_pages").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, row: data });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;

  const { data: existing, error: existingError } = await admin.supa
    .from("seo_pages")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ ok: false, error: existingError.message }, { status: 500 });
  if (!existing) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const currentStatus = (existing as { status: string }).status;
  if (currentStatus === "published") {
    return NextResponse.json(
      { ok: false, error: "published_page_locked_use_revert_or_archive" },
      { status: 409 },
    );
  }
  if (currentStatus === "archived") {
    return NextResponse.json({ ok: false, error: "archived_page_locked" }, { status: 409 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) update[key] = body[key];
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: false, error: "no_editable_fields" }, { status: 400 });
  }

  // Derive h1_slug if h1 is being updated
  if (typeof update.h1 === "string") {
    (update as { h1_slug?: string | null }).h1_slug = slugifyH1(update.h1);
  }
  if (currentStatus === "approved") {
    update.status = "review";
    update.approved_by = null;
    update.approved_at = null;
    update.approval_notes = "Approval cleared because page content or metadata changed after approval.";
  }

  const { data, error } = await admin.supa
    .from("seo_pages")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const ledgerResult = await syncSeoPageLedger({
    id: String(data.id),
    slug: String(data.slug),
    pageType: String(data.page_type),
    status: String(data.status) as "draft" | "review" | "approved" | "published" | "archived",
    titleTag: typeof data.title_tag === "string" ? data.title_tag : null,
    metaDescription: typeof data.meta_description === "string" ? data.meta_description : null,
    h1: typeof data.h1 === "string" ? data.h1 : null,
    cityId: typeof data.city_id === "string" ? data.city_id : null,
    categoryId: typeof data.category_id === "string" ? data.category_id : null,
    approvedBy: typeof data.approved_by === "string" ? data.approved_by : null,
    approvedAt: typeof data.approved_at === "string" ? data.approved_at : null,
    approvalNotes: typeof data.approval_notes === "string" ? data.approval_notes : null,
    publishedAt: typeof data.published_at === "string" ? data.published_at : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  }, {
    actorId: admin.adminId,
    actorLabel: "seo_page_patch",
    eventType: "seo_page_updated",
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] seo page patch sync skipped:", ledgerResult.error);
  }

  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  const { data, error } = await admin.supa
    .from("seo_pages")
    .update({ status: "archived" })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const ledgerResult = await syncSeoPageLedger({
    id: String(data.id),
    slug: String(data.slug),
    pageType: String(data.page_type),
    status: "archived",
    titleTag: typeof data.title_tag === "string" ? data.title_tag : null,
    metaDescription: typeof data.meta_description === "string" ? data.meta_description : null,
    h1: typeof data.h1 === "string" ? data.h1 : null,
    cityId: typeof data.city_id === "string" ? data.city_id : null,
    categoryId: typeof data.category_id === "string" ? data.category_id : null,
    approvedBy: typeof data.approved_by === "string" ? data.approved_by : null,
    approvedAt: typeof data.approved_at === "string" ? data.approved_at : null,
    approvalNotes: typeof data.approval_notes === "string" ? data.approval_notes : null,
    publishedAt: typeof data.published_at === "string" ? data.published_at : null,
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : null,
  }, {
    actorId: admin.adminId,
    actorLabel: "seo_page_delete",
    eventType: "seo_page_archived",
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] seo page delete sync skipped:", ledgerResult.error);
  }

  return NextResponse.json({ ok: true, row: data });
}

function slugifyH1(h1: string): string {
  return h1
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 200);
}
