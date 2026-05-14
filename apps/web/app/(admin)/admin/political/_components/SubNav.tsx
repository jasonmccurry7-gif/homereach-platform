"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Political Command Center — sub-navigation
//
// Renders the per-section tabs that sit under the main /admin/political
// route. Each tab is its own page; this component does not load data,
// only highlights the active one based on the current pathname.
//
// Added in migration 068 / Phase 2a — when new sections (plans, payments,
// reporting, etc.) are not yet implemented, their pages render a "Coming
// soon" stub. The nav still lists them so operators can see the roadmap.
// ─────────────────────────────────────────────────────────────────────────────

interface SubNavItem {
  readonly label: string;
  readonly href: string;
  readonly badge?: "NEW" | "SOON";
}

const SUB_NAV: readonly SubNavItem[] = [
  { label: "Dashboard",     href: "/admin/political" },
  { label: "Maps",          href: "/admin/political/maps",          badge: "NEW" },
  { label: "Routes",        href: "/admin/political/routes",        badge: "NEW" },
  { label: "Campaigns",     href: "/admin/political/campaigns",     badge: "NEW" },
  { label: "Candidate Agent", href: "/admin/political/candidate-agent", badge: "NEW" },
  { label: "Inbound Leads", href: "/admin/political/leads",         badge: "NEW" },
  { label: "Plans",         href: "/admin/political/plans",         badge: "NEW" },
  { label: "Proposals",     href: "/admin/political/proposals" },
  { label: "Outreach",      href: "/admin/political/outreach",      badge: "NEW" },
  { label: "Calendar",      href: "/admin/political/calendar",      badge: "NEW" },
  { label: "Analytics",     href: "/admin/political/analytics",     badge: "NEW" },
  { label: "CRM",           href: "/admin/political/crm",           badge: "NEW" },
  { label: "Payments",      href: "/admin/political/payments",      badge: "NEW" },
  { label: "Operations",    href: "/admin/political/operations",    badge: "NEW" },
  { label: "Intelligence",  href: "/admin/political/intelligence",  badge: "NEW" },
  { label: "Delivery",      href: "/admin/political/delivery",      badge: "NEW" },
  { label: "Reporting",     href: "/admin/political/reporting",     badge: "NEW" },
  { label: "Compliance",    href: "/admin/political/compliance",    badge: "NEW" },
  { label: "Settings",      href: "/admin/political/settings",      badge: "NEW" },
  { label: "Organizations", href: "/admin/political/organizations", badge: "NEW" },
  { label: "Review",        href: "/admin/political/review",        badge: "NEW" },
  { label: "Imports",       href: "/admin/political/imports",       badge: "NEW" },
  { label: "Data Sources",  href: "/admin/political/data-sources",  badge: "NEW" },
] as const;

export function PoliticalSubNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Political sections"
      className="flex gap-1 overflow-x-auto border-b border-white/10 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {SUB_NAV.map((item) => {
        const isActive =
          item.href === "/admin/political"
            ? pathname === "/admin/political"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              isActive
                ? "bg-white text-slate-950"
                : "text-slate-300 hover:bg-white/10 hover:text-white",
            )}
          >
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold leading-none",
                  item.badge === "NEW"
                    ? isActive
                      ? "bg-emerald-600 text-white"
                      : "bg-emerald-950 text-emerald-200"
                    : isActive
                      ? "bg-amber-500 text-white"
                      : "bg-amber-950 text-amber-200",
                )}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
