"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  Bot,
  Brain,
  Compass,
  CreditCard,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Package,
  RadioTower,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import { signOut } from "@/app/actions/auth";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",    href: "/dashboard",          roles: ["client", "nonprofit", "sponsor", "admin"] },
  { label: "Growth",      href: "/growth-center",      roles: ["client", "admin"] },
  { label: "Growth Intel", href: "/dashboard/growth-intelligence", roles: ["client", "admin"] },
  { label: "Campaign",    href: "/campaign", roles: ["client", "nonprofit", "admin"] },
  { label: "Cost Control", href: "/dashboard/cost-control", roles: ["client", "admin"] },
  { label: "Reputation", href: "/dashboard/reputation", roles: ["client", "admin"] },
  { label: "Inventory",   href: "/operations-copilot", roles: ["client", "admin"] },
  { label: "Visibility",  href: "/visibility", roles: ["client", "admin"] },
  { label: "Digital Ads", href: "/dashboard/digital-targeting", roles: ["client", "admin"] },
  { label: "Launch", href: "/dashboard/campaign-launch", roles: ["client", "admin"] },
  { label: "Social", href: "/dashboard/social-publishing", roles: ["client", "admin"] },
  { label: "AI Assistant", href: "/ai-assistant", roles: ["client", "admin"] },
  { label: "Memory", href: "/dashboard/business-memory", roles: ["client", "admin"] },
  { label: "Replies",     href: "/replies",  roles: ["client", "nonprofit", "admin"] },
  { label: "Billing",     href: "/billing",  roles: ["client", "nonprofit", "sponsor", "admin"] },
  { label: "Settings",    href: "/settings", roles: ["client", "nonprofit", "sponsor", "admin"] },
];

const NAV_ICONS = {
  Overview: LayoutDashboard,
  Growth: Sparkles,
  "Growth Intel": Compass,
  Campaign: Megaphone,
  "Cost Control": BadgeDollarSign,
  Reputation: Star,
  Inventory: Package,
  Visibility: Star,
  "Digital Ads": RadioTower,
  Launch: RadioTower,
  Social: Megaphone,
  "AI Assistant": Bot,
  Memory: Brain,
  Replies: Inbox,
  Billing: CreditCard,
  Settings,
} as const;

const MOBILE_PRIORITY_LABELS = ["Overview", "Growth", "Campaign", "Cost Control", "AI Assistant"];

export function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname() ?? "";
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));
  const priorityItems = visibleItems.filter((item) => MOBILE_PRIORITY_LABELS.includes(item.label));

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-xl lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
          <Link href="/dashboard" className="min-w-0 shrink">
            <HomeReachLogo size="sm" tone="dark" />
          </Link>

          <details className="group relative shrink-0">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 text-sm font-bold text-gray-800 transition hover:bg-gray-100 [&::-webkit-details-marker]:hidden">
              <Menu className="h-4 w-4" aria-hidden="true" />
              Menu
            </summary>
            <div className="fixed inset-x-3 top-[4.25rem] max-h-[calc(100dvh-8.75rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 shadow-2xl shadow-slate-950/15">
              <nav className="grid gap-1" aria-label="Dashboard mobile menu">
                {visibleItems.map((item) => {
                  const Icon = NAV_ICONS[item.label as keyof typeof NAV_ICONS] ?? LayoutDashboard;
                  const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
                        active
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-950",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <form action={signOut} className="mt-3 border-t border-gray-200 pt-3">
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </form>
            </div>
          </details>
        </div>
      </header>

      <aside className="hidden w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-6 lg:flex">
      <div className="mb-6 px-3">
        <Link href="/">
          <HomeReachLogo size="sm" tone="dark" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1">
        {visibleItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`))
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <form action={signOut} className="mt-6 border-t border-gray-200 pt-4">
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-red-50 hover:text-red-700"
        >
          <LogOut className="h-4 w-4" />
          Log out
        </button>
      </form>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 shadow-2xl shadow-slate-950/15 backdrop-blur-xl lg:hidden" aria-label="Client dashboard quick actions">
        <div className="mx-auto grid max-w-lg grid-cols-5 gap-1">
          {priorityItems.map((item) => {
            const Icon = NAV_ICONS[item.label as keyof typeof NAV_ICONS] ?? LayoutDashboard;
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[11px] font-bold transition",
                  active
                    ? "bg-blue-50 text-blue-700 shadow-sm"
                    : "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
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
