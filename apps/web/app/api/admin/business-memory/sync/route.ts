import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { hasBusinessMemoryPersistence, isBusinessMemoryEnabled } from "@/lib/business-memory/config";
import { ensureBusinessMemoryForAll } from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST() {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!isBusinessMemoryEnabled()) {
    return NextResponse.json({ ok: false, error: "Business Memory is disabled." }, { status: 404 });
  }

  if (!hasBusinessMemoryPersistence()) {
    return NextResponse.json(
      { ok: false, error: "Business Memory persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  try {
    const result = await ensureBusinessMemoryForAll({ supabase: createServiceClient() });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Business Memory sync failed." },
      { status: 500 },
    );
  }
}
