"use client";

import { useState } from "react";
import Link from "next/link";
import type { TargetedCampaign, CarrierRoute, TargetedCampaignStatus } from "@/lib/engine/types";
import { TargetedRouteEngine } from "@/lib/engine/targeted-routes";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Admin Campaigns Dashboard
// Unified view: shared postcard + targeted route campaigns
// ─────────────────────────────────────────────────────────────────────────────

type EnrichedCampaign = TargetedCampaign & { routes: CarrierRoute[] };

interface CityOption {
  id: string;
  name: string;
  totalRoutes: number;
  totalHomes: number;
}

interface Props {
  campaigns: EnrichedCampaign[];
  cities: CityOption[];
  allRoutes: CarrierRoute[];
}

const STATUS_META: Record<TargetedCampaignStatus, { label: string; color: string }> = {
  draft:           { label: "Draft",          color: "bg-gray-800 text-gray-400"         },
  pending_review:  { label: "Pending Review", color: "bg-amber-900/50 text-amber-300"    },
  active:          { label: "Active",         color: "bg-green-900/50 text-green-300"    },
  completed:       { label: "Completed",      color: "bg-blue-900/50 text-blue-300"      },
  cancelled:       { label: "Cancelled",      color: "bg-red-900/50 text-red-400"        },
};

function StatusBadge({ status }: { status: TargetedCampaignStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("text-xs px-2.5 py-1 rounded-full font-semibold", meta.color)}>
      {meta.label}
    </span>
  );
}

// ── Campaign Detail Panel ─────────────────────────────────────────────────────

