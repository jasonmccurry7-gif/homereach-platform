import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, BadgeDollarSign, CheckCircle2, ClipboardList, PackageSearch, ShieldCheck } from "lucide-react";
import { CostControlActions } from "@/components/cost-control/cost-control-actions";
import { formatCostControlMoney, hasCostControlPersistence, isCostControlEnabled } from "@/lib/cost-control/config";
import { loadClientCostControlCenter } from "@/lib/cost-control/engine";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ClientCostControlPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isCostControlEnabled()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Cost Control is off" body="This module is disabled by feature flag." />
      </main>
    );
  }

  if (!hasCostControlPersistence()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Cost Control safe mode" body="Savings recommendations will appear after database persistence is configured." />
      </main>
    );
  }

  const data = await loadClientCostControlCenter({
    supabase: createServiceClient(),
    user: { id: user.id, email: user.email },
  });

  const topOpportunities = data.opportunities.slice(0, 6);

  return (
    <main className="max-w-6xl space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
              Cost Control Center
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
              Cost Savings Opportunities
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              HomeReach watches supplier and savings signals so you can see where money may be leaking and what deserves review next.
            </p>
          </div>
          <ScoreBadge score={data.score?.score ?? 0} color={data.score?.color ?? "yellow"} />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Cost Control safe mode" body={data.message ?? "Cost Control data is unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={BadgeDollarSign} label="Potential Savings" value={formatCostControlMoney(data.metrics.potentialSavingsCents)} detail="Open monthly savings signals" />
        <Metric icon={CheckCircle2} label="Accepted Savings" value={formatCostControlMoney(data.metrics.acceptedSavingsCents)} detail="Approved or implemented monthly savings" />
        <Metric icon={ShieldCheck} label="Annual Opportunity" value={formatCostControlMoney(data.metrics.estimatedAnnualSavingsCents)} detail="Estimated annualized open savings" />
        <Metric icon={PackageSearch} label="Categories Tracked" value={String(data.metrics.supplierCategoriesTracked)} detail="Supplier cost categories in view" />
      </section>

      {data.score ? (
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <MiniScore label="Categories" value={data.score.categories_monitored_score} />
          <MiniScore label="Reviewed" value={data.score.opportunities_reviewed_score} />
          <MiniScore label="Implemented" value={data.score.opportunities_implemented_score} />
          <MiniScore label="Suppliers" value={data.score.supplier_reviews_score} />
          <div className="rounded-xl border border-slate-200 bg-white p-3 md:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Next Action</p>
            <p className="mt-1 text-sm font-black leading-5 text-slate-950">{data.score.recommended_action}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">Savings Pipeline</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review, approve, or dismiss. HomeReach will not change vendors, place orders, or commit spend without approval.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.category}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>Confidence {opportunity.confidence_score}%</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.reason}</p>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recommended Action</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{opportunity.recommended_action}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Estimated Annual Savings</p>
                      <p className="mt-1 text-2xl font-black text-slate-950">{formatCostControlMoney(opportunity.estimated_annual_savings_cents)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Advisory estimate. Actual savings require review.</p>
                      <div className="mt-4">
                        <CostControlActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-black text-slate-950">No savings opportunities yet.</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Supplier, invoice, and savings records will appear here after HomeReach has enough cost context to review.
                </p>
                <Link href="/operations-copilot" className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white">
                  Add cost context
                </Link>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Supplier Directory</h2>
            <div className="mt-4 space-y-3">
              {data.suppliers.slice(0, 6).map((supplier) => (
                <div key={supplier.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="font-black text-slate-950">{supplier.supplier_name}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{supplier.category ?? "Other"}</p>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{supplier.notes ?? "Tracked for future supplier review."}</p>
                </div>
              ))}
              {data.suppliers.length === 0 ? <p className="text-sm text-slate-500">No supplier records yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950 shadow-sm">
            <h2 className="text-lg font-black">Monthly Savings Report</h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              {data.report
                ? `${formatCostControlMoney(data.report.estimated_savings_cents)} estimated annualized savings in the current report.`
                : "Reports will appear after savings opportunities are generated."}
            </p>
            <p className="mt-3 text-xs font-bold text-emerald-800">
              Results vary. HomeReach surfaces savings opportunities; you approve any action.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
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

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}%</p>
    </div>
  );
}

function Badge({ children }: { children: string | number | Array<string | number> }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{children}</span>;
}

function ScoreBadge({ color, score }: { color: "green" | "yellow" | "red"; score: number }) {
  const styles = color === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : color === "red" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Cost Control Score</p>
      <p className="mt-1 text-3xl font-black">{score}</p>
    </div>
  );
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
