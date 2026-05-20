// POST /api/admin/seo-engine/pages/[id]/archive
//
// Transitions a page to archived regardless of prior status. Public URL
// immediately 404s; sitemap excludes on next regeneration.

import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
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
    .select("id, slug, status")
    .maybeSingle();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  try {
    revalidatePath(`/${(data as { slug: string }).slug}`);
  } catch {
    // non-fatal
  }

  console.log(`[seo.page.archived] id=${id} actor=${admin.adminId}`);
  return NextResponse.json({ ok: true, row: data });
}
