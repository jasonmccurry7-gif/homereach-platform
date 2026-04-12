"use client";

import Link from "next/link";
import { useState } from "react";
import type { CityAvailability, Reservation } from "@/lib/engine/types";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine }  from "@/lib/engine/reservation";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach OS Hub — Control Center
// All data is live from the database via hub/page.tsx server component.
// ─────────────────────────────────────────────────────────────────────────────

interface Snapshot {
  activeCities:     number;
  totalCities:      number;
  spotsFilled:      number;
  totalSpots:       number;
  estimatedMRR:     number;
  totalLeads:       number;
  newLeadsThisWeek: number;
  activeClients:    number;
  activeCampaigns:  number;
  upcomingCampaigns: number;
  unreadReplies:    number;
  waitlistCount:    number;
  conversionRate:   number;
}

interface Props {
  cities:             CityAvailability[];
  activeReservations: Reservation[];
  snapshot:           Snapshot;
}

const STATUS_URGENCY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high:     "text-orange-400",
  medium:   "text-yellow-400",
  low:      "text-green-400",
};

function fillBar(filled: number, total: number) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full",
            pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-blue-500" : "bg-gray-500"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-14 text-right">{filled}/{total}</span>
    </div>
  );
}

// ── Quick Action Button ────────────────────────────────────────────────────

