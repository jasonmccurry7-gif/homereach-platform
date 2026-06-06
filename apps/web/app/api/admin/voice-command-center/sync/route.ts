import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { syncActionQueueFromApprovalSpine } from "@/lib/voice-command-center/repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const result = await syncActionQueueFromApprovalSpine(guard.user?.id ?? null);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
