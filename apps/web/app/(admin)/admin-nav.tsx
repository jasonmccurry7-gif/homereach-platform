"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "@/app/actions/auth";

const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { label: "⚡ OS Control Center", href: "/os",                    emoji: "🖥️", badge: "PRIMARY" },
      { label: "Admin Control Center", href: "/admin/control-center", emoji: "🎛️", badge: "NEW" },
      { label: "Dashboard",      href: "/admin",              emoji: "🏠" },
      { label: "Leads",          href: "/admin/leads",              emoji: "🎯" },
      { label: "Targeted Campaigns", href: "/admin/targeted-campaigns", emoji: "📬", badge: "NEW" },
      { label: "Inbox",          href: "/admin/inbox",         emoji: "💬" },
    ],
  },
  {
    label: "Growth",
    items: [
      { label: "Growth Intelligence", href: "/admin/growth",          emoji: "📈", badge: "NEW" },
    ],
  },
  {
    label: "Traffic Engine",
    items: [
      { label: "Traffic Engine",  href: "/admin/traffic-engine", emoji: "🚀", badge: "NEW" },
    ],
  },
  {
    label: "Sales Execution",
    items: [
      { label: "Agent Dialer",      href: "/admin/agent-view",       emoji: "⚡", badge: "LIVE" },
      { label: "Sales Intelligence",href: "/admin/sales-dashboard",  emoji: "📊", badge: "LIVE" },
      { label: "CRM",               href: "/admin/crm",              emoji: "🗂️", badge: "NEW" },
      { label: "Sales Engine",      href: "/admin/sales-engine",     emoji: "🤖" },
      { label: "Availability",      href: "/admin/availability",     emoji: "📍" },
      { label: "ROI Preview",       href: "/admin/roi-preview",      emoji: "💰" },
      { label: "Ad Designer",       href: "/admin/ad-designer",      emoji: "🎨" },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Profit Center",  href: "/admin/profit-center",  emoji: "💰", badge: "NEW" },
      { label: "Reviews",        href: "/admin/reviews",        emoji: "⭐", badge: "NEW" },
      { label: "Legacy Import",  href: "/admin/legacy-import",  emoji: "🗄️", badge: "NEW" },
      { label: "Migration",      href: "/admin/migration",      emoji: "🔄" },
      { label: "Businesses",     href: "/admin/businesses",    emoji: "🏢" },
      { label: "Orders",         href: "/admin/orders",        emoji: "🧾" },
      { label: "Cities",         href: "/admin/cities",        emoji: "🗺️" },
      { label: "Campaigns",      href: "/admin/campaigns",     emoji: "📣" },
      { label: "Waitlist",       href: "/admin/waitlist",      emoji: "📋" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { label: "Products",       href: "/admin/products",      emoji: "📦" },
      { label: "Bundles",        href: "/admin/bundles",       emoji: "🎁" },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Agents",         href: "/admin/agents",        emoji: "👥", badge: "NEW" },
      { label: "Users",          href: "/admin/users",         emoji: "🙋" },
      { label: "Nonprofits",     href: "/admin/nonprofits",    emoji: "🤝" },
    ],
  },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-gray-800 bg-gray-900 min-h-screen">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-gray-800">
        <Link href="/os" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
            HR
          </div>
          <div>
            <p className="text-sm font-bold text-white leading-none">HomeReach</p>
            <p className="text-xs text-gray-500 mt-0.5">OS v2</p>
          </div>
        </Link>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 mb-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  item.href === "/admin"
                    ? pathname === "/admin"
                    : item.href === "/os"
                    ? pathname === "/os"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-600 text-white"
                        : "text-gray-400 hover:bg-gray-800 hover:text-white"
                    )}
                  >
                    <span className="text-base leading-none">{item.emoji}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded font-bold",
                        isActive
                          ? "bg-blue-500 text-white"
                          : "bg-gray-700 text-gray-400"
                      )}>
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

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
        >
          ← Back to site
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-gray-500 hover:text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
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
