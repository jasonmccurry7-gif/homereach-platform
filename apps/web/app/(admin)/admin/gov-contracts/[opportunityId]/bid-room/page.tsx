import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGovContractOpportunity } from "@/lib/gov-contracts/data";
import { OpportunityStatusActions } from "../../_components/OpportunityStatusActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Bid Room - HomeReach Admin" };

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

const CHECKLIST = [
  "Official notice reviewed",
  "Attachments downloaded",
  "Questions deadline confirmed",
  "Submission method confirmed",
  "Required forms identified",
  "Insurance and bonding requirements checked",
  "Pricing worksheet approved",
  "Subcontractor quotes collected",
  "Compliance review complete",
  "Human submission approval recorded",
];

const BID_SECTIONS = [
  {
    title: "Go / No-Go Decision",
    detail: "Confirm whether this is worth pursuit based on fit, timeline, risk, and available partners.",
    status: "Manual approval required",
  },
  {
    title: "Pricing Worksheet",
    detail: "Draft internal pricing assumptions. Do not finalize price until owner/admin approval.",
    status: "Approval locked",
  },
  {
    title: "Subcontractor Quote Tracker",
    detail: "Track quotes, insurance documents, availability, and reliability for required trade partners.",
    status: "Phase 2 matching ready",
  },
  {
    title: "Proposal Drafting Area",
    detail: "Prepare response outline, capability language, compliance matrix, and executive summary.",
    status: "Draft only",
  },
  {
    title: "Amendment Tracker",
    detail: "Watch for amendments and update the compliance checklist before submission.",
    status: "Sync-ready",
  },
  {
    title: "Document Repository",
    detail: "Store solicitation files, forms, insurance certificates, pricing, and approval artifacts.",
    status: "Storage hook pending",
  },
];

export default async function GovContractBidRoomPage({ params }: PageProps) {
  const { opportunityId } = await params;
  const opportunity = await loadGovContractOpportunity(decodeURIComponent(opportunityId));
  if (!opportunity) notFound();

  const readiness = Math.max(12, Math.min(78, Math.round(opportunity.fitScore * 0.58 + (100 - opportunity.riskScore) * 0.22)));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`} className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to opportunity review
        </Link>
        <Link href="/admin/gov-contracts" className="text-sm font-bold text-slate-600 hover:text-slate-900">
          Gov Contracts dashboard
        </Link>
      </div>

      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">Bid Room - human controlled</p>
        <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight">{opportunity.title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
          This room organizes pursuit work. It does not submit bids, commit pricing, claim certifications, or commit subcontractors.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <Metric label="Submission readiness" value={`${readiness}%`} detail="Advisory only" />
          <Metric label="Fit score" value={`${opportunity.fitScore}/100`} detail={opportunity.fitStatus.replace("_", " ")} />
          <Metric label="Current status" value={opportunity.pipelineStatus.replace("_", " ")} detail="Manual pipeline" />
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Pipeline Control</h2>
            <p className="mt-2 text-sm text-slate-600">Move the opportunity through the manual workflow after review.</p>
            <div className="mt-4">
              <OpportunityStatusActions opportunityId={opportunity.id} initialStatus={opportunity.pipelineStatus} />
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h2 className="text-lg font-black text-amber-950">Approval Lock</h2>
            <p className="mt-2 text-sm leading-6 text-amber-900">
              Final submission, pricing approval, certification approval, legal acknowledgements, award acceptance, and subcontractor commitments must be handled manually by an authorized person.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Compliance Checklist</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {CHECKLIST.map((item, index) => (
              <label key={item} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                <input type="checkbox" disabled defaultChecked={index < 2 && !opportunity.isSample} className="h-4 w-4 rounded border-slate-300" />
                {item}
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Checklist persistence is included in the schema. Interactive checklist saving is a Phase 2 hardening item.
          </p>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {BID_SECTIONS.map((section) => (
          <article key={section.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">{section.title}</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                {section.status}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">{section.detail}</p>
            <button
              type="button"
              disabled
              title="This workflow section is scaffolded for Phase 2 persistence and document integrations."
              className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400 ring-1 ring-slate-200"
            >
              Phase 2 workflow
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{detail}</p>
    </div>
  );
}
