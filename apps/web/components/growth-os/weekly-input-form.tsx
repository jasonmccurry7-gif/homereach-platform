"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";
import { EMPTY_CONTEXT_FLAGS } from "@/lib/growth-os/types";
import type { GrowthOsContextFlags } from "@/lib/growth-os/types";
import { ContextFlags } from "./context-flags";
import { SameAsLastWeekButton } from "./same-as-last-week-button";

type WeeklyInputInitial = {
  weekStartDate?: string;
  weeklyRevenueCents?: number;
  weeklyOrders?: number;
  weeklyLaborCostCents?: number;
  weeklyIngredientCostCents?: number;
  weeklyWasteEstimateCents?: number;
  notes?: string | null;
  contextFlags?: Partial<GrowthOsContextFlags> | null;
} | null;

export function WeeklyInputForm({
  currentWeekStartDate,
  initial,
  previous,
}: {
  currentWeekStartDate: string;
  initial: WeeklyInputInitial;
  previous: WeeklyInputInitial;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sameAsPrevious, setSameAsPrevious] = useState(false);
  const [form, setForm] = useState(() => formFromInput(initial));

  const calculatedAov = useMemo(() => {
    const revenue = Number(form.weeklyRevenue);
    const orders = Number(form.weeklyOrders);
    if (!Number.isFinite(revenue) || !Number.isFinite(orders) || orders <= 0) {
      return "0.00";
    }
    return (revenue / orders).toFixed(2);
  }, [form.weeklyRevenue, form.weeklyOrders]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/growth-os/weekly-input", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        weekStartDate: currentWeekStartDate,
        sameAsPrevious,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Unable to save weekly input");
      setLoading(false);
      return;
    }

    router.push("/growth-os/dashboard");
    router.refresh();
  }

  function copyPrevious() {
    if (!previous) return;
    setForm(formFromInput(previous));
    setSameAsPrevious(true);
  }

  function updateText(key: Exclude<keyof typeof form, "contextFlags">, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    setSameAsPrevious(false);
  }

  function updateFlags(value: GrowthOsContextFlags) {
    setForm((current) => ({ ...current, contextFlags: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-gray-700">
          Week of {formatDate(currentWeekStartDate)}
        </p>
        <SameAsLastWeekButton disabled={!previous} onClick={copyPrevious} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          label="Weekly revenue"
          value={form.weeklyRevenue}
          onChange={(value) => updateText("weeklyRevenue", value)}
        />
        <NumberField
          label="Weekly orders"
          value={form.weeklyOrders}
          onChange={(value) => updateText("weeklyOrders", value)}
        />
        <ReadOnlyField label="Average order value" value={`$${calculatedAov}`} />
        <MoneyField
          label="Weekly labor cost"
          value={form.weeklyLaborCost}
          onChange={(value) => updateText("weeklyLaborCost", value)}
        />
        <MoneyField
          label="Weekly ingredient cost"
          value={form.weeklyIngredientCost}
          onChange={(value) => updateText("weeklyIngredientCost", value)}
        />
        <MoneyField
          label="Weekly waste estimate"
          value={form.weeklyWasteEstimate}
          onChange={(value) => updateText("weeklyWasteEstimate", value)}
        />
      </div>

      <ContextFlags
        value={form.contextFlags}
        onChange={updateFlags}
      />

      <label className="block">
        <span className="text-sm font-medium text-gray-700">Notes</span>
        <textarea
          rows={3}
          value={form.notes}
          onChange={(event) => updateText("notes", event.target.value)}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              Saving
            </>
          ) : (
            <>
              Save week
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-700">{label}</p>
      <div className="mt-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-900">
        {value}
      </div>
    </div>
  );
}

function formFromInput(input: WeeklyInputInitial) {
  return {
    weeklyRevenue: dollars(input?.weeklyRevenueCents),
    weeklyOrders: input?.weeklyOrders ? String(input.weeklyOrders) : "",
    weeklyLaborCost: dollars(input?.weeklyLaborCostCents),
    weeklyIngredientCost: dollars(input?.weeklyIngredientCostCents),
    weeklyWasteEstimate: dollars(input?.weeklyWasteEstimateCents),
    notes: input?.notes ?? "",
    contextFlags: {
      ...EMPTY_CONTEXT_FLAGS,
      ...(input?.contextFlags ?? {}),
    },
  };
}

function dollars(cents: number | null | undefined) {
  if (!cents) return "";
  return String(cents / 100);
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
