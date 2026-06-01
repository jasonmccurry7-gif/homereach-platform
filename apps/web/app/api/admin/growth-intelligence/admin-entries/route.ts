import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import {
  hasGrowthIntelligencePersistence,
  isAdminIntelligenceEntriesEnabled,
  isGrowthIntelligenceEnabled,
} from "@/lib/growth-intelligence/config";
import { createAdminIntelligenceEntry } from "@/lib/growth-intelligence/engine";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: Request) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!isGrowthIntelligenceEnabled() || !isAdminIntelligenceEntriesEnabled()) {
    return NextResponse.json({ error: "Admin intelligence entries are disabled." }, { status: 404 });
  }

  if (!hasGrowthIntelligencePersistence()) {
    return NextResponse.json(
      { error: "Growth Intelligence persistence is not configured.", safeMode: true },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const entry = await createAdminIntelligenceEntry({
      supabase: createServiceClient(),
      actorUserId: user?.id ?? null,
      actorEmail: user?.email ?? null,
      input: body,
    });
    return NextResponse.json({ ok: true, entry });
  } catch (error) {
    console.error("[growth-intelligence/admin-entry] failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Admin intelligence entry creation failed" },
      { status: 500 },
    );
  }
}
