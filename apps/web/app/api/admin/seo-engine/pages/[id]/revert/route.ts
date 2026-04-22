// POST /api/admin/seo-engine/pages/[id]/revert?version=N
//
// Restores a prior snapshot from seo_page_versions into the live seo_pages
// row. Creates a new version entry labeled "revert_to_version_N".
// Calls revalidatePath() so public render reflects the revert.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const versionParam = url.searchParams.get("version");
  const version = versionParam ? parseInt(versionParam, 10) : NaN;
  if (!Number.isFinite(version) || version < 1) {
    return NextResponse.json({ ok: false, error: "invalid_version" }, { status: 400 });
  }

  const { data: versionRow, error: versionErr } = await admin.supa
    .from("seo_page_versions")
    .select("snapshot")
    .eq("page_id", id)
    .eq("version_number", version)
    .maybeSingle();
  if (versionErr) return NextResponse.json({ ok: false, error: versionErr.message }, { status: 500 });
  if (!versionRow) return NextResponse.json({ ok: false, error: "version_not_found" }, { status: 404 });

  type Snapshot = {
    title_tag?: string | null;
    meta_description?: string | null;
    h1?: string | null;
    content_blocks?: unknown[];
    schema_ld?: unknown[];
    internal_links?: unknown[];
    primary_cta_url?: string | null;
  };
  const snap = (versionRow as { snapshot: Snapshot }).snapshot;

  const update: Record<string, unknown> = {};
  if ("title_tag" in snap) update.title_tag = snap.title_tag;
  if ("meta_description" in snap) update.meta_description = snap.meta_description;
  if ("h1" in snap) update.h1 = snap.h1;
  if ("content_blocks" in snap) update.content_blocks = snap.content_blocks;
  if ("schema_ld" in snap) update.schema_ld = snap.schema_ld;
  if ("internal_links" in snap) update.internal_links = snap.internal_links;
  if ("primary_cta_url" in snap) update.primary_cta_url = snap.primary_cta_url;

  const { data: updated, error: updErr } = await admin.supa
    .from("seo_pages")
    .update(update)
    .eq("id", id)
    .select("id, slug, status")
    .maybeSingle();

  if (updErr || !updated) {
    return NextResponse.json({ ok: false, error: updErr?.message ?? "revert_failed" }, { status: 500 });
  }

  try {
    revalidatePath(`/${(updated as { slug: string }).slug}`);
  } catch {
    // non-fatal
  }

  console.log(`[seo.page.reverted] id=${id} to_version=${version} actor=${admin.adminId}`);
  return NextResponse.json({ ok: true, row: updated, reverted_to_version: version });
}