function QuickActionButton({
  icon, label, sublabel, onClick, href, color = "gray",
}: {
  icon: string;
  label: string;
  sublabel: string;
  onClick?: () => void;
  href?: string;
  color?: "blue" | "green" | "amber" | "red" | "purple" | "gray";
}) {
  const COLORS = {
    blue:   "border-blue-700/50 hover:border-blue-500 hover:bg-blue-900/30",
    green:  "border-green-700/50 hover:border-green-500 hover:bg-green-900/30",
    amber:  "border-amber-700/50 hover:border-amber-500 hover:bg-amber-900/30",
    red:    "border-red-700/50 hover:border-red-500 hover:bg-red-900/30",
    purple: "border-purple-700/50 hover:border-purple-500 hover:bg-purple-900/30",
    gray:   "border-gray-700 hover:border-gray-500 hover:bg-gray-800",
  };
  const cls = cn(
    "flex flex-col gap-1.5 p-4 rounded-xl border bg-gray-900/50 cursor-pointer transition-all group",
    COLORS[color]
  );
  const content = (
    <>
      <span className="text-2xl">{icon}</span>
      <p className="text-sm font-semibold text-white group-hover:text-white/90">{label}</p>
      <p className="text-xs text-gray-500">{sublabel}</p>
    </>
  );
  if (href) return <Link href={href} className={cls}>{content}</Link>;
  return <button onClick={onClick} className={cls}>{content}</button>;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function HubClient({ cities, activeReservations, snapshot }: Props) {
  const [actionToast, setActionToast] = useState<string | null>(null);

  function showToast(msg: string) {
    setActionToast(msg);
    setTimeout(() => setActionToast(null), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/60 backdrop-blur sticky top-0 z-10">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">HomeReach OS</h1>
            <p className="text-xs text-gray-500">Control Center · Live System View</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              System Live
            </span>
            <span className="text-xs text-gray-600">|</span>
            <span className="text-xs text-gray-400">
              {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8 max-w-[1400px] mx-auto">

        {/* ── Toast ─────────────────────────────────────────────────── */}
        {actionToast && (
          <div className="fixed bottom-6 right-6 z-50 bg-gray-800 border border-gray-700 text-white text-sm px-4 py-3 rounded-xl shadow-lg">
            ✅ {actionToast}
          </div>
        )}

        {/* ── A: System Snapshot ────────────────────────────────────── */}
        <section>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {/* MRR Hero */}
            <div className="col-span-2 md:col-span-3 xl:col-span-1 bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-5">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-wide">Est. MRR</p>
              <p className="text-3xl font-bold text-white mt-1">${snapshot.estimatedMRR.toLocaleString()}</p>
              <p className="text-xs text-blue-200 mt-1">{snapshot.activeClients} active clients</p>
            </div>

            <SnapshotCard icon="🏙️" label="Active Cities"
              value={`${snapshot.activeCities} / ${snapshot.totalCities}`}
              sub={`${snapshot.totalCities - snapshot.activeCities} launching soon`} />
            <SnapshotCard icon="📍" label="Spots Filled"
              value={`${snapshot.spotsFilled} / ${snapshot.totalSpots}`}
              sub={`${snapshot.totalSpots - snapshot.spotsFilled} still available`} />
            <SnapshotCard icon="🎯" label="Total Leads"
              value={String(snapshot.totalLeads)}
              sub={`${snapshot.conversionRate}% conversion rate`} />
            <SnapshotCard icon="📋" label="Waitlist"
              value={String(snapshot.waitlistCount)}
              sub={`+${snapshot.newLeadsThisWeek} this week`} />
            <SnapshotCard icon="📬" label="Campaigns"
              value={String(snapshot.activeCampaigns)}
              sub={
                snapshot.upcomingCampaigns > 0
                  ? `${snapshot.upcomingCampaigns} upcoming`
                  : "All campaigns live"
              } />
          </div>
        </section>

        {/* ── B: Quick Access Panel ─────────────────────────────────── */}
        <section>
          <div className="mb-3">
            <h2 className="text-sm font-bold text-white">Quick Access</h2>
            <p className="text-xs text-gray-500">Jump anywhere in the system</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <QuickAccessCard icon="🌐" label="Website"       href="/"                  />
            <QuickAccessCard icon="📝" label="Intake Form"   href="/get-started"        />
            <QuickAccessCard icon="📊" label="ROI Dashboard" href="/admin/roi-preview"  />
            <QuickAccessCard icon="💬" label="Inbox"         href="/admin/inbox"
              badge={snapshot.unreadReplies > 0 ? String(snapshot.unreadReplies) : undefined} />
            <QuickAccessCard icon="📍" label="Availability"  href="/admin/availability" />
            <QuickAccessCard icon="📬" label="Campaigns"     href="/admin/campaigns"
              badge={snapshot.upcomingCampaigns > 0 ? String(snapshot.upcomingCampaigns) : undefined} />
            <QuickAccessCard icon="🎨" label="Ad Designer"   href="/admin/ad-designer"  />
            <QuickAccessCard icon="🔄" label="Migration"     href="/admin/migration"    />
          </div>
        </section>

        {/* ── Main Grid: Left + Right ────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* LEFT: 2/3 width */}
          <div className="xl:col-span-2 space-y-6">

            {/* ── C: City Control ───────────────────────────────────── */}
            <Panel title="City Control" sub="Spot fill rate & campaign status per market">
              <div className="divide-y divide-gray-800">
                {cities.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No cities configured yet.</p>
                ) : cities.map((city) => {
                  const urgency = AvailabilityEngine.getUrgencyLevel(city.availableSpots, city.totalSpots);
                  return (
                    <div key={city.cityId} className="py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white">{city.cityName}</span>
                          <span className={cn("text-xs font-medium", STATUS_URGENCY_COLOR[urgency])}>
                            {urgency === "critical" ? "🔴 Critical" :
                             urgency === "high"     ? "🟠 High"     :
                             urgency === "medium"   ? "🟡 Active"   : "🟢 Open"}
                          </span>
                        </div>
                        {fillBar(city.soldSpots + city.reservedSpots, city.totalSpots)}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Link
                          href={`/get-started?city=${encodeURIComponent(city.cityName)}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                        >
                          Intake
                        </Link>
                        <Link
                          href={`/admin/inbox?city=${encodeURIComponent(city.cityName)}`}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition"
                        >
                          Convos
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* ── D: Pipeline Overview ──────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Leads Summary */}
              <Panel title="🎯 Lead Pipeline" sub="All leads from waitlist & outreach">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-300">Total Leads</p>
                    <span className="text-lg font-bold text-white">{snapshot.totalLeads}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">New This Week</p>
                    <span className="text-lg font-bold text-amber-400">+{snapshot.newLeadsThisWeek}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">Active Clients</p>
                    <span className="text-lg font-bold text-green-400">{snapshot.activeClients}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">Conversion Rate</p>
                    <span className="text-lg font-bold text-blue-400">{snapshot.conversionRate}%</span>
                  </div>
                </div>
                <Link href="/admin/leads" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View all leads →
                </Link>
              </Panel>

              {/* Waitlist */}
              <Panel title="📋 Waitlist" sub="Prospects not yet converted">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                    <p className="text-sm text-gray-300">On Waitlist</p>
                    <span className="text-lg font-bold text-white">{snapshot.waitlistCount}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-purple-900/20 border border-purple-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">Joined This Week</p>
                    <span className="text-lg font-bold text-purple-400">+{snapshot.newLeadsThisWeek}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-gray-500">
                  These are prospects who signed up but haven't purchased a spot yet.
                </p>
                <Link href="/admin/leads" className="mt-2 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View leads →
                </Link>
              </Panel>

              {/* Unread Inbox */}
              <Panel title="💬 Unread Replies" sub="SMS & email responses needing attention">
                <div className="flex items-center justify-center py-4">
                  {snapshot.unreadReplies === 0 ? (
                    <div className="text-center">
                      <p className="text-3xl mb-2">✅</p>
                      <p className="text-sm text-gray-400">Inbox clear</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <p className={cn(
                        "text-5xl font-bold mb-2",
                        snapshot.unreadReplies > 10 ? "text-red-400" : "text-amber-400"
                      )}>
                        {snapshot.unreadReplies}
                      </p>
                      <p className="text-sm text-gray-400">unread {snapshot.unreadReplies === 1 ? "reply" : "replies"}</p>
                    </div>
                  )}
                </div>
                <Link href="/admin/inbox" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Open inbox →
                </Link>
              </Panel>

              {/* Campaign Summary */}
              <Panel title="📬 Campaign Status" sub="Active & upcoming postcard runs">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">Active Campaigns</p>
                    <span className="text-lg font-bold text-green-400">{snapshot.activeCampaigns}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-900/20 border border-blue-800/30 rounded-lg">
                    <p className="text-sm text-gray-300">Upcoming</p>
                    <span className="text-lg font-bold text-blue-400">{snapshot.upcomingCampaigns}</span>
                  </div>
                </div>
                <Link href="/admin/campaigns" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View all campaigns →
                </Link>
              </Panel>
            </div>
          </div>

          {/* RIGHT: 1/3 width */}
          <div className="space-y-6">

            {/* ── E: Quick Actions ────────────────────────────────────── */}
            <Panel title="⚡ Quick Actions" sub="One-click system operations">
              <div className="grid grid-cols-2 gap-2.5">
                <QuickActionButton icon="📝" label="Send Intake" sublabel="to a lead"
                  color="blue" onClick={() => showToast("Navigate to Leads to send intake")} />
                <QuickActionButton icon="🏙️" label="New City"    sublabel="add market"
                  color="green" href="/admin/availability" />
                <QuickActionButton icon="🔒" label="Lock Spot"   sublabel="category lock"
                  color="amber" onClick={() => showToast("Navigate to Availability to lock/unlock")} />
                <QuickActionButton icon="✅" label="Close Deal"  sublabel="mark as sold"
                  color="purple" onClick={() => showToast("Navigate to Leads to mark closed")} />
                <QuickActionButton icon="📬" label="Campaign"    sublabel="view campaigns"
                  color="blue" href="/admin/campaigns" />
                <QuickActionButton icon="🔄" label="Migration"   sublabel="add legacy client"
                  color="gray" href="/admin/migration" />
                <QuickActionButton icon="👤" label="Agent View"  sublabel="preview dashboard"
                  color="gray" href="/admin/agent-view" />
              </div>
            </Panel>

            {/* ── Reservations ─────────────────────────────────────── */}
            <Panel title="⏱️ Active Reservations" sub="Spots on hold">
              {activeReservations.length === 0 ? (
                <p className="text-sm text-gray-500 py-2">No active reservations</p>
              ) : (
                <div className="space-y-2">
                  {activeReservations.map((res) => {
                    const hrs = ReservationEngine.hoursRemaining(res);
                    const isUrgent = hrs <= 6;
                    return (
                      <div key={res.id} className={cn(
                        "p-3 rounded-lg border",
                        isUrgent
                          ? "bg-red-900/20 border-red-800/40"
                          : "bg-gray-800/50 border-gray-700/50"
                      )}>
                        <p className="text-sm font-medium text-white">{res.businessName}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-xs text-gray-400">
                            {res.categoryId.replace("cat-", "")} · {res.cityId.replace("city-", "")}
                          </p>
                          <span className={cn("text-xs font-semibold", isUrgent ? "text-red-400" : "text-gray-400")}>
                            {ReservationEngine.countdownLabel(res)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <Link href="/admin/availability" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                Manage availability →
              </Link>
            </Panel>

            {/* ── System Links ──────────────────────────────────────── */}
            <Panel title="🔗 System Links" sub="All admin sections">
              <div className="space-y-1.5">
                {[
                  { label: "Admin Home",      href: "/admin",                icon: "🏠" },
                  { label: "Leads",           href: "/admin/leads",          icon: "📋" },
                  { label: "Inbox",           href: "/admin/inbox",          icon: "💬" },
                  { label: "Campaigns",       href: "/admin/campaigns",      icon: "📬" },
                  { label: "Availability",    href: "/admin/availability",   icon: "📍" },
                  { label: "Businesses",      href: "/admin/businesses",     icon: "🏢" },
                  { label: "ROI Dashboard",   href: "/admin/roi-preview",    icon: "📊" },
                  { label: "Sales Engine",    href: "/admin/sales-engine",   icon: "⚡" },
                  { label: "Agent View",      href: "/admin/agent-view",     icon: "🎯" },
                  { label: "Reviews",         href: "/admin/reviews",        icon: "⭐" },
                  { label: "Client Migration",href: "/admin/migration",      icon: "🔄" },
                  { label: "Agents",          href: "/admin/agents",         icon: "👥" },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-800 text-gray-300 hover:text-white transition text-sm"
                  >
                    <span>{link.icon}</span>
                    {link.label}
                    <span className="ml-auto text-gray-600">→</span>
                  </Link>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Shared Sub-components ─────────────────────────────────────────────────

function SnapshotCard({ icon, label, value, sub }: {
  icon: string; label: string; value: string; sub: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  );
}

function Panel({ title, sub, children }: {
  title: string; sub?: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div className="mb-4">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function QuickAccessCard({
  icon, label, href, badge,
}: {
  icon: string; label: string; href: string; badge?: string;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col items-center gap-2 p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-blue-600 hover:bg-gray-800 transition group"
    >
      {badge && (
        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
          {badge}
        </span>
      )}
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-medium text-gray-400 group-hover:text-white transition text-center">{label}</span>
    </Link>
  );
}
