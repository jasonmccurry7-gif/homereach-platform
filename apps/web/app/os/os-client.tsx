"use client";

import Link from "next/link";
import { useState, useRef } from "react";

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

type IconDef = {
  id: string;
  label: string;
  href: string;
  external?: boolean;
  bg: string;           // Tailwind gradient
  icon: React.ReactNode;
  badge?: number | string;
  badgeColor?: "red" | "yellow" | "green" | "blue";
  group: "pinned" | "sales" | "crm" | "ops" | "external";
};

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icons = {
  home: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/>
    </svg>
  ),
  bolt: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
      <path d="M13 2L4.09 12.96A1 1 0 005 14.5h6.5L10 22l9.91-10.96A1 1 0 0019 9.5H12.5L13 2z"/>
    </svg>
  ),
  chart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-7 h-7">
      <path d="M3 20h18M8 20V10M12 20V4M16 20v-7"/>
    </svg>
  ),
  crm: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h4M7 11h6M15 8h2"/>
    </svg>
  ),
  shield: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M12 2l8 3v6c0 5-3.5 9.5-8 11C7.5 20.5 4 16 4 11V5l8-3z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  ),
  target: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-7 h-7">
      <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/>
    </svg>
  ),
  megaphone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M3 11l19-9-9 19-2-8-8-2z"/>
    </svg>
  ),
  building: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="2" y="7" width="13" height="15" rx="1"/><path d="M16 7V5a2 2 0 00-2-2H8a2 2 0 00-2 2v2"/><path d="M22 22H2M6 11h1M6 15h1M10 11h1M10 15h1"/>
    </svg>
  ),
  card: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 8l10 6 10-6"/>
    </svg>
  ),
  phone: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  receipt: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M4 2v20l3-2 2 2 2-2 2 2 2-2 3 2V2z"/><path d="M8 7h8M8 11h6M8 15h4"/>
    </svg>
  ),
  map: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/>
    </svg>
  ),
  users: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  db: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
    </svg>
  ),
  triangle: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M12 2L2 22h20L12 2z"/>
    </svg>
  ),
  inbox: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z"/>
    </svg>
  ),
  dollar: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="w-7 h-7">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
    </svg>
  ),
  paint: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 011.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
    </svg>
  ),
  cart: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
      <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 002 1.61h9.72a2 2 0 002-1.61L23 6H6"/>
    </svg>
  ),
};

