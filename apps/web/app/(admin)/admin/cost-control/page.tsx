import Link from "next/link";
import { AlertTriangle, BadgeDollarSign, Building2, CheckCircle2, ClipboardList, PackageSearch, ShieldCheck } from "lucide-react";
import { CostControlActions } from "@/components/cost-control/cost-control-actions";
import { CostControlSyncButton } from "@/components/cost-control/cost-control-sync-button";
import { formatCostControlMoney, hasCostControlPersistence, isCostControlQueueEnabled } from "@/lib/cost-control/config";
import { loadAdminCostControlQueue } from "@/lib/cost-control/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cost Control Queue - HomeReach Admin",
};

export default async function AdminCostControlPage() {
  if (!isCostControlQueueEnabled()) {
    return <SafeMode title="Cost Control Queue is off" body="This module is disabled by feature flag." />;
  }

  if (!hasCostControlPersistence()) {
    return <SafeMode title="Cost Control safe mode" body="Database persistence is not configured, so the queue is intentionally offline." />;
  }

  const data = await loadAdminCostControlQueue({
    supabase: createServiceClient(),
  });

  const topOpportunities = data.opportunities.slice(0, 12);
  const pipeline = buildPipeline(data.opportunities);

  return (
    <main className="space-y-6 pb-20">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-600">
              Cost Control Engine
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              Cost Control Queue
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Admin operating view for savings opportunities, supplier reviews, owner approvals, and cost-control reporting. No purchasing, vendor changes, or spend commitments execute from this queue.
            </p>
          </div>
          <CostControlSyncButton />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Cost Control safe mode" body={data.message ?? "Cost Control queue is unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={BadgeDollarSign} label="Potential Savings" value={formatCostControlMoney(data.metrics.potentialSavingsCents)} detail="Open monthly savings signals" />
        <Metric icon={CheckCircle2} label="Accepted Savings" value={formatCostControlMoney(data.metrics.acceptedSavingsCents)} detail="Approved or implemented monthly savings" />
        <Metric icon={ShieldCheck} label="Annual Savings" value={formatCostControlMoney(data.metrics.estimatedAnnualSavingsCents)} detail="Estimated annualized opportunity" />
        <Metric icon={PackageSearch} label="Open Opportunities" value={String(data.metrics.openOpportunities)} detail="Savings cards awaiting review" />
        <Metric icon={Building2} label="Suppliers" value={String(data.suppliers.length)} detail="Supplier records tracked" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden="true" />
          <h2 className="text-xl font-black text-slate-950">Savings Pipeline</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-7">
          {pipeline.map((stage) => (
            <div key={stage.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{stage.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{stage.count}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{formatCostControlMoney(stage.savingsCents)} annual</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-black text-slate-950">Savings Opportunities</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review, assign, approve, or dismiss. Copy drafts stay approval-gated.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.category}</Badge>
                        <Badge>{opportunity.opportunity_type.replaceAll("_", " ")}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>Priority {opportunity.priority_score}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.reason}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Mini label="Recommended Action" value={opportunity.recommended_action} />
                        <Mini label="Owner" value={opportunity.owner ?? "Unassigned"} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Estimated Annual Savings</p>
                      <p className="mt-1 text-2xl font-black text-slate-950">{formatCostControlMoney(opportunity.estimated_annual_savings_cents)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Confidence {opportunity.confidence_score}%. Approval required before action.</p>
                      <div className="mt-4">
                        <CostControlActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-500">No Cost Control opportunities yet. Sync from Operations Copilot or Business Memory.</div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Supplier Directory</h2>
            <div className="mt-4 space-y-3">
              {data.suppliers.slice(0, 10).map((supplier) => (
                <Link
                  key={supplier.id}
                  href={`/admin/cost-control/suppliers/${supplier.id}`}
                  className="block rounded-xl border border-slate-100 bg-slate-50 p-3 hover:border-emerald-200 hover:bg-emerald-50"
                >
                  <p className="font-black text-slate-950">{supplier.supplier_name}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{supplier.category ?? "Other"}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-600">{formatCostControlMoney(supplier.savings_found_cents)} found</p>
                </Link>
              ))}
              {data.suppliers.length === 0 ? <p className="text-sm text-slate-500">No suppliers synced yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Savings Report</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {data.report
                ? `${formatCostControlMoney(data.report.estimated_savings_cents)} estimated and ${formatCostControlMoney(data.report.actual_savings_cents)} actual savings in the current report.`
                : "Report will generate after opportunities exist."}
            </p>
            <p className="mt-3 text-xs font-bold text-slate-500">
              Reports are advisory until reconciled against invoices and owner-approved actions.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function buildPipeline(rows: Array<{ status: string; estimated_annual_savings_cents: number }>) {
  const stages = [
    ["new_opportunity", "New Opportunity"],
    ["under_review", "Under Review"],
    ["pending_decision", "Pending Decision"],
    ["approved", "Approved"],
    ["implemented", "Implemented"],
    ["rejected", "Rejected"],
    ["completed", "Completed"],
  ];
  return stages.map(([status, label]) => {
    const matching = rows.filter((row) => row.status === status);
    return {
      label,
      count: matching.length,
      savingsCents: matching.reduce((sum, row) => sum + row.estimated_annual_savings_cents, 0),
    };
  });
}

function Metric({ detail, icon: Icon, label, value }: { detail: string; icon: typeof BadgeDollarSign; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-emerald-600" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: string | number | Array<string | number> }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{children}</span>;
}

function SafeMode({ body, title }: { body: string; title: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-6">{body}</p>
        </div>
      </div>
    </section>
  );
}
