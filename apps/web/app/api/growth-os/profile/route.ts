import { NextResponse } from "next/server";
import {
  db,
  fsgosBusinessProfiles,
  fsgosUserState,
} from "@homereach/db";
import { sql } from "drizzle-orm";
import { businessProfileSchema } from "@/lib/growth-os/validators";
import { dollarsToCents } from "@/lib/growth-os/metrics";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getGrowthOsProfile } from "@/lib/growth-os/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getGrowthOsProfile(user.id);
  return NextResponse.json({ profile });
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

  const parsed = businessProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid profile" },
      { status: 400 }
    );
  }

  const now = new Date();
  const input = parsed.data;
  const profilePayload = {
    userId: user.id,
    companyName: input.companyName,
    locationZip: input.locationZip,
    businessType: input.businessType,
    weeklyRevenueCents: dollarsToCents(input.weeklyRevenue),
    avgOrderValueCents: dollarsToCents(input.avgOrderValue),
    dailyCustomers: input.dailyCustomers,
    laborCostWeeklyCents: dollarsToCents(input.laborCostWeekly),
    ingredientCostWeeklyCents: dollarsToCents(input.ingredientCostWeekly),
    overheadMonthlyCents: dollarsToCents(input.overheadMonthly),
    ownerGoal: input.ownerGoal,
    timezone: input.timezone,
    updatedAt: now,
  };

  const [profile] = await db
    .insert(fsgosBusinessProfiles)
    .values({
      ...profilePayload,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: fsgosBusinessProfiles.userId,
      set: profilePayload,
    })
    .returning();

  await db
    .insert(fsgosUserState)
    .values({
      userId: user.id,
      onboardingCompletedAt: now,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: fsgosUserState.userId,
      set: {
        onboardingCompletedAt: sql`coalesce(${fsgosUserState.onboardingCompletedAt}, ${now})`,
        updatedAt: now,
      },
    });

  return NextResponse.json({ profile, saved: true });
}