export function OSClient({ stats }: { stats: OSStats }) {
  const [selected, setSelected] = useState<string | null>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const icons: IconDef[] = [
    // ── Pinned / Primary ──────────────────────────────────────────────────────
    {
      id: "control-center",
      label: "Control Center",
      href: "/admin/control-center",
      bg: "from-indigo-600 to-blue-700",
      icon: Icons.shield,
      group: "pinned",
    },
    {
      id: "agent-dialer",
      label: "Agent Dialer",
      href: "/admin/agent-view",
      bg: "from-yellow-500 to-orange-500",
      icon: Icons.bolt,
      group: "pinned",
    },
    {
      id: "sales-intel",
      label: "Sales Intelligence",
      href: "/admin/sales-dashboard",
      bg: "from-emerald-500 to-teal-600",
      icon: Icons.chart,
      group: "pinned",
    },
    {
      id: "crm",
      label: "CRM",
      href: "/admin/crm",
      bg: "from-violet-600 to-purple-700",
      icon: Icons.crm,
      group: "pinned",
    },
    {
      id: "inbox",
      label: "Inbox",
      href: "/admin/inbox",
      bg: "from-red-500 to-rose-600",
      icon: Icons.chat,
      badge: stats.unreadReplies > 0 ? stats.unreadReplies : undefined,
      badgeColor: "red",
      group: "pinned",
    },
    // ── Sales ─────────────────────────────────────────────────────────────────
    {
      id: "admin",
      label: "Admin",
      href: "/admin",
      bg: "from-blue-600 to-blue-800",
      icon: Icons.home,
      badge: `$${stats.mrr.toLocaleString()}`,
      badgeColor: "green",
      group: "sales",
    },
    {
      id: "leads",
      label: "Leads",
      href: "/admin/leads",
      bg: "from-orange-500 to-amber-600",
      icon: Icons.target,
      group: "sales",
    },
    {
      id: "campaigns",
      label: "Campaigns",
      href: "/admin/campaigns",
      bg: "from-pink-500 to-fuchsia-600",
      icon: Icons.megaphone,
      badge: stats.activeCampaigns > 0 ? stats.activeCampaigns : undefined,
      badgeColor: "green",
      group: "sales",
    },
    {
      id: "targeted",
      label: "Targeted",
      href: "/admin/targeted-campaigns",
      bg: "from-sky-500 to-blue-600",
      icon: Icons.mail,
      group: "sales",
    },
    {
      id: "checkout",
      label: "Checkout",
      href: "/spots",
      bg: "from-teal-500 to-cyan-600",
      icon: Icons.cart,
      group: "sales",
    },
    {
      id: "roi",
      label: "ROI Preview",
      href: "/admin/roi-preview",
      bg: "from-green-600 to-emerald-700",
      icon: Icons.dollar,
      group: "sales",
    },
    {
      id: "ad-designer",
      label: "Ad Designer",
      href: "/admin/ad-designer",
      bg: "from-fuchsia-500 to-pink-600",
      icon: Icons.paint,
      group: "sales",
    },
    // ── CRM ───────────────────────────────────────────────────────────────────
    {
      id: "businesses",
      label: "Businesses",
      href: "/admin/businesses",
      bg: "from-slate-600 to-slate-800",
      icon: Icons.building,
      badge: stats.activeClients > 0 ? `${stats.activeClients}` : undefined,
      badgeColor: "green",
      group: "crm",
    },
    {
      id: "intake",
      label: "Intake Queue",
      href: "/admin/intake",
      bg: "from-red-600 to-red-800",
      icon: Icons.inbox,
      badge: stats.pendingIntake > 0 ? stats.pendingIntake : undefined,
      badgeColor: "red",
      group: "crm",
    },
    {
      id: "orders",
      label: "Orders",
      href: "/admin/orders",
      bg: "from-zinc-600 to-zinc-800",
      icon: Icons.receipt,
      group: "crm",
    },
    {
      id: "spots",
      label: "Spots",
      href: "/admin/spots",
      bg: "from-amber-600 to-yellow-700",
      icon: Icons.map,
      badge: stats.pendingSpots > 0 ? `${stats.pendingSpots}` : `${stats.activeSpots}`,
      badgeColor: stats.pendingSpots > 0 ? "yellow" : "blue",
      group: "crm",
    },
    {
      id: "profit",
      label: "Profit Center",
      href: "/admin/profit-center",
      bg: "from-green-700 to-emerald-800",
      icon: Icons.dollar,
      group: "crm",
    },
    {
      id: "availability",
      label: "Availability",
      href: "/admin/availability",
      bg: "from-sky-600 to-sky-800",
      icon: Icons.map,
      group: "crm",
    },
    // ── Ops ───────────────────────────────────────────────────────────────────
    {
      id: "agents",
      label: "Agents",
      href: "/admin/agents",
      bg: "from-purple-600 to-indigo-700",
      icon: Icons.users,
      group: "ops",
    },
    {
      id: "users",
      label: "Users",
      href: "/admin/users",
      bg: "from-gray-600 to-gray-800",
      icon: Icons.users,
      group: "ops",
    },
    {
      id: "cities",
      label: "Cities",
      href: "/admin/cities",
      bg: "from-cyan-600 to-teal-700",
      icon: Icons.map,
      group: "ops",
    },
    {
      id: "waitlist",
      label: "Waitlist",
      href: "/admin/waitlist",
      bg: "from-violet-500 to-purple-700",
      icon: Icons.inbox,
      badge: stats.waitlist > 0 ? stats.waitlist : undefined,
      badgeColor: "blue",
      group: "ops",
    },
    // ── External ──────────────────────────────────────────────────────────────
    {
      id: "stripe",
      label: "Stripe",
      href: "https://dashboard.stripe.com",
      external: true,
      bg: "from-[#6772e5] to-[#4e58b5]",
      icon: Icons.card,
      group: "external",
    },
    {
      id: "supabase",
      label: "Supabase",
      href: "https://supabase.com/dashboard",
      external: true,
      bg: "from-[#3ecf8e] to-[#1a9e6a]",
      icon: Icons.db,
      group: "external",
    },
    {
      id: "mailgun",
      label: "Mailgun",
      href: "https://app.mailgun.com",
      external: true,
      bg: "from-red-600 to-red-800",
      icon: Icons.mail,
      group: "external",
    },
    {
      id: "twilio",
      label: "Twilio",
      href: "https://console.twilio.com",
      external: true,
      bg: "from-[#f22f46] to-[#b01c30]",
      icon: Icons.phone,
      group: "external",
    },
    {
      id: "vercel",
      label: "Vercel",
      href: "https://vercel.com/dashboard",
      external: true,
      bg: "from-gray-800 to-black",
      icon: Icons.triangle,
      group: "external",
    },
  ];

  const grouped = [
    { key: "pinned",   label: "⚡ PRIMARY",  icons: icons.filter(i => i.group === "pinned") },
    { key: "sales",    label: "💰 SALES",    icons: icons.filter(i => i.group === "sales") },
    { key: "crm",      label: "🗂️ CRM",     icons: icons.filter(i => i.group === "crm") },
    { key: "ops",      label: "⚙️ OPS",     icons: icons.filter(i => i.group === "ops") },
    { key: "external", label: "🔗 EXTERNAL", icons: icons.filter(i => i.group === "external") },
  ];

  // Dock — always-visible shortcuts
  const dock: IconDef[] = [
    icons.find(i => i.id === "control-center")!,
    icons.find(i => i.id === "agent-dialer")!,
    icons.find(i => i.id === "crm")!,
    icons.find(i => i.id === "inbox")!,
    icons.find(i => i.id === "admin")!,
    icons.find(i => i.id === "stripe")!,
  ].filter(Boolean);

  const handleIconClick = (id: string) => {
    if (selected === id) {
      // Double-click behavior — navigate
      return;
    }
    setSelected(id);
    if (clickTimer.current) clearTimeout(clickTimer.current);
    clickTimer.current = setTimeout(() => setSelected(null), 2000);
  };

  return (
    <div
      className="min-h-screen text-white select-none"
      style={{ background: "radial-gradient(ellipse at 60% 20%, #1a1f35 0%, #0a0d1a 60%, #000 100%)" }}
      onClick={e => { if ((e.target as HTMLElement).closest("[data-icon]") === null) setSelected(null); }}
    >
      {/* ── Menu bar ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-2 bg-black/40 backdrop-blur-md border-b border-white/5 sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-xs font-black">
            HR
          </div>
          <span className="text-sm font-semibold text-white/90">HomeReach OS</span>
          <span className="text-xs text-white/30">|</span>
          <span className="text-xs text-white/50">Operator Control Center</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-white/50">
          <span className="text-green-400 font-semibold">${stats.mrr.toLocaleString()}/mo</span>
          <span>{stats.activeClients} clients</span>
          <span>{stats.activeSpots} spots</span>
          {stats.unreadReplies > 0 && (
            <span className="text-red-400 animate-pulse font-semibold">{stats.unreadReplies} replies</span>
          )}
          {stats.pendingIntake > 0 && (
            <span className="text-yellow-400 font-semibold">{stats.pendingIntake} intake</span>
          )}
        </div>
      </div>

      {/* ── Desktop ─────────────────────────────────────────────────────────── */}
      <div className="px-8 py-8 space-y-10 pb-32">
        {grouped.map(group => (
          <div key={group.key}>
            <p className="text-[10px] font-bold tracking-[0.2em] text-white/25 mb-4 ml-1">
              {group.label}
            </p>
            <div className="flex flex-wrap gap-6">
              {group.icons.map(icon => (
                <AppIcon
                  key={icon.id}
                  icon={icon}
                  selected={selected === icon.id}
                  onClick={() => handleIconClick(icon.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Dock ────────────────────────────────────────────────────────────── */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30">
        <div className="flex items-end gap-3 px-5 py-3 rounded-2xl bg-white/10 backdrop-blur-2xl border border-white/15 shadow-2xl">
          {dock.map(icon => (
            <DockIcon key={icon.id} icon={icon} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppIcon — desktop grid icon
// ─────────────────────────────────────────────────────────────────────────────
function AppIcon({
  icon,
  selected,
  onClick,
}: {
  icon: IconDef;
  selected: boolean;
  onClick: () => void;
}) {
  const badgeClass = {
    red:    "bg-red-500",
    yellow: "bg-yellow-500",
    green:  "bg-green-500",
    blue:   "bg-blue-500",
  }[icon.badgeColor ?? "blue"];

  const content = (
    <div
      data-icon
      className="flex flex-col items-center gap-2 w-20 cursor-pointer group"
      onClick={onClick}
    >
      {/* Icon square */}
      <div className="relative">
        <div
          className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${icon.bg} flex items-center justify-center text-white shadow-lg
            transition-all duration-150
            ${selected
              ? "scale-95 brightness-90 ring-2 ring-blue-400 ring-offset-2 ring-offset-transparent"
              : "group-hover:scale-110 group-hover:shadow-xl group-hover:shadow-black/40"
            }`}
          style={{ boxShadow: selected ? undefined : "0 8px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2)" }}
        >
          {icon.icon}
        </div>

        {/* Badge dot / number */}
        {icon.badge !== undefined && (
          <div className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] ${badgeClass} rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1 shadow-md`}>
            {typeof icon.badge === "number" && icon.badge > 99 ? "99+" : icon.badge}
          </div>
        )}

        {/* External arrow */}
        {icon.external && (
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-gray-700 rounded-full flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-gray-300" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M2 10L10 2M6 2h4v4"/>
            </svg>
          </div>
        )}
      </div>

      {/* Label */}
      <span className={`text-[11px] font-medium leading-tight text-center px-1 py-0.5 rounded-md max-w-full truncate w-full text-center
        ${selected ? "bg-blue-600/80 text-white" : "text-white/80 group-hover:text-white"}`}>
        {icon.label}
      </span>
    </div>
  );

  if (icon.external) {
    return (
      <a href={icon.href} target="_blank" rel="noopener noreferrer">
        {content}
      </a>
    );
  }

  return <Link href={icon.href}>{content}</Link>;
}

// ─────────────────────────────────────────────────────────────────────────────
// DockIcon — bottom dock shortcut
// ─────────────────────────────────────────────────────────────────────────────
function DockIcon({ icon }: { icon: IconDef }) {
  const [hovered, setHovered] = useState(false);

  const badgeClass = {
    red:    "bg-red-500",
    yellow: "bg-yellow-500",
    green:  "bg-green-500",
    blue:   "bg-blue-500",
  }[icon.badgeColor ?? "blue"];

  const content = (
    <div
      className="relative flex flex-col items-center gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Tooltip */}
      {hovered && (
        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold px-2 py-1 rounded-md whitespace-nowrap border border-white/10 shadow-lg z-50">
          {icon.label}
        </div>
      )}

      <div
        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${icon.bg} flex items-center justify-center text-white shadow-md
          transition-all duration-150 ${hovered ? "scale-125 -translate-y-2" : ""}`}
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.15)" }}
      >
        <div className="scale-75">{icon.icon}</div>
      </div>

      {/* Badge */}
      {icon.badge !== undefined && (
        <div className={`absolute top-0 right-0 w-4 h-4 ${badgeClass} rounded-full flex items-center justify-center text-[8px] font-bold text-white`}>
          {typeof icon.badge === "number" && icon.badge > 9 ? "9+" : icon.badge}
        </div>
      )}

      {/* Dot indicator */}
      <div className="w-1 h-1 rounded-full bg-white/40" />
    </div>
  );

  if (icon.external) {
    return <a href={icon.href} target="_blank" rel="noopener noreferrer">{content}</a>;
  }
  return <Link href={icon.href}>{content}</Link>;
}
