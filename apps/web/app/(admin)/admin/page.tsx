import type { Metadata } from "next";
import Link from "next/link";
import {
  MOCK_STATS,
  MOCK_CITIES,
  MOCK_RECENT_ACTIVITY,
} from "@/lib/admin/mock-data";

export const metadata: Metadata = { title: "Dashboard — HomeReach Admin" };

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  sold:     { icon: "💰", color: "bg-green-50 border-green-100" },
  reply:    { icon: "💬", color: "bg-blue-50 border-blue-100" },
  waitlist: { icon: "📋", color: "bg-purple-50 border-purple-100" },
  outreach: { icon: "📤", color: "bg-amber-50 border-amber-100" },
};

export default async function AdminDashboardPage() {
  const s = MOCK_STATS;

  return (
    <div className="space-y-8">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good morning, Jason 👋</h1>
          <p className="mt-1 text-gray-500">Here's what's happening across HomeReach today.</p>
        </div>
        <div className="flex gap-3 mt-1">
          <Link
            href="/admin/inbox"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            💬 Inbox
          </Link>
          <Link
            href="/admin/leads"
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
          >
            🎯 View Leads
          </Link>
        </div>
      </div>

      {/* ── Hero stat: MRR ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-7 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-200 uppercase tracking-wide">Monthly Recurring Revenue</p>
            <p className="mt-2 text-5xl font-bold">${s.mrr.toLocaleString()}</p>
            <p className="mt-2 text-blue-200 text-sm">
              <span className="text-green-300 font-semibold">↑ {s.mrrGrowth}%</span> vs. last month
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-200 mb-1">This month</div>
            <div className="text-3xl font-bold">{s.conversionsThisMonth}</div>
            <div className="text-sm text-blue-200">new clients signed</div>
          </div>
        </div>
      </div>

      {/* ── 4 secondary stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: "Active Clients",
            value: s.activeClients,
            sub: `${s.conversionsThisMonth} signed this month`,
            icon: "🏢",
            accent: "text-blue-600",
          },
          {
            label: "Total Leads",
            value: s.totalLeads,
            sub: `${s.newLeadsThisWeek} new this week`,
            icon: "🎯",
            accent: "text-purple-600",
          },
          {
            label: "Open Spots",
            value: s.openSpots,
            sub: "available to sell",
            icon: "📍",
            accent: "text-amber-600",
          },
          {
            label: "Waitlist",
            value: s.waitlistCount,
            sub: "pending signups",
            icon: "📋",
            accent: "text-pink-600",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-500">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className={`text-4xl font-bold ${card.accent}`}>{card.value}</p>
            <p className="mt-1.5 text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Cities + Activity ──────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">

        {/* Cities table — takes 3 columns */}
        <div className="lg:col-span-3 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
            <div>
              <h2 className="font-semibold text-gray-900">Cities</h2>
              <p className="text-xs text-gray-400 mt-0.5">Spot fill rate and revenue by market</p>
            </div>
            <Link href="/admin/cities" className="text-xs font-medium text-blue-600 hover:underline">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCK_CITIES.map((city) => {
              const fillPct = Math.round((city.spotsSold / city.spotsTotal) * 100);
              const barColor =
                fillPct >= 75 ? "bg-green-500" :
                fillPct >= 40 ? "bg-blue-500" :
                "bg-gray-300";
              return (
                <div key={city.name} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-36 shrink-0">
                    <p className="font-medium text-sm text-gray-900">{city.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{city.leads} leads</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">{city.spotsSold} / {city.spotsTotal} spots sold</span>
                      <span className="text-xs font-semibold text-gray-700">{fillPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-20 text-right shrink-0">
                    <p className="text-sm font-bold text-green-700">${city.mrr.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">/ mo</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Activity feed — takes 2 columns */}
        <div className="lg:col-span-2 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Recent Activity</h2>
            <p className="text-xs text-gray-400 mt-0.5">What's happened lately</p>
          </div>
          <div className="divide-y divide-gray-50">
            {MOCK_RECENT_ACTIVITY.map((item) => {
              const style = ACTIVITY_ICONS[item.type] ?? { icon: "•", color: "bg-gray-50 border-gray-100" };
              return (
                <div key={item.id} className="flex items-start gap-3 px-6 py-4">
                  <div className={`shrink-0 w-8 h-8 rounded-full border flex items-center justify-center text-sm ${style.color}`}>
                    {style.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700 leading-snug">{item.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{item.time}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
