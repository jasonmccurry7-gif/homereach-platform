// POST /api/admin/seo-engine/pages/[id]/archive
//
// Transitions a page to archived regardless of prior status. Public URL
// immediately 404s; sitemap excludes on next regeneration.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { syncSeoPageLedger } from "@/lib/approvals/seo-ledger";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
    actorLabel: "seo_page_archive",
    eventType: "seo_page_archived",
  });
  if (!ledgerResult.ok) {
    console.warn("[approval-ledger] seo page archive sync skipped:", ledgerResult.error);
  }

  try {
    revalidatePath(`/${(data as { slug: string }).slug}`);
  } catch {
    // non-fatal
  }

  console.log(`[seo.page.archived] id=${id} actor=${admin.adminId}`);
  return NextResponse.json({ ok: true, row: data });
}
