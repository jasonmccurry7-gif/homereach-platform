import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getEmailInfrastructureAudit } from "@/lib/email-infrastructure/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const audit = await getEmailInfrastructureAudit();
  return NextResponse.json(audit);
}
