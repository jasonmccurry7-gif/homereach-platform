import { redirect } from "next/navigation";
import { WeeklyInputForm } from "@/components/growth-os/weekly-input-form";
import { StreakCounter } from "@/components/growth-os/streak-counter";
import { getGrowthOsSessionUser } from "@/lib/growth-os/auth";
import { getCurrentWeekStartDate } from "@/lib/growth-os/metrics";
import { getGrowthOsPhase1Data } from "@/lib/growth-os/queries";
import type { GrowthOsContextFlags } from "@/lib/growth-os/types";
import { normalizeContextFlags } from "@/lib/growth-os/validators";

export default async function GrowthOsWeeklyPage() {
  const user = await getGrowthOsSessionUser();
  if (!user) redirect("/login?redirect=/growth-os/weekly");

  const data = await getGrowthOsPhase1Data(user.id);
  if (!data.profile) redirect("/growth-os/onboarding");

  const currentWeekStartDate = getCurrentWeekStartDate();
  const currentWeekInput =
    data.weeklyInputs.find(
      (input) => input.weekStartDate === currentWeekStartDate
    ) ?? null;
  const previousInput =
    data.weeklyInputs.find(
      (input) => input.weekStartDate !== currentWeekStartDate
    ) ??
    data.latestWeeklyInput ??
    null;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">
            Weekly input
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-950">
            Update this week
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">
            A 60-second check-in keeps the recommendations tied to real sales,
            labor, ingredient cost, and waste instead of guesswork.
          </p>
        </div>
        <StreakCounter weeks={data.userState?.currentStreakWeeks ?? 0} />
      </div>

      <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <WeeklyInputForm
          currentWeekStartDate={currentWeekStartDate}
          initial={serializeWeeklyInput(currentWeekInput ?? previousInput)}
          previous={serializeWeeklyInput(previousInput)}
        />
      </section>
    </div>
  );
}

function serializeWeeklyInput(
  input:
    | {
        weekStartDate: string;
        weeklyRevenueCents: number;
        weeklyOrders: number;
        weeklyLaborCostCents: number;
        weeklyIngredientCostCents: number;
        weeklyWasteEstimateCents: number;
        notes: string | null;
        contextFlags: unknown;
      }
    | null
) {
  if (!input) return null;

  return {
    weekStartDate: input.weekStartDate,
    weeklyRevenueCents: input.weeklyRevenueCents,
    weeklyOrders: input.weeklyOrders,
    weeklyLaborCostCents: input.weeklyLaborCostCents,
    weeklyIngredientCostCents: input.weeklyIngredientCostCents,
    weeklyWasteEstimateCents: input.weeklyWasteEstimateCents,
    notes: input.notes,
    contextFlags: normalizeContextFlags(
      typeof input.contextFlags === "object" && input.contextFlags
        ? (input.contextFlags as Partial<GrowthOsContextFlags>)
        : null
    ),
  };
}
