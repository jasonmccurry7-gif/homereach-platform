import { NextResponse } from "next/server";
import { requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { isAiCooAdminQueueEnabled } from "@/lib/ai-coo/config";
import { ensureAiCooRecommendationsForAll } from "@/lib/ai-coo/recommendations";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isAiCooAdminQueueEnabled()) {
    return NextResponse.json({ error: "AI COO admin queue is disabled." }, { status: 404 });
  }

  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "AI COO persistence is not configured.", safeMode: true }, { status: 503 });
  }

  try {
    const result = await ensureAiCooRecommendationsForAll({
      supabase: createServiceClient(),
      limit: 200,
    });

    return NextResponse.json({
      ok: true,
      createdOrUpdated: result.createdOrUpdated,
      approvalRequired: true,
      noAutonomousAction: true,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "AI COO generation failed.",
        safeMode: true,
        approvalRequired: true,
        noAutonomousAction: true,
      },
      { status: 500 },
    );
  }
}
