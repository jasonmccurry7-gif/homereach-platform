import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getUnifiedActionCenter } from "@/lib/ai-orchestration/action-center";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "24");
  const actionCenter = await getUnifiedActionCenter(Number.isFinite(limit) ? limit : 24);

  return NextResponse.json({
    ok: true,
    ...actionCenter,
  });
}
