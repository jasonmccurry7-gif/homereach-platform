// GET /api/admin/seo-engine/pages/[id]/preview?token=...
//
// Returns the draft page as JSON when the preview token is valid. Used by
// the preview-URL mechanism. Visual rendering happens in Step 10.

import { NextResponse, type NextRequest } from "next/server";
import { seoFlagGate } from "@/lib/seo/guards";
import { validatePreviewToken } from "@/lib/seo/preview";
import { getPageById } from "@/lib/seo/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = seoFlagGate();
  if (gate) return gate;

  const { id } = await ctx.params;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? "";
  if (!token) return new NextResponse("Not Found", { status: 404 });

  const result = validatePreviewToken(token, id);
  if (!result.valid) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const page = await getPageById(id);
  if (!page) return new NextResponse("Not Found", { status: 404 });

  return NextResponse.json({ ok: true, page, actor_id: result.actorId });
}
