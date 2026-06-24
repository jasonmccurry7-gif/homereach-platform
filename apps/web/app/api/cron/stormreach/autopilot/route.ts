import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runStormReachAutopilot } from "@/lib/stormreach/autopilot";
import { stormReachRuntimeVerified } from "@/lib/stormreach/approval-and-send-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;
  if (!stormReachRuntimeVerified()) {
    return NextResponse.json(
      {
        ok: false,
        error: "Runtime verification is required before StormReach autopilot can run.",
        approvalRequired: true,
      },
      { status: 412 },
    );
  }

  const result = await runStormReachAutopilot({ actor: { label: "stormreach_autopilot_cron" } });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
