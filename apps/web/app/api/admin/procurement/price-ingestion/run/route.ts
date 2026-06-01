import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { runDailyPriceIngestion } from "@/lib/operations-copilot/price-ingestion";

export async function GET(request: NextRequest) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const result = await runDailyPriceIngestion({ dryRun: false });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  const body = await request.json().catch(() => ({}));
  const result = await runDailyPriceIngestion({
    dryRun: Boolean(body?.dryRun),
  });

  return NextResponse.json(result);
}
