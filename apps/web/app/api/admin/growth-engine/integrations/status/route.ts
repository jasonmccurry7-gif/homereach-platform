import { NextResponse } from "next/server";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { getGrowthIntegrationStatuses } from "@/lib/growth-engine/integrations";
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
      generatedAt: new Date().toISOString(),
      integrations: getGrowthIntegrationStatuses(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
