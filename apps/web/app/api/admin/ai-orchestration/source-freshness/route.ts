import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getSourceFreshnessReport } from "@/lib/ai-orchestration/source-freshness";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    ...(await getSourceFreshnessReport()),
  });
}
