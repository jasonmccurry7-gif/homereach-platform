"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCampaignStatus } from "./actions";

const STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming", description: "Paid, not yet live" },
  { value: "active", label: "Active", description: "Currently mailing" },
  { value: "paused", label: "Paused", description: "Temporarily on hold" },
  { value: "completed", label: "Completed", description: "Campaign period ended" },
  { value: "cancelled", label: "Cancelled", description: "Cancelled or refunded" },
] as const;

interface CampaignStatusFormProps {
  campaignId: string;
  currentStatus: string;
  dropsCompleted: number;
  totalDrops: number;
  nextDropDate: string | null;
  renewalDate: string | null;
}

const toDateInput = (iso: string | null) => (iso ? iso.split("T")[0]! : "");

const toLocalDate = (input: string) => {
  if (!input) return null;
  const [y, m, d] = input.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
};

export function CampaignStatusForm({
  campaignId,
  currentStatus,
  dropsCompleted,
  totalDrops,
  nextDropDate,
  renewalDate,
}: CampaignStatusFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(currentStatus);
  const [drops, setDrops] = useState(dropsCompleted.toString());
  const [nextDrop, setNextDrop] = useState(toDateInput(nextDropDate));
  const [renewal, setRenewal] = useState(toDateInput(renewalDate));
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const result = await updateCampaignStatus(campaignId, {
        status,
        dropsCompleted: parseInt(drops) || 0,
        nextDropDate: toLocalDate(nextDrop),
        renewalDate: toLocalDate(renewal),
      });

      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        router.refresh();
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-slate-700">Status</label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-xl border px-3 py-2.5 text-left text-xs transition-colors ${
                status === opt.value
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <p className="font-bold">{opt.label}</p>
              <p className={`mt-0.5 ${status === opt.value ? "text-slate-200" : "text-slate-400"}`}>
                {opt.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Drops completed
          </label>
          <input
            type="number"
            min="0"
            max={totalDrops}
            value={drops}
            onChange={(e) => setDrops(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <p className="mt-1 text-xs text-slate-400">of {totalDrops} total</p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Next drop date
          </label>
          <input
            type="date"
            value={nextDrop}
            onChange={(e) => setNextDrop(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Renewal date
          </label>
          <input
            type="date"
            value={renewal}
            onChange={(e) => setRenewal(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
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
          className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Update campaign"}
        </button>
        {saved && (
          <span className="text-sm font-semibold text-emerald-600">Saved</span>
        )}
      </div>
    </form>
  );
}
