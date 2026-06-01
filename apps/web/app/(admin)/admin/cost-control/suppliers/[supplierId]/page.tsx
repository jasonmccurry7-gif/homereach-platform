import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, BadgeDollarSign, ClipboardList, PackageSearch, ShieldCheck } from "lucide-react";
import { CostControlActions } from "@/components/cost-control/cost-control-actions";
import { formatCostControlMoney } from "@/lib/cost-control/config";
import { loadSupplierProfile } from "@/lib/cost-control/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

type Params = Promise<{ supplierId: string }>;

export default async function CostControlSupplierPage({ params }: { params: Params }) {
  const { supplierId } = await params;
  const data = await loadSupplierProfile({
    supabase: createServiceClient(),
    supplierId,
  });
  if (!data) notFound();

  const totalEstimated = data.opportunities.reduce((sum, row) => sum + row.estimated_annual_savings_cents, 0);
  const totalActual = data.savings.reduce((sum, row) => sum + Number(row.actual_savings_cents ?? 0), 0);

  return (
    <main className="space-y-6 pb-20">
      <Link href="/admin/cost-control" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Cost Control Queue
      </Link>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
          Supplier Profile
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
          {data.supplier.supplier_name}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          Supplier cost review, related savings opportunities, notes, history, and next action. This page is advisory only and cannot place orders or change vendors.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={PackageSearch} label="Category" value={data.supplier.category ?? "Other"} detail={data.supplier.status.replaceAll("_", " ")} />
        <Metric icon={BadgeDollarSign} label="Savings Found" value={formatCostControlMoney(data.supplier.savings_found_cents || totalEstimated)} detail="Potential savings signal" />
        <Metric icon={ShieldCheck} label="Actual Savings" value={formatCostControlMoney(totalActual)} detail="Tracked after implementation" />
        <Metric icon={ClipboardList} label="Reviews" value={String(data.reviews.length)} detail="Supplier review records" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-black text-slate-950">Opportunities</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {data.opportunities.length > 0 ? (
              data.opportunities.map((opportunity) => (
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
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Annual Savings</p>
                      <p className="mt-1 text-2xl font-black text-slate-950">{formatCostControlMoney(opportunity.estimated_annual_savings_cents)}</p>
                      <div className="mt-4">
                        <CostControlActions opportunity={opportunity} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="p-5 text-sm text-slate-500">No opportunities tied to this supplier yet.</p>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Supplier Notes</h2>
            <div className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
              <p>{data.supplier.notes ?? "No supplier notes yet."}</p>
              <p>{data.supplier.pricing_notes ?? "No pricing notes yet."}</p>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Review History</h2>
            <div className="mt-4 space-y-3">
              {data.reviews.slice(0, 8).map((review) => (
                <div key={review.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="font-black capitalize text-slate-950">{String(review.review_type ?? "").replaceAll("_", " ")}</p>
                  <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-400">{String(review.status ?? "pending").replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm leading-5 text-slate-600">{review.recommended_action ?? review.notes ?? "Review pending."}</p>
                </div>
              ))}
              {data.reviews.length === 0 ? <p className="text-sm text-slate-500">No review history yet.</p> : null}
            </div>
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
      <p className="mt-3 text-xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function Badge({ children }: { children: string | number | Array<string | number> }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{children}</span>;
}
