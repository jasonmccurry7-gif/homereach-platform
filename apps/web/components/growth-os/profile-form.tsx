"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Save } from "lucide-react";

type ProfileFormInitial = {
  companyName?: string;
  locationZip?: string;
  businessType?: string;
  weeklyRevenueCents?: number;
  avgOrderValueCents?: number;
  dailyCustomers?: number;
  laborCostWeeklyCents?: number;
  ingredientCostWeeklyCents?: number;
  overheadMonthlyCents?: number;
  ownerGoal?: string;
  timezone?: string;
} | null;

const BUSINESS_TYPES = [
  "Bakery",
  "Cupcake shop",
  "Coffee shop",
  "Juice bar",
  "Ice cream shop",
  "Food truck",
  "Ghost kitchen",
  "Small QSR",
];

const OWNER_GOALS = [
  "Increase profit",
  "Reduce waste",
  "Grow daily sales",
  "Improve cash flow",
  "Stabilize labor costs",
];

export function ProfileForm({ initial }: { initial: ProfileFormInitial }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    companyName: initial?.companyName ?? "",
    locationZip: initial?.locationZip ?? "",
    businessType: initial?.businessType ?? "Bakery",
    weeklyRevenue: dollars(initial?.weeklyRevenueCents),
    avgOrderValue: dollars(initial?.avgOrderValueCents),
    dailyCustomers: String(initial?.dailyCustomers ?? ""),
    laborCostWeekly: dollars(initial?.laborCostWeeklyCents),
    ingredientCostWeekly: dollars(initial?.ingredientCostWeeklyCents),
    overheadMonthly: dollars(initial?.overheadMonthlyCents),
    ownerGoal: initial?.ownerGoal ?? "Increase profit",
    timezone: initial?.timezone ?? "America/New_York",
  });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const response = await fetch("/api/growth-os/profile", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "Unable to save profile");
      setLoading(false);
      return;
    }

    router.push("/growth-os/weekly");
    router.refresh();
  }

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Company name"
          value={form.companyName}
          onChange={(value) => update("companyName", value)}
          required
        />
        <TextField
          label="ZIP code"
          value={form.locationZip}
          onChange={(value) => update("locationZip", value)}
          required
        />
        <SelectField
          label="Business type"
          value={form.businessType}
          options={BUSINESS_TYPES}
          onChange={(value) => update("businessType", value)}
        />
        <SelectField
          label="Owner goal"
          value={form.ownerGoal}
          options={OWNER_GOALS}
          onChange={(value) => update("ownerGoal", value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          label="Weekly revenue"
          value={form.weeklyRevenue}
          onChange={(value) => update("weeklyRevenue", value)}
        />
        <MoneyField
          label="Average order value"
          value={form.avgOrderValue}
          onChange={(value) => update("avgOrderValue", value)}
        />
        <NumberField
          label="Daily customers"
          value={form.dailyCustomers}
          onChange={(value) => update("dailyCustomers", value)}
        />
        <MoneyField
          label="Weekly labor cost"
          value={form.laborCostWeekly}
          onChange={(value) => update("laborCostWeekly", value)}
        />
        <MoneyField
          label="Weekly ingredient cost"
          value={form.ingredientCostWeekly}
          onChange={(value) => update("ingredientCostWeekly", value)}
        />
        <MoneyField
          label="Monthly overhead"
          value={form.overheadMonthly}
          onChange={(value) => update("overheadMonthly", value)}
        />
      </div>

      <TextField
        label="Timezone"
        value={form.timezone}
        onChange={(value) => update("timezone", value)}
        required
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
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
              Save profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </>
          )}
        </button>
      </div>
    </form>
  );
}

function TextField({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
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

function dollars(cents: number | null | undefined) {
  if (!cents) return "";
  return String(cents / 100);
}
