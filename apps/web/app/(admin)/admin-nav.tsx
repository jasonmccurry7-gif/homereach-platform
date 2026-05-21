"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Building2,
  Brush,
  ClipboardList,
  CreditCard,
  DollarSign,
  Gauge,
  HeartHandshake,
  History,
  Inbox,
  Landmark,
  Layers3,
  LogOut,
  Mail,
  Map,
  Megaphone,
  MessagesSquare,
  Package,
  Palette,
  ReceiptText,
  Search,
  Settings,
  Sparkles,
  Star,
  Target,
  Upload,
  Users,
  Wand2,
  Workflow,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { cn } from "@/lib/utils";

const NAV = [
  {
    label: "HomeReach OS",
    items: [
      { label: "Command Center", href: "/admin", icon: Gauge },
      { label: "Growth Execution", href: "/admin/growth-execution", icon: Workflow },
      { label: "Sales Intelligence", href: "/admin/sales-dashboard", icon: BarChart3 },
      { label: "Communications", href: "/admin/inbox", icon: Inbox },
      { label: "AI Workforce", href: "/admin/agents", icon: Bot },
      { label: "Control Center", href: "/admin/control-center", icon: Activity },
    ],
  },
  {
    label: "Revenue Ops",
    items: [
      { label: "CRM", href: "/admin/crm", icon: BriefcaseBusiness },
      { label: "Revenue Command", href: "/admin/revenue-operations", icon: MessagesSquare },
      { label: "Email Infrastructure", href: "/admin/email-infrastructure", icon: Mail },
      { label: "Procurement", href: "/admin/procurement", icon: Package },
      { label: "Gov Contracts", href: "/admin/gov-contracts", icon: Landmark },
      { label: "Businesses", href: "/admin/businesses", icon: Building2 },
      { label: "Orders", href: "/admin/orders", icon: ReceiptText },
      { label: "Profit Center", href: "/admin/profit-center", icon: CreditCard },
      { label: "Pricing Control", href: "/admin/pricing", icon: DollarSign },
      { label: "Founding Members", href: "/admin/founding", icon: Star },
    ],
  },
  {
    label: "Campaign Ops",
    items: [
      { label: "Shared Postcards", href: "/admin/spots", icon: Layers3 },
      { label: "AI Intake Carts", href: "/admin/ai-intake", icon: Bot },
      { label: "Targeted Campaigns", href: "/admin/targeted-campaigns", icon: Target },
      { label: "Political", href: "/admin/political", icon: Landmark },
      { label: "Political Outreach", href: "/admin/political/outreach-strategy", icon: Megaphone },
      { label: "Maps", href: "/admin/political/maps", icon: Map },
      { label: "Campaigns", href: "/admin/campaigns", icon: Activity },
      { label: "Availability", href: "/admin/availability", icon: Map },
      { label: "Ad Designer", href: "/admin/ad-designer", icon: Palette },
      { label: "Canva Design OS", href: "/admin/canva", icon: Palette },
    ],
  },
  {
    label: "Marketing",
    items: [
      { label: "SEO Command Center", href: "/admin/marketing/seo-command-center", icon: Search },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Lead Intel", href: "/admin/leads", icon: Sparkles },
      { label: "Sales Engine", href: "/admin/sales-engine", icon: Wand2 },
      { label: "Operator", href: "/admin/operator", icon: ClipboardList },
      { label: "War Room", href: "/admin/war-room", icon: Activity },
      { label: "Agent Dialer", href: "/admin/agent-view", icon: ZapIcon },
      { label: "Facebook Engine", href: "/admin/facebook", icon: Megaphone },
      { label: "Growth Engine", href: "/admin/growth-engine", icon: Sparkles },
      { label: "Growth Intelligence", href: "/admin/growth", icon: Brush },
      { label: "Traffic Engine", href: "/admin/traffic-engine", icon: Upload },
      { label: "ROI Preview", href: "/admin/roi-preview", icon: DollarSign },
    ],
  },
  {
    label: "Catalog & Admin",
    items: [
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Bundles", href: "/admin/bundles", icon: Package },
      { label: "Cities", href: "/admin/cities", icon: Map },
      { label: "Users", href: "/admin/users", icon: Users },
      { label: "Waitlist", href: "/admin/waitlist", icon: ClipboardList },
      { label: "Nonprofits", href: "/admin/nonprofits", icon: HeartHandshake },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
      { label: "Legacy Import", href: "/admin/legacy-import", icon: History },
      { label: "Migration", href: "/admin/migration", icon: Upload },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();
  const activeHref =
    NAV.flatMap((group) => group.items)
      .filter((item) =>
        item.href === "/admin"
          ? pathname === "/admin"
          : pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <aside className="flex min-h-screen w-72 shrink-0 flex-col border-r border-slate-800 bg-[#07111f] text-white">
      <div className="border-b border-slate-800 px-4 py-5">
        <Link href="/admin" className="block">
          <HomeReachLogo size="sm" tone="light" sublabel="HomeReach OS" />
        </Link>
        <div className="mt-4 rounded-lg border border-sky-300/20 bg-sky-300/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
            <span className="text-xs font-semibold text-emerald-100">Operational command live</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {NAV.map((group) => (
          <div key={group.label}>
            <p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              {group.label}
            </p>
            <div className="mt-2 space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeHref === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                      active
                        ? "bg-white text-slate-950 shadow-lg"
                        : "text-slate-300 hover:bg-white/10 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-4">
        <Link
          href="/dashboard"
          className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white hover:text-slate-950"
        >
          Client dashboard
          <span aria-hidden="true">-&gt;</span>
        </Link>
        <form action={signOut} className="mt-2">
          <button
            type="submit"
            className="flex w-full items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-100"
          >
            <span className="flex items-center gap-2">
              <LogOut className="h-3.5 w-3.5" />
              Log out
            </span>
          </button>
        </form>
      </div>
    </aside>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return <Activity className={className} />;
}
