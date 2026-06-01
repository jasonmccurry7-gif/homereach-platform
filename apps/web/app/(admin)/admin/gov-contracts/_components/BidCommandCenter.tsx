"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  DollarSign,
  ExternalLink,
  FileArchive,
  FileText,
  Handshake,
  History,
  ListChecks,
  Search,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { BidSubmissionActions } from "./BidSubmissionActions";
import type {
  GovContractBidWorkspace,
  GovContractOpportunity,
  GovContractPricingLineItem,
  GovContractResearchSource,
  GovContractSubcontractorCandidate,
  GovContractWorkflowItem,
} from "@/lib/gov-contracts/types";

type TabId =
  | "overview"
  | "requirements"
  | "documents"
  | "pricing"
  | "subcontractors"
  | "intelligence"
  | "proposal"
  | "financial"
  | "crm"
  | "assistant"
  | "submission"
  | "post_award";

const TABS: Array<{ id: TabId; label: string; icon: LucideIcon }> = [
  { id: "overview", label: "Overview", icon: BriefcaseBusiness },
  { id: "requirements", label: "Requirements", icon: ListChecks },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "pricing", label: "Pricing", icon: Calculator },
  { id: "subcontractors", label: "Subcontractors", icon: Handshake },
  { id: "intelligence", label: "Intelligence", icon: Building2 },
  { id: "proposal", label: "Proposal", icon: FileText },
  { id: "financial", label: "Cash Flow", icon: DollarSign },
  { id: "crm", label: "Gov CRM", icon: UsersRound },
  { id: "assistant", label: "AI Bid Assistant", icon: Sparkles },
  { id: "submission", label: "Submission", icon: FileArchive },
  { id: "post_award", label: "Post-Award", icon: PackageCheck },
];

function isTabId(value: string | null): value is TabId {
  return TABS.some((tab) => tab.id === value);
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
  if (["complete", "completed", "ready"].includes(status)) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (["missing", "critical"].includes(status)) return "bg-rose-50 text-rose-700 ring-rose-200";
  if (["not_applicable"].includes(status)) return "bg-slate-100 text-slate-500 ring-slate-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function countBlockingWork(items: GovContractWorkflowItem[]) {
  return items.filter((item) => ["missing", "needs_review", "pending"].includes(item.status)).length;
}

function countCriticalWork(items: GovContractWorkflowItem[]) {
  return items.filter((item) => item.priority === "critical" && item.status !== "complete" && item.status !== "ready").length;
}

function completionPercent(items: GovContractWorkflowItem[]) {
  if (!items.length) return 100;
  const complete = items.filter((item) => ["complete", "ready", "not_applicable"].includes(item.status)).length;
  return Math.round((complete / items.length) * 100);
}

function completionTone(percent: number) {
  if (percent >= 80) return "bg-emerald-600";
  if (percent >= 45) return "bg-amber-500";
  return "bg-rose-500";
}

function readinessTone(score: number) {
  if (score >= 85) return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (score >= 60) return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-rose-200 bg-rose-50 text-rose-950";
}

function ExecutiveReadinessPanel({
  workspace,
}: {
  workspace: GovContractBidWorkspace;
}) {
  const missingDocs = countBlockingWork(workspace.documents);
  const complianceOpen = workspace.complianceMatrix.filter((item) => item.status === "missing" || item.status === "needs_review").length;
  const criticalSubmission = countCriticalWork(workspace.submissionPlan.checklist);
  const subcontractorOpen = workspace.subcontractorNeeds.length;
  const nextAction =
    workspace.bidDecision.recommendation === "No-Bid"
      ? "Record no-bid rationale and keep the opportunity out of active bid spend unless an executive overrides."
      : workspace.bidDecision.recommendedNextStep;

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${readinessTone(workspace.submissionReadinessScore)}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em]">Executive bid posture</p>
          <h2 className="mt-2 text-2xl font-black">{workspace.bidDecision.recommendation}</h2>
          <p className="mt-2 max-w-4xl text-sm font-semibold leading-6">{nextAction}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4 lg:w-[30rem]">
          <MiniStat label="Docs open" value={missingDocs} />
          <MiniStat label="Compliance" value={complianceOpen} />
          <MiniStat label="Submit blockers" value={criticalSubmission} />
          <MiniStat label="Partner needs" value={subcontractorOpen} />
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-white/65 p-3 text-xs font-bold leading-5">
        Bid readiness means the team can prepare a package for human review. It does not mean HomeReach is legally compliant,
        price-approved, or authorized to submit.
      </p>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-black/5">
      <p className="text-2xl font-black">{value}</p>
      <p className="mt-1 text-[10px] font-black uppercase tracking-wide">{label}</p>
    </div>
  );
}

