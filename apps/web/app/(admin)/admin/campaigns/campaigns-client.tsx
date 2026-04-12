"use client";

import { useState } from "react";
import Link from "next/link";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Campaigns Dashboard — real data from marketing_campaigns table
// ─────────────────────────────────────────────────────────────────────────────

export type CampaignStatus = "upcoming" | "active" | "completed" | "paused" | "cancelled";

export interface RealCampaign {
  id:             string;
  businessId:     string;
  businessName:   string;
  businessPhone:  string;
  businessEmail:  string;
  city:           string;
  category:       string;
  bundleName:     string;
  orderId:        string;
  /** Actual amount charged (from order.total via pricing engine). NOT bundle.price. */
  orderTotal:     number;
  orderPaidAt:    string | null;
  status:         CampaignStatus;
  startDate:      string | null;
  endDate:        string | null;
  renewalDate:    string | null;
  nextDropDate:   string | null;
  totalDrops:     number;
  dropsCompleted: number;
  homesPerDrop:   number;
  homesTotal:     number;
  notes:          string;
  createdAt:      string;
}

interface Props {
  campaigns: RealCampaign[];
}

const STATUS_META: Record<CampaignStatus, { label: string; bg: string; text: string }> = {
  upcoming:  { label: "Upcoming",  bg: "bg-blue-100",   text: "text-blue-700"   },
  active:    { label: "Active",    bg: "bg-green-100",  text: "text-green-700"  },
  completed: { label: "Completed", bg: "bg-gray-100",   text: "text-gray-600"   },
  paused:    { label: "Paused",    bg: "bg-amber-100",  text: "text-amber-700"  },
  cancelled: { label: "Cancelled", bg: "bg-red-100",    text: "text-red-600"    },
};

function StatusBadge({ status }: { status: CampaignStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.bg} ${m.text}`}>
      {m.label}
    </span>
  );
}

function fmt(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CampaignsClient({ campaigns }: Props) {
  const [filter, setFilter] = useState<"all" | CampaignStatus>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filter === "all" ? campaigns : campaigns.filter((c) => c.status === filter);

  const activeCount    = campaigns.filter((c) => c.status === "active").length;
  const upcomingCount  = campaigns.filter((c) => c.status === "upcoming").length;
  const totalRevenue   = campaigns.filter((c) => c.status !== "cancelled").reduce((s, c) => s + c.orderTotal, 0);
  const totalHomes     = campaigns.filter((c) => c.status === "active").reduce((s, c) => s + c.homesTotal, 0);

  return (
    <div className="max-w-6xl space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campaigns</h1>
          <p className="mt-1 text-sm text-gray-500">
            All postcard marketing campaigns — live from database
          </p>
        </div>
        <Link
          href="/admin/availability"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          📍 Manage Spots
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: "✅", label: "Active",        value: activeCount,                                    accent: "text-green-600" },
          { icon: "🕐", label: "Upcoming",       value: upcomingCount,                                  accent: "text-blue-600"  },
          { icon: "🏠", label: "Homes (active)", value: totalHomes >= 1000 ? `${(totalHomes/1000).toFixed(1)}k` : totalHomes, accent: "text-purple-600" },
          { icon: "💰", label: "Total Revenue",  value: `$${totalRevenue.toLocaleString()}`,             accent: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className={`text-3xl font-bold ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-3 flex-wrap">
        {(["all", "active", "upcoming", "completed", "paused", "cancelled"] as const).map((f) => {
          const cnt = f === "all" ? campaigns.length : campaigns.filter((c) => c.status === f).length;
          if (f !== "all" && cnt === 0) return null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {f === "all" ? "All" : STATUS_META[f as CampaignStatus].label} ({cnt})
            </button>
          );
        })}
      </div>

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-sm">No campaigns yet. They appear here automatically after a client pays.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden"
            >
              {/* Row */}
              <button
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{c.businessName}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {c.city} · {c.category} · {c.bundleName}
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-sm shrink-0">
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{c.homesPerDrop.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">homes/drop</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-gray-900">{c.dropsCompleted}/{c.totalDrops}</p>
                    <p className="text-xs text-gray-400">drops</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold text-green-700">${c.orderTotal.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">paid</p>
                  </div>
                </div>
                <span className="text-gray-400 text-sm ml-2">{expanded === c.id ? "▲" : "▼"}</span>
              </button>

              {/* Expanded detail */}
              {expanded === c.id && (
                <div className="border-t border-gray-100 px-6 py-5 space-y-4 bg-gray-50">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Paid On</p>
                      <p className="text-gray-800">{fmt(c.orderPaidAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Start Date</p>
                      <p className="text-gray-800">{fmt(c.startDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Next Drop</p>
                      <p className="text-gray-800">{fmt(c.nextDropDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Renewal</p>
                      <p className="text-gray-800">{fmt(c.renewalDate)}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Contact</p>
                      <p className="text-gray-800">{c.businessPhone || "—"}</p>
                      <p className="text-xs text-gray-500">{c.businessEmail || "—"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Total Homes</p>
                      <p className="text-gray-800 font-bold">{c.homesTotal.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Amount Charged</p>
                      <p className="text-gray-800">${c.orderTotal.toLocaleString()}</p>
                    </div>
                  </div>
                  {c.notes && (
                    <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-800">
                      📝 {c.notes}
                    </div>
                  )}
                  <div className="flex gap-2 pt-1">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      📊 Manage Campaign →
                    </Link>
                    <Link
                      href={`/admin/businesses`}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      🏢 View Business →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
