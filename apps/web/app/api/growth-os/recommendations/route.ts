import { NextResponse } from "next/server";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import {
  generateGrowthOsRecommendations,
  persistGrowthOsRecommendations,
} from "@/lib/growth-os/recommendations";

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

  const recommendations = await generateGrowthOsRecommendations({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });

  return NextResponse.json({ recommendations });
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

  const recommendations = await generateGrowthOsRecommendations({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });
  const savedRecommendations = await persistGrowthOsRecommendations(
    user.id,
    recommendations
  );

  return NextResponse.json({
    recommendations,
    savedRecommendations,
    saved: true,
  });
}
