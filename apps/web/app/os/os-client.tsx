"use client";

import Link from "next/link";
import { useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// OS Client — Unified Operator Control Center UI
// All systems in one place. Zero fragmentation.
// ─────────────────────────────────────────────────────────────────────────────

interface OSStats {
  activeSpots: number;
  pendingSpots: number;
  mrr: number;
  pendingIntake: number;
  activeClients: number;
  activeCampaigns: number;
  unreadReplies: number;
  waitlist: number;
}

interface SystemTile {
  label: string;
  description: string;
  href: string;
  emoji: string;
  badge?: string | number;
  badgeColor?: "red" | "yellow" | "green" | "blue";
  external?: boolean;
  category: "internal" | "external";
  group: string;
}

export function OSClient({ stats }: { stats: OSStats }) {
  const [activeGroup, setActiveGroup] = useState<string>("all");

  const tiles: SystemTile[] = [
    // ── Revenue ──────────────────────────────────────────────────────────────
    {
      label: "Admin Dashboard",
      description: "MRR, active clients, leads, city overview",
      href: "/admin",
      emoji: "🏠",
      badge: `$${stats.mrr.toLocaleString()}/mo`,
      badgeColor: "green",
      category: "internal",
      group: "revenue",
    },
    {
      label: "Spots Management",
      description: "Spot assignments, status overrides, exclusivity",
      href: "/admin/spots",
      emoji: "📍",
      badge: stats.pendingSpots > 0 ? `${stats.pendingSpots} pending` : stats.activeSpots,
      badgeColor: stats.pendingSpots > 0 ? "yellow" : "blue",
      category: "internal",
      group: "revenue",
    },
    {
      label: "Sales Engine",
      description: "Pipeline, deal stages, revenue projections",
      href: "/admin/sales-engine",
      emoji: "⚡",
      badge: "NEW",
      badgeColor: "blue",
      category: "internal",
      group: "revenue",
    },
    {
      label: "Checkout / Funnel",
      description: "Live checkout pages, spot availability, pricing",
      href: "/checkout",
      emoji: "🛒",
      category: "internal",
      group: "revenue",
    },
    {
      label: "ROI Preview",
      description: "Client-facing ROI calculator",
      href: "/admin/roi-preview",
      emoji: "📊",
      category: "internal",
      group: "revenue",
    },

    // ── Fulfillment ───────────────────────────────────────────────────────────
    {
      label: "Intake Queue",
      description: "New client onboarding submissions",
      href: "/admin/intake",
      emoji: "📥",
      badge: stats.pendingIntake > 0 ? stats.pendingIntake : undefined,
      badgeColor: "red",
      category: "internal",
      group: "fulfillment",
    },
    {
      label: "Campaigns",
      description: "Marketing campaigns, send status, performance",
      href: "/admin/campaigns",
      emoji: "📣",
      badge: stats.activeCampaigns > 0 ? `${stats.activeCampaigns} active` : undefined,
      badgeColor: "green",
      category: "internal",
      group: "fulfillment",
    },
    {
      label: "Targeted Campaigns",
      description: "AI-driven targeted outreach sequences",
      href: "/admin/targeted-campaigns",
      emoji: "📬",
      badge: "NEW",
      badgeColor: "blue",
      category: "internal",
      group: "fulfillment",
    },
    {
      label: "Ad Designer",
      description: "Campaign creative builder",
      href: "/admin/ad-designer",
      emoji: "🎨",
      category: "internal",
      group: "fulfillment",
    },

    // ── Growth ────────────────────────────────────────────────────────────────
    {
      label: "Leads",
      description: "All leads, source tracking, conversion status",
      href: "/admin/leads",
      emoji: "🎯",
      category: "internal",
      group: "growth",
    },
    {
      label: "Inbox",
      description: "Inbound SMS/email replies, AI routing",
      href: "/admin/inbox",
      emoji: "💬",
      badge: stats.unreadReplies > 0 ? stats.unreadReplies : undefined,
      badgeColor: "red",
      category: "internal",
      group: "growth",
    },
    {
      label: "Waitlist",
      description: "Pre-launch signups and demand signals",
      href: "/admin/waitlist",
      emoji: "📋",
      badge: stats.waitlist > 0 ? stats.waitlist : undefined,
      badgeColor: "blue",
      category: "internal",
      group: "growth",
    },
    {
      label: "Availability",
      description: "City/category spot availability matrix",
      href: "/admin/availability",
      emoji: "🗺️",
      category: "internal",
      group: "growth",
    },

    // ── Clients ───────────────────────────────────────────────────────────────
    {
      label: "Businesses",
      description: "All businesses, subscription status, history",
      href: "/admin/businesses",
      emoji: "🏢",
      badge: stats.activeClients > 0 ? `${stats.activeClients} active` : undefined,
      badgeColor: "green",
      category: "internal",
      group: "clients",
    },
    {
      label: "Client Dashboard",
      description: "Client-facing portal (as-client view)",
      href: "/dashboard",
      emoji: "👤",
      category: "internal",
      group: "clients",
    },
    {
      label: "Reviews",
      description: "Client reviews and testimonials",
      href: "/admin/reviews",
      emoji: "⭐",
      category: "internal",
      group: "clients",
    },
    {
      label: "Profit Center",
      description: "Revenue reporting and margin analysis",
      href: "/admin/profit-center",
      emoji: "💰",
      category: "internal",
      group: "clients",
    },

    // ── Ops ───────────────────────────────────────────────────────────────────
    {
      label: "Orders",
      description: "Order history and payment records",
      href: "/admin/orders",
      emoji: "🧾",
      category: "internal",
      group: "ops",
    },
    {
      label: "Cities",
      description: "Market management and configuration",
      href: "/admin/cities",
      emoji: "🗺️",
      category: "internal",
      group: "ops",
    },
    {
      label: "Agents",
      description: "Sales agent accounts and performance",
      href: "/admin/agents",
      emoji: "👥",
      category: "internal",
      group: "ops",
    },
    {
      label: "Users",
      description: "All platform user accounts",
      href: "/admin/users",
      emoji: "🙋",
      category: "internal",
      group: "ops",
    },
    {
      label: "Legacy Import",
      description: "Import historical data from old platform",
      href: "/admin/legacy-import",
      emoji: "🗄️",
      category: "internal",
      group: "ops",
    },

    // ── External ──────────────────────────────────────────────────────────────
    {
      label: "Stripe Dashboard",
      description: "Payments, subscriptions, disputes",
      href: "https://dashboard.stripe.com",
      emoji: "💳",
      external: true,
      category: "external",
      group: "external",
    },
    {
      label: "Supabase",
      description: "Database, auth, storage, logs",
      href: "https://supabase.com/dashboard",
      emoji: "🗄️",
      external: true,
      category: "external",
      group: "external",
    },
    {
      label: "Email — Mailgun",
      description: "Email delivery, logs, suppression list",
      href: "https://app.mailgun.com",
      emoji: "✉️",
      external: true,
      category: "external",
      group: "external",
    },
    {
      label: "SMS — Twilio",
      description: "SMS delivery, logs, phone numbers",
      href: "https://console.twilio.com",
      emoji: "📱",
      external: true,
      category: "external",
      group: "external",
    },
    {
      label: "Vercel",
      description: "Deployments, domains, environment vars",
      href: "https://vercel.com/dashboard",
      emoji: "▲",
      external: true,
      category: "external",
      group: "external",
    },
  ];

  const groups = [
    { key: "all", label: "All Systems" },
    { key: "revenue", label: "Revenue" },
    { key: "fulfillment", label: "Fulfillment" },
    { key: "growth", label: "Growth" },
    { key: "clients", label: "Clients" },
    { key: "ops", label: "Ops" },
    { key: "external", label: "External" },
  ];

  const filtered = activeGroup === "all" ? tiles : tiles.filter((t) => t.group === activeGroup);
  const internalTiles = filtered.filter((t) => t.category === "internal");
  const externalTiles = filtered.filter((t) => t.category === "external");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-sm">
              HR
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">HomeReach OS</h1>
              <p className="text-xs text-gray-500 mt-0.5">Operator Control Center</p>
            </div>
          </div>

          {/* Live MRR chip */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-green-900/40 border border-green-700/50 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs font-semibold text-green-300">
                ${stats.mrr.toLocaleString()}/mo MRR
              </span>
            </div>
            <Link
              href="/admin"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              Admin ↗
            </Link>
          </div>
        </div>
      </header>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 grid grid-cols-4 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          <StatChip label="Active Spots" value={stats.activeSpots} color="green" />
          <StatChip label="Pending" value={stats.pendingSpots} color="yellow" />
          <StatChip label="MRR" value={`$${stats.mrr.toLocaleString()}`} color="green" />
          <StatChip label="Intake Queue" value={stats.pendingIntake} color={stats.pendingIntake > 0 ? "red" : "gray"} />
          <StatChip label="Active Clients" value={stats.activeClients} color="blue" />
          <StatChip label="Campaigns" value={stats.activeCampaigns} color="blue" />
          <StatChip label="Inbox" value={stats.unreadReplies} color={stats.unreadReplies > 0 ? "red" : "gray"} />
          <StatChip label="Waitlist" value={stats.waitlist} color="gray" />
        </div>
      </div>

      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800 bg-gray-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto py-3 scrollbar-hide">
            {groups.map((g) => (
              <button
                key={g.key}
                onClick={() => setActiveGroup(g.key)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeGroup === g.key
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tiles ─────────────────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-10">
        {/* Internal systems */}
        {internalTiles.length > 0 && (
          <section>
            {activeGroup === "all" && (
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                Internal Systems
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {internalTiles.map((tile) => (
                <TileCard key={tile.href} tile={tile} />
              ))}
            </div>
          </section>
        )}

        {/* External systems */}
        {externalTiles.length > 0 && (
          <section>
            {activeGroup === "all" && (
              <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                External Systems
              </h2>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {externalTiles.map((tile) => (
                <TileCard key={tile.href} tile={tile} />
              ))}
            </div>
          </section>
        )}

        {/* Quick actions footer */}
        <section className="pt-4 border-t border-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-2">
            <QuickLink href="/spots" label="→ New Checkout" />
            <QuickLink href="/admin/intake" label="→ Review Intake Queue" highlight={stats.pendingIntake > 0} />
            <QuickLink href="/admin/inbox" label="→ Check Inbox" highlight={stats.unreadReplies > 0} />
            <QuickLink href="/admin/leads" label="→ View Leads" />
            <QuickLink href="/admin/spots" label="→ Manage Spots" />
            <QuickLink href="https://dashboard.stripe.com" label="→ Open Stripe" external />
          </div>
        </section>
      </main>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-800 bg-gray-900/20 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-gray-600">HomeReach OS — Single Control Center</span>
          <span className="text-xs text-gray-600">
            {stats.activeSpots} spots · {stats.activeClients} clients · ${stats.mrr.toLocaleString()}/mo
          </span>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function TileCard({ tile }: { tile: SystemTile }) {
  const badgeColorClass = {
    red: "bg-red-500/20 text-red-300 border-red-500/30",
    yellow: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    green: "bg-green-500/20 text-green-300 border-green-500/30",
    blue: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  }[tile.badgeColor ?? "blue"] ?? "bg-blue-500/20 text-blue-300 border-blue-500/30";

  const content = (
    <div className="group relative flex flex-col p-4 rounded-xl border border-gray-800 bg-gray-900/60 hover:bg-gray-800/80 hover:border-gray-700 transition-all duration-150 cursor-pointer h-full min-h-[100px]">
      {/* External indicator */}
      {tile.external && (
        <span className="absolute top-3 right-3 text-gray-600 text-xs group-hover:text-gray-400 transition-colors">
          ↗
        </span>
      )}

      {/* Badge */}
      {tile.badge !== undefined && (
        <span
          className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColorClass}`}
        >
          {tile.badge}
        </span>
      )}

      <div className="flex items-start gap-3 flex-1">
        <span className="text-2xl leading-none mt-0.5">{tile.emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white leading-snug group-hover:text-blue-300 transition-colors">
            {tile.label}
          </p>
          <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2">
            {tile.description}
          </p>
        </div>
      </div>
    </div>
  );

  if (tile.external) {
    return (
      <a href={tile.href} target="_blank" rel="noopener noreferrer" className="block h-full">
        {content}
      </a>
    );
  }

  return (
    <Link href={tile.href} className="block h-full">
      {content}
    </Link>
  );
}

function StatChip({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: "green" | "yellow" | "red" | "blue" | "gray";
}) {
  const colorClass = {
    green: "text-green-300",
    yellow: "text-yellow-300",
    red: "text-red-300",
    blue: "text-blue-300",
    gray: "text-gray-400",
  }[color];

  return (
    <div className="flex flex-col">
      <span className={`text-lg font-bold leading-none ${colorClass}`}>{value}</span>
      <span className="text-[10px] text-gray-500 mt-1 leading-none">{label}</span>
    </div>
  );
}

function QuickLink({
  href,
  label,
  highlight,
  external,
}: {
  href: string;
  label: string;
  highlight?: boolean;
  external?: boolean;
}) {
  const cls = `text-xs px-3 py-1.5 rounded-lg border transition-all ${
    highlight
      ? "border-red-500/50 bg-red-500/10 text-red-300 hover:bg-red-500/20"
      : "border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 hover:bg-gray-800"
  }`;

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={cls}>
      {label}
    </Link>
  );
}