function WorkList({ items }: { items: GovContractWorkflowItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <article key={`${item.title}-${item.detail}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-black text-slate-950">{item.title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(item.status)}`}>
              {item.status.replaceAll("_", " ")}
            </span>
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

function PricingTable({ title, items }: { title: string; items: GovContractPricingLineItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-black text-slate-950">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.key} className="flex items-start justify-between gap-4 border-t border-slate-100 pt-3 first:border-t-0 first:pt-0">
            <div>
              <p className="text-sm font-black text-slate-900">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.note}</p>
            </div>
            <p className="shrink-0 text-sm font-black text-slate-950">{formatCurrency(item.amountCents)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComplianceSafeguards() {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
      <div className="flex items-start gap-3">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="font-black">Human approval lock</p>
          <p className="mt-1 leading-6">
            This workspace can draft, calculate, organize, and export preparation materials. It does not submit bids,
            make legal certifications, approve final pricing, fabricate past performance, or commit subcontractors.
          </p>
        </div>
      </div>
    </section>
  );
}

export function BidCommandCenter({
  opportunity,
  workspace,
}: {
  opportunity: GovContractOpportunity;
  workspace: GovContractBidWorkspace;
}) {
  const searchParams = useSearchParams();
  const requestedTab = searchParams?.get("tab") ?? null;
  const [activeTab, setActiveTab] = useState<TabId>(isTabId(requestedTab) ? requestedTab : "overview");

  useEffect(() => {
    if (isTabId(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab]);

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_42%),linear-gradient(135deg,#020617,#0f172a)] p-6 lg:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Bid Command Center</p>
              <h1 className="mt-3 max-w-5xl text-3xl font-black leading-tight lg:text-4xl">{opportunity.title}</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Built to win profitable, executable contracts. Every high-risk action remains human-approved.
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 rounded-2xl border border-white/10 bg-white/10 p-3 sm:w-auto lg:w-80">
              <BidSubmissionActions opportunityId={opportunity.id} compact />
              <Link
                href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-center text-sm font-black text-white ring-1 ring-white/20 hover:bg-white/15"
              >
                Opportunity Details
              </Link>
            </div>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Stage</p>
              <p className="mt-2 text-2xl font-black capitalize">{workspace.bidStage.replaceAll("_", " ")}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Bid completion</p>
              <p className="mt-2 text-2xl font-black">{workspace.submissionReadinessScore}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Win probability</p>
              <p className="mt-2 text-2xl font-black">{workspace.winProbability}%</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Recommended bid</p>
              <p className="mt-2 text-2xl font-black">{formatCurrency(workspace.pricing.recommendedBidCents)}</p>
            </div>
          </div>
        </div>
      </header>

      <ComplianceSafeguards />

      <ExecutiveReadinessPanel workspace={workspace} />

      <nav className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-black ${
                active ? "bg-slate-950 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Agency" value={opportunity.agency} detail={opportunity.solicitationNumber ?? "Solicitation number not listed"} />
            <Metric label="Due date" value={formatDate(opportunity.dueDate)} detail={`Q&A: ${formatDate(opportunity.questionsDeadline)}`} />
            <Metric label="Fit / risk" value={`${opportunity.fitScore}/${opportunity.riskScore}`} detail="Advisory fit score and execution risk" />
            <Metric label="Profit target" value={`${workspace.profitTargetPercent}%`} detail="Risk-adjusted gross margin target" />
            <Metric label="Expected gross profit" value={formatCurrency(workspace.pricing.expectedGrossProfitCents)} detail="Advisory until costs and quotes are approved" />
            <Metric label="Net profit model" value={formatCurrency(workspace.pricing.expectedNetProfitCents)} detail={`${workspace.pricing.riskAdjustedMarginPercent}% risk-adjusted margin`} />
            <Metric label="Approval state" value={workspace.approvalStatus.replaceAll("_", " ")} detail="Human gate required before final use" />
            <Metric label="Owner" value={workspace.ownerLabel} detail="Responsible for next internal action" />
          </div>
          <Panel title="True Bid Completion" icon={ClipboardCheck}>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <CompletionTile label="Requirements" percent={completionPercent(workspace.requirements)} detail="Solicitation, eligibility, Q&A, and submission facts" />
              <CompletionTile label="Documents" percent={completionPercent(workspace.documents)} detail="Response files, forms, pricing, and support docs" />
              <CompletionTile
                label="Compliance"
                percent={completionPercent(
                  workspace.complianceMatrix.map((item) => ({
                    title: item.requirement,
                    detail: item.sourceReference,
                    status: item.status === "completed" ? "complete" : item.status,
                    priority: item.riskLevel,
                    owner: "Compliance reviewer",
                  }))
                )}
                detail="Requirement mapping and human review status"
              />
              <CompletionTile label="Submission" percent={completionPercent(workspace.submissionPlan.checklist)} detail="Final package and approval gate readiness" />
              <CompletionTile label="Overall" percent={workspace.submissionReadinessScore} detail="Advisory readiness before human approval" />
            </div>
            <p className="mt-4 rounded-2xl bg-white p-3 text-xs font-bold leading-5 text-slate-600 ring-1 ring-slate-200">
              Completion is intentionally conservative. A 100% workspace still requires owner approval before final pricing,
              external submission, certification claims, or subcontractor commitments.
            </p>
          </Panel>
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <BadgeCheck className="mt-1 h-5 w-5 shrink-0 text-blue-600" />
              <div>
                <h2 className="text-lg font-black text-slate-950">Bid / No-Bid Recommendation: {workspace.bidDecision.recommendation}</h2>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Why</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                      {workspace.bidDecision.why.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-wide text-slate-500">Risks</p>
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-700">
                      {[...workspace.bidDecision.risks, ...workspace.bidDecision.missingRequirements].map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-blue-50 p-4 text-sm font-semibold leading-6 text-blue-950">
                  {workspace.bidDecision.recommendedNextStep}
                </p>
              </div>
            </div>
          </section>
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoBlock
              title="Strategic Summary"
              items={[
                workspace.bidDecision.capabilityFit,
                workspace.bidDecision.financialFit,
                workspace.bidDecision.operationalFit,
              ]}
            />
            <InfoBlock
              title="Market Research Readout"
              items={[
                `Competitive range: ${workspace.operatingModel.awardIntel.realisticCompetitiveRange}`,
                `Incumbent: ${workspace.operatingModel.awardIntel.incumbentVendor}`,
                `Research gaps: ${workspace.operatingModel.awardIntel.intelligenceGaps.join(", ")}`,
              ]}
            />
            <InfoBlock
              title="Underbid Warnings"
              items={[
                workspace.pricing.underpricingWarning,
                workspace.pricing.lowMarginWarning,
                workspace.pricing.cashFlowWarning,
              ]}
              danger
            />
          </div>
          <Panel title="Contracting Lifecycle" icon={History}>
            <div className="grid gap-3 lg:grid-cols-2">
              {workspace.operatingModel.lifecycle.map((item) => (
                <article key={item.stage} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-sm font-black text-slate-950">{item.stage}</h3>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.objective}</p>
                  <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">{item.nextAction}</p>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "requirements" ? (
        <section className="space-y-4">
          <Panel title="Solicitation Requirements" icon={ListChecks}>
            <WorkList items={workspace.requirements} />
          </Panel>
          <Panel title="Compliance Matrix" icon={ClipboardCheck}>
            <div className="grid gap-3">
              {workspace.complianceMatrix.map((item) => (
                <article key={item.requirement} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h3 className="font-black text-slate-950">{item.requirement}</h3>
                      <p className="mt-1 text-sm text-slate-600">{item.sourceReference}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">Response location: {item.responseLocation}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(item.status)}`}>
                      {item.status.replaceAll("_", " ")}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "documents" ? (
        <Panel title="Documents And Response Package" icon={FileText}>
          <WorkList items={workspace.documents} />
        </Panel>
      ) : null}

      {activeTab === "pricing" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Minimum safe bid" value={formatCurrency(workspace.pricing.minimumSafeBidCents)} detail="Do not price below fully loaded cost" />
            <Metric label="Aggressive bid" value={formatCurrency(workspace.pricing.aggressiveBidCents)} detail="Lower margin, still above floor" />
            <Metric label="Recommended bid" value={formatCurrency(workspace.pricing.recommendedBidCents)} detail="Risk-adjusted target" />
            <Metric label="Premium bid" value={formatCurrency(workspace.pricing.premiumBidCents)} detail="Higher risk or stronger value case" />
          </div>
          <section className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="space-y-2 font-semibold leading-6">
                <p>{workspace.pricing.underpricingWarning}</p>
                <p>{workspace.pricing.lowMarginWarning}</p>
                <p>{workspace.pricing.cashFlowWarning}</p>
              </div>
            </div>
          </section>
          <div className="grid gap-4 xl:grid-cols-3">
            <PricingTable title="Base Costs" items={workspace.pricing.directCosts} />
            <PricingTable title="Indirect Costs" items={workspace.pricing.indirectCosts} />
            <PricingTable title="Risk Adders" items={workspace.pricing.riskAdders} />
          </div>
          <InfoBlock title="Price Reasonableness Support" items={workspace.pricing.priceReasonablenessNotes} />
        </section>
      ) : null}

      {activeTab === "subcontractors" ? (
        <Panel title="Subcontractor Sourcing And Compliance" icon={Handshake}>
          <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-4 text-indigo-950">
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-75">Near-job subcontractor preview</p>
            {workspace.subcontractorNeeds.length ? (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {workspace.subcontractorNeeds.map((need) => (
                  <div key={`${need.workCategory}-${need.geography}`} className="rounded-xl bg-white/70 p-3 ring-1 ring-indigo-100">
                    <p className="text-sm font-black">{need.workCategory}</p>
                    <p className="mt-1 text-xs font-semibold leading-5">{need.geography}</p>
                    <p className="mt-2 text-xs leading-5">
                      Verify {need.requiredCapabilities.slice(0, 2).join(" and ")} before pricing approval.
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm font-semibold leading-6">
                No immediate subcontractor need detected. Keep place-of-performance coverage and direct execution assumptions under review.
              </p>
            )}
          </div>
          {workspace.subcontractorNeeds.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {workspace.subcontractorNeeds.map((need) => (
                <article key={need.workCategory} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-lg font-black text-slate-950">{need.workCategory}</h3>
                  <p className="mt-2 text-sm text-slate-600">{need.geography}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge label={need.pipelineStage} />
                    {need.insuranceRequired ? <Badge label="Insurance required" tone="amber" /> : null}
                    <Badge label="Human approval required" tone="rose" />
                  </div>
                  <p className="mt-4 text-xs font-black uppercase tracking-wide text-slate-500">Quote request draft</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{need.outreachDraft}</pre>
                  {need.candidateBusinesses?.length ? (
                    <div className="mt-4">
                      <p className="text-xs font-black uppercase tracking-wide text-slate-500">Businesses to source near this job</p>
                      <div className="mt-2 grid gap-2">
                        {need.candidateBusinesses.slice(0, 4).map((candidate) => (
                          <SubcontractorCandidateCard key={`${need.workCategory}-${candidate.name}-${candidate.sourceUrl}`} candidate={candidate} />
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {need.sourcingLinks?.length ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {need.sourcingLinks.map((source) =>
                        source.url ? (
                          <a
                            key={`${need.workCategory}-${source.label}`}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200"
                          >
                            {source.label}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null
                      )}
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No subcontractor need detected yet. Keep direct execution assumptions under review.</p>
          )}
        </Panel>
      ) : null}

      {activeTab === "intelligence" ? (
        <section className="space-y-4">
          <Panel title="Opportunity Market Research Packet" icon={Search}>
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge label={workspace.marketResearch.confidence} />
                  <Badge label={workspace.marketResearch.researchStatus.replaceAll("_", " ")} tone="amber" />
                  <Badge label={workspace.marketResearch.freshnessLabel} />
                </div>
                <h3 className="mt-4 text-lg font-black text-slate-950">Research summary</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{workspace.marketResearch.executiveSummary}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <InfoBlock title="Historical Award Signal" items={[workspace.marketResearch.historicalAwardSummary]} />
                  <InfoBlock title="Competitive Pricing Range" items={[workspace.marketResearch.competitiveRangeSummary]} />
                  <InfoBlock title="Likely Competitor Signal" items={[workspace.marketResearch.likelyCompetitorSummary]} />
                  <InfoBlock title="Research Gaps" items={workspace.marketResearch.sourceGaps} danger />
                </div>
              </div>
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-slate-950">Research sources</h3>
                  <div className="mt-3 grid gap-2">
                    {workspace.marketResearch.sourceLinks.map((source) => (
                      <ResearchSourceRow key={source.label} source={source} />
                    ))}
                  </div>
                </div>
                <InfoBlock title="Underbid Controls" items={workspace.marketResearch.underbidControls} danger />
              </div>
            </div>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2">
            <Panel title="Agency Intelligence" icon={Building2}>
              <div className="grid gap-3">
                <Metric label="Agency" value={workspace.operatingModel.agencyProfile.agencyName} detail={workspace.operatingModel.agencyProfile.office ?? "Office not listed"} />
                <InfoBlock
                  title="Strategic Guidance"
                  items={[
                    workspace.operatingModel.agencyProfile.spendingTrend,
                    workspace.operatingModel.agencyProfile.incumbentPattern,
                    workspace.operatingModel.agencyProfile.smallBusinessTendency,
                    ...workspace.operatingModel.agencyProfile.aiGuidance,
                  ]}
                />
              </div>
            </Panel>
            <Panel title="Historical Award Intelligence" icon={History}>
              <div className="grid gap-3">
                <Metric label="Competitive range" value={workspace.operatingModel.awardIntel.realisticCompetitiveRange} detail="Advisory until prior award data is attached" />
                <InfoBlock
                  title="Award Signals"
                  items={[
                    `Incumbent: ${workspace.operatingModel.awardIntel.incumbentVendor}`,
                    workspace.operatingModel.awardIntel.historicalAwardSignal,
                    workspace.operatingModel.awardIntel.likelyCompetitorBehavior,
                    workspace.operatingModel.awardIntel.pricingPattern,
                  ]}
                />
                <InfoBlock title="Intelligence Gaps" items={workspace.operatingModel.awardIntel.intelligenceGaps} danger />
              </div>
            </Panel>
          </div>
          <Panel title="Past Performance And Recompete Signals" icon={BadgeCheck}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                {workspace.operatingModel.pastPerformanceMatches.map((match) => (
                  <article key={match.projectName} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="font-black text-slate-950">{match.projectName}</h3>
                      <Badge label={`${match.relevanceScore}% relevant`} />
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{match.narrativeUse}</p>
                    <p className="mt-3 text-xs font-semibold leading-5 text-rose-700">{match.gap}</p>
                  </article>
                ))}
              </div>
              <div className="space-y-3">
                {workspace.operatingModel.recompeteSignals.map((signal) => (
                  <article key={signal.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-black text-slate-950">{signal.label}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{signal.timing}</p>
                    <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-600">{signal.prepositioningAction}</p>
                  </article>
                ))}
              </div>
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "proposal" ? (
        <Panel title="Proposal Development Workspace" icon={FileText}>
          <div className="grid gap-3 md:grid-cols-2">
            {workspace.operatingModel.proposalSections.map((section) => (
              <article key={section.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-black text-slate-950">{section.title}</h3>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${statusTone(section.status)}`}>
                    {section.status.replaceAll("_", " ")}
                  </span>
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-600">{section.purpose}</p>
                <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{section.owner}</p>
                <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{section.aiDraftInstruction}</p>
              </article>
            ))}
          </div>
        </Panel>
      ) : null}

      {activeTab === "financial" ? (
        <section className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Upfront cash need" value={formatCurrency(workspace.operatingModel.financialRisk.upfrontCashNeedCents)} detail="Estimated before first payment" />
            <Metric label="Subcontractor float" value={formatCurrency(workspace.operatingModel.financialRisk.subcontractorFloatCents)} detail="Potential partner payment exposure" />
            <Metric label="Payment gap" value={`${workspace.operatingModel.financialRisk.estimatedPaymentGapDays} days`} detail="Advisory timing model" />
            <Metric label="Stress score" value={`${workspace.operatingModel.financialRisk.workingCapitalStressScore}/100`} detail="Cash-flow risk indicator" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoBlock title="Financial Stress Warnings" items={workspace.operatingModel.financialRisk.warnings} danger />
            <InfoBlock title="Model Assumptions" items={workspace.operatingModel.financialRisk.assumptions} />
          </div>
        </section>
      ) : null}

      {activeTab === "crm" ? (
        <section className="space-y-4">
          <Panel title="Government CRM And Relationship Plan" icon={UsersRound}>
            <div className="grid gap-3 md:grid-cols-2">
              {workspace.operatingModel.governmentContacts.map((contact) => (
                <article key={`${contact.contactType}-${contact.label}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-black text-slate-950">{contact.label}</h3>
                    <Badge label={contact.contactType.replaceAll("_", " ")} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{contact.nextAction}</p>
                  <p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-500">{contact.relationshipStage}</p>
                </article>
              ))}
            </div>
          </Panel>
          <Panel title="Teaming Decision" icon={Handshake}>
            <div className="grid gap-4 lg:grid-cols-2">
              <InfoBlock
                title={workspace.operatingModel.teamingPlan.primeRecommendation}
                items={workspace.operatingModel.teamingPlan.rationale}
              />
              <InfoBlock
                title="Agreement Warnings"
                items={workspace.operatingModel.teamingPlan.agreementWarnings}
                danger
              />
            </div>
          </Panel>
        </section>
      ) : null}

      {activeTab === "assistant" ? (
        <Panel title="AI Government Contract Assistant" icon={Sparkles}>
          <div className="grid gap-4 lg:grid-cols-3">
            <InfoBlock title="Recommendation" items={[workspace.aiAssistant.recommendation, workspace.aiAssistant.nextAction]} />
            <InfoBlock title="Allowed AI Work" items={workspace.aiAssistant.allowedActions} />
            <InfoBlock title="Blocked Without Human Approval" items={workspace.aiAssistant.blockedActions} danger />
          </div>
        </Panel>
      ) : null}

      {activeTab === "submission" ? (
        <section className="space-y-4">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-950 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] opacity-75">Submit / export approval guard</p>
                <h2 className="mt-2 text-2xl font-black">Human-gated bid submission control</h2>
              <p className="mt-2 max-w-3xl leading-6">
                  Export creates an internal review package for the human approver. The workspace never uploads to SAM.gov,
                  sends proposal email, certifies compliance, accepts an award, or binds HomeReach. Email submission is only
                  appropriate when the official notice explicitly names email as the response method and the address has been
                  verified from the solicitation.
                </p>
              </div>
              <BidSubmissionActions opportunityId={opportunity.id} />
            </div>
          </section>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Metric label="Method" value={workspace.submissionPlan.method} detail={workspace.submissionPlan.portalOrEmail} />
            <Metric label="Deadline" value={formatDate(workspace.submissionPlan.deadline)} detail={workspace.submissionPlan.timezone} />
            <Metric label="Subject line" value={workspace.submissionPlan.requiredSubjectLine} detail="Verify from solicitation" />
            <Metric label="Attachment limits" value={workspace.submissionPlan.attachmentLimits} detail="Verify before export" />
          </div>
          <Panel title="Ready-To-Submit Gate" icon={FileArchive}>
            <WorkList items={workspace.submissionPlan.checklist} />
          </Panel>
          <InfoBlock title="Human Approval Gate" items={workspace.submissionPlan.humanApprovalGate} danger />
        </section>
      ) : null}

      {activeTab === "post_award" ? (
        <section className="space-y-4">
          <Panel title="Post-Award Fulfillment" icon={PackageCheck}>
            <div className="grid gap-4 lg:grid-cols-2">
              <WorkGroup title="Kickoff" items={workspace.postAwardPlan.kickoffChecklist} />
              <WorkGroup title="Milestones" items={workspace.postAwardPlan.milestones} />
              <WorkGroup title="Invoices" items={workspace.postAwardPlan.invoiceTracker} />
              <WorkGroup title="Closeout" items={workspace.postAwardPlan.closeoutChecklist} />
            </div>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: JSX.Element | JSX.Element[];
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 shadow-sm lg:p-5">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-700" />
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Badge({ label, tone = "slate" }: { label: string; tone?: "slate" | "amber" | "rose" }) {
  const classes =
    tone === "amber"
      ? "bg-amber-50 text-amber-800 ring-amber-200"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-rose-200"
      : "bg-slate-100 text-slate-700 ring-slate-200";
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${classes}`}>{label}</span>;
}

function CompletionTile({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
        <p className="text-lg font-black text-slate-950">{clamped}%</p>
      </div>
      <div className="mt-3 h-2 rounded-full bg-slate-100">
        <div className={`h-2 rounded-full ${completionTone(clamped)}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function ResearchSourceRow({ source }: { source: GovContractResearchSource }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{source.label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{source.note}</p>
        </div>
        <Badge label={source.status.replaceAll("_", " ")} tone={source.status === "verified" ? "slate" : "amber"} />
      </div>
      {source.url ? (
        <a
          href={source.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-900"
        >
          Open source
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function SubcontractorCandidateCard({ candidate }: { candidate: GovContractSubcontractorCandidate }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{candidate.name}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {candidate.workCategory} - {candidate.geography} - {candidate.distanceSignal}
          </p>
        </div>
        <Badge label={candidate.verificationStatus.replaceAll("_", " ")} tone={candidate.verificationStatus === "verified" ? "slate" : "amber"} />
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{candidate.nextAction}</p>
      {candidate.sourceUrl ? (
        <a
          href={candidate.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-black text-blue-700 hover:text-blue-900"
        >
          {candidate.sourceLabel}
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}

function InfoBlock({ title, items, danger = false }: { title: string; items: string[]; danger?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${danger ? "border-rose-200 bg-rose-50" : "border-slate-200 bg-white"}`}>
      <div className="flex items-center gap-2">
        {danger ? <ShieldAlert className="h-4 w-4 text-rose-700" /> : <CheckCircle2 className="h-4 w-4 text-emerald-700" />}
        <h3 className={`text-sm font-black ${danger ? "text-rose-950" : "text-slate-950"}`}>{title}</h3>
      </div>
      <ul className={`mt-3 space-y-2 text-sm leading-6 ${danger ? "text-rose-900" : "text-slate-700"}`}>
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </div>
  );
}

function WorkGroup({ title, items }: { title: string; items: GovContractWorkflowItem[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="font-black text-slate-950">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.title} className="rounded-xl bg-slate-50 p-3">
            <p className="text-sm font-black text-slate-900">{item.title}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
