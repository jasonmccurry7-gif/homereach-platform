"use client";

import Link from "next/link";
import { useState } from "react";
import type { CityAvailability, Reservation } from "@/lib/engine/types";
import type { Lead, Conversation } from "@/lib/admin/mock-data";
import { AvailabilityEngine } from "@/lib/engine/availability";
import { ReservationEngine }  from "@/lib/engine/reservation";
import { cn } from "@/lib/utils";
import { MockDataBanner } from "@/components/admin/mock-data-banner";

// ─────────────────────────────────────────────────────────────────────────────
// HomeReach OS Hub — Control Center
// ─────────────────────────────────────────────────────────────────────────────

interface Snapshot {
  activeCities: number;
  totalCities: number;
  spotsFilled: number;
  totalSpots: number;
  estimatedMRR: number;
  totalLeads: number;
  conversionRate: number;
  activeAgents: number;
  migratedClients: number;
  activeCampaigns: number;
  pendingCampaigns: number;
  campaignReach: number;
}

interface Props {
  cities: CityAvailability[];
  activeReservations: Reservation[];
  hotLeads: Lead[];
  awaitingIntake: Lead[];
  recentlyClosed: Lead[];
  activeConversations: Conversation[];
  snapshot: Snapshot;
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

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "< 1h ago";
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const LEAD_STATUS_STYLES: Record<string, string> = {
  lead:       "bg-gray-700 text-gray-300",
  interested: "bg-amber-900/50 text-amber-300",
  sold:       "bg-green-900/50 text-green-300",
  closed_won: "bg-emerald-900/50 text-emerald-300",
};

// ── Quick Action Modal ──────────────────────────────────────────────────────

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

export function HubClient({
  cities,
  activeReservations,
  hotLeads,
  awaitingIntake,
  recentlyClosed,
  activeConversations,
  snapshot,
}: Props) {
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

        {/* ── Mock Data Warning ─────────────────────────────────────── */}
        <MockDataBanner items={["Lead pipeline", "Conversion stats", "MRR estimate", "Active agents", "Campaign data"]} />

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
              <p className="text-xs text-blue-200 mt-1">{snapshot.migratedClients} legacy + new clients</p>
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
            <SnapshotCard icon="👥" label="Active Agents"
              value={String(snapshot.activeAgents)}
              sub={`${snapshot.migratedClients} migrated clients`} />
            <SnapshotCard icon="📬" label="Campaigns"
              value={String(snapshot.activeCampaigns)}
              sub={
                snapshot.pendingCampaigns > 0
                  ? `${snapshot.pendingCampaigns} pending review`
                  : snapshot.campaignReach >= 1000
                    ? `${(snapshot.campaignReach / 1000).toFixed(1)}k homes reached`
                    : `${snapshot.campaignReach} homes reached`
              } />
          </div>
        </section>

        {/* ── B: Quick Access Panel ─────────────────────────────────── */}
        <section>
          <SectionHeader label="Quick Access" sub="Jump anywhere in the system" />
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <QuickAccessCard icon="🌐" label="Website"       href="/"                  />
            <QuickAccessCard icon="📝" label="Intake Form"   href="/get-started"        />
            <QuickAccessCard icon="📊" label="ROI Dashboard" href="/admin/roi-preview"  />
            <QuickAccessCard icon="💬" label="Inbox"         href="/admin/inbox"
              badge={activeConversations.length > 0 ? String(activeConversations.length) : undefined} />
            <QuickAccessCard icon="📍" label="Availability"  href="/admin/availability" />
            <QuickAccessCard icon="📬" label="Campaigns"     href="/admin/campaigns"
              badge={snapshot.pendingCampaigns > 0 ? String(snapshot.pendingCampaigns) : undefined} />
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
                {cities.map((city) => {
                  const urgency = AvailabilityEngine.getUrgencyLevel(city.availableSpots, city.totalSpots);
                  return (
                    <div key={city.cityId} className="py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-sm font-semibold text-white")}>{city.cityName}</span>
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

            {/* ── D: Sales Command ──────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

              {/* Hot Leads */}
              <Panel title="🔥 Hot Leads" sub="Interested, no spot yet">
                {hotLeads.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No hot leads right now</p>
                ) : (
                  <div className="space-y-2">
                    {hotLeads.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                          <p className="text-xs text-gray-400">{lead.city} · {lead.category}</p>
                        </div>
                        <span className="text-xs font-semibold text-amber-400">${lead.monthlyValue}/mo</span>
                      </div>
                    ))}
                  </div>
                )}
                <Link href="/admin/leads" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  View all leads →
                </Link>
              </Panel>

