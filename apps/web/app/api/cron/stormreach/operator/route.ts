import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runStormReachOperatorAgent } from "@/lib/stormreach/operator-agent";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const result = await runStormReachOperatorAgent({ actor: { label: "stormreach_operator_cron" } });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
