import { NextRequest, NextResponse } from "next/server";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { fetchBlotatoAccounts } from "@/lib/growth-engine/integrations";
import { requireAdmin } from "@/lib/seo/guards";

export async function GET(request: NextRequest) {
  if (!isGrowthEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  const platform = request.nextUrl.searchParams.get("platform") ?? undefined;
  const result = await fetchBlotatoAccounts(platform);

  return NextResponse.json(result, {
    status: result.ok ? 200 : 409,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
