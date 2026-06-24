import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runStormReachScheduledJob } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const result = await runStormReachScheduledJob("three_hour");
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
