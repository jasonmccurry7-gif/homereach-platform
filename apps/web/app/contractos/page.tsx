import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CheckCircle2,
  ClipboardList,
  FileText,
  Landmark,
  ShieldCheck,
  Timer,
} from "lucide-react";
import { SiteFooter } from "@/components/marketing/site-footer";
import { SiteHeader } from "@/components/marketing/site-header";
import { contractOSFeatureFlags } from "@/lib/contractos/config";
import { loadContractOSDashboard } from "@/lib/contractos/data";
import { CONTRACTOS_PRICING_PLANS } from "@/lib/contractos/pricing";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "ContractOS - Simple Government Contract Operating System | HomeReach",
  description:
    "ContractOS helps small businesses find, understand, bid on, and manage government contracts with AI-assisted readiness, fit scoring, proposal support, and human approval controls.",
};

const lifecycle = [
  "Find opportunities",
  "Understand requirements",
  "Score fit",
  "Decide bid/no-bid",
  "Price safely",
  "Build proposal",
  "Track submission",
  "Manage execution",
];

const pillars = [
  {
    title: "Plain-English contract summaries",
    body: "See what the government is buying, who should bid, who should not bid, what is missing, and what to do next.",
    icon: FileText,
  },
  {
    title: "Fit and readiness scoring",
    body: "Compare each opportunity against services, geography, certifications, capacity, timeline, and past performance.",
    icon: BadgeCheck,
  },
  {
    title: "Profit-aware bid decisions",
    body: "Model costs, subcontractors, cash-flow strain, risk adders, and minimum safe margin before chasing a bad win.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Human-controlled proposal work",
    body: "AI can draft and organize. It never submits, certifies, prices, or commits the business without approval.",
    icon: ShieldCheck,
  },
];

function toneForFit(score: number) {
  if (score >= 78) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (score >= 58) return "bg-blue-50 text-blue-800 ring-blue-200";
  if (score >= 38) return "bg-amber-50 text-amber-800 ring-amber-200";
  return "bg-rose-50 text-rose-800 ring-rose-200";
}

export default async function ContractOSLandingPage() {
  const flags = contractOSFeatureFlags();
  if (!flags.enabled) notFound();

  const data = await loadContractOSDashboard();
  const previewOpportunities = data.opportunities.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50">
      <SiteHeader />
      <main>
        <section className="bg-slate-950 px-4 py-14 text-white lg:px-6 lg:py-20">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-100">
                <Landmark className="h-4 w-4" aria-hidden="true" />
                ContractOS by HomeReach
              </div>
              <h1 className="mt-6 max-w-3xl text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                The simplest way for small businesses to find, understand, bid on, and manage government contracts.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-300">
                ContractOS turns confusing notices, deadlines, documents, pricing risk, and subcontractor work into a
                guided operating system. It is built for normal business owners who need confidence before they spend
                time on a bid.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/contractos/dashboard"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-950/20 transition hover:bg-blue-500"
                >
                  Open ContractOS
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/waitlist?product=contractos-readiness-scan"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-white/15 bg-white/10 px-5 text-sm font-black text-white transition hover:bg-white hover:text-slate-950"
                >
                  Start free readiness scan
                </Link>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-slate-950/30">
              <div className="rounded-xl border border-white/10 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">Today in ContractOS</p>
                    <h2 className="mt-2 text-2xl font-black">What should I do next?</h2>
                  </div>
                  <span className="rounded-full bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-100 ring-1 ring-amber-300/30">
                    Human review
                  </span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <Metric label="Readiness" value={`${data.readiness.score}%`} />
                  <Metric label="Tracked" value={String(data.summary.opportunitiesTracked)} />
                  <Metric label="High fit" value={String(data.summary.highFitMatches)} />
                </div>
                <div className="mt-5 space-y-3">
                  {previewOpportunities.map((opportunity) => (
                    <Link
                      key={opportunity.id}
                      href={opportunity.detailHref}
                      className="block rounded-xl border border-white/10 bg-white/[0.04] p-4 transition hover:border-blue-300/40 hover:bg-blue-300/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-white">{opportunity.plainEnglishTitle}</p>
                          <p className="mt-1 text-xs leading-5 text-slate-400">{opportunity.agency}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black uppercase ring-1 ${toneForFit(opportunity.estimatedFit)}`}>
                          {opportunity.estimatedFit}% fit
                        </span>
                      </div>
                      <p className="mt-3 text-xs font-semibold text-slate-300">
                        Deadline: {opportunity.deadline} · {opportunity.location}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-3xl">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">TurboTax-style guidance</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                ContractOS reduces the fear and clutter before a bid starts.
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {pillars.map((pillar) => {
                const Icon = pillar.icon;
                return (
                  <div key={pillar.title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-lg font-black text-slate-950">{pillar.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{pillar.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Founder pricing</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                  Government contract support priced for small businesses.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  Standard rates are shown for context. Current HomeReach clients can start at founder rates while this
                  service is being rolled out.
                </p>
              </div>
              <Link
                href="/contractos/dashboard"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
              >
                Choose a plan
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {CONTRACTOS_PRICING_PLANS.map((plan) => (
                <PricingCard key={plan.key} plan={plan} />
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-200 bg-white px-4 py-14 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Operating lifecycle</p>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
                  A clear path from discovery to execution.
                </h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The platform is designed around the real work: find a realistic opportunity, understand the work,
                  confirm readiness, price it without underbidding, prepare documents, and manage performance after award.
                </p>
                <Link
                  href="/contractos/dashboard"
                  className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white transition hover:bg-slate-800"
                >
                  View dashboard
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {lifecycle.map((step, index) => (
                  <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-sm font-black text-blue-700 shadow-sm">
                      {index + 1}
                    </span>
                    <p className="mt-3 text-sm font-black text-slate-950">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-14 lg:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
            <StatusPanel icon={BrainCircuit} title="AI assists" body="AI summarizes, drafts, recommends, flags risk, and explains next steps." />
            <StatusPanel icon={ShieldCheck} title="Humans approve" body="No bid submission, compliance claim, pricing commitment, or subcontractor selection happens autonomously." />
            <StatusPanel icon={Timer} title="Deadlines stay visible" body="Q&A dates, amendments, stale workspaces, and response windows stay surfaced." />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PricingCard({ plan }: { plan: (typeof CONTRACTOS_PRICING_PLANS)[number] }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-5 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{plan.publicLabel}</p>
      <div className="mt-4 flex flex-wrap items-baseline gap-2">
        <span className="text-lg font-black text-slate-400 line-through">{plan.standardPriceLabel}</span>
        <span className="text-3xl font-black text-slate-950">{plan.founderPriceLabel}</span>
      </div>
      <p className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-blue-800 ring-1 ring-blue-100">
        Founder rate
      </p>
      <p className="mt-4 text-sm font-semibold leading-6 text-slate-700">{plan.bestFor}</p>
      <p className="mt-3 rounded-lg bg-white p-3 text-xs font-black uppercase tracking-wide text-slate-600">
        {plan.includedAiSummaries}
      </p>
      <ul className="mt-4 space-y-2 text-sm font-semibold leading-6 text-slate-700">
        {plan.highlights.map((highlight) => (
          <li key={highlight} className="flex gap-2">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
            <span>{highlight}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.05] p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

function StatusPanel({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof CheckCircle2;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-white">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-lg font-black text-slate-950">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
  );
}
