import { NextResponse } from "next/server";
import {
  agentDefinitions,
  ctaAuditBlueprint,
  growthEngineBlueprint,
  growthEngineSections,
  integrationRequirements,
  revenuePathTest,
  reviewQueueBlueprint,
  topRevenuePages,
} from "@/lib/growth-engine/blueprint";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { requireAdmin } from "@/lib/seo/guards";

export async function GET() {
  if (!isGrowthEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  return NextResponse.json(
    {
      blueprint: growthEngineBlueprint,
      sections: growthEngineSections,
      topRevenuePages,
      reviewQueue: reviewQueueBlueprint,
      integrations: integrationRequirements,
      ctaAudit: ctaAuditBlueprint,
      revenuePathTest,
      agents: agentDefinitions,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
