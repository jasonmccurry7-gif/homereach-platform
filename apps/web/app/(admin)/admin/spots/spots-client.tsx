"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// SpotsClient — Agent 2 Fulfillment
// Real-time spot management: view, filter, override status
// ─────────────────────────────────────────────────────────────────────────────

type SpotStatus = "pending" | "active" | "paused" | "churned" | "cancelled";

interface SpotRow {
  id:                 string;
  status:             SpotStatus;
  spotType:           string;
  monthlyValueCents:  number;
  activatedAt:        string | null;
  commitmentEndsAt:   string | null;
  releasedAt:         string | null;
  createdAt:          string;
  stripeSubscriptionId: string | null;
  businessName:       string;
  businessEmail:      string;
  market:             string;
  category:           string;
}

interface Stats {
  active:    number;
  pending:   number;
  paused:    number;
  churned:   number;
  mrrCents:  number;
}

interface Props {
  spots: SpotRow[];
  stats: Stats;
}

const STATUS_COLORS: Record<SpotStatus, string> = {
  active:    "bg-green-100 text-green-800",
  pending:   "bg-yellow-100 text-yellow-800",
  paused:    "bg-orange-100 text-orange-800",
  churned:   "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export function SpotsClient({ spots, stats }: Props) {
  const [filter, setFilter]     = useState<SpotStatus | "all">("all");
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideStatus, setOverrideStatus] = useState<SpotStatus>("active");
  const [overriding, setOverriding] = useState(false);
  const [localSpots, setLocalSpots] = useState(spots);
  const [error, setError]       = useState<string | null>(null);

  const displayed = filter === "all" ? localSpots : localSpots.filter((s) => s.status === filter);
  const mrr       = `$${(stats.mrrCents / 100).toLocaleString()}`;

  async function applyOverride(id: string) {
    setOverriding(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/spots/${id}/status`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ status: overrideStatus }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to update status.");
        return;
      }

      // Optimistically update local state
      setLocalSpots((prev) =>
        prev.map((s) => s.id === id ? { ...s, status: overrideStatus } : s)
      );
      setOverrideId(null);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setOverriding(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Spot Management</h1>
      <p className="text-gray-500 mb-6 text-sm">All spot_assignments in real time. Override status for manual control.</p>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {[
          { label: "Active",   value: stats.active,   color: "text-green-600",  bg: "bg-green-50" },
          { label: "Pending",  value: stats.pending,  color: "text-yellow-600", bg: "bg-yellow-50" },
          { label: "Paused",   value: stats.paused,   color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Churned",  value: stats.churned,  color: "text-gray-500",   bg: "bg-gray-50" },
          { label: "MRR",      value: mrr,            color: "text-blue-600",   bg: "bg-blue-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-gray-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "active", "pending", "paused", "churned", "cancelled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Business", "Market / Category", "Spot Type", "MRR", "Status", "Activated", "Commitment Ends", "Actions"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {displayed.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No spots found for this filter.
                </td>
              </tr>
            )}
            {displayed.map((spot) => (
              <tr key={spot.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{spot.businessName}</div>
                  <div className="text-gray-400 text-xs">{spot.businessEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-gray-900">{spot.market}</div>
                  <div className="text-gray-400 text-xs">{spot.category}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-gray-700 capitalize">
                    {spot.spotType.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700 font-medium">
                  {spot.monthlyValueCents > 0
                    ? `$${(spot.monthlyValueCents / 100).toLocaleString()}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[spot.status]}`}>
                    {spot.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {spot.activatedAt
                    ? new Date(spot.activatedAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {spot.commitmentEndsAt
                    ? new Date(spot.commitmentEndsAt).toLocaleDateString()
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {overrideId === spot.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={overrideStatus}
                        onChange={(e) => setOverrideStatus(e.target.value as SpotStatus)}
                        className="border border-gray-300 rounded px-2 py-1 text-xs"
                      >
                        <option value="active">active</option>
                        <option value="pending">pending</option>
                        <option value="paused">paused</option>
                        <option value="churned">churned</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                      <button
                        onClick={() => applyOverride(spot.id)}
                        disabled={overriding}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                      >
                        {overriding ? "..." : "Apply"}
                      </button>
                      <button
                        onClick={() => setOverrideId(null)}
                        className="text-gray-400 hover:text-gray-600 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setOverrideId(spot.id); setOverrideStatus(spot.status); }}
                      className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                    >
                      Override
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
