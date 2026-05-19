import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getDashboardAgentMatrix, getDashboardAgentSummary } from "@/lib/ai-orchestration/dashboard-agents";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const agents = getDashboardAgentMatrix();

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    summary: getDashboardAgentSummary(agents),
    agents,
  });
}
