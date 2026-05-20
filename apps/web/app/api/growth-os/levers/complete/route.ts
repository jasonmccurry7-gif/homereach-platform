import { NextResponse } from "next/server";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { completeGrowthOsActiveLever } from "@/lib/growth-os/impact";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";

export const dynamic = "force-dynamic";

export async function POST() {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getGrowthOsPhase1Data(user.id);
  if (!data.profile) {
    return NextResponse.json(
      { error: "Business profile is required first" },
      { status: 409 }
    );
  }

  if (!data.activeAppliedRecommendation) {
    return NextResponse.json(
      { error: "No active lever to complete" },
      { status: 404 }
    );
  }

  const result = await completeGrowthOsActiveLever({
    userId: user.id,
    activeAppliedRecommendation: data.activeAppliedRecommendation,
    weeklyInputs: data.weeklyInputs,
  });

  return NextResponse.json({
    impact: result.calculation,
    impactTracking: result.impactTracking,
    completed: true,
  });
}
