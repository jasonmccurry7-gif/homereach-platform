import { notFound } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";
import { PoliticalSubNav } from "./_components/SubNav";

// ─────────────────────────────────────────────────────────────────────────────
// Political Command Center — route-level flag gate
//
// If ENABLE_POLITICAL is not "true" at runtime, every route under
// /admin/political returns a real 404 (notFound() triggers the nearest
// not-found boundary, which is the platform 404 page).
//
// Admin/sales_agent role check is already enforced by the parent
// (admin)/layout.tsx → see apps/web/app/(admin)/layout.tsx — we don't need
// to re-do that work here.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export default function PoliticalLayout({ children }: { children: React.ReactNode }) {
  if (!isPoliticalEnabled()) notFound();
  return (
    <div className="min-h-[calc(100vh-4rem)] rounded-lg border border-slate-900/10 bg-slate-950 p-4 text-white shadow-2xl shadow-slate-900/20 sm:p-6">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-blue-900/30 via-slate-950/0 to-slate-950/0" />
      <div className="relative space-y-5">
        <header className="grid gap-4 border-b border-white/10 pb-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-200">
              HomeReach Political
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-3xl">
              Campaign Command Center
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Planning, route intelligence, proposals, outreach, payment,
              fulfillment, and reporting in one protected operating system.
            </p>
          </div>
          <div className="rounded-lg border border-red-300/20 bg-red-950/30 px-4 py-3 text-sm text-red-100">
            <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-200/80">
              Protected Admin Route
            </div>
            <div className="mt-1 font-semibold">/admin/political</div>
          </div>
        </header>

        <PoliticalSubNav />

        <div>{children}</div>
      </div>
    </div>
  );
}
