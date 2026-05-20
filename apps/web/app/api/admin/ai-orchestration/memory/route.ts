import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getOperationalMemory } from "@/lib/ai-orchestration/operational-memory";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? "30");
  const memory = await getOperationalMemory(Number.isFinite(limit) ? limit : 30);

  return NextResponse.json({
    ok: true,
    ...memory,
  });
}
