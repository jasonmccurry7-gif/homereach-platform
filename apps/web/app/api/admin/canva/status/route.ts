import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { buildHomeReachCanvaOperatingModel } from "@/lib/canva/orchestrator";
import { loadCanvaStoredConnectionStatus } from "@/lib/canva/repository";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    canva: buildHomeReachCanvaOperatingModel(),
    storedConnection: await loadCanvaStoredConnectionStatus(),
  });
}
