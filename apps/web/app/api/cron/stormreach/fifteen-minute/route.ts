import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runStormReachOverdriveMode, stormReachOverdriveEnabled } from "@/lib/stormreach/overdrive";
import { runStormReachScheduledJob } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const result = stormReachOverdriveEnabled()
    ? await runStormReachOverdriveMode({ actor: { label: "stormreach_overdrive_cron" } })
    : await runStormReachScheduledJob("fifteen_minute");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
