import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getAgentMissionControl } from "@/lib/ai-orchestration/agent-mission-control";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const missionControl = await getAgentMissionControl();
    return NextResponse.json({ ok: true, missionControl });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load agent mission control.",
      },
      { status: 500 }
    );
  }
}
