import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getUserActionReadiness } from "@/lib/ai-orchestration/user-action-items";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    ...getUserActionReadiness(),
  });
}
