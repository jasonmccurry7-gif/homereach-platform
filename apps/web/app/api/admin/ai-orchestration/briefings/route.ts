import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getRecentDashboardMonitorRuns, getRecentOperationalBriefings } from "@/lib/ai-orchestration/briefings";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "4");
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 12) : 4;

  const [briefings, monitorRuns] = await Promise.all([
    getRecentOperationalBriefings(safeLimit),
    getRecentDashboardMonitorRuns(8),
  ]);

  return NextResponse.json({
    ok: true,
    briefings,
    monitorRuns,
  });
}
