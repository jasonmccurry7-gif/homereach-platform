import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runStormReachScheduledJob, type StormReachScheduledJob } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

function parseJob(request: Request, fallback: StormReachScheduledJob = "hourly"): StormReachScheduledJob {
  const value = new URL(request.url).searchParams.get("job") ?? fallback;
  if (value === "fifteen_minute" || value === "three_hour" || value === "daily" || value === "weekly" || value === "hourly") return value;
  return fallback;
}

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const result = await runStormReachScheduledJob(parseJob(request));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

export async function POST(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({})) as { job?: StormReachScheduledJob };
  const result = await runStormReachScheduledJob(body.job ?? parseJob(request, "daily"));
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
