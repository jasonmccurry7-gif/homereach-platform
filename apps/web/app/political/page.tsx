import Link from "next/link";
import type { Metadata } from "next";
import {
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  MapPinned,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { PoliticalClientCampaignPlanner } from "./_components/PoliticalClientCampaignPlanner";
import { PoliticalCandidateAgentChat } from "./_components/PoliticalCandidateAgentChat";
import { loadPublicPoliticalCandidatesForPlanner } from "@/lib/political/public-candidates";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "PoliticalReach Political Postcard Planning - HomeReach",
  description:
    "Plan political postcards with clearer coverage, cost, creative direction, timing, and review-safe campaign mail execution.",
};

const launchPath = [
  {
    label: "1. Select",
    title: "Choose the campaign workspace",
    body: "Load the candidate, office, geography, and cycle so the campaign is not stuck rebuilding the basics from scratch.",
    icon: CheckCircle2,
  },
  {
    label: "2. Compare",
    title: "Review four mail strategies",
    body: "Compare reach, drops, estimated cost, timing, and message direction before committing budget.",
    icon: MapPinned,
  },
  {
    label: "3. Approve",
    title: "Move only reviewed work forward",
    body: "Keep human approval in front of outreach, price lock, checkout, creative, and production.",
    icon: ShieldCheck,
  },
  {
    label: "4. Launch",
    title: "Secure the mail window",
    body: "Move from plan to reviewed proposal, payment, drop schedule, and production handoff without endless back-and-forth.",
    icon: CreditCard,
  },
];

const conversionTrustPoints = [
  "Coverage before commitment",
  "Cost clarity before approval",
  "Mailbox-ready creative direction",
  "Review-safe geographic planning",
];

const campaignPainPoints = [
  {
    title: "The district is hard to visualize",
    body: "Campaign teams need to see coverage by geography, not guess from a spreadsheet or wait days for a static quote.",
    icon: MapPinned,
  },
  {
    title: "Mail timing gets risky fast",
    body: "Late approvals, artwork delays, print windows, and USPS timing can turn a good message into a missed opportunity.",
    icon: Clock3,
  },
  {
    title: "Pricing is too vague",
    body: "Campaign managers need to know the practical tradeoff between more households, more drops, better creative, and total cost.",
    icon: CreditCard,
  },
  {
    title: "Most postcards look forgettable",
    body: "Voters scan mail quickly. The piece needs instant hierarchy: candidate, message, proof, trust, and action.",
    icon: Sparkles,
  },
];

const positioningPillars = [
  {
    label: "Speed",
    title: "Move from idea to reviewed plan",
    body: "PoliticalReach turns scattered campaign details into a concrete mail plan that can be compared, reviewed, and advanced quickly.",
  },
  {
    label: "Clarity",
    title: "Know the coverage and cost",
    body: "Campaigns can understand households, route coverage, drops, timing, and estimated investment before the proposal stage.",
  },
  {
    label: "Confidence",
    title: "Reduce execution uncertainty",
    body: "The workflow keeps route data, production timing, creative review, payment, and compliance boundaries visible.",
  },
];

