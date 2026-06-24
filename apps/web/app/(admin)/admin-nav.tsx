"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  BriefcaseBusiness,
  Building2,
  Brush,
  Clapperboard,
  ClipboardList,
  CloudLightning,
  Compass,
  CreditCard,
  DollarSign,
  Gauge,
  Globe2,
  HeartHandshake,
  History,
  Inbox,
  Landmark,
  Layers3,
  LogOut,
  Mail,
  Map,
  Menu,
  Megaphone,
  MessagesSquare,
  Mic,
  Package,
  Palette,
  Radar,
  RadioTower,
  ReceiptText,
  Search,
  Settings,
  ShieldCheck,
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
    label: "Primary Products",
    items: [
      { label: "Product Command", href: "/admin", icon: Gauge },
      { label: "StormReach", href: "/admin/stormreach", icon: CloudLightning },
      { label: "Political Campaigns", href: "/admin/political", icon: Landmark },
      { label: "Targeted Campaigns", href: "/admin/targeted-campaigns", icon: Target },
      { label: "Design Engine", href: "/admin/creative-studio", icon: Palette },
      { label: "Outreach Automation", href: "/admin/outreach-command", icon: Megaphone },
      { label: "Payment Paths", href: "/admin/profit-center", icon: CreditCard },
      { label: "Admin Users", href: "/admin/users", icon: Users },
    ],
  },
  {
    label: "Outcome Command",
    items: [
      { label: "Revenue Operations", href: "/admin/revenue-operations", icon: MessagesSquare },
      { label: "AI COO Queue", href: "/admin/ai-coo-queue", icon: Bot },
      { label: "Business Memory", href: "/admin/business-memory", icon: Brain },
      { label: "Savings Queue", href: "/admin/cost-control", icon: DollarSign },
      { label: "Reputation Queue", href: "/admin/reputation", icon: Star },
      { label: "Growth Opportunities", href: "/admin/growth-intelligence", icon: Compass },
      { label: "Growth OS", href: "/admin/ai-growth-os", icon: Sparkles },
      { label: "Growth Execution", href: "/admin/growth-execution", icon: Workflow },
      { label: "Sales Signals", href: "/admin/sales-dashboard", icon: BarChart3 },
      { label: "Client Messages", href: "/admin/inbox", icon: Inbox },
      { label: "AI Workforce", href: "/admin/agents", icon: Bot },
      { label: "Executive Leadership Team", href: "/admin/executive-chat", icon: Users },
      { label: "Voice Command", href: "/admin/voice-command-center", icon: Mic },
      { label: "Mini Apps", href: "/admin/agent-mini-apps", icon: Workflow },
      { label: "Agent Control", href: "/admin/agent-execution", icon: ShieldCheck },
      { label: "AI Assets", href: "/admin/ai-assets", icon: Sparkles },
      { label: "Executive Review", href: "/admin/content-review", icon: ShieldCheck },
      { label: "AI Reels", href: "/admin/daily-content", icon: Clapperboard },
      { label: "Control Tower", href: "/admin/control-center", icon: Activity },
    ],
  },
  {
    label: "Revenue Growth",
    items: [
      { label: "CRM", href: "/admin/crm", icon: BriefcaseBusiness },
      { label: "Market Capture Sales", href: "/admin/market-capture-sales", icon: Target },
      { label: "Group Intelligence", href: "/admin/group-intelligence", icon: MessagesSquare },
      { label: "Websites", href: "/admin/websites", icon: Globe2 },
      { label: "AI Web Assistant", href: "/admin/ai-web-assistant", icon: Bot },
      { label: "Email Infrastructure", href: "/admin/email-infrastructure", icon: Mail },
      { label: "Deliverability", href: "/admin/deliverability", icon: ShieldCheck },
      { label: "Supplier Savings", href: "/admin/procurement", icon: Package },
      { label: "ContractOS Packaging", href: "/admin/contractos", icon: Landmark },
      { label: "Gov Contracts Approvals", href: "/admin/gov-contracts", icon: Landmark },
      { label: "Businesses", href: "/admin/businesses", icon: Building2 },
      { label: "Orders", href: "/admin/orders", icon: ReceiptText },
      { label: "Profit Center", href: "/admin/profit-center", icon: CreditCard },
      { label: "Pricing Control", href: "/admin/pricing", icon: DollarSign },
      { label: "Founding Members", href: "/admin/founding", icon: Star },
    ],
  },
  {
    label: "Campaign Fulfillment",
    items: [
      { label: "Shared Postcards", href: "/admin/spots", icon: Layers3 },
      { label: "AI Intake Carts", href: "/admin/ai-intake", icon: Bot },
      { label: "Market Capture Fulfillment", href: "/admin/market-capture-fulfillment", icon: Radar },
      { label: "Market Capture Campaigns", href: "/admin/digital-targeting", icon: Radar },
      { label: "Ad-Tech Health", href: "/admin/ad-tech", icon: RadioTower },
      { label: "Political Outreach", href: "/admin/political/outreach-strategy", icon: Megaphone },
      { label: "Maps", href: "/admin/political/maps", icon: Map },
      { label: "Campaigns", href: "/admin/campaigns", icon: Activity },
      { label: "Availability", href: "/admin/availability", icon: Map },
      { label: "Ad Designer", href: "/admin/ad-designer", icon: Palette },
      { label: "Canva Design OS", href: "/admin/canva", icon: Palette },
    ],
  },
  {
    label: "Visibility & Authority",
    items: [
      { label: "SEO Command Center", href: "/admin/marketing/seo-command-center", icon: Search },
      { label: "Local Visibility", href: "/admin/local-visibility", icon: Star },
      { label: "Content Intelligence", href: "/admin/content-intel", icon: Sparkles },
    ],
  },
  {
    label: "Operating Intelligence",
    items: [
      { label: "Lead Intel", href: "/admin/leads", icon: Sparkles },
      { label: "Sales Engine", href: "/admin/sales-engine", icon: Wand2 },
      { label: "Operator", href: "/admin/operator", icon: ClipboardList },
      { label: "War Room", href: "/admin/war-room", icon: Activity },
      { label: "Agent Dialer", href: "/admin/agent-view", icon: ZapIcon },
      { label: "Facebook Engine", href: "/admin/facebook", icon: Megaphone },
      { label: "Growth Engine", href: "/admin/growth-engine", icon: Sparkles },
      { label: "Growth Activity", href: "/admin/growth", icon: Brush },
      { label: "Traffic Engine", href: "/admin/traffic-engine", icon: Upload },
      { label: "ROI Preview", href: "/admin/roi-preview", icon: DollarSign },
    ],
  },
  {
    label: "Platform Controls",
    items: [
      { label: "Service Catalog", href: "/admin/service-catalog", icon: ClipboardList },
      { label: "Products", href: "/admin/products", icon: Package },
      { label: "Bundles", href: "/admin/bundles", icon: Package },
      { label: "Cities", href: "/admin/cities", icon: Map },
      { label: "Waitlist", href: "/admin/waitlist", icon: ClipboardList },
      { label: "Nonprofits", href: "/admin/nonprofits", icon: HeartHandshake },
      { label: "Reviews", href: "/admin/reviews", icon: Star },
      { label: "Legacy Import", href: "/admin/legacy-import", icon: History },
      { label: "Migration", href: "/admin/migration", icon: Upload },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const MOBILE_COMMAND_ITEMS = [
  { label: "Home", href: "/admin", icon: Gauge },
  { label: "Storm", href: "/admin/stormreach", icon: CloudLightning },
  { label: "Political", href: "/admin/political", icon: Landmark },
  { label: "Targeted", href: "/admin/targeted-campaigns", icon: Target },
  { label: "Design", href: "/admin/creative-studio", icon: Palette },
];

export function AdminNav() {
  const pathname = usePathname();
  const currentPath = pathname ?? "";
  const activeHref =
    NAV.flatMap((group) => group.items)
      .filter((item) =>
        item.href === "/admin"
          ? currentPath === "/admin"
          : currentPath === item.href || currentPath.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null;

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-[#07111f]/95 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin" className="min-w-0 shrink">
            <HomeReachLogo size="sm" tone="light" sublabel="Command" />
          </Link>

          <details className="group relative shrink-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15 [&::-webkit-details-marker]:hidden">
              <Menu className="h-4 w-4" aria-hidden="true" />
              Menu
            </summary>
            <div className="fixed inset-x-3 top-[4.25rem] max-h-[calc(100dvh-8.75rem)] overflow-y-auto rounded-xl border border-white/10 bg-[#07111f] p-3 shadow-2xl shadow-slate-950/50">
              <div className="mb-3 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_14px_rgba(52,211,153,0.9)]" />
                  <span className="text-xs font-semibold text-emerald-100">Operational command live</span>
                </div>
              </div>

              <nav className="space-y-4" aria-label="Admin mobile menu">
                {NAV.map((group) => (
                  <div key={group.label}>
                    <p className="px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
                      {group.label}
                    </p>
                    <div className="mt-2 grid gap-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = activeHref === item.href;
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition",
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

              <div className="mt-4 border-t border-slate-800 pt-3">
                <Link
                  href="/dashboard"
                  className="flex min-h-11 items-center justify-between rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white hover:text-slate-950"
                >
                  Client dashboard
                  <span aria-hidden="true">-&gt;</span>
                </Link>
                <form action={signOut} className="mt-2">
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-rose-300/30 hover:bg-rose-400/10 hover:text-rose-100"
                  >
                    <span className="flex items-center gap-2">
                      <LogOut className="h-3.5 w-3.5" />
                      Log out
                    </span>
                  </button>
                </form>
              </div>
            </div>
          </details>
        </div>

        <nav className="flex gap-2 overflow-x-auto px-3 pb-3" aria-label="Admin priority navigation">
          {MOBILE_COMMAND_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition",
                  active
                    ? "border-cyan-300/40 bg-cyan-300/15 text-cyan-50"
                    : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <aside className="hidden min-h-screen w-72 shrink-0 flex-col border-r border-slate-800 bg-[#07111f] text-white lg:flex">
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

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-800 bg-[#07111f]/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:hidden" aria-label="Admin quick actions">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {MOBILE_COMMAND_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeHref === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition",
                  active
                    ? "bg-white text-slate-950 shadow-lg"
                    : "text-slate-400 hover:bg-white/10 hover:text-white",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function ZapIcon({ className }: { className?: string }) {
  return <Activity className={className} />;
}
