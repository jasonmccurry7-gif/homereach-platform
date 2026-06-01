import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { ensureAdTechForAll } from "@/lib/ad-tech/engine";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";

export async function POST() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;
  const privileged = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "ad_tech_sync",
    route: "/api/admin/ad-tech/sync",
  });

  try {
    const result = await ensureAdTechForAll({
      supabase: privileged.supabase,
      limit: 250,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[ad-tech/sync] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ad-Tech sync failed" },
      { status: 500 },
    );
  }
}
