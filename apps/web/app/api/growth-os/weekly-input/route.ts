import { NextResponse } from "next/server";
import {
  db,
  fsgosUserState,
  fsgosWeeklyInputs,
} from "@homereach/db";
import { eq } from "drizzle-orm";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { isGrowthOsEnabled } from "@/lib/growth-os/feature-flag";
import {
  calculateAovCents,
  computeWeeklyStreak,
  dollarsToCents,
  getCurrentWeekStartDate,
} from "@/lib/growth-os/metrics";
import { getGrowthOsProfile, getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import {
  normalizeContextFlags,
  weeklyInputSchema,
} from "@/lib/growth-os/validators";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isGrowthOsEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getGrowthOsSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const data = await getGrowthOsPhase1Data(user.id);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = weeklyInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid weekly input" },
      { status: 400 }
    );
  }

  const input = parsed.data;
  const now = new Date();
  const weekStartDate = input.weekStartDate ?? getCurrentWeekStartDate(now);
  const weeklyRevenueCents = dollarsToCents(input.weeklyRevenue);
  const weeklyOrders = input.weeklyOrders;
  const weeklyPayload = {
    userId: user.id,
    weekStartDate,
    weeklyRevenueCents,
    weeklyOrders,
    weeklyLaborCostCents: dollarsToCents(input.weeklyLaborCost),
    weeklyIngredientCostCents: dollarsToCents(input.weeklyIngredientCost),
    weeklyWasteEstimateCents: dollarsToCents(input.weeklyWasteEstimate),
    avgOrderValueCents: calculateAovCents(weeklyRevenueCents, weeklyOrders),
    notes: input.notes || null,
    contextFlags: normalizeContextFlags(input.contextFlags),
    sameAsPrevious: input.sameAsPrevious,
    updatedAt: now,
  };

  const [weeklyInput] = await db
    .insert(fsgosWeeklyInputs)
    .values({
      ...weeklyPayload,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: [fsgosWeeklyInputs.userId, fsgosWeeklyInputs.weekStartDate],
      set: weeklyPayload,
    })
    .returning();

  const allWeeks = await db
    .select({ weekStartDate: fsgosWeeklyInputs.weekStartDate })
    .from(fsgosWeeklyInputs)
    .where(eq(fsgosWeeklyInputs.userId, user.id));

  const streak = computeWeeklyStreak(allWeeks.map((row) => row.weekStartDate));

  await db
    .insert(fsgosUserState)
    .values({
      userId: user.id,
      currentStreakWeeks: streak.current,
      longestStreakWeeks: streak.longest,
      lastInputWeekStart: streak.latest,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: fsgosUserState.userId,
      set: {
        currentStreakWeeks: streak.current,
        longestStreakWeeks: streak.longest,
        lastInputWeekStart: streak.latest,
        updatedAt: now,
      },
    });

  return NextResponse.json({ weeklyInput, streak, saved: true });
}
