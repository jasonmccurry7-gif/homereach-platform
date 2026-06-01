import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ClipboardCheck, DollarSign, ShieldCheck } from "lucide-react";
import {
  listProductionServiceOffers,
  summarizeProductionServiceCatalog,
  type ProductionStatus,
} from "@/lib/service-catalog/production-offers";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Production Service Catalog | HomeReach Admin",
  description: "Operational source of truth for HomeReach sellable services, fulfillment, reporting, and approval gates.",
};

const STATUS_LABELS: Record<ProductionStatus, string> = {
  sellable_now: "Sellable now",
  sellable_manual: "Manual sellable",
  sellable_manual_compliance_review: "Compliance review",
  sellable_with_political_compliance: "Political gated",
  sellable_needs_fresh_smoke: "Needs smoke",
  sellable_needs_inventory_audit: "Inventory audit",
  manual_sellable: "Manual sellable",
  manual_sellable_with_publish_gate: "Publish gated",
  sales_wedge_ready: "Sales wedge",
  pilot_only: "Pilot only",
  internal_first: "Internal first",
  internal_foundation: "Foundation",
  internal_then_client: "Internal to client",
  manual_launch_only: "Manual launch",
  internal_only: "Internal only",
};

function statusTone(status: ProductionStatus) {
  if (status === "sellable_now") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status.startsWith("sellable") || status.startsWith("manual") || status === "sales_wedge_ready") {
    return "bg-blue-50 text-blue-800 ring-blue-200";
  }
  if (status === "pilot_only" || status.includes("needs")) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

export default function AdminServiceCatalogPage() {
  const offers = listProductionServiceOffers();
  const summary = summarizeProductionServiceCatalog();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-xl bg-slate-950 p-5 text-white shadow-sm lg:p-7">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">Production service catalog</p>
          <div className="mt-3 grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h1 className="text-3xl font-black tracking-tight lg:text-4xl">What HomeReach can sell, fulfill, and report.</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                This is the internal source of truth for pricing, deliverables, owners, fulfillment steps, report metrics,
                approval gates, issue handling, and smoke tests. Keep this aligned before scaling a service.
              </p>
            </div>
            <Link
              href="/admin"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-white px-4 text-sm font-black text-slate-950 transition hover:bg-blue-50"
            >
              Revenue command
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={ClipboardCheck} label="Cataloged offers" value={String(summary.total)} />
          <Metric icon={DollarSign} label="Sellable/manual" value={String(summary.sellable)} />
          <Metric icon={ShieldCheck} label="Needs proof" value={String(summary.needsProof)} />
          <Metric icon={ShieldCheck} label="Internal layers" value={String(summary.internal)} />
        </section>

        <section className="grid gap-4">
          {offers.map((offer) => (
            <article key={offer.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(offer.productionStatus)}`}>
                      {STATUS_LABELS[offer.productionStatus]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      {offer.category}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-950">{offer.publicName}</h2>
                  <p className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                    {offer.price.public}
                  </p>
                  <div className="mt-4 grid gap-2 text-sm">
                    <Fact label="Owner" value={offer.primaryOwner} />
                    <Fact label="Billing" value={offer.price.billingMode} />
                    <Fact label="Stripe" value={offer.price.stripeStatus} />
                    <Fact label="Renewal" value={offer.renewalMotion} />
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-2">
                  <ListBlock title="Deliverables" items={offer.deliverables} />
                  <ListBlock title="Approval Gates" items={offer.approvalGates} />
                  <ListBlock title="Reporting Metrics" items={offer.reportingMetrics} />
                  <ListBlock title="Issue Handling" items={offer.issueHandling} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                <p className="text-sm font-semibold leading-6 text-slate-600">{offer.readinessNotes}</p>
                <div className="flex flex-wrap gap-2 text-xs font-black">
                  <Link href={offer.publicPath} className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800 transition hover:bg-blue-100">
                    Public
                  </Link>
                  <Link href={offer.adminPath} className="rounded-lg bg-slate-100 px-3 py-2 text-slate-800 transition hover:bg-slate-200">
                    Admin
                  </Link>
                  <Link href={offer.customerPath} className="rounded-lg bg-slate-100 px-3 py-2 text-slate-800 transition hover:bg-slate-200">
                    Client
                  </Link>
                </div>
                <code className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white">{offer.id}</code>
              </div>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof ClipboardCheck; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-sm font-bold leading-5 text-slate-800">{value}</span>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{title}</p>
      <ul className="mt-3 space-y-2 text-sm font-semibold leading-5 text-slate-700">
        {items.slice(0, 5).map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}
