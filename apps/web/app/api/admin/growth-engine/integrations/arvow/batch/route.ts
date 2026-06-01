import { NextRequest, NextResponse } from "next/server";
import { isGrowthEngineEnabled } from "@/lib/growth-engine/env";
import { createArvowBatch } from "@/lib/growth-engine/integrations";
import { requireAdmin } from "@/lib/seo/guards";

export async function POST(request: NextRequest) {
  if (!isGrowthEngineEnabled()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const admin = await requireAdmin();
  if (!admin.ok) {
    return admin.response;
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const result = await createArvowBatch({
    keyword: typeof input.keyword === "string" ? input.keyword : undefined,
    title: typeof input.title === "string" ? input.title : undefined,
    context: typeof input.context === "string" ? input.context : undefined,
    includeKeywords: Array.isArray(input.includeKeywords)
      ? input.includeKeywords.filter((item): item is string => typeof item === "string")
      : undefined,
    dryRun: input.dryRun !== false,
  });

  return NextResponse.json(result, {
    status: result.ok ? 200 : 409,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
