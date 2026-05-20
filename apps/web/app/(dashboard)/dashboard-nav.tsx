"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
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
  { label: "Campaign",    href: "/campaign", roles: ["client", "nonprofit", "admin"] },
  { label: "Inventory",   href: "/inventory-purchasing/dashboard", roles: ["client", "admin"] },
  { label: "Replies",     href: "/replies",  roles: ["client", "nonprofit", "admin"] },
  { label: "Billing",     href: "/billing",  roles: ["client", "nonprofit", "sponsor", "admin"] },
  { label: "Settings",    href: "/settings", roles: ["client", "nonprofit", "sponsor", "admin"] },
];

export function DashboardNav({ role }: { role: string }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white px-3 py-6">
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
  );
}
