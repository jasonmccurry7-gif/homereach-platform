import { NextResponse } from "next/server";
import { requireRole, roleOf } from "@/lib/auth/api-guards";
import {
  hasGrowthIntelligencePersistence,
  isGrowthIntelligenceEnabled,
} from "@/lib/growth-intelligence/config";
import {
  loadAdminGrowthIntelligenceCenter,
  loadClientGrowthIntelligenceCenter,
} from "@/lib/growth-intelligence/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isGrowthIntelligenceEnabled()) {
    return NextResponse.json({ error: "Growth Intelligence is disabled." }, { status: 404 });
  }

  const guard = await requireRole(["admin", "sales_agent", "client"]);
  if (!guard.ok) return guard.response;

  if (!hasGrowthIntelligencePersistence()) {
    return NextResponse.json(
      { error: "Growth Intelligence persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = roleOf(user);
  const url = new URL(request.url);
  const requestedScope = url.searchParams.get("scope")?.trim().toLowerCase();
  const adminScope = requestedScope === "admin";

  if (adminScope && role === "client") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();

    if (adminScope && (role === "admin" || role === "sales_agent")) {
      const data = await loadAdminGrowthIntelligenceCenter({ supabase, autoSync: false });
      return NextResponse.json({
        ok: true,
        scope: "admin",
        readOnly: true,
        approvalRequiredBeforeExecution: true,
        noAutonomousOutreach: true,
        noCampaignLaunchWithoutApproval: true,
        ...data,
      });
    }

    const data = await loadClientGrowthIntelligenceCenter({
      supabase,
      user: { id: user.id, email: user.email },
      autoSync: false,
    });

    return NextResponse.json({
      ok: true,
      scope: "client",
      readOnly: true,
      approvalRequiredBeforeExecution: true,
      noAutonomousOutreach: true,
      noCampaignLaunchWithoutApproval: true,
      ...data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Growth Intelligence opportunities failed.",
        safeMode: true,
        approvalRequiredBeforeExecution: true,
        noAutonomousOutreach: true,
        noCampaignLaunchWithoutApproval: true,
      },
      { status: 500 },
    );
  }
}
