"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, ChevronRight, MapPinned } from "lucide-react";

const NAV = [
  { label: "Overview", href: "/political" },
  { label: "AI Agent", href: "/political/candidate-agent" },
  { label: "Plan", href: "/political/plan" },
  { label: "Maps", href: "/political/maps" },
  { label: "Pricing", href: "/political/pricing" },
  { label: "Routes", href: "/political/routes" },
  { label: "Timeline", href: "/political/timeline" },
  { label: "Calendar", href: "/political/calendar" },
  { label: "Simulator", href: "/political/simulator" },
  { label: "Analytics", href: "/political/analytics" },
  { label: "Data", href: "/political/data-sources" },
] as const;

const FLOW = [
  { label: "Start Campaign", href: "/political/plan", match: "/political/plan" },
  { label: "Select Geography", href: "/political/maps", match: "/political/maps" },
  { label: "Review Pricing", href: "/political/pricing", match: "/political/pricing" },
  { label: "Generate Proposal", href: "/political/plan?intent=generate_proposal", match: "/political/thanks" },
  { label: "Schedule Drops", href: "/political/timeline", match: "/political/timeline" },
  { label: "Track Campaign", href: "/political/analytics", match: "/political/analytics" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/political") return pathname === "/political";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function PoliticalCommandNav({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={mobile ? "Mobile political command navigation" : "Political command navigation"}
      className={
        mobile
          ? "mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-3 [scrollbar-width:none] 2xl:hidden [&::-webkit-scrollbar]:hidden"
          : "hidden items-center gap-1 overflow-x-auto 2xl:flex"
      }
    >
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={
              mobile
                ? `shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-blue-300/50 bg-blue-500/20 text-white"
                      : "border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
                : `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-blue-500/20 text-white ring-1 ring-blue-300/30"
                      : "text-slate-300 hover:bg-white/10 hover:text-white"
                  }`
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function PoliticalFlowStrip() {
  const pathname = usePathname();

  return (
    <div className="border-b border-white/10 bg-slate-900/80">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-5 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-200">
          <MapPinned className="h-4 w-4" />
          Campaign launch flow
        </div>
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FLOW.map((step, index) => {
            const active = pathname.startsWith(step.match);

            return (
              <Link
                key={`${step.href}-${index}`}
                href={step.href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-blue-300/50 bg-blue-500/20 text-white"
                    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px]">
                  {index + 1}
                </span>
                {step.label}
                {index < FLOW.length - 1 && <ChevronRight className="h-3 w-3 text-slate-500" />}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PoliticalFloatingAgentButton() {
  return (
    <Link
      href="/political/candidate-agent"
      className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full border border-blue-200/30 bg-blue-600 px-4 py-3 text-sm font-black text-white shadow-2xl shadow-blue-950/50 transition hover:-translate-y-0.5 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
    >
      <Bot className="h-5 w-5" />
      Chat with Campaign AI Agent
    </Link>
  );
}
