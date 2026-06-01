import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { hasAdTechPersistence, isReportingImportsEnabled } from "@/lib/ad-tech/config";
import { saveReportingImport } from "@/lib/ad-tech/engine";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";

export async function POST(request: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!isReportingImportsEnabled()) {
    return NextResponse.json({ error: "Ad-Tech reporting imports are disabled." }, { status: 404 });
  }

  if (!hasAdTechPersistence()) {
    return NextResponse.json(
      { error: "Ad-Tech persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

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
