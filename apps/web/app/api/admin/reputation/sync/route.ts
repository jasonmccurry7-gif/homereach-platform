import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { ensureReputationForAll } from "@/lib/reputation/engine";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  try {
    const result = await ensureReputationForAll({
      supabase: createServiceClient(),
      limit: 300,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[reputation/sync] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Reputation sync failed" },
      { status: 500 },
    );
  }
}
