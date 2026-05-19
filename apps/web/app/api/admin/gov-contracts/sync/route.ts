import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { getGovContractsSyncReadiness, runGovContractsSamSync } from "@/lib/gov-contracts/sync";

export async function GET(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;
  const readiness = getGovContractsSyncReadiness();

  return NextResponse.json({
    ok: true,
    samConfigured: readiness.samConfigured,
    databaseConfigured: readiness.databaseConfigured,
    message: readiness.samConfigured
      ? "SAM.gov sync is configured."
      : "SAM_GOV_API_KEY is required before live opportunity sync can run.",
  });
}

export async function POST(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const body = (await req.json().catch(() => ({}))) as {
    keyword?: string;
    state?: string;
    naics?: string;
    psc?: string;
    setAside?: string;
    noticeType?: string;
    focus?: string;
    limit?: number;
  };

  const result = await runGovContractsSamSync({ ...body, source: "manual" });
  return NextResponse.json(result, { status: result.status });
}
