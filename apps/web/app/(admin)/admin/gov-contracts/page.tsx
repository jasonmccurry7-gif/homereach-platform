import type { Metadata } from "next";
import Link from "next/link";
import { CONTRACT_WORKFLOW_GOVERNANCE } from "@/lib/admin/admin-operating-model";
import { loadGovContractDashboard } from "@/lib/gov-contracts/data";
import { buildGeneratedBidWorkspace } from "@/lib/gov-contracts/execution";
import type { GovContractDashboardFilters, GovContractOpportunity } from "@/lib/gov-contracts/types";
import { OpportunityStatusActions } from "./_components/OpportunityStatusActions";
import { OpportunityExecutionActions } from "./_components/OpportunityExecutionActions";
import { BidSubmissionActions } from "./_components/BidSubmissionActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contracts - HomeReach Admin" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): GovContractDashboardFilters {
  return {
    keyword: first(params.keyword)?.trim() || undefined,
    naics: first(params.naics)?.trim() || undefined,
    psc: first(params.psc)?.trim() || undefined,
    agency: first(params.agency)?.trim() || undefined,
    state: first(params.state)?.trim().toUpperCase() || undefined,
    setAside: first(params.setAside)?.trim() || undefined,
    noticeType: first(params.noticeType)?.trim() || undefined,
    status: (first(params.status)?.trim() as GovContractDashboardFilters["status"]) || "all",
  };
}

