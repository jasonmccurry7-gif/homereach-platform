import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { loadFoundationControlTower } from "@/lib/control-tower/foundation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const data = await loadFoundationControlTower();
  return NextResponse.json(data);
}
