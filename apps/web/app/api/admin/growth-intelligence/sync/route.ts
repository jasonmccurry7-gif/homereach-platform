import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import {
  hasGrowthIntelligencePersistence,
  isGrowthIntelligenceEnabled,
} from "@/lib/growth-intelligence/config";
import { ensureGrowthIntelligenceForAll } from "@/lib/growth-intelligence/engine";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!isGrowthIntelligenceEnabled()) {
    return NextResponse.json({ error: "Growth Intelligence is disabled." }, { status: 404 });
  }

  if (!hasGrowthIntelligencePersistence()) {
    return NextResponse.json(
      { error: "Growth Intelligence persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  try {
    const result = await ensureGrowthIntelligenceForAll({
      supabase: createServiceClient(),
      limit: 300,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[growth-intelligence/sync] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Growth Intelligence sync failed" },
      { status: 500 },
    );
  }
}
