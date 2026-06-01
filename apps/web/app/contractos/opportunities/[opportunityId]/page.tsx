import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  FileCheck2,
  FileText,
  ShieldCheck,
  Users,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { loadContractOSAwardHistory } from "@/lib/contractos/award-history";
import { contractOSFeatureFlags } from "@/lib/contractos/config";
import { loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContractOS Opportunity Review | HomeReach",
  description:
    "Plain-English government contract opportunity review with fit scoring, bid/no-bid support, compliance checklist, pricing guidance, and proposal preparation controls.",
};

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

function formatMoney(cents: number | null | undefined) {
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

function scoreTone(value: number) {
  if (value >= 78) return "bg-emerald-600";
  if (value >= 58) return "bg-blue-600";
  if (value >= 38) return "bg-amber-500";
  return "bg-rose-500";
}

export default async function ContractOSOpportunityPage({ params }: PageProps) {
  const flags = contractOSFeatureFlags();
  if (!flags.enabled || !flags.publicDashboard) notFound();

  const { opportunityId } = await params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) notFound();

  const pricing = workspace.pricing;
  const awardHistory = await loadContractOSAwardHistory(opportunity);
  const complianceItems = workspace.complianceMatrix.slice(0, 6);
  const proposalSections = workspace.operatingModel.proposalSections.slice(0, 6);
  const subcontractorCandidates = workspace.marketResearch.subcontractorCandidates.slice(0, 4);
  const firstNeed = workspace.subcontractorNeeds[0];

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="px-4 py-8 lg:px-6 lg:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <Link href="/contractos/dashboard" className="inline-flex items-center gap-2 text-sm font-black text-blue-700 hover:text-blue-900">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to ContractOS
          </Link>

          <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Opportunity review</p>
                <h1 className="mt-3 max-w-4xl text-3xl font-black leading-tight text-slate-950">{opportunity.title}</h1>
                <p className="mt-2 text-sm text-slate-600">
                  {opportunity.agency} {opportunity.solicitationNumber ? `- ${opportunity.solicitationNumber}` : ""}
                </p>
                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-700">{opportunity.summary}</p>
              </div>
              <div className="grid w-full gap-2 sm:grid-cols-3 lg:w-96">
                <Score label="Fit" value={opportunity.fitScore} />
                <Score label="Risk" value={opportunity.riskScore} />
                <Score label="Readiness" value={workspace.submissionReadinessScore} />
              </div>
            </div>
          </header>

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Fact label="Deadline" value={formatDate(opportunity.dueDate)} />
            <Fact label="Location" value={opportunity.location.label} />
            <Fact label="Estimated size" value={formatMoney(opportunity.estimatedValueCents)} />
            <Fact label="Set-aside" value={opportunity.setAsideDescription ?? opportunity.setAsideCode ?? "Not listed"} />
            <Fact label="NAICS / PSC" value={[opportunity.naicsCode, opportunity.pscCode].filter(Boolean).join(" / ") || "TBD"} />
            <Fact label="Contract type" value={opportunity.contractType ?? "TBD"} />
            <Fact label="Response method" value={opportunity.responseMethod ?? "Verify notice"} />
            <Fact label="Required docs" value={opportunity.requiredDocuments.length ? `${opportunity.requiredDocuments.length} listed` : "Needs extraction"} />
          </section>

          <section id="bid-decision" className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <Panel title="Bid / No-Bid Decision" icon={CheckCircle2}>
              <p className="text-2xl font-black text-slate-950">{workspace.bidDecision.recommendation}</p>
              <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-950">
                {workspace.bidDecision.recommendedNextStep}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <DecisionBlock title="Why it fits" items={workspace.bidDecision.why} />
                <DecisionBlock title="Risks" items={workspace.bidDecision.risks} />
              </div>
            </Panel>

            <Panel title="Plain-English Solicitation Summary" icon={FileText}>
              <div className="grid gap-3 sm:grid-cols-2">
                <PlainEnglish label="What they are buying" value={workspace.bidDecision.capabilityFit} />
                <PlainEnglish label="Who should bid" value="Businesses with verified capability, documents, pricing discipline, and enough time to respond cleanly." />
                <PlainEnglish label="Who should not bid" value="Businesses missing eligibility, insurance, capacity, pricing proof, or subcontractor support for required work." />
                <PlainEnglish label="Questions to ask" value="What documents, pricing format, portal/email method, Q&A rules, and subcontracting terms are required?" />
              </div>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
            <Panel title="Historical Award Intelligence" icon={BadgeDollarSign}>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black uppercase text-emerald-800 ring-1 ring-emerald-200">
                  {awardHistory.status.replaceAll("_", " ")}
                </span>
                <a href={awardHistory.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-black text-blue-700 hover:text-blue-900">
                  Source: {awardHistory.sourceLabel}
                </a>
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-700">{awardHistory.summary}</p>
              <p className="mt-3 rounded-lg bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-950">
                {awardHistory.competitiveRangeSummary}
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Pricing signals</p>
                  <ul className="mt-2 space-y-1 text-xs font-semibold leading-5 text-slate-700">
                    {awardHistory.pricingSignals.map((signal) => (
                      <li key={signal}>- {signal}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Recent awards</p>
                  <div className="mt-2 space-y-2">
                    {awardHistory.awards.slice(0, 3).map((award) => (
                      <div key={`${award.awardId}-${award.recipientName}`} className="rounded-md bg-white p-2 ring-1 ring-slate-200">
                        <p className="text-xs font-black text-slate-950">{award.recipientName}</p>
                        <p className="mt-1 text-xs font-semibold text-slate-600">{formatMoney(award.awardAmountCents)}</p>
                        {award.sourceUrl ? (
                          <a href={award.sourceUrl} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-[11px] font-black text-blue-700">
                            Open award
                          </a>
                        ) : null}
                      </div>
                    ))}
                    {awardHistory.awards.length === 0 ? (
                      <p className="text-xs font-semibold leading-5 text-slate-600">No comparable awards returned yet.</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Pricing Guardrails" icon={BadgeDollarSign}>
              <div className="grid gap-3">
                <Fact label="Minimum safe bid" value={formatMoney(pricing.minimumSafeBidCents)} />
                <Fact label="Recommended bid" value={formatMoney(pricing.recommendedBidCents)} />
                <Fact label="Projected gross profit" value={formatMoney(pricing.expectedGrossProfitCents)} />
                <Fact label="Cash-flow risk" value={`${pricing.cashFlowRiskScore}/100`} />
              </div>
              <p className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-semibold leading-6 text-rose-950">
                {pricing.underpricingWarning}
              </p>
            </Panel>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <Panel title="Compliance Matrix" icon={ShieldCheck}>
              <div className="space-y-2">
                {complianceItems.map((item) => (
                  <div key={item.requirement} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-950">{item.requirement}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.status.replaceAll("_", " ")} · {item.riskLevel} risk
                    </p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="AI Proposal Assistant" icon={FileCheck2}>
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold leading-6 text-amber-950">
                Draft - Human Review Required. The assistant can draft sections only from verified solicitation facts.
              </p>
              <div className="mt-3 space-y-2">
                {proposalSections.map((section) => (
                  <div key={section.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-950">{section.title}</p>
                    <p className="mt-1 text-xs text-slate-600">{section.purpose}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="subcontractors" className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Panel title="Subcontractor Mode" icon={Users}>
              <p className="text-sm leading-6 text-slate-600">
                {firstNeed
                  ? `This opportunity may need ${firstNeed.workCategory} support near ${firstNeed.geography}.`
                  : "No immediate subcontractor need was detected, but partner review remains available before final pricing."}
              </p>
              <div className="mt-4 space-y-2">
                {subcontractorCandidates.map((candidate) => (
                  <div key={`${candidate.name}-${candidate.sourceUrl}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm font-black text-slate-950">{candidate.name}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">{candidate.nextAction}</p>
                    {candidate.sourceUrl ? (
                      <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-black text-blue-700 hover:text-blue-900">
                        Open source
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Submission Safety Lock" icon={AlertTriangle}>
              <ul className="space-y-2 text-sm leading-6 text-slate-700">
                {workspace.submissionPlan.humanApprovalGate.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-amber-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <Link href="/waitlist?product=contractos-managed-bid-help" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-black text-white">
                  Request bid help
                </Link>
                <Link href="/contractos/dashboard" className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-950">
                  Watch this opportunity
                </Link>
              </div>
            </Panel>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="text-sm font-black text-slate-950">{clamped}%</p>
      </div>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div className={`h-2 rounded-full ${scoreTone(clamped)}`} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DecisionBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="font-black text-slate-950">{title}</p>
      <ul className="mt-2 space-y-2 text-sm leading-6 text-slate-600">
        {items.map((item) => (
          <li key={item}>- {item}</li>
        ))}
      </ul>
    </div>
  );
}

function PlainEnglish({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-700">{value}</p>
    </div>
  );
}
