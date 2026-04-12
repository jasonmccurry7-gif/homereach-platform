"use client";

import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// IntakeQueueClient — Agent 2 Fulfillment / Agent 7 Targeted
// Admin intake review queue with one-click "Mark Reviewed"
// ─────────────────────────────────────────────────────────────────────────────

interface IntakeItem {
  id:              string;
  status:          string;
  accessToken:     string;
  serviceArea:     string;
  targetCustomer:  string;
  keyOffer:        string;
  differentiators: string;
  additionalNotes: string;
  submittedAt:     string | null;
  createdAt:       string;
  businessName:    string;
  businessEmail:   string;
  businessPhone:   string;
  spotType:        string;
  market:          string;
  category:        string;
}

interface Stats {
  pending:   number;
  submitted: number;
  reviewed:  number;
}

interface Props {
  items: IntakeItem[];
  stats: Stats;
}

export function IntakeQueueClient({ items, stats }: Props) {
  const [filter, setFilter]   = useState<"all" | "pending" | "submitted" | "reviewed">("submitted");
  const [localItems, setLocalItems] = useState(items);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [reviewing, setReviewing]   = useState<string | null>(null);
  const [error, setError]           = useState<string | null>(null);

  const displayed = filter === "all" ? localItems : localItems.filter((i) => i.status === filter);

  async function markReviewed(id: string) {
    setReviewing(id);
    setError(null);

    try {
      const res = await fetch(`/api/admin/intake/${id}/review`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to mark reviewed.");
        return;
      }

      setLocalItems((prev) =>
        prev.map((i) => i.id === id ? { ...i, status: "reviewed" } : i)
      );
    } catch {
      setError("Network error.");
    } finally {
      setReviewing(null);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Intake Queue</h1>
      <p className="text-gray-500 text-sm mb-6">
        Review submitted intake forms and action campaign creation.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-yellow-700">{stats.pending}</div>
          <div className="text-xs text-gray-500 mt-1">Awaiting Submission</div>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{stats.submitted}</div>
          <div className="text-xs text-gray-500 mt-1">Needs Review</div>
        </div>
        <div className="bg-green-50 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-green-700">{stats.reviewed}</div>
          <div className="text-xs text-gray-500 mt-1">Reviewed</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-4">
        {(["submitted", "pending", "reviewed", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === f
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "submitted" && stats.submitted > 0 && (
              <span className="ml-2 bg-blue-700 text-white text-xs px-1.5 py-0.5 rounded-full">
                {stats.submitted}
              </span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Items */}
      <div className="space-y-3">
        {displayed.length === 0 && (
          <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
            No intake forms for this filter.
          </div>
        )}
        {displayed.map((item) => (
          <div
            key={item.id}
            className={`bg-white rounded-xl border ${
              item.status === "submitted" ? "border-blue-200" : "border-gray-200"
            } overflow-hidden`}
          >
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-4">
                <div>
                  <div className="font-semibold text-gray-900">{item.businessName}</div>
                  <div className="text-gray-500 text-xs">
                    {item.market} · {item.category} · {item.spotType.replace(/_/g, " ")}
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  item.status === "submitted" ? "bg-blue-100 text-blue-800" :
                  item.status === "pending"   ? "bg-yellow-100 text-yellow-800" :
                                               "bg-green-100 text-green-800"
                }`}>
                  {item.status}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {item.submittedAt && (
                  <span className="text-gray-400 text-xs">
                    {new Date(item.submittedAt).toLocaleDateString()}
                  </span>
                )}
                <button
                  onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  className="text-blue-600 text-sm font-medium hover:text-blue-800"
                >
                  {expanded === item.id ? "Collapse" : "View Details"}
                </button>
                {item.status === "submitted" && (
                  <button
                    onClick={() => markReviewed(item.id)}
                    disabled={reviewing === item.id}
                    className="bg-green-600 text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
                  >
                    {reviewing === item.id ? "..." : "✓ Mark Reviewed"}
                  </button>
                )}
              </div>
            </div>

            {/* Expanded details */}
            {expanded === item.id && (
              <div className="border-t border-gray-100 p-4 bg-gray-50 grid grid-cols-2 gap-4 text-sm">
                {[
                  ["Email",           item.businessEmail],
                  ["Phone",           item.businessPhone],
                  ["Service Area",    item.serviceArea],
                  ["Target Customer", item.targetCustomer],
                  ["Key Offer",       item.keyOffer],
                  ["Differentiators", item.differentiators],
                  ...(item.additionalNotes ? [["Additional Notes", item.additionalNotes]] : []),
                ].map(([label, value]) => (
                  <div key={label}>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      {label}
                    </div>
                    <div className="text-gray-900">{value || "—"}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
