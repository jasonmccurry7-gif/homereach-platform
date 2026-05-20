import { NextResponse } from "next/server";
import { evaluateGrowthOsActiveAbTest } from "@/lib/growth-os/ab-tests";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
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

  const result = await evaluateGrowthOsActiveAbTest({
    userId: user.id,
    weeklyInputs: data.weeklyInputs,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ abTest: result.abTest, evaluated: true });
}