export default async function PoliticalLanding() {
  const candidateOptions = await loadPublicPoliticalCandidatesForPlanner();

  return (
    <main className="mx-auto w-full max-w-[100vw] space-y-6 overflow-x-hidden px-4 py-6 sm:px-5 lg:py-8 xl:max-w-7xl">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.22),transparent_34%),linear-gradient(135deg,rgba(15,23,42,0.98),rgba(2,6,23,0.96))] shadow-2xl shadow-slate-950/45">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="p-5 sm:p-6 lg:p-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">
              <Sparkles className="h-3.5 w-3.5" />
              PoliticalReach
            </div>
            <h1 className="mt-4 max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl">
              Political postcards that look credible, land on time, and make the next decision obvious.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Campaigns do not need another print quote buried in email. They
              need a clear mail strategy: where to send, what it costs, how many
              voters see it, when it lands, and why the postcard will be taken
              seriously in the mailbox.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href="#campaign-options"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
              >
                <CalendarDays className="h-4 w-4" />
                Build My Mail Plan
              </a>
              <Link
                href="/political/plan?intent=consultation"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-5 py-3 text-sm font-black text-white transition hover:bg-white/[0.12]"
              >
                Get Reviewed Estimate
              </Link>
              <a
                href="#campaign-ai-chat"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/25 bg-blue-500/15 px-5 py-3 text-sm font-black text-blue-50 transition hover:bg-blue-500/25"
              >
                <Bot className="h-4 w-4" />
                Ask Campaign AI
              </a>
            </div>
          </div>

          <aside className="border-t border-white/10 bg-slate-950/70 p-5 sm:p-6 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <ShieldCheck className="h-4 w-4 text-emerald-200" />
              Safe political planning boundary
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              HomeReach uses public candidate context, aggregate geography,
              route logistics, timing, budget, and production planning. It does
              not infer individual voter beliefs, score individual voters, or
              run autonomous political outreach.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="font-black text-slate-400">Candidate roster</p>
                <p className="mt-1 text-lg font-black text-white">
                  {candidateOptions.length}+
                </p>
            </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="font-black text-slate-400">Mail options</p>
                <p className="mt-1 text-lg font-black text-white">4 each</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="font-black text-slate-400">Approval</p>
                <p className="mt-1 text-lg font-black text-white">Required</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <p className="font-black text-slate-400">Unknown names</p>
                <p className="mt-1 text-lg font-black text-white">Plan draft</p>
              </div>
              </div>
            <div className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 p-3">
              <div className="flex items-start gap-2">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-red-100" />
                <p className="text-xs leading-5 text-red-50">
                  Recommended next step: pick a candidate and strategy, then request a reviewed plan before print, payment, or outreach.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-xl border border-red-300/15 bg-red-500/10 p-5">
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-red-100">
            Campaign pressure points
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-white">
            We solve the painful parts of political mail before they slow the campaign down.
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            The real problem is not printing postcards. It is turning a tight
            timeline, unclear geography, budget pressure, creative decisions,
            and delivery risk into a confident execution plan.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {campaignPainPoints.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-blue-100">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-black text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-4">
        {launchPath.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-200">{item.label}</p>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-blue-100">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
              <h2 className="mt-3 text-lg font-black text-white">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-xl border border-blue-300/15 bg-blue-500/10 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-100">
              Decision-ready before commitment
            </p>
            <h2 className="mt-2 text-xl font-black text-white">
              Campaigns see the plan, the cost, the timing, and the review gates before moving forward.
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {conversionTrustPoints.map((point) => (
              <span key={point} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-bold text-slate-100">
                {point}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {positioningPillars.map((item) => (
          <article key={item.title} className="rounded-xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-200">{item.label}</p>
            <h2 className="mt-2 text-xl font-black text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        {[
          {
            label: "Emotional hierarchy",
            title: "Mail that voters can understand fast",
            body:
              "PoliticalReach treats each postcard as a campaign asset: attention, identity, message, proof, trust, and action in that order.",
          },
          {
            label: "Premium visual system",
            title: "Serious campaign creative rules",
            body:
              "Design direction uses restrained patriotic color, bold typography, disciplined spacing, and candidate photography that feels serious and legitimate.",
          },
          {
            label: "Approval-gated production",
            title: "Execution without unsafe targeting",
            body:
              "Creative can use public facts, campaign-approved messages, aggregate geography, timing, and route logistics. No individual voter belief inference.",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">{item.label}</p>
            <h2 className="mt-2 text-lg font-black text-white">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{item.body}</p>
          </div>
        ))}
      </section>

      <PoliticalClientCampaignPlanner candidateOptions={candidateOptions} />

      <PoliticalCandidateAgentChat
        candidateOptions={candidateOptions}
        mode="compact"
      />
    </main>
  );
}
