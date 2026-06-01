import { NextResponse } from "next/server";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import {
  calculateGrowthOsRiskAlerts,
  refreshGrowthOsRiskAlerts,
} from "@/lib/growth-os/risk-alerts";

export const dynamic = "force-dynamic";

export async function GET() {
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

  const result = calculateGrowthOsRiskAlerts({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });

  return NextResponse.json({
    ...result,
    storedAlerts: data.riskAlerts,
  });
}

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

  const result = await refreshGrowthOsRiskAlerts({
    userId: user.id,
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });

  return NextResponse.json(result);
}
