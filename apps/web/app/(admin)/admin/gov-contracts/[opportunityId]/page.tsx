import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGovContractOpportunity } from "@/lib/gov-contracts/data";
import type { GovContractOpportunity } from "@/lib/gov-contracts/types";
import { OpportunityStatusActions } from "../_components/OpportunityStatusActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Review - HomeReach Admin" };

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "Value not provided";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value || "Not listed"}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-slate-500">
        <span>{label}</span>
        <span>{value}/100</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function ApprovalGate({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-amber-400" />
      <div>
        <p className="font-black text-slate-950">{label}</p>
        <p className="mt-1 text-sm text-slate-600">{detail}</p>
      </div>
    </li>
  );
}

export default async function GovContractDetailPage({ params }: PageProps) {
  const { opportunityId } = await params;
  const opportunity = await loadGovContractOpportunity(decodeURIComponent(opportunityId));
  if (!opportunity) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/admin/gov-contracts" className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to Gov Contracts
        </Link>
        <Link
          href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}/bid-room`}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white shadow-sm hover:bg-slate-800"
        >
          Open Bid Room
        </Link>
      </div>

      <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-700">
              {opportunity.sourceSystem === "sam.gov" ? "SAM.gov opportunity" : "Sample planning record"}
            </p>
            <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-slate-950">{opportunity.title}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {opportunity.agency} {opportunity.solicitationNumber ? `- ${opportunity.solicitationNumber}` : ""}
            </p>
            <p className="mt-4 max-w-4xl text-sm leading-6 text-slate-700">{opportunity.summary}</p>
          </div>
          <div className="w-full shrink-0 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200 lg:w-80">
            <ScoreBar label="Fit score" value={opportunity.fitScore} />
            <div className="mt-4 space-y-4">
              <ScoreBar label="Risk score" value={opportunity.riskScore} />
              <ScoreBar label="Urgency score" value={opportunity.urgencyScore} />
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <DetailRow label="Due date" value={formatDate(opportunity.dueDate)} />
        <DetailRow label="Questions deadline" value={formatDate(opportunity.questionsDeadline)} />
        <DetailRow label="Site visit" value={formatDate(opportunity.siteVisitAt)} />
        <DetailRow label="Estimated value" value={formatCurrency(opportunity.estimatedValueCents)} />
        <DetailRow label="NAICS" value={opportunity.naicsCode} />
        <DetailRow label="PSC" value={opportunity.pscCode} />
        <DetailRow label="Set-aside" value={opportunity.setAsideDescription ?? opportunity.setAsideCode} />
        <DetailRow label="Place of performance" value={opportunity.location.label} />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">AI Advisory Summary</h2>
          <p className="mt-3 text-sm leading-6 text-slate-700">{opportunity.scoringReason}</p>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Recommended pursuit action</p>
            <p className="mt-1 text-sm font-semibold text-blue-950">{opportunity.recommendedNextAction}</p>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {Object.entries(opportunity.scoreBreakdown).map(([key, value]) => (
              <ScoreBar key={key} label={key.replace(/([A-Z])/g, " $1")} value={value} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Manual Workflow</h2>
          <p className="mt-2 text-sm text-slate-600">
            Status actions are manual and audit-ready. They do not submit bids or create outside commitments.
          </p>
          <div className="mt-4">
            <OpportunityStatusActions opportunityId={opportunity.id} initialStatus={opportunity.pipelineStatus} />
          </div>
          {opportunity.sourceUrl ? (
            <a
              href={opportunity.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex w-full justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-black text-white hover:bg-blue-700"
            >
              Open official notice
            </a>
          ) : (
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
              Official notice link is not present. Verify source before client-facing work.
            </p>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="text-lg font-black text-slate-950">Human Approval Gates</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          <ApprovalGate label="Go / No-Go decision" detail="A human must confirm pursuit before bid prep resources are committed." />
          <ApprovalGate label="Pricing finalization" detail="All pricing assumptions, margins, and subcontractor quotes require approval." />
          <ApprovalGate label="Certification claims" detail="No socioeconomic, insurance, bonding, or past-performance claims may be invented or auto-approved." />
          <ApprovalGate label="Bid submission" detail="The system never submits bids. Final submission remains manual and explicitly approved." />
        </ul>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Attachments and Documents">
          {opportunity.attachments.length > 0 ? (
            <ul className="space-y-2">
              {opportunity.attachments.map((attachment) => (
                <li key={attachment.url}>
                  <a href={attachment.url} target="_blank" rel="noreferrer" className="text-sm font-bold text-blue-700 hover:text-blue-900">
                    {attachment.label}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No attachments loaded yet. Sync and document ingestion are part of the SAM.gov connector workflow.</p>
          )}
        </Panel>
        <Panel title="Missing Data / Risk Flags">
          {opportunity.missingItems.length > 0 ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {opportunity.missingItems.map((item) => (
                <li key={item}>- Verify {item}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No high-priority data gaps detected by the advisory score.</p>
          )}
        </Panel>
      </section>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
