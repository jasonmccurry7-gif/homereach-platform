import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { buildBidExportPackage, loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import type { GovContractWorkflowItem } from "@/lib/gov-contracts/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Review Packet - HomeReach Admin" };

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "TBD";
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

function statusTone(status: string) {
  if (["complete", "completed", "ready", "verified"].includes(status)) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (["missing", "critical"].includes(status)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["not_applicable"].includes(status)) return "bg-slate-100 text-slate-600 ring-slate-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

function Panel({ title, children }: { title: string; children: JSX.Element | JSX.Element[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(value)}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function WorkRows({ items }: { items: GovContractWorkflowItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <article key={`${item.title}-${item.detail}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-black text-slate-950">{item.title}</h3>
            <Badge value={item.status} />
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
          <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            {item.priority} priority - {item.owner}
          </p>
        </article>
      ))}
    </div>
  );
}

export default async function GovContractReviewPacketPage({ params }: PageProps) {
  const { opportunityId } = await params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) notFound();

  const reviewPackage = buildBidExportPackage(opportunity, workspace);
  const rawPacketUrl = `/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunity.id)}/export-package`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`} className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to opportunity
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}/bid-room?tab=submission`}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Open Submission Tab
          </Link>
          <a
            href={rawPacketUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Raw JSON Export
          </a>
        </div>
      </div>

      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">Internal review packet</p>
        <h1 className="mt-3 max-w-5xl text-3xl font-black leading-tight">{opportunity.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Preparation package only. This page organizes the bid review trail; it does not submit a bid, send an email,
          certify eligibility, approve pricing, or commit subcontractors.
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Agency" value={opportunity.agency} />
        <Metric label="Solicitation" value={opportunity.solicitationNumber ?? "Not listed"} />
        <Metric label="Due date" value={formatDate(opportunity.dueDate)} />
        <Metric label="Review status" value={reviewPackage.reviewStatus.replaceAll("_", " ")} />
      </section>

      <Panel title="Submission Truth Check">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
            <p className="font-black">Do not assume the official contact email is the submission path.</p>
            <p className="mt-2 text-sm font-semibold leading-6">
              Submit by email only when the official notice explicitly says email submission is allowed and names the exact
              address, subject line, deadline, time zone, and attachment rules. If the notice names SAM.gov, a VA portal,
              a vendor portal, eBuy, PIEE, or another system, use that official portal instead.
            </p>
          </div>
          <div className="grid gap-3">
            <Metric label="Response method" value={workspace.submissionPlan.method} />
            <Metric label="Portal or email" value={workspace.submissionPlan.portalOrEmail} />
            <Metric label="Subject line" value={workspace.submissionPlan.requiredSubjectLine} />
            <Metric label="Attachment limits" value={workspace.submissionPlan.attachmentLimits} />
            {opportunity.sourceUrl ? (
              <a
                href={opportunity.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700"
              >
                Open Official Notice
              </a>
            ) : null}
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Bid / No-Bid: ${workspace.bidDecision.recommendation}`}>
          <div className="space-y-4">
            <InfoList title="Why" items={workspace.bidDecision.why} />
            <InfoList title="Risks / missing items" items={[...workspace.bidDecision.risks, ...workspace.bidDecision.missingRequirements]} danger />
            <p className="rounded-2xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-950">
              {workspace.bidDecision.recommendedNextStep}
            </p>
          </div>
        </Panel>
        <Panel title="Pricing Guardrail">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Minimum safe bid" value={formatCurrency(workspace.pricing.minimumSafeBidCents)} />
            <Metric label="Recommended bid" value={formatCurrency(workspace.pricing.recommendedBidCents)} />
            <Metric label="Underbid risk" value={`${workspace.pricing.underbidRiskScore}/100`} />
            <Metric label="Cash-flow risk" value={`${workspace.pricing.cashFlowRiskScore}/100`} />
          </div>
          <InfoList title="Warnings" items={[workspace.pricing.underpricingWarning, workspace.pricing.lowMarginWarning, workspace.pricing.cashFlowWarning]} danger />
        </Panel>
      </section>

      <Panel title="Submission Checklist">
        <WorkRows items={workspace.submissionPlan.checklist} />
      </Panel>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Required Documents">
          <WorkRows items={workspace.documents} />
        </Panel>
        <Panel title="Compliance Matrix">
          <div className="grid gap-3">
            {workspace.complianceMatrix.map((item) => (
              <article key={item.requirement} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-950">{item.requirement}</h3>
                  <Badge value={item.status} />
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.sourceReference}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{item.responseLocation}</p>
              </article>
            ))}
          </div>
        </Panel>
      </section>

      <Panel title="Sources Referenced">
        <div className="grid gap-3 md:grid-cols-2">
          {reviewPackage.sourcesReferenced.map((source) => (
            <article key={`${source.label}-${source.url}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">{source.label}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{source.type}</p>
              {source.url ? (
                <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-blue-700 hover:text-blue-900">
                  Open source
                </a>
              ) : null}
            </article>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-black leading-5 text-slate-950">{value}</p>
    </div>
  );
}

function InfoList({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${danger ? "border-rose-200 bg-rose-50 text-rose-950" : "border-slate-200 bg-slate-50 text-slate-900"}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{title}</p>
      <ul className="mt-3 space-y-2 text-sm font-semibold leading-6">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}
