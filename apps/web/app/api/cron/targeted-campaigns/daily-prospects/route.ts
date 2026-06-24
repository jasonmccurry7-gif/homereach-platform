import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { generateTargetedOutreachPlan } from "@/lib/daily-outreach/targeted-plan";
import { todayKey } from "@/lib/daily-outreach/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const guard = await requireAdminOrCron(request);
  if (!guard.ok) return guard.response;

  try {
    const payload = await generateTargetedOutreachPlan(todayKey(), null, {
      refreshExternalProspects: true,
      forceTopUp: true,
    });
    return NextResponse.json({ ok: true, payload });
  } catch (error) {
    console.error("[targeted-campaigns-daily-prospects] failed", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Targeted campaign daily prospect generation failed" },
      { status: 500 },
    );
  }
}
