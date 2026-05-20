import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getWorkflowRecipeCatalog } from "@/lib/ai-orchestration/workflow-recipes";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    catalog: getWorkflowRecipeCatalog(),
  });
}
