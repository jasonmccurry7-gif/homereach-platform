"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut, Menu, Palette, Package, Sparkles, Users } from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// AgentNav — sidebar shown to sales_agent role users
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  {
    label: "Sales",
    items: [
      { href: "/admin/agent-view",    icon: "⚡", label: "My Dashboard",    badge: "LIVE" },
      { href: "/admin/agent-view#facebook", icon: "💙", label: "Facebook Engine", badge: "VIEW" },
      { href: "/admin/agent-view#intelligence", icon: "📊", label: "Sales Intelligence" },
      { href: "/admin/agent-view#leads", icon: "🗂️", label: "CRM Queue" },
      { href: "/admin/agent-view#automation", icon: "🤖", label: "Sales Engine" },
      { href: "/admin/agent-mini-apps", icon: "AI", label: "Mini Apps", badge: "REVIEW" },
    ],
  },
  {
    label: "Prospect Tools",
    items: [
      { href: "/admin/agent-view#creative", icon: "🎨", label: "Ad Designer" },
      { href: "/admin/agent-view#roi", icon: "💰", label: "ROI Preview" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/agent-view#offers", icon: "📦", label: "Products" },
      { href: "/admin/agent-view#offers", icon: "🗂️", label: "Bundles" },
    ],
  },
];

const MOBILE_AGENT_ITEMS = [
  { href: "/admin/agent-view", label: "Dash", icon: LayoutDashboard },
  { href: "/admin/agent-view#leads", label: "Leads", icon: Users },
  { href: "/admin/agent-view#automation", label: "Engine", icon: Sparkles },
  { href: "/admin/agent-view#creative", label: "Creative", icon: Palette },
  { href: "/admin/agent-view#offers", label: "Offers", icon: Package },
];

export default function AgentNav() {
  const pathname = usePathname() ?? "";

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-800 bg-gray-900/95 text-white shadow-2xl shadow-slate-950/20 backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
          <Link href="/admin/agent-view" className="min-w-0 shrink">
            <HomeReachLogo size="sm" tone="light" />
            <p className="mt-0.5 text-xs text-gray-400">Sales Agent Portal</p>
          </Link>

          <details className="group relative shrink-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/15 [&::-webkit-details-marker]:hidden">
              <Menu className="h-4 w-4" aria-hidden="true" />
              Menu
            </summary>
            <div className="fixed inset-x-3 top-[4.25rem] max-h-[calc(100dvh-8.75rem)] overflow-y-auto rounded-xl border border-white/10 bg-gray-900 p-3 shadow-2xl shadow-slate-950/50">
              <nav className="space-y-4" aria-label="Sales agent mobile menu">
                {NAV.map((group) => (
                  <div key={group.label}>
                    <p className="px-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                      {group.label}
                    </p>
                    <div className="mt-2 grid gap-1">
                      {group.items.map((item) => {
                        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                        return (
                          <Link
                            key={`${group.label}-${item.label}`}
                            href={item.href}
                            className={cn(
                              "flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                              active ? "bg-blue-600 text-white" : "text-gray-300 hover:bg-gray-800 hover:text-white",
                            )}
                          >
                            <span>{item.label}</span>
                            {item.badge ? (
                              <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                                {item.badge}
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </nav>

              <form action={signOut} className="mt-4 border-t border-gray-700 pt-3">
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <aside className="hidden w-56 min-h-screen bg-gray-900 text-white lg:flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-700">
        <HomeReachLogo size="sm" tone="light" />
        <p className="text-xs text-gray-400 mt-0.5">Sales Agent Portal</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {NAV.map(group => (
          <div key={group.label}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      active
                        ? "bg-blue-600 text-white"
                        : "text-gray-300 hover:bg-gray-800 hover:text-white"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {item.badge && (
                      <span className="rounded-full bg-green-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Log out */}
      <div className="px-3 py-4 border-t border-gray-700">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Log out
          </button>
        </form>
      </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-800 bg-gray-900/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 text-white shadow-2xl shadow-slate-950/30 backdrop-blur-xl lg:hidden" aria-label="Sales agent quick actions">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {MOBILE_AGENT_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition",
                  active ? "bg-blue-600 text-white shadow-lg" : "text-gray-400 hover:bg-gray-800 hover:text-white",
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
