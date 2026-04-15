"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/actions/auth";

// ─────────────────────────────────────────────────────────────────────────────
// AgentNav — sidebar shown to sales_agent role users
// ─────────────────────────────────────────────────────────────────────────────

const NAV = [
  {
    label: "Sales",
    items: [
      { href: "/admin/agent-view",    icon: "⚡", label: "My Dashboard",    badge: "LIVE" },
      { href: "/admin/facebook",      icon: "💙", label: "Facebook Engine",  badge: "LIVE" },
      { href: "/admin/sales-dashboard", icon: "📊", label: "Sales Intelligence" },
      { href: "/admin/crm",           icon: "🗂️", label: "CRM" },
      { href: "/admin/sales-engine",  icon: "🤖", label: "Sales Engine" },
    ],
  },
  {
    label: "Prospect Tools",
    items: [
      { href: "/admin/ad-designer",   icon: "🎨", label: "Ad Designer" },
      { href: "/admin/roi-preview",   icon: "💰", label: "ROI Preview" },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/admin/products",      icon: "📦", label: "Products" },
      { href: "/admin/bundles",       icon: "🗂️", label: "Bundles" },
    ],
  },
];

export default function AgentNav() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-gray-900 text-white flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-gray-700">
        <span className="font-bold text-lg tracking-tight">HomeReach</span>
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
                    key={item.href}
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

      {/* Sign out */}
      <div className="px-3 py-4 border-t border-gray-700">
        <form action={signOut}>
          <button
            type="submit"
            className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            Sign Out
          </button>
        </form>
      </div>
    </aside>
  );
}
