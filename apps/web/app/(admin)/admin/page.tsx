import type { Metadata } from "next";
import Link from "next/link";
import {
  db,
  businesses,
  orders,
  waitlistEntries,
  cities,
  marketingCampaigns,
  outreachReplies,
} from "@homereach/db";
import { eq, count, sum, gte, isNull, desc, and } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dashboard — HomeReach Admin" };

// ── System health fetch (non-blocking) ────────────────────────────────────────
async function getSystemHealth() {
  try {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
    const res = await fetch(`${base}/api/admin/health`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<{
      status: "GREEN" | "YELLOW" | "RED";
      timestamp: string;
      summary: { total: number; passed: number; failed: number; warned: number };
      failedChecks: { name: string; message: string }[];
    }>;
  } catch {
    return null;
  }
}

const ACTIVITY_ICONS: Record<string, { icon: string; color: string }> = {
  sold:     { icon: "💰", color: "bg-green-50 border-green-100" },
  reply:    { icon: "💬", color: "bg-blue-50 border-blue-100" },
  waitlist: { icon: "📋", color: "bg-purple-50 border-purple-100" },
  outreach: { icon: "📤", color: "bg-amber-50 border-amber-100" },
};

function fmt(n: number | null | undefined) {
  return (n ?? 0).toLocaleString();
}

export default async function AdminDashboardPage() {
  const [health] = await Promise.all([getSystemHealth()]);

  // ── Real DB queries ────────────────────────────────────────────────────────
  const now        = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0);

  // Wrap all queries — if any table is missing or has schema differences,
  // fall back to empty results rather than crashing the page.
  const safeQuery = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const [
    activeClientsResult,
    newClientsThisMonthResult,
    totalLeadsResult,
    waitlistResult,
    mrrResult,
    lastMrrResult,
    activeCitiesResult,
    recentOrdersResult,
    recentWaitlistResult,
    recentRepliesResult,
  ] = await Promise.all([
    // Active clients
    safeQuery(() => db.select({ n: count() }).from(businesses).where(eq(businesses.status, "active")), [{ n: 0 }]),

    // New clients this month
    safeQuery(() => db.select({ n: count() }).from(businesses).where(
      and(eq(businesses.status, "active"), gte(businesses.createdAt, monthStart))
    ), [{ n: 0 }]),

    // Total leads (waitlist entries that haven't converted)
    safeQuery(() => db.select({ n: count() }).from(waitlistEntries), [{ n: 0 }]),

    // Unconverted waitlist
    safeQuery(() => db.select({ n: count() }).from(waitlistEntries).where(isNull(waitlistEntries.convertedToBusinessId)), [{ n: 0 }]),

    // MRR: sum of orders paid this month
    safeQuery(() => db.select({ total: sum(orders.total) }).from(orders).where(
      and(eq(orders.status, "paid"), gte(orders.paidAt, monthStart))
    ), [{ total: "0" }]),

    // Last month revenue for growth %
    safeQuery(() => db.select({ total: sum(orders.total) }).from(orders).where(
      and(
        eq(orders.status, "paid"),
        gte(orders.paidAt, lastMonthStart),
        gte(lastMonthEnd, orders.paidAt!)
      )
    ), [{ total: "0" }]),

    // Active cities (with active businesses)
    safeQuery(() => db.selectDistinct({ id: cities.id, name: cities.name, state: cities.state })
      .from(cities)
      .leftJoin(businesses, eq(businesses.cityId, cities.id))
      .where(eq(cities.isActive, true)), []),

    // Recent paid orders
    safeQuery(() => db.select({
      id: orders.id,
      total: orders.total,
      paidAt: orders.paidAt,
      businessId: orders.businessId,
    })
      .from(orders)
      .where(eq(orders.status, "paid"))
      .orderBy(desc(orders.paidAt))
      .limit(5), []),

    // Recent waitlist
    safeQuery(() => db.select({ id: waitlistEntries.id, email: waitlistEntries.email, businessName: waitlistEntries.businessName, createdAt: waitlistEntries.createdAt })
      .from(waitlistEntries)
      .orderBy(desc(waitlistEntries.createdAt))
      .limit(5), []),

    // Recent inbound replies
    safeQuery(() => db.select({ id: outreachReplies.id, body: outreachReplies.body, receivedAt: outreachReplies.receivedAt })
      .from(outreachReplies)
      .orderBy(desc(outreachReplies.receivedAt))
      .limit(5), []),
  ]);

  const activeClients    = activeClientsResult[0]?.n ?? 0;
  const newClientsMonth  = newClientsThisMonthResult[0]?.n ?? 0;
  const totalLeads       = totalLeadsResult[0]?.n ?? 0;
  const waitlistCount    = waitlistResult[0]?.n ?? 0;
  const mrr              = Math.round(Number(mrrResult[0]?.total ?? 0));
  const lastMrr          = Math.round(Number(lastMrrResult[0]?.total ?? 0));
  const mrrGrowth        = lastMrr > 0 ? Math.round(((mrr - lastMrr) / lastMrr) * 100) : 0;

  // Build city rows with business counts
  const cityBusinessCounts = await Promise.all(
    activeCitiesResult.slice(0, 6).map(async (city) => {
      const [active] = await safeQuery(() => db.select({ n: count() }).from(businesses)
        .where(and(eq(businesses.cityId, city.id), eq(businesses.status, "active"))), [{ n: 0 }]);
      const [total]  = await safeQuery(() => db.select({ n: count() }).from(businesses)
        .where(eq(businesses.cityId, city.id)), [{ n: 0 }]);
      return { ...city, active: active?.n ?? 0, total: total?.n ?? 0 };
    })
  );

  // Build activity feed from real events
  type ActivityItem = { id: string; type: string; text: string; time: string };
  const activity: ActivityItem[] = [];

  for (const o of recentOrdersResult) {
    activity.push({
      id:   `order-${o.id}`,
      type: "sold",
      text: `New client signed — $${Number(o.total).toLocaleString()}`,
      time: o.paidAt ? new Date(o.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently",
    });
  }
  for (const w of recentWaitlistResult) {
    activity.push({
      id:   `waitlist-${w.id}`,
      type: "waitlist",
      text: `${w.businessName ?? w.email} joined the waitlist`,
      time: w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently",
    });
  }
  for (const r of recentRepliesResult) {
    activity.push({
      id:   `reply-${r.id}`,
      type: "reply",
      text: `Inbound reply: "${r.body.slice(0, 50)}${r.body.length > 50 ? "…" : ""}"`,
      time: r.receivedAt ? new Date(r.receivedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "recently",
    });
  }

  // Sort by recency (best-effort: use id ordering for now)
  const sortedActivity = activity.slice(0, 8);

  const healthColor = {
    GREEN:  { bg: "bg-green-50 border-green-200",  dot: "bg-green-500", text: "text-green-800", label: "All systems operational" },
    YELLOW: { bg: "bg-amber-50 border-amber-200",  dot: "bg-amber-500", text: "text-amber-800", label: "Minor issues detected" },
    RED:    { bg: "bg-red-50 border-red-200",      dot: "bg-red-500",   text: "text-red-800",   label: "Critical failure — action required" },
  }[health?.status ?? "GREEN"];

  return (
    <div className="space-y-8">

      {/* ── System Health Banner ─────────────────────────────────────────── */}
      <div className={`flex items-center justify-between rounded-xl border px-5 py-3 ${healthColor.bg}`}>
        <div className="flex items-center gap-3">
          <span className={`inline-block h-3 w-3 rounded-full ${healthColor.dot} animate-pulse`} />
          <span className={`text-sm font-semibold ${healthColor.text}`}>
            SYSTEM {health?.status ?? "UNKNOWN"} — {healthColor.label}
          </span>
          {health && health.summary.failed > 0 && (
            <span className="text-xs text-red-700 font-medium">
              {health.summary.failed} check{health.summary.failed !== 1 ? "s" : ""} failing
            </span>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          {health && (
            <span>Last checked: {new Date(health.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span>
          )}
          <Link href="/admin/control-center" className="font-medium text-blue-600 hover:underline">
            View details →
          </Link>
        </div>
      </div>

      {/* ── Failed checks (RED/YELLOW only) ─────────────────────────────── */}
      {health && health.failedChecks.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
          <p className="text-sm font-bold text-red-800 mb-2">⚠️ Action Required</p>
          <ul className="space-y-1">
            {health.failedChecks.map((c) => (
              <li key={c.name} className="text-sm text-red-700">
                <span className="font-mono font-semibold">{c.name}</span>: {c.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Good morning, Jason 👋</h1>
          <p className="mt-1 text-gray-500">Here&apos;s what&apos;s happening across HomeReach today.</p>
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
            <p className="text-sm font-medium text-blue-200 uppercase tracking-wide">Revenue This Month</p>
            <p className="mt-2 text-5xl font-bold">${fmt(mrr)}</p>
            {lastMrr > 0 ? (
              <p className="mt-2 text-blue-200 text-sm">
                <span className={`font-semibold ${mrrGrowth >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {mrrGrowth >= 0 ? "↑" : "↓"} {Math.abs(mrrGrowth)}%
                </span>{" "}
                vs. last month
              </p>
            ) : (
              <p className="mt-2 text-blue-200 text-sm">First month of revenue tracking</p>
            )}
          </div>
          <div className="text-right">
            <div className="text-sm text-blue-200 mb-1">This month</div>
            <div className="text-3xl font-bold">{newClientsMonth}</div>
            <div className="text-sm text-blue-200">new clients signed</div>
          </div>
        </div>
      </div>

      {/* ── 4 secondary stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: "Active Clients",
            value: activeClients,
            sub: `${newClientsMonth} signed this month`,
            icon: "🏢",
            accent: "text-blue-600",
          },
          {
            label: "Total Leads",
            value: totalLeads,
            sub: "waitlist entries",
            icon: "🎯",
            accent: "text-purple-600",
          },
          {
            label: "Active Cities",
            value: activeCitiesResult.length,
            sub: "markets live",
            icon: "📍",
            accent: "text-amber-600",
          },
          {
            label: "Waitlist",
            value: waitlistCount,
            sub: "unconverted signups",
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
              <h2 className="font-semibold text-gray-900">Active Cities</h2>
              <p className="text-xs text-gray-400 mt-0.5">Businesses by market</p>
            </div>
            <Link href="/admin/cities" className="text-xs font-medium text-blue-600 hover:underline">
              Manage →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {cityBusinessCounts.length === 0 && (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No active cities yet. <Link href="/admin/cities" className="text-blue-600 underline">Add one →</Link></p>
            )}
            {cityBusinessCounts.map((city) => {
              const fillPct = city.total > 0 ? Math.round((city.active / city.total) * 100) : 0;
              const barColor = fillPct >= 75 ? "bg-green-500" : fillPct >= 40 ? "bg-blue-500" : "bg-gray-300";
              return (
                <div key={city.id} className="flex items-center gap-4 px-6 py-4">
                  <div className="w-40 shrink-0">
                    <p className="font-medium text-sm text-gray-900">{city.name}, {city.state}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{city.total} businesses total</p>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-gray-500">{city.active} active</span>
                      <span className="text-xs font-semibold text-gray-700">{fillPct}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${fillPct}%` }} />
                    </div>
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
            <p className="text-xs text-gray-400 mt-0.5">Live from database</p>
          </div>
          <div className="divide-y divide-gray-50">
            {sortedActivity.length === 0 && (
              <p className="px-6 py-8 text-sm text-gray-400 text-center">No activity yet.</p>
            )}
            {sortedActivity.map((item) => {
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