function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "Value TBD";
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
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusTone(status: string) {
  if (status === "strong_fit") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (status === "possible_fit") return "bg-blue-100 text-blue-800 ring-blue-200";
  if (status === "weak_fit") return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function pursuitSignal(opportunity: GovContractOpportunity) {
  if (opportunity.fitStatus === "no_bid" || opportunity.pipelineStatus === "no_bid") {
    return { label: "No-bid candidate", detail: "Capture rationale and archive the pursuit unless a human overrides.", tone: "rose" };
  }
  if (opportunity.missingItems.length || opportunity.requiredDocuments.length === 0) {
    return { label: "Docs before bid", detail: "Verify solicitation package, required forms, and response method before pricing.", tone: "amber" };
  }
  if (opportunity.riskScore >= 70) {
    return { label: "Risk review first", detail: "Resolve pricing, compliance, or delivery exposure before committing bid resources.", tone: "amber" };
  }
  if (opportunity.fitScore >= 75) {
    return { label: "Bid-ready review", detail: "Strong candidate for fit evaluation and bid room setup after human go/no-go.", tone: "emerald" };
  }
  return { label: "Evaluate fit", detail: "Confirm scope, value, deadlines, and internal delivery capacity before pursuit.", tone: "blue" };
}

function signalTone(tone: string) {
  if (tone === "emerald") return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (tone === "rose") return "border-rose-200 bg-rose-50 text-rose-950";
  if (tone === "amber") return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-blue-200 bg-blue-50 text-blue-950";
}

function formatPercent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value)))}%`;
}

function ProgressMeter({ value }: { value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const barClass = clamped >= 75 ? "bg-emerald-600" : clamped >= 50 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="mt-2 h-2 rounded-full bg-slate-200">
      <div className={`h-2 rounded-full ${barClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function insightTone(tone: "blue" | "indigo" | "rose" | "slate") {
  if (tone === "blue") return "border-blue-100 bg-blue-50 text-blue-950";
  if (tone === "indigo") return "border-indigo-100 bg-indigo-50 text-indigo-950";
  if (tone === "rose") return "border-rose-100 bg-rose-50 text-rose-950";
  return "border-slate-200 bg-slate-50 text-slate-900";
}

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function OpportunityInsight({
  label,
  value,
  detail,
  tone = "slate",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "blue" | "indigo" | "rose" | "slate";
}) {
  return (
    <div className={`rounded-xl border p-4 ${insightTone(tone)}`}>
      <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-sm font-black leading-5">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 opacity-80">{detail}</p>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: GovContractOpportunity }) {
  const signal = pursuitSignal(opportunity);
  const workspace = buildGeneratedBidWorkspace(opportunity);
  const firstNeed = workspace.subcontractorNeeds[0];
  const awardIntel = workspace.operatingModel.awardIntel;
  const marketGaps = awardIntel.intelligenceGaps.slice(0, 3).join(", ");
  const partnerValue = firstNeed
    ? `${firstNeed.workCategory} near ${firstNeed.geography}`
    : `Direct review for ${opportunity.location.label}`;
  const partnerDetail = firstNeed
    ? `${firstNeed.pipelineStage}; verify ${firstNeed.requiredCapabilities.slice(0, 2).join(" and ")} before pricing.`
    : "No immediate subcontractor need detected; keep capacity, insurance, and delivery assumptions under review.";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-wide ring-1 ${statusTone(opportunity.fitStatus)}`}>
              {opportunity.fitStatus.replace("_", " ")}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              {opportunity.noticeType}
            </span>
            {opportunity.isSample ? (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-700 ring-1 ring-amber-200">
                Sample data
              </span>
            ) : null}
          </div>
          <h2 className="mt-3 text-xl font-black leading-tight text-slate-950">{opportunity.title}</h2>
          <p className="mt-2 text-sm text-slate-600">
            {opportunity.agency} {opportunity.solicitationNumber ? `- ${opportunity.solicitationNumber}` : ""}
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700">{opportunity.summary}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Due date" value={formatDate(opportunity.dueDate)} />
            <Metric label="Pipeline value" value={formatCurrency(opportunity.estimatedValueCents)} />
            <Metric label="Location" value={opportunity.location.label} />
            <Metric label="NAICS / PSC" value={[opportunity.naicsCode, opportunity.pscCode].filter(Boolean).join(" / ") || "TBD"} />
            <Metric label="Contract type" value={opportunity.contractType ?? "TBD"} />
            <Metric label="Response method" value={opportunity.responseMethod ?? "Verify notice"} />
            <Metric label="Required docs" value={opportunity.requiredDocuments.length ? `${opportunity.requiredDocuments.length} listed` : "Extract needed"} />
            <Metric label="Incumbent" value={opportunity.incumbentVendor ?? "Not discovered"} />
          </div>
          <div className="mt-4 grid gap-3 xl:grid-cols-3">
            <OpportunityInsight
              label="Strategic summary"
              value={workspace.bidDecision.recommendation}
              detail={`${workspace.bidDecision.capabilityFit} ${workspace.bidDecision.financialFit}`}
              tone="blue"
            />
            <OpportunityInsight
              label="Subcontractor near job"
              value={partnerValue}
              detail={`${partnerDetail} No partner commitment without approval.`}
              tone={firstNeed ? "indigo" : "slate"}
            />
            <OpportunityInsight
              label="Market / underbid warning"
              value={awardIntel.realisticCompetitiveRange}
              detail={`${workspace.pricing.underpricingWarning} Research gaps: ${marketGaps || "none flagged"}.`}
              tone="rose"
            />
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recommended next step</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{opportunity.recommendedNextAction}</p>
          </div>
          <div className={`mt-3 rounded-xl border p-4 ${signalTone(signal.tone)}`}>
            <p className="text-xs font-black uppercase tracking-[0.16em]">{signal.label}</p>
            <p className="mt-1 text-sm font-semibold leading-6">{signal.detail}</p>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:w-64">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Score label="Fit" value={opportunity.fitScore} />
            <Score label="Risk" value={opportunity.riskScore} />
            <Score label="Urgency" value={opportunity.urgencyScore} />
          </div>
          <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Bid completion</p>
              <p className="text-sm font-black text-slate-950">{formatPercent(workspace.submissionReadinessScore)}</p>
            </div>
            <ProgressMeter value={workspace.submissionReadinessScore} />
            <p className="mt-2 text-[11px] font-semibold leading-4 text-slate-500">
              Completion is preparation readiness only; submit authority stays locked behind human approval.
            </p>
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-4 text-slate-500">
            Primary actions are internal and approval-gated. Nothing here submits a bid or certifies eligibility.
          </p>
          <div className="mt-4">
            <OpportunityExecutionActions opportunityId={opportunity.id} sourceUrl={opportunity.sourceUrl} compact />
          </div>
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-800">Submit / research gate</p>
            <div className="mt-2">
              <BidSubmissionActions opportunityId={opportunity.id} compact />
            </div>
          </div>
          <div className="mt-4">
            <OpportunityStatusActions opportunityId={opportunity.id} initialStatus={opportunity.pipelineStatus} />
          </div>
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
      <p className="text-lg font-black text-slate-950">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
    </div>
  );
}

export default async function GovContractsPage({ searchParams }: PageProps) {
  const filters = parseFilters(await searchParams);
  const data = await loadGovContractDashboard(filters);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_42%),linear-gradient(135deg,#020617,#0f172a)] p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Admin only - Bid execution platform</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">Government Contract Mission Control</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Find opportunities, decide bid/no-bid, start bid workspaces, price profitably, manage subcontractors,
                prepare response packages, and track post-award execution. Final submission, pricing, certification claims,
                and subcontractor commitments stay under explicit human approval.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4 text-sm text-slate-200">
              <p className="font-black text-white">SAM.gov sync</p>
              <p className="mt-1">{data.sync.message}</p>
            </div>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="New opportunities" value={String(data.summary.newOpportunities)} detail="Fresh notices to triage" />
        <SummaryCard label="Strong fit" value={String(data.summary.strongFit)} detail="Worth reviewing first" />
        <SummaryCard label="Deadlines this week" value={String(data.summary.deadlinesThisWeek)} detail="Time-sensitive items" />
        <SummaryCard label="Bids in progress" value={String(data.summary.bidsInProgress)} detail="Active pursuit work" />
        <SummaryCard label="Pipeline value" value={formatCurrency(data.summary.estimatedPipelineValueCents)} detail="Estimated or award values" />
      </section>

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Canonical approval surface</p>
            <h2 className="mt-1 text-lg font-black">Gov Contracts owns bid approval and submission status evidence.</h2>
            <p className="mt-2 max-w-4xl text-sm leading-6">{CONTRACT_WORKFLOW_GOVERNANCE.rule}</p>
          </div>
          <Link
            href={CONTRACT_WORKFLOW_GOVERNANCE.packagingSurfacePath}
            className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-white px-4 text-sm font-black text-blue-950 ring-1 ring-blue-200"
          >
            Open ContractOS packaging
          </Link>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Submitted bids" value={String(data.summary.submittedBids)} detail="Under evaluation or submitted" />
        <SummaryCard label="Awards won" value={String(data.summary.awardedBids)} detail="Post-award execution candidates" />
        <SummaryCard label="Pending approvals" value={String(data.summary.pendingApprovals)} detail="Human review required" />
        <SummaryCard label="Missing docs" value={String(data.summary.missingDocuments)} detail="Potential compliance blockers" />
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Expected profit" value={formatCurrency(data.summary.expectedProfitCents)} detail="Advisory pipeline margin" />
        <SummaryCard label="Cash exposure" value={formatCurrency(data.summary.cashFlowExposureCents)} detail="Estimated working-capital load" />
        <SummaryCard label="Compliance risks" value={String(data.summary.complianceRisks)} detail="Need human review" />
        <SummaryCard label="Subcontractor needs" value={String(data.summary.activeSubcontractorNeeds)} detail="Potential partner dependencies" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Government Contract Operating System</h2>
            <p className="mt-1 text-sm text-slate-500">Discovery, qualification, pricing, compliance, proposal, teaming, execution, recompete, and past performance.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/gov-contracts" className="rounded-full bg-slate-950 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
              Opportunities
            </Link>
            <Link href="/admin/gov-contracts?status=bid_prep" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              Bid Pipeline
            </Link>
            <Link href="/admin/gov-contracts?status=ready_to_submit" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              Submit Review
            </Link>
            <Link href="/admin/gov-contracts/subcontractors" className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
              Subcontractors
            </Link>
            {["Documents", "Pricing Models", "Compliance", "Awards", "Past Performance", "Agency Intel", "Gov CRM", "Recompetes", "AI Assistant", "Reports"].map((item) => (
              <span key={item} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-slate-600 ring-1 ring-slate-200">
                {item} <span className="text-slate-400">planned</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Opportunity Feed</h2>
            <p className="mt-1 text-sm text-slate-500">
              Search and filter live SAM.gov records after configuration. Sample records are labeled.
            </p>
          </div>
          <Link
            href="/admin/gov-contracts"
            className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200"
          >
            Clear filters
          </Link>
        </div>
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <FilterInput name="keyword" label="Keyword" defaultValue={filters.keyword} placeholder="mailing, courier..." />
          <FilterInput name="naics" label="NAICS" defaultValue={filters.naics} placeholder="541860" />
          <FilterInput name="psc" label="PSC" defaultValue={filters.psc} placeholder="R701" />
          <FilterInput name="agency" label="Agency" defaultValue={filters.agency} placeholder="GSA, VA..." />
          <FilterInput name="state" label="State" defaultValue={filters.state} placeholder="OH" />
          <div className="flex items-end">
            <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-black text-white hover:bg-blue-700">
              Filter
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-black">Compliance lock</p>
        <p className="mt-1">
          This system may recommend, organize, and draft. It never submits bids, certifies eligibility, commits pricing,
          accepts awards, or commits subcontractors without human approval.
        </p>
      </section>

      <div className="space-y-4">
        {data.opportunities.length > 0 ? (
          data.opportunities.map((opportunity) => <OpportunityCard key={opportunity.id} opportunity={opportunity} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h2 className="text-xl font-black text-slate-950">No opportunities match these filters.</h2>
            <p className="mt-2 text-sm text-slate-500">Clear filters or run a SAM.gov sync after adding the API key.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function FilterInput({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
    </label>
  );
}
