import { NextResponse } from "next/server";
import { applyGrowthOsRecommendation } from "@/lib/growth-os/apply";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import { generateGrowthOsRecommendations } from "@/lib/growth-os/recommendations";
import { applyRecommendationSchema } from "@/lib/growth-os/validators";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = applyRecommendationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid recommendation" },
      { status: 400 }
    );
  }

  const data = await getGrowthOsPhase1Data(user.id);
  if (!data.profile) {
    return NextResponse.json(
      { error: "Business profile is required first" },
      { status: 409 }
    );
  }

  if (data.activeAppliedRecommendation) {
    return NextResponse.json(
      {
        error: "An active lever already exists",
        activeAppliedRecommendation: data.activeAppliedRecommendation,
      },
      { status: 409 }
    );
  }

  const recommendations = await generateGrowthOsRecommendations({
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
  });
  const recommendation = recommendations.find(
    (item) => item.triggerKey === parsed.data.triggerKey
  );

  if (!recommendation) {
    return NextResponse.json(
      { error: "Recommendation is no longer available" },
      { status: 404 }
    );
  }

  const result = await applyGrowthOsRecommendation({
    userId: user.id,
    profile: data.profile,
    weeklyInputs: data.weeklyInputs,
    recommendation,
  });

  if (result.alreadyActive) {
    return NextResponse.json(
      {
        error: "An active lever already exists",
        activeAppliedRecommendation: result.activeAppliedRecommendation,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    appliedRecommendation: result.appliedRecommendation,
    recommendation: result.recommendation,
    saved: true,
  });
}
