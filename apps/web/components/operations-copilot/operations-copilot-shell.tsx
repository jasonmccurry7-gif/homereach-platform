"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  ClipboardCheck,
  Database,
  Gauge,
  PackageCheck,
  PackageSearch,
  ShieldCheck,
  Tags,
  Truck,
} from "lucide-react";
import { HomeReachLogo } from "@/components/brand/home-reach-logo";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Command", href: "/operations-copilot", icon: Bot },
  { label: "Spend Map", href: "/operations-copilot/supplies", icon: PackageSearch },
  { label: "Deliveries", href: "/operations-copilot/delivery", icon: Truck },
  { label: "Receiving", href: "/operations-copilot/receiving", icon: PackageCheck },
  { label: "Price Watch", href: "/operations-copilot/supplier-prices", icon: Tags },
  { label: "Decisions", href: "/operations-copilot/approvals", icon: ClipboardCheck },
  { label: "Source Health", href: "/operations-copilot/data", icon: Database },
];

export function OperationsCopilotShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";

  return (
    <div className="min-h-screen bg-[#070a0f] text-white">
      <header className="border-b border-white/10 bg-[#070a0f]/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <Link href="/operations-copilot" className="flex items-center gap-3" aria-label="Supplify command center">
            <HomeReachLogo tone="light" size="sm" sublabel="Supplify" />
            <div className="hidden border-l border-white/10 pl-3 sm:block">
              <div className="flex items-center gap-2 text-sm font-black text-white">
                <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Profitability Command Center
              </div>
              <p className="mt-0.5 text-xs text-neutral-500">
                Margin protection, purchasing visibility, and AI-assisted operational control
              </p>
            </div>
          </Link>
          <nav className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" aria-label="Supplify navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    active
                      ? "bg-emerald-400/15 text-emerald-100"
                      : "text-neutral-300 hover:bg-white/10 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                </Link>
              );
            })}
            <span className="hidden shrink-0 items-center gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.14em] text-emerald-100 lg:inline-flex">
              <Gauge className="h-4 w-4" aria-hidden="true" />
              Margin watch
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-8">{children}</main>
    </div>
  );
}
