import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Landmark,
  ShieldCheck,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { contractOSFeatureFlags } from "@/lib/contractos/config";
import { loadContractOSDashboard } from "@/lib/contractos/data";
import { getContractOSProductionDepth } from "@/lib/contractos/production-readiness";
import { contractOSSbaGuidanceLibrary } from "@/lib/contractos/sba-guidance";
import { ContractOSBillingActions, ContractOSDocumentAnalyzer } from "./contractos-client-actions";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContractOS Dashboard - Government Contract Readiness | HomeReach",
  description:
    "A simple ContractOS dashboard for government contract readiness, opportunity fit, bid decisions, proposal prep, compliance tracking, and next actions.",
};

function fitTone(score: number) {
  if (score >= 78) return "border-emerald-200 bg-emerald-50 text-emerald-950";
  if (score >= 58) return "border-blue-200 bg-blue-50 text-blue-950";
  if (score >= 38) return "border-amber-200 bg-amber-50 text-amber-950";
  return "border-rose-200 bg-rose-50 text-rose-950";
}

function statusTone(status: string) {
  if (status === "complete") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (status === "review") return "bg-blue-50 text-blue-800 ring-blue-200";
  return "bg-amber-50 text-amber-800 ring-amber-200";
}

export default async function ContractOSDashboardPage() {
  const flags = contractOSFeatureFlags();
  if (!flags.enabled || !flags.publicDashboard) notFound();

  const data = await loadContractOSDashboard();
  const productionDepth = getContractOSProductionDepth();
  const billingPlans = productionDepth.billing.plans.map((plan) => ({
    key: plan.key,
    label: plan.label,
    publicLabel: plan.publicLabel,
    description: plan.description,
    mode: plan.mode,
    configured: plan.configured,
    priceEnvKey: plan.priceEnvKey,
    standardPriceLabel: plan.standardPriceLabel,
    founderPriceLabel: plan.founderPriceLabel,
    cadenceLabel: plan.cadenceLabel,
    checkoutAmountLabel: plan.checkoutAmountLabel,
    includedAiSummaries: plan.includedAiSummaries,
    aiSummaryOverageLabel: plan.aiSummaryOverageLabel,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main className="px-4 py-8 lg:px-6 lg:py-10">
        <div className="mx-auto max-w-7xl space-y-6">
          <header className="overflow-hidden rounded-2xl bg-slate-950 text-white shadow-sm">
            <div className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.36),transparent_42%),linear-gradient(135deg,#020617,#0f172a)] p-5 lg:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-200">ContractOS command center</p>
                  <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">
                    Government contracting made understandable.
                  </h1>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                    Start with readiness, then review realistic opportunities, risk, missing items, and the next safest action.
                    AI output is draft-only until a human approves it.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:w-[34rem]">
                  <HeroMetric label="Tracked" value={String(data.summary.opportunitiesTracked)} />
                  <HeroMetric label="High fit" value={String(data.summary.highFitMatches)} />
                  <HeroMetric label="Deadlines" value={String(data.summary.upcomingDeadlines)} />
                </div>
              </div>
            </div>
          </header>

          <section className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <p className="font-black">Source truth</p>
            <p className="mt-1">{data.sourceNotice}</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Business readiness profile</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">{data.readiness.label}</h2>
                </div>
                <div className="rounded-lg bg-slate-950 px-4 py-3 text-center text-white">
                  <p className="text-3xl font-black">{data.readiness.score}%</p>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Ready</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">{data.readiness.summary}</p>
              <div className="mt-5 space-y-3">
                {data.readiness.nextChecklist.map((item) => (
                  <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-black text-slate-950">{item.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-600">{item.detail}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ring-1 ${statusTone(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href="/waitlist?product=contractos-readiness-scan"
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700"
              >
                Complete readiness scan
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <div className="grid gap-4">
              <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Do next</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-950">Review the strongest opportunities first.</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      ContractOS filters out noise and pushes the next safest action to the front.
                    </p>
                  </div>
                  <Link
                    href="#opportunities"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
                  >
                    View matches
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard icon={ClipboardCheck} label="Bids in progress" value={String(data.summary.bidsInProgress)} />
                <SummaryCard icon={FileText} label="Draft packages" value={String(data.summary.proposalDrafts)} />
                <SummaryCard icon={BadgeDollarSign} label="Revenue signals" value={String(data.summary.revenueOpportunities)} />
                <SummaryCard icon={ShieldCheck} label="Human gates" value="On" />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                  <div>
                    <p className="font-black">No autonomous bid submission</p>
                    <p className="mt-1">
                      AI can draft, summarize, score, and organize. Final pricing, representations, submission, award acceptance,
                      and subcontractor commitments remain human-controlled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="opportunities" className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Opportunity command center</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">Realistic contract matches</h2>
              </div>
              <Link
                href="/waitlist?product=contractos-managed-bid-help"
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-black text-slate-950 shadow-sm transition hover:bg-slate-100"
              >
                Ask HomeReach to review one
              </Link>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {data.opportunities.map((opportunity) => (
                <article key={opportunity.id} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black uppercase ${fitTone(opportunity.estimatedFit)}`}>
                      {opportunity.estimatedFit}% fit
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black uppercase text-slate-600">
                      {opportunity.complexityLevel}
                    </span>
                  </div>
                  <h3 className="mt-4 text-lg font-black leading-tight text-slate-950">{opportunity.plainEnglishTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.agency}</p>
                  <div className="mt-4 grid gap-2 text-sm">
                    <SmallFact label="Deadline" value={opportunity.deadline} />
                    <SmallFact label="Location" value={opportunity.location} />
                    <SmallFact label="Contract size" value={opportunity.estimatedContractSize} />
                    <SmallFact label="Set-aside" value={opportunity.setAsideStatus} />
                    <SmallFact label="Docs" value={opportunity.requiredDocuments} />
                  </div>
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">
                    {opportunity.recommendedAction}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Link href={opportunity.detailHref} className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-black text-white transition hover:bg-blue-700">
                      View
                    </Link>
                    <Link href={`${opportunity.detailHref}#bid-decision`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-slate-100">
                      Bid?
                    </Link>
                    <Link href={`${opportunity.detailHref}#subcontractors`} className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-slate-100">
                      Partner
                    </Link>
                    <Link href="/waitlist?product=contractos-watchlist" className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm font-black text-slate-950 transition hover:bg-slate-100">
                      Watch
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {flags.documentAnalyzer ? (
              <ContractOSDocumentAnalyzer />
            ) : (
              <DisabledFeatureCard
                title="Document review lane"
                detail="Document analysis is currently paused. HomeReach can still review solicitation documents through the managed operating process."
              />
            )}
            {flags.billing ? (
              <ContractOSBillingActions plans={billingPlans} />
            ) : (
              <DisabledFeatureCard
                title="Paid workspace gate"
                detail="ContractOS checkout is paused. Use manual quoting and owner-approved payment handling before starting paid work."
              />
            )}
          </section>

          <section className="grid gap-4 lg:grid-cols-4">
            {contractOSSbaGuidanceLibrary.map((item) => (
              <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">SBA source library</p>
                <h2 className="mt-2 text-lg font-black leading-tight text-slate-950">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.plainEnglishSummary}</p>
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs font-semibold leading-5 text-slate-700">
                  {item.ownerAction}
                </p>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-black text-blue-700 hover:text-blue-900">
                  {item.sourceLabel}
                </a>
              </article>
            ))}
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {data.agents.slice(0, 3).map((agent) => (
              <div key={agent.name} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <Landmark className="h-6 w-6 text-blue-700" aria-hidden="true" />
                <h2 className="mt-3 text-xl font-black text-slate-950">{agent.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{agent.mission}</p>
                <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm font-semibold leading-6 text-blue-950">{agent.nextAction}</p>
              </div>
            ))}
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function DisabledFeatureCard({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em]">Feature paused</p>
      <h2 className="mt-2 text-xl font-black">{title}</h2>
      <p className="mt-2 text-sm font-semibold leading-6">{detail}</p>
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</span>
      <span className="text-right text-xs font-black text-slate-900">{value}</span>
    </div>
  );
}
