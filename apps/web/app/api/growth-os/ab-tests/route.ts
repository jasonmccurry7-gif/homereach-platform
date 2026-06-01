import { NextResponse } from "next/server";
import {
  createGrowthOsAbTest,
  getGrowthOsAbTests,
} from "@/lib/growth-os/ab-tests";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import { growthOsAbTestSchema } from "@/lib/growth-os/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const abTests = await getGrowthOsAbTests(user.id);
  return NextResponse.json({ abTests });
}

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

  const parsed = growthOsAbTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid A/B test" },
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

  const result = await createGrowthOsAbTest({
    userId: user.id,
    activeAppliedRecommendation: data.activeAppliedRecommendation,
    input: parsed.data,
  });

  if (result.error) {
    return NextResponse.json({ error: result.error, abTest: result.abTest }, { status: 409 });
  }

  return NextResponse.json({ abTest: result.abTest, saved: true });
}
