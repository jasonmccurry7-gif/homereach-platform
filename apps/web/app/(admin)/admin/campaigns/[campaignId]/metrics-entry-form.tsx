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

  const engagements =
    (parseInt(form.qrScans) || 0) +
    (parseInt(form.phoneLeads) || 0) +
    (parseInt(form.formLeads) || 0);
  const impressions = parseInt(form.impressions) || 0;
  const conversionRate = impressions > 0 ? ((engagements / impressions) * 100).toFixed(2) : "0.00";

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
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Period start
          </label>
          <input
            type="date"
            value={form.periodStart}
            onChange={set("periodStart")}
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Period end
          </label>
          <input
            type="date"
            value={form.periodEnd}
            onChange={set("periodEnd")}
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Impressions
            <span className="ml-1 text-xs font-normal text-slate-400">(homes reached)</span>
          </label>
          <input
            type="number"
            min="0"
            value={form.impressions}
            onChange={set("impressions")}
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Mailpieces
            <span className="ml-1 text-xs font-normal text-slate-400">(postcards sent)</span>
          </label>
          <input
            type="number"
            min="0"
            value={form.mailpieces}
            onChange={set("mailpieces")}
            required
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-700">Response tracking</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-blue-700">
              QR scans
            </label>
            <input
              type="number"
              min="0"
              value={form.qrScans}
              onChange={set("qrScans")}
              className="w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">
              Phone leads
            </label>
            <input
              type="number"
              min="0"
              value={form.phoneLeads}
              onChange={set("phoneLeads")}
              className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
              Form fills
            </label>
            <input
              type="number"
              min="0"
              value={form.formLeads}
              onChange={set("formLeads")}
              className="w-full rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
          Preview
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-slate-500">Total engagements</p>
            <p className="text-2xl font-bold text-slate-950">{engagements}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Conversion rate</p>
            <p className="text-2xl font-bold text-slate-800">{conversionRate}%</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Formula</p>
            <p className="font-mono text-xs text-slate-500">
              ({form.qrScans || 0} + {form.phoneLeads || 0} + {form.formLeads || 0}) / {impressions.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save drop results"}
        </button>
        {success && (
          <span className="text-sm font-semibold text-emerald-600">
            Saved. Dashboard will update immediately.
          </span>
        )}
      </div>
    </form>
  );
}
