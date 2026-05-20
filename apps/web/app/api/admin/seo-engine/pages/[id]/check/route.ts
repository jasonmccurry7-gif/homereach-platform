// POST /api/admin/seo-engine/pages/[id]/check
//
// Runs the quality gate: DB-side checks via seo_pages_quality_check RPC
// plus a live HEAD request against primary_cta_url. Result persisted in
// seo_pages.quality_check.

import { NextResponse, type NextRequest } from "next/server";
import { seoFlagGate, requireAdmin } from "@/lib/seo/guards";
import { runFullQualityCheck } from "@/lib/seo/quality";

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
    .select("id, primary_cta_url")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!page) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });

  const result = await runFullQualityCheck(id, (page as { primary_cta_url: string | null }).primary_cta_url);

  // Persist the combined result (DB fn already persisted its part; we overwrite with CTA included)
  await admin.supa.from("seo_pages").update({ quality_check: result }).eq("id", id);

  return NextResponse.json({ ok: true, result });
}
