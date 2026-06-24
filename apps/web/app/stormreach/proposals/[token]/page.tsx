import { notFound } from "next/navigation";
import { StormReachProposalActions } from "@/components/stormreach/stormreach-proposal-actions";
import { loadStormReachProposal } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ token: string }>;
};

export default async function StormReachProposalPage({ params }: Params) {
  const { token } = await params;
  const proposal = await loadStormReachProposal(token);
  if (!proposal.package || !proposal.event) notFound();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">StormReach proposal</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{String(proposal.package.package_name)}</h1>
          <p className="mt-4 text-sm font-semibold leading-6 text-slate-600">
            Severe weather moved through this area recently. This campaign helps your business show up in front of homeowners most likely to be checking their property over the next few days.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <Metric label="Households" value={numberFormat(Number(proposal.package.estimated_households ?? 0))} />
          <Metric label="Geofence Radius" value={`${String(proposal.package.recommended_geofence_radius_miles)} mi`} />
          <Metric label="Postcards" value={numberFormat(Number(proposal.package.recommended_postcard_quantity ?? 0))} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Recommended Campaign</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Info label="Event" value={String(proposal.event.title)} />
            <Info label="Service Category" value={String(proposal.package.industry)} />
            <Info label="Timeline" value={String(proposal.package.suggested_timeline)} />
            <Info label="Pricing" value={formatCents(Number(proposal.package.estimated_price_to_client_cents ?? 0))} />
          </div>
          <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.14em] text-slate-500">Campaign Copy</h3>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">{String(proposal.package.landing_page_copy)}</p>
          </div>
        </section>

        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <p className="text-sm font-bold leading-6">
            Requesting approval records interest only. HomeReach still reviews map accuracy, campaign details, pricing, payment, and launch readiness before any external action.
          </p>
        </section>

        <StormReachProposalActions token={token} />
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</p>
    </div>
  );
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}
