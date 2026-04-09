"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";

interface NavItem {
  label: string;
  href: string;
  roles: string[];
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Overview",       href: "/dashboard",              roles: ["client", "nonprofit", "sponsor", "admin", "sales_agent"], icon: "▦" },
  { label: "Campaign",       href: "/dashboard/campaign",     roles: ["client", "nonprofit", "admin"], icon: "📣" },
  { label: "Replies",        href: "/dashboard/replies",      roles: ["client", "nonprofit", "admin"], icon: "💬" },
  { label: "Billing",        href: "/dashboard/billing",      roles: ["client", "nonprofit", "sponsor", "admin"], icon: "💳" },
  { label: "Settings",       href: "/dashboard/settings",     roles: ["client", "nonprofit", "sponsor", "admin", "sales_agent"], icon: "⚙️" },
  // Role-specific
  { label: "Nonprofit Status",  href: "/dashboard/nonprofit",    roles: ["nonprofit"], icon: "🤝" },
  { label: "Sponsorships",      href: "/dashboard/sponsorships", roles: ["sponsor"], icon: "🏅" },
];

// Sales agents get a link into their restricted admin view
const AGENT_ITEMS: NavItem[] = [
  { label: "My Dashboard",  href: "/admin/agent-view",        roles: ["sales_agent"], icon: "🎯" },
];

export function DashboardNav({ role, userEmail }: { role: string; userEmail?: string }) {
  const pathname = usePathname();
  const visibleItems = [
    ...NAV_ITEMS.filter((item) => item.roles.includes(role)),
    ...(role === "sales_agent" ? AGENT_ITEMS : []),
  ];

  return (
    <aside className="w-60 shrink-0 flex flex-col border-r border-gray-200 bg-white">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs shadow-sm">
            HR
          </div>
          <span className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
            HomeReach
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              )}
            >
              <span className="text-base leading-none w-5 text-center">
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}

        {/* Admin shortcut for admin role */}
        {role === "admin" && (
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:bg-gray-100 hover:text-gray-900 transition-colors mt-4 border-t border-gray-100 pt-4"
          >
            <span className="text-base leading-none w-5 text-center">🖥️</span>
            Admin OS
          </Link>
        )}
      </nav>

      {/* Footer — user + logout */}
      <div className="border-t border-gray-100 px-3 py-4 space-y-1">
        {userEmail && (
          <div className="px-3 py-2">
            <p className="text-xs text-gray-400 truncate">{userEmail}</p>
          </div>
        )}
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M19 10a.75.75 0 0 0-.75-.75H8.704l1.048-1.06a.75.75 0 1 0-1.064-1.056l-2.5 2.5a.75.75 0 0 0 0 1.062l2.5 2.5a.75.75 0 0 0 1.064-1.056l-1.048-1.06h9.546A.75.75 0 0 0 19 10z" clipRule="evenodd" />
            </svg>
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
