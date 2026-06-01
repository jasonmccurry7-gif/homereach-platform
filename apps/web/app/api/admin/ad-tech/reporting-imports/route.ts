import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { saveReportingImport } from "@/lib/ad-tech/engine";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";

export async function POST(request: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const privileged = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "ad_tech_reporting_import",
    route: "/api/admin/ad-tech/reporting-imports",
  });

  try {
    const input = await request.json().catch(() => ({}));
    const row = await saveReportingImport({
      supabase: privileged.supabase,
      input,
      importedBy: privileged.actor.label,
    });
    return NextResponse.json({ ok: true, row });
  } catch (error) {
    console.error("[ad-tech/reporting-imports] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reporting import failed" },
      { status: 500 },
    );
  }
}