function CampaignDetail({
  campaign,
  onStatusChange,
}: {
  campaign: EnrichedCampaign;
  onStatusChange: (id: string, status: TargetedCampaignStatus) => void;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white">{campaign.businessName}</h3>
            <StatusBadge status={campaign.status} />
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-900/40 text-blue-400 font-semibold">
              🎯 Targeted
            </span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">{campaign.contactName} · {campaign.city}</p>
          <p className="text-xs text-gray-500">{campaign.email} · {campaign.phone}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold text-white">{TargetedRouteEngine.formatPrice(campaign.totalPrice)}</p>
          <p className="text-xs text-gray-500 mt-0.5">{campaign.pricingTierLabel} rate</p>
        </div>
      </div>

      {/* Reach stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCell icon="🏠" label="Homes" value={campaign.totalHouseholds.toLocaleString()} />
        <StatCell icon="📍" label="Routes" value={String(campaign.routes.length)} />
        <StatCell icon="💰" label="Per 1k" value={`$${campaign.pricePerThousand}`} />
      </div>

      {/* Routes list */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Selected Routes</p>
        <div className="space-y-1.5">
          {campaign.routes.map((r) => (
            <div key={r.id} className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded-lg text-xs">
              <span className="text-gray-300">{r.name}</span>
              <div className="flex items-center gap-3">
                <span className="text-gray-500">{r.routeCode}</span>
                <span className="text-gray-300 font-semibold">{r.households.toLocaleString()} homes</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Targeting filters */}
      {Object.keys(campaign.targetingFilters).length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Targeting Filters</p>
          <div className="flex flex-wrap gap-2">
            {campaign.targetingFilters.homeValueRange && (
              <span className="text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-full">
                🏡 Home value: {campaign.targetingFilters.homeValueRange}
              </span>
            )}
            {campaign.targetingFilters.incomeRange && (
              <span className="text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-full">
                💼 Income: {campaign.targetingFilters.incomeRange}
              </span>
            )}
            {campaign.targetingFilters.zipCluster && (
              <span className="text-xs px-2.5 py-1 bg-gray-800 text-gray-400 rounded-full">
                📮 ZIP: {campaign.targetingFilters.zipCluster}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Metrics (if available) */}
      {campaign.metrics && (
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Campaign Metrics</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCell label="Homes Reached" value={campaign.metrics.homesReached.toLocaleString()} />
            {campaign.metrics.responseRate != null && (
              <MetricCell label="Response Rate" value={`${campaign.metrics.responseRate}%`} />
            )}
            {campaign.metrics.leadsGenerated != null && (
              <MetricCell label="Leads Generated" value={String(campaign.metrics.leadsGenerated)} />
            )}
            {campaign.metrics.estimatedROI != null && (
              <MetricCell label="Est. ROI" value={TargetedRouteEngine.formatPrice(campaign.metrics.estimatedROI)} />
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {campaign.notes && (
        <div className="px-3 py-2 bg-gray-800 rounded-lg text-xs text-gray-400">{campaign.notes}</div>
      )}

      {/* Status actions */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-gray-800">
        <span className="text-xs text-gray-500">Update status:</span>
        {(["pending_review", "active", "completed", "cancelled"] as const)
          .filter((s) => s !== campaign.status)
          .map((s) => (
            <button
              key={s}
              onClick={() => onStatusChange(campaign.id, s)}
              className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition"
            >
              → {STATUS_META[s].label}
            </button>
          ))}
      </div>
    </div>
  );
}

function StatCell({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-3 text-center">
      <span className="text-lg">{icon}</span>
      <p className="text-base font-bold text-white mt-1">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-green-900/20 border border-green-800/30 rounded-xl p-3">
      <p className="text-base font-bold text-green-300">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function CampaignsClient({ campaigns, cities, allRoutes }: Props) {
  const [localCampaigns, setLocalCampaigns] = useState(campaigns);
  const [filter, setFilter] = useState<"all" | TargetedCampaignStatus>("all");
  const [toast, setToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleStatusChange(id: string, status: TargetedCampaignStatus) {
    setLocalCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c))
    );
    showToast(`Status updated to ${STATUS_META[status].label}`);
  }

  const filtered = filter === "all"
    ? localCampaigns
    : localCampaigns.filter((c) => c.status === filter);

  // Summary stats
  const totalReach = localCampaigns
    .filter((c) => c.status === "active")
    .reduce((s, c) => s + c.totalHouseholds, 0);
  const totalRevenue = localCampaigns
    .filter((c) => c.status !== "cancelled")
    .reduce((s, c) => s + c.totalPrice, 0);
  const pendingCount = localCampaigns.filter((c) => c.status === "pending_review").length;
  const activeCount  = localCampaigns.filter((c) => c.status === "active").length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 text-sm text-white px-4 py-3 rounded-xl shadow-lg">
          ✅ {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Targeted route campaigns — dedicated postcards, precise reach
          </p>
        </div>
        <Link
          href="/targeted"
          target="_blank"
          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition"
        >
          + New Campaign →
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CampaignStat icon="✅" label="Active"          value={String(activeCount)}                        color="green" />
        <CampaignStat icon="⏳" label="Pending Review"  value={String(pendingCount)}                       color={pendingCount > 0 ? "amber" : "gray"} />
        <CampaignStat icon="🏠" label="Active Reach"    value={totalReach >= 1000 ? `${(totalReach/1000).toFixed(1)}k` : String(totalReach)} color="blue" />
        <CampaignStat icon="💰" label="Total Revenue"   value={TargetedRouteEngine.formatPrice(totalRevenue)} color="gray" />
      </div>

      {/* System separation notice */}
      <div className="p-4 bg-gray-900/50 border border-gray-800 rounded-xl">
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-gray-400">
              <span className="font-semibold text-white">Targeted Campaigns</span> — dedicated postcard, you pick exact routes
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gray-600" />
            <span className="text-gray-600">
              Shared Postcard — see <Link href="/admin/availability" className="text-blue-500 hover:text-blue-400">Availability</Link> for spot-based campaigns
            </span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 border-b border-gray-800 pb-3 flex-wrap">
        {(["all", "pending_review", "active", "completed", "draft", "cancelled"] as const).map((f) => {
          const count = f === "all"
            ? localCampaigns.length
            : localCampaigns.filter((c) => c.status === f).length;
          if (f !== "all" && count === 0) return null;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition",
                filter === f ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {f === "all" ? "All" : STATUS_META[f].label} ({count})
            </button>
          );
        })}
      </div>

      {/* Campaign list */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center text-gray-600">
          <p className="text-4xl mb-3">🎯</p>
          <p className="text-sm">No campaigns in this status yet.</p>
          <Link
            href="/targeted"
            target="_blank"
            className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300"
          >
            + Create a targeted campaign →
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((campaign) => (
            <CampaignDetail
              key={campaign.id}
              campaign={campaign}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {/* City reach summary */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-white mb-4">Available Markets</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cities.map((city) => (
            <div key={city.id} className="p-3 bg-gray-800/50 rounded-xl">
              <p className="text-sm font-semibold text-white">{city.name}</p>
              <p className="text-xs text-gray-500 mt-1">{city.totalRoutes} routes</p>
              <p className="text-xs text-gray-500">{(city.totalHomes / 1_000).toFixed(1)}k homes available</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-4">
          Route availability and household counts are updated periodically.
          Future: income, home value, and ZIP cluster filters will narrow selectable routes.
        </p>
      </div>
    </div>
  );
}

function CampaignStat({
  icon, label, value, color,
}: {
  icon: string; label: string; value: string;
  color: "green" | "amber" | "blue" | "gray";
}) {
  const COLORS = {
    green: "border-green-800/30",
    amber: "border-amber-800/30",
    blue:  "border-blue-800/30",
    gray:  "border-gray-800",
  };
  return (
    <div className={cn("bg-gray-900 border rounded-xl p-4", COLORS[color])}>
      <div className="flex items-center gap-2 mb-2">
        <span>{icon}</span>
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}