              {/* Awaiting Intake */}
              <Panel title="📋 Awaiting Intake" sub="Interested but form not sent">
                {awaitingIntake.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">All intakes sent</p>
                ) : (
                  <div className="space-y-2">
                    {awaitingIntake.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                          <p className="text-xs text-gray-400">{lead.category} · {lead.city}</p>
                        </div>
                        <button
                          onClick={() => showToast(`Intake link sent to ${lead.name}`)}
                          className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition shrink-0"
                        >
                          Send
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              {/* Active Conversations */}
              <Panel title="💬 Unread Conversations" sub="Need your reply">
                {activeConversations.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">Inbox clear</p>
                ) : (
                  <div className="space-y-2">
                    {activeConversations.map((conv) => (
                      <Link
                        key={conv.id}
                        href="/admin/inbox"
                        className="flex items-center gap-3 p-3 bg-gray-800/50 hover:bg-gray-800 rounded-lg transition"
                      >
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
                          {conv.leadName[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{conv.leadName}</p>
                          <p className="text-xs text-gray-400 truncate">{conv.lastMessage}</p>
                        </div>
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold shrink-0">
                          {conv.unreadCount}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link href="/admin/inbox" className="mt-3 text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                  Open inbox →
                </Link>
              </Panel>

              {/* Recently Closed */}
              <Panel title="✅ Recently Closed" sub="Deals won">
                {recentlyClosed.length === 0 ? (
                  <p className="text-sm text-gray-500 py-2">No closed deals yet</p>
                ) : (
                  <div className="space-y-2">
                    {recentlyClosed.map((lead) => (
                      <div key={lead.id} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-800/30 rounded-lg">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{lead.businessName}</p>
                          <p className="text-xs text-gray-400">{lead.category} · {lead.city}</p>
                        </div>
                        <span className="text-xs font-semibold text-green-400">${lead.monthlyValue}/mo</span>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>
            </div>
          </div>

          {/* RIGHT: 1/3 width */}
          <div className="space-y-6">

            {/* ── E: Quick Actions ────────────────────────────────────── */}
            <Panel title="⚡ Quick Actions" sub="One-click system operations">
              <div className="grid grid-cols-2 gap-2.5">
                <QuickActionButton icon="📝" label="Send Intake" sublabel="to a lead"
                  color="blue" onClick={() => showToast("Choose a lead to send intake")} />
                <QuickActionButton icon="🏙️" label="New City"    sublabel="add market"
                  color="green" href="/admin/availability" />
                <QuickActionButton icon="🔒" label="Lock Spot"   sublabel="category lock"
                  color="amber" onClick={() => showToast("Navigate to Availability to lock/unlock")} />
                <QuickActionButton icon="✅" label="Close Deal"  sublabel="mark as sold"
                  color="purple" onClick={() => showToast("Choose a lead to mark closed")} />
                <QuickActionButton icon="📬" label="Campaign"    sublabel="new targeted"
                  color="blue" href="/targeted" />
                <QuickActionButton icon="🔄" label="Migration"   sublabel="add legacy client"
                  color="gray" href="/admin/migration" />
                <QuickActionButton icon="👤" label="Agent View"  sublabel="preview dashboard"
                  color="gray" href="/admin/agent-view" />
              </div>
            </Panel>

            {/* ── Reservations Expiring ─────────────────────────────── */}
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
            <Panel title="🔗 System Links" sub="External tools & portals">
              <div className="space-y-1.5">
                {[
                  { label: "Admin Panel",     href: "/admin",                icon: "🏠" },
                  { label: "Sales Engine",    href: "/admin/sales-engine",   icon: "⚡" },
                  { label: "Sales Dashboard", href: "/admin/agent-view",     icon: "🎯" },
                  { label: "ROI Dashboard",   href: "/admin/roi-preview",    icon: "📊" },
                  { label: "Campaigns",       href: "/admin/campaigns",      icon: "📬" },
                  { label: "Profit Center",   href: "/admin/profit-center",  icon: "💰" },
                  { label: "Reviews",         href: "/admin/reviews",        icon: "⭐" },
                  { label: "Legacy Import",   href: "/admin/legacy-import",  icon: "🗄️" },
                  { label: "Client Migration",href: "/admin/migration",      icon: "🔄" },
                  { label: "Agents",          href: "/admin/agents",         icon: "👥" },
                  { label: "Leads",           href: "/admin/leads",          icon: "📋" },
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

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-bold text-white">{label}</h2>
      <p className="text-xs text-gray-500">{sub}</p>
    </div>
  );
}

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
