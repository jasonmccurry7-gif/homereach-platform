"use client";

import { useMemo, useState } from "react";

type SpotStatus = "pending" | "active" | "paused" | "churned" | "cancelled";

interface SpotRow {
  id: string;
  status: SpotStatus;
  spotType: string;
  monthlyValueCents: number;
  activatedAt: string | null;
  commitmentEndsAt: string | null;
  releasedAt: string | null;
  createdAt: string;
  stripeSubscriptionId: string | null;
  businessName: string;
  businessEmail: string;
  market: string;
  category: string;
}

interface Stats {
  active: number;
  pending: number;
  paused: number;
  churned: number;
  cancelled: number;
  mrrCents: number;
  pendingValueCents: number;
  renewalDue: number;
  activeWithoutSubscription: number;
  needsReview: number;
}

interface Props {
  spots: SpotRow[];
  stats: Stats;
}

const STATUS_COLORS: Record<SpotStatus, string> = {
  active: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paused: "bg-orange-50 text-orange-700 border-orange-200",
  churned: "bg-slate-100 text-slate-600 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const dayMs = 24 * 60 * 60 * 1000;

function money(cents: number) {
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function formatDate(input: string | null) {
  if (!input) return "-";
  return new Date(input).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleize(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function daysUntil(input: string | null) {
  if (!input) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(input);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / dayMs);
}

function deriveStats(spots: SpotRow[]): Stats {
  const active = spots.filter((s) => s.status === "active").length;
  const pending = spots.filter((s) => s.status === "pending").length;
  const paused = spots.filter((s) => s.status === "paused").length;
  const churned = spots.filter((s) => s.status === "churned").length;
  const cancelled = spots.filter((s) => s.status === "cancelled").length;
  const mrrCents = spots
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyValueCents, 0);
  const pendingValueCents = spots
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.monthlyValueCents, 0);
  const renewalDue = spots.filter((s) => {
    const days = daysUntil(s.commitmentEndsAt);
    return s.status === "active" && days !== null && days >= 0 && days <= 30;
  }).length;
  const activeWithoutSubscription = spots.filter((s) => s.status === "active" && !s.stripeSubscriptionId).length;

  return {
    active,
    pending,
    paused,
    churned,
    cancelled,
    mrrCents,
    pendingValueCents,
    renewalDue,
    activeWithoutSubscription,
    needsReview: pending + paused + renewalDue + activeWithoutSubscription,
  };
}

function getSpotAttention(spot: SpotRow) {
  const days = daysUntil(spot.commitmentEndsAt);

  if (spot.status === "pending") {
    return {
      priority: "High",
      label: "Activation needed",
      nextStep: "Confirm payment, intake, and design assets before launch.",
      className: STATUS_COLORS.pending,
    };
  }

  if (spot.status === "paused") {
    return {
      priority: "High",
      label: "Paused inventory",
      nextStep: "Decide whether to resume, replace, or release this spot.",
      className: STATUS_COLORS.paused,
    };
  }

  if (spot.status === "active" && !spot.stripeSubscriptionId) {
    return {
      priority: "High",
      label: "Billing check",
      nextStep: "Confirm the recurring payment record before renewal.",
      className: "bg-red-50 text-red-700 border-red-200",
    };
  }

  if (spot.status === "active" && days !== null && days >= 0 && days <= 30) {
    return {
      priority: "Medium",
      label: "Renewal window",
      nextStep: "Start renewal or upgrade conversation.",
      className: "bg-blue-50 text-blue-700 border-blue-200",
    };
  }

  if (spot.monthlyValueCents <= 0) {
    return {
      priority: "Medium",
      label: "Pricing missing",
      nextStep: "Confirm monthly value so MRR reporting stays accurate.",
      className: "bg-violet-50 text-violet-700 border-violet-200",
    };
  }

  if (spot.status === "churned") {
    return {
      priority: "Low",
      label: "Win-back candidate",
      nextStep: "Review whether this category can be resold.",
      className: STATUS_COLORS.churned,
    };
  }

  return null;
}

export function SpotsClient({ spots, stats }: Props) {
  const [filter, setFilter] = useState<SpotStatus | "all" | "needs_review">("needs_review");
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<SpotStatus>("active");
  const [overriding, setOverriding] = useState(false);
  const [localSpots, setLocalSpots] = useState(spots);
  const [error, setError] = useState<string | null>(null);

  const currentStats = useMemo(() => deriveStats(localSpots), [localSpots]);
  const effectiveStats = localSpots.length > 0 ? currentStats : stats;
  const attentionItems = useMemo(
    () =>
      localSpots
        .map((spot) => ({ spot, attention: getSpotAttention(spot) }))
        .filter((item): item is { spot: SpotRow; attention: NonNullable<ReturnType<typeof getSpotAttention>> } =>
          Boolean(item.attention)
        ),
    [localSpots]
  );

  const displayed = useMemo(() => {
    if (filter === "all") return localSpots;
    if (filter === "needs_review") return attentionItems.map((item) => item.spot);
    return localSpots.filter((s) => s.status === filter);
  }, [attentionItems, filter, localSpots]);

  async function applyOverride(id: string) {
    setOverriding(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/spots/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: overrideStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update status.");
        return;
      }

      setLocalSpots((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: overrideStatus } : s))
      );
      setOverrideId(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setOverriding(false);
    }
  }

  const filters: Array<{ value: SpotStatus | "all" | "needs_review"; label: string; count: number }> = [
    { value: "needs_review", label: "Needs review", count: attentionItems.length },
    { value: "all", label: "All", count: localSpots.length },
    { value: "active", label: "Active", count: effectiveStats.active },
    { value: "pending", label: "Pending", count: effectiveStats.pending },
    { value: "paused", label: "Paused", count: effectiveStats.paused },
    { value: "churned", label: "Churned", count: effectiveStats.churned },
    { value: "cancelled", label: "Cancelled", count: effectiveStats.cancelled },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600">
              Inventory control
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Shared postcard spot inventory
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              A simple view of sold spots, revenue at risk, renewal windows, and manual owner decisions.
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">MRR protected</p>
            <p className="mt-1 text-3xl font-bold text-slate-950">{money(effectiveStats.mrrCents)}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Needs review", value: effectiveStats.needsReview, note: "Owner decisions" },
          { label: "Pending activation", value: effectiveStats.pending, note: money(effectiveStats.pendingValueCents) },
          { label: "Active spots", value: effectiveStats.active, note: "Live inventory" },
          { label: "Renewals due", value: effectiveStats.renewalDue, note: "Next 30 days" },
          { label: "Billing checks", value: effectiveStats.activeWithoutSubscription, note: "Active without Stripe ID" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.note}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-950">What needs attention today</h2>
            <p className="mt-1 text-sm text-slate-500">
              Focus on activations, paused inventory, billing checks, and renewals before browsing the full ledger.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFilter("needs_review")}
            className="w-fit rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Show review queue
          </button>
        </div>

        {attentionItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="font-semibold text-emerald-900">Spot inventory looks clear from current records.</p>
            <p className="mt-1 text-sm text-emerald-700">
              Keep checking sold categories before each campaign cycle.
            </p>
          </div>
        ) : (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {attentionItems.slice(0, 6).map(({ spot, attention }) => (
              <div key={spot.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${attention.className}`}>
                    {attention.priority} - {attention.label}
                  </span>
                  <span className="text-sm font-bold text-slate-950">{spot.businessName}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {spot.market} - {spot.category}. {attention.nextStep}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {spot.businessEmail !== "-" && (
                    <a
                      href={`mailto:${spot.businessEmail}`}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Email customer
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setOverrideId(spot.id);
                      setOverrideStatus(spot.status);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Update status
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-bold text-slate-950">Spot ledger</h2>
          <p className="mt-1 text-sm text-slate-500">
            Manual status controls stay here so owner-facing inventory remains clean and controlled.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-slate-100 px-5 py-4">
          {filters.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter(item.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                filter === item.value
                  ? "bg-slate-950 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label} ({item.count})
            </button>
          ))}
        </div>

        {error && (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50">
              <tr>
                {[
                  "Business",
                  "Market / Category",
                  "Spot",
                  "MRR",
                  "Status",
                  "Commitment",
                  "Attention",
                  "Actions",
                ].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayed.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-slate-400">
                    No spots found for this filter.
                  </td>
                </tr>
              )}

              {displayed.map((spot) => {
                const attention = getSpotAttention(spot);
                return (
                  <tr key={spot.id} className="transition hover:bg-slate-50">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-950">{spot.businessName}</div>
                      <div className="text-xs text-slate-500">{spot.businessEmail}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-slate-800">{spot.market}</div>
                      <div className="text-xs text-slate-500">{spot.category}</div>
                    </td>
                    <td className="px-4 py-4 text-slate-700">
                      {titleize(spot.spotType)}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">
                      {spot.monthlyValueCents > 0 ? money(spot.monthlyValueCents) : "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_COLORS[spot.status]}`}>
                        {titleize(spot.status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      <div>Activated: {formatDate(spot.activatedAt)}</div>
                      <div>Ends: {formatDate(spot.commitmentEndsAt)}</div>
                    </td>
                    <td className="px-4 py-4">
                      {attention ? (
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${attention.className}`}>
                          {attention.label}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">Clear</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      {overrideId === spot.id ? (
                        <div className="flex items-center gap-2">
                          <select
                            value={overrideStatus}
                            onChange={(e) => setOverrideStatus(e.target.value as SpotStatus)}
                            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                          >
                            <option value="active">Active</option>
                            <option value="pending">Pending</option>
                            <option value="paused">Paused</option>
                            <option value="churned">Churned</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                          <button
                            onClick={() => applyOverride(spot.id)}
                            disabled={overriding}
                            className="rounded-lg bg-slate-950 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                          >
                            {overriding ? "Saving..." : "Apply"}
                          </button>
                          <button
                            onClick={() => setOverrideId(null)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setOverrideId(spot.id);
                            setOverrideStatus(spot.status);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Update status
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
