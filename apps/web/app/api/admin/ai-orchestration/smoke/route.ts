import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getAiWorkforceSmokeReport } from "@/lib/ai-orchestration/ai-workforce-smoke";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    ...(await getAiWorkforceSmokeReport()),
  });
}
