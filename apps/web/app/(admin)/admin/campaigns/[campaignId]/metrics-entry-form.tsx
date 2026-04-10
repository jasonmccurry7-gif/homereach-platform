"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDropResults } from "./actions";

interface MetricsEntryFormProps {
  campaignId: string;
  defaultHomes: number;
}

export function MetricsEntryForm({ campaignId, defaultHomes }: MetricsEntryFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Period defaults: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const toDateInput = (d: Date) => d.toISOString().split("T")[0]!;

  const [form, setForm] = useState({
    periodStart: toDateInput(thirtyDaysAgo),
    periodEnd: toDateInput(today),
    impressions: defaultHomes.toString(),
    mailpieces: defaultHomes.toString(),
    qrScans: "0",
    phoneLeads: "0",
    formLeads: "0",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  // Derived preview
  const eng =
    (parseInt(form.qrScans) || 0) +
    (parseInt(form.phoneLeads) || 0) +
    (parseInt(form.formLeads) || 0);
  const impressions = parseInt(form.impressions) || 0;
  const conv = impressions > 0 ? ((eng / impressions) * 100).toFixed(2) : "0.00";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await addDropResults(campaignId, {
        periodStart: form.periodStart,
        periodEnd: form.periodEnd,
        impressions: parseInt(form.impressions) || 0,
        mailpieces: parseInt(form.mailpieces) || 0,
        qrScans: parseInt(form.qrScans) || 0,
        phoneLeads: parseInt(form.phoneLeads) || 0,
        formLeads: parseInt(form.formLeads) || 0,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        router.refresh();
        setForm({
          periodStart: toDateInput(thirtyDaysAgo),
          periodEnd: toDateInput(today),
          impressions: defaultHomes.toString(),
          mailpieces: defaultHomes.toString(),
          qrScans: "0",
          phoneLeads: "0",
          formLeads: "0",
        });
        setTimeout(() => setSuccess(false), 4000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Period */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Period start
          </label>
          <input
            type="date"
            value={form.periodStart}
            onChange={set("periodStart")}
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Period end
          </label>
          <input
            type="date"
            value={form.periodEnd}
            onChange={set("periodEnd")}
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Delivery figures */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Impressions
            <span className="ml-1 text-xs font-normal text-gray-400">(homes reached)</span>
          </label>
          <input
            type="number"
            min="0"
            value={form.impressions}
            onChange={set("impressions")}
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mailpieces
            <span className="ml-1 text-xs font-normal text-gray-400">(postcards sent)</span>
          </label>
          <input
            type="number"
            min="0"
            value={form.mailpieces}
            onChange={set("mailpieces")}
            required
            className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Engagement figures */}
      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">Response tracking</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-blue-700 mb-1">
              📱 QR scans
            </label>
            <input
              type="number"
              min="0"
              value={form.qrScans}
              onChange={set("qrScans")}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-mono text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-green-700 mb-1">
              📞 Phone leads
            </label>
            <input
              type="number"
              min="0"
              value={form.phoneLeads}
              onChange={set("phoneLeads")}
              className="w-full rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-mono text-gray-900 focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-purple-700 mb-1">
              📋 Form fills
            </label>
            <input
              type="number"
              min="0"
              value={form.formLeads}
              onChange={set("formLeads")}
              className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-mono text-gray-900 focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Live derived KPI preview */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">
          Preview
        </p>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-gray-500">Total engagements</p>
            <p className="text-2xl font-bold text-gray-900">{eng}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Conversion rate</p>
            <p className="text-2xl font-bold text-gray-700">{conv}%</p>
          </div>
          <div className="text-xs text-gray-400 font-mono">
            ({form.qrScans || 0} + {form.phoneLeads || 0} + {form.formLeads || 0}) ÷{" "}
            {impressions.toLocaleString()}
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 border border-red-200 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? "Saving…" : "Save drop results"}
        </button>
        {success && (
          <span className="text-sm font-medium text-green-600">
            ✓ Saved — dashboard will update immediately
          </span>
        )}
      </div>
    </form>
  );
}
