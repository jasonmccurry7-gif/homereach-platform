import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth/api-guards";
import { runGovContractsSamSync } from "@/lib/gov-contracts/sync";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  const guard = requireCron(req);
  if (!guard.ok) return guard.response;

  const result = await runGovContractsSamSync({
    state: "OH",
    focus: "home_services",
    limit: 30,
    source: "cron_home_services",
  });

  return NextResponse.json(result, { status: result.status });
}
