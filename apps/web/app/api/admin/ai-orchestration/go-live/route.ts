import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { getGoLiveReadinessReport } from "@/lib/ai-orchestration/go-live-readiness";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  try {
    const readiness = await getGoLiveReadinessReport();
    return NextResponse.json({ ok: true, readiness });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unable to load go-live readiness.",
      },
      { status: 500 }
    );
  }
}
