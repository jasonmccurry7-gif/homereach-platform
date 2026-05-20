"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardCheck,
  Database,
  Package,
  Radar,
  ShieldCheck,
  Tags,
  Truck,
} from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Command", href: "/operations-copilot", icon: Bot },
  { label: "Supplies", href: "/operations-copilot/supplies", icon: Package },
  { label: "Delivery", href: "/operations-copilot/delivery", icon: Truck },
  { label: "Data", href: "/operations-copilot/data", icon: Database },
  { label: "Prices", href: "/operations-copilot/supplier-prices", icon: Tags },
  { label: "Approvals", href: "/operations-copilot/approvals", icon: ClipboardCheck },
  { label: "Risks", href: "/operations-copilot#risks", icon: Radar },
  { label: "Governance", href: "/operations-copilot#governance", icon: ShieldCheck },
];

export function OperationsCopilotShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <header className="border-b border-white/10 bg-neutral-950/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/operations-copilot" className="flex items-center gap-3">
            <HomeReachLogo tone="light" size="sm" sublabel="Inventory Intelligence" />
          </Link>
          <nav className="flex flex-wrap gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-cyan-400/15 text-cyan-200"
                      : "text-neutral-300 hover:bg-white/10 hover:text-white"
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
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
