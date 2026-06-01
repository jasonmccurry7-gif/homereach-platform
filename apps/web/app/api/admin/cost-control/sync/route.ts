import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { ensureCostControlForAll } from "@/lib/cost-control/engine";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  try {
    const result = await ensureCostControlForAll({
      supabase: createServiceClient(),
      limit: 300,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[cost-control/sync] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cost Control sync failed" },
      { status: 500 },
    );
  }
}
