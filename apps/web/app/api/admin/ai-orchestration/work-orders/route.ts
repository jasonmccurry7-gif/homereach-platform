import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getAgentWorkOrderQueue } from "@/lib/ai-orchestration/agent-work-orders";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const url = new URL(req.url);
    const limit = Number(url.searchParams.get("limit") ?? "18");
    const workOrders = await getAgentWorkOrderQueue(Number.isFinite(limit) ? limit : 18);
    return NextResponse.json({ ok: true, workOrders });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load agent work orders.",
      },
      { status: 500 }
    );
  }
}
