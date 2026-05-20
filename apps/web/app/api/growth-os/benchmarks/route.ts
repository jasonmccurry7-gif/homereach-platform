import { NextResponse } from "next/server";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getGrowthOsBenchmarksForProfile } from "@/lib/growth-os/benchmarks";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsProfile } from "@/lib/growth-os/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getGrowthOsProfile(user.id);
  if (!profile) {
    return NextResponse.json(
      { error: "Business profile is required first" },
      { status: 409 }
    );
  }

  const benchmarks = await getGrowthOsBenchmarksForProfile({
    businessType: profile.businessType,
    weeklyRevenueCents: profile.weeklyRevenueCents,
    locationZip: profile.locationZip,
  });

  return NextResponse.json({ benchmarks });
}
