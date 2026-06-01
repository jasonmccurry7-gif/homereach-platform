"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, BarChart3, ClipboardList, FlaskConical, Store } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/growth-os/dashboard", icon: BarChart3 },
  { label: "Weekly", href: "/growth-os/weekly", icon: ClipboardList },
  { label: "Levers", href: "/growth-os/levers", icon: Archive },
  { label: "Tests", href: "/growth-os/experiments", icon: FlaskConical },
  { label: "Profile", href: "/growth-os/onboarding", icon: Store },
];

export function GrowthOsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/growth-os" className="font-bold text-gray-950">
            Food Service Growth OS
          </Link>
          <nav className="flex flex-wrap gap-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href ||
                (item.href !== "/growth-os/dashboard" &&
                  pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-950"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
