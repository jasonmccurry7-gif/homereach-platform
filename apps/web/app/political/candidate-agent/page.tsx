import Link from "next/link";
import { Bot, CalendarDays, FileText, MapPinned, ShieldCheck } from "lucide-react";
import { CampaignReadinessChecklist } from "../_components/CampaignReadinessChecklist";
import { PoliticalCandidateAgentChat } from "../_components/PoliticalCandidateAgentChat";
import {
  buildCandidateLaunchReadiness,
  type CandidateLaunchReadiness,
} from "@/lib/political/candidate-readiness";
import { loadCandidateAgentDashboard } from "@/lib/political/candidate-launch-agent";

export const dynamic = "force-dynamic";
export const metadata = { title: "AI Campaign Agent - HomeReach Political" };

const START_HREF = "/political/plan";

const PANELS = [
  {
    title: "Candidate Profile",
    icon: Bot,
    text: "Public candidate and campaign fields, missing-data checklist, confidence score, and source freshness.",
  },
  {
    title: "Launch Plan",
    icon: CalendarDays,
    text: "Name ID, local priorities, credibility or contrast, election reminder, and optional final-week push.",
  },
  {
    title: "Geography + Routes",
    icon: MapPinned,
    text: "District, county, city, ZIP, township, and USPS route recommendations using aggregate public geography.",
  },
  {
    title: "Proposal Draft",
    icon: FileText,
    text: "Human-reviewed plan copy, budgets, timing, creative briefs, and compliance notes before client-facing send.",
  },
] as const;

const PUBLIC_ACTON_READINESS: CandidateLaunchReadiness = {
  score: 21,
  statusLabel: "Prebuilt profile",
  checkoutEnabled: false,
  approvalEnabled: false,
  productionEnabled: false,
  proposalDraftAllowed: false,
  nextRequiredAction: "Verify the official campaign contact and attach USPS EDDM/carrier-route counts before quoting.",
  gates: [
    {
      key: "source",
      label: "Source verified",
      status: "review",
      detail: "The public Acton campaign profile is loaded, but election-result/source freshness still needs operator verification before quoting.",
      action: "Confirm official campaign/election sources and source timestamp.",
    },
    {
      key: "contact",
      label: "Campaign contact verified",
      status: "blocked",
      detail: "Public page does not expose a verified campaign email, phone, or manager contact.",
      action: "Add verified campaign contact fields in the admin candidate record.",
    },
    {
      key: "boundary",
      label: "Boundary verified",
      status: "complete",
      detail: "Ohio statewide governor geography is selected.",
      action: "No boundary action needed for statewide Ohio.",
    },
    {
      key: "usps",
      label: "USPS counts loaded",
      status: "blocked",
      detail: "The public Acton planner is using planning recommendations, not production USPS route counts.",
      action: "Load USPS EDDM/carrier-route counts and source timestamp before quote.",
    },
    {
      key: "quote",
      label: "Quote verified",
      status: "blocked",
      detail: "Final print, postage, household/mail-piece count, and per-postcard pricing are not locked.",
      action: "Generate a verified quote after USPS counts are attached.",
    },
    {
      key: "approval",
      label: "Human approval",
      status: "blocked",
      detail: "No HomeReach operator approval is attached to the public planning view.",
      action: "Review compliance, source freshness, route counts, and creative before approval.",
    },
    {
      key: "checkout",
      label: "Checkout enabled",
      status: "blocked",
      detail: "Checkout is locked until all readiness gates pass.",
      action: "Finish source, contact, USPS, quote, and approval gates before creating checkout.",
    },
  ],
};

type CandidateAgentDashboard = Awaited<ReturnType<typeof loadCandidateAgentDashboard>>;

async function loadPublicAgentDashboard(): Promise<CandidateAgentDashboard | null> {
  try {
    return await loadCandidateAgentDashboard(12);
  } catch {
    return null;
  }
}

export default async function PoliticalCandidateAgentOverviewPage() {
  const dashboard = await loadPublicAgentDashboard();
  const liveRows = dashboard?.schemaReady
    ? dashboard.rows.filter((row) => row.agent || row.latestPlan || row.latestResearch)
    : [];
  const primaryReadinessRow = liveRows[0] ?? null;
  const primaryReadiness = primaryReadinessRow
    ? buildCandidateLaunchReadiness({
        candidate: primaryReadinessRow.candidate,
        latestResearch: primaryReadinessRow.latestResearch,
        latestPlan: primaryReadinessRow.latestPlan,
      })
    : PUBLIC_ACTON_READINESS;
  const primaryReadinessName = primaryReadinessRow?.candidate.candidateName ?? "Dr. Amy Acton";

  return (
    <main className="mx-auto max-w-7xl px-5 py-10">
      <section className="grid gap-8 lg:grid-cols-[1fr_420px] lg:items-start">
        <div>
          <p className="text-xs font-bold uppercase text-blue-200">AI Campaign Agent</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black text-white sm:text-5xl">
            Chat with the Campaign AI Agent.
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-slate-300">
            The agent guides campaign plan creation, recommended mail drops, route and geography options, budget explanations, proposal next steps, and timeline planning. When a campaign is loaded, its recommendations stay campaign-specific.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={START_HREF}
              className="rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
            >
              Start Campaign Plan
            </Link>
            <Link
              href="/political/maps"
              className="rounded-lg border border-white/15 bg-white/5 px-5 py-3 text-sm font-bold text-slate-100 transition hover:bg-white/10"
            >
              Validate Map
            </Link>
          </div>
        </div>

        <aside className="rounded-lg border border-emerald-300/20 bg-emerald-950/20 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-200" />
            <h2 className="font-bold text-white">Compliance Boundary</h2>
          </div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-emerald-50">
            <p>Public geography, public election records, USPS logistics, schedule, budget, and production planning only.</p>
            <p>No individual voter scoring, ideology prediction, sensitive demographic targeting, or turnout-suppression features.</p>
            <p>Human approval is required before proposal, creative, outreach, or production handoff.</p>
          </div>
        </aside>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PANELS.map(({ title, text, icon: Icon }) => (
          <article key={title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20 text-blue-100">
              <Icon className="h-5 w-5" />
            </div>
            <h2 className="mt-4 font-bold text-white">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">{text}</p>
          </article>
        ))}
      </section>

      {primaryReadiness && (
        <section className="mt-10">
          <CampaignReadinessChecklist
            candidateName={primaryReadinessName}
            readiness={primaryReadiness}
          />
        </section>
      )}

      {liveRows.length > 0 && (
        <section className="mt-10 rounded-lg border border-blue-300/20 bg-blue-950/25 p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
                Live launch-agent workspaces
              </p>
              <h2 className="mt-2 text-2xl font-black text-white">
                Candidate records with assigned planning agents
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                These cards read from the same candidate-agent tables used by the Political Command dashboard. Operator actions stay human-reviewed inside admin-only workspaces.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {liveRows.slice(0, 4).map((row) => (
              <article key={row.candidate.id} className="rounded-lg border border-white/10 bg-slate-950/65 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-white">{row.candidate.candidateName}</h3>
                    <p className="mt-1 text-sm text-slate-300">
                      {row.candidate.officeSought ?? "Office pending"} / {row.candidate.geographyValue ?? row.candidate.state}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-bold capitalize text-slate-200">
                    {row.agent?.status.replaceAll("_", " ") ?? "agent not assigned"}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <AgentWorkspaceMetric
                    label="Confidence"
                    value={`${row.latestPlan?.confidenceScore ?? row.latestResearch?.confidenceScore ?? row.agent?.confidenceScore ?? 0}%`}
                  />
                  <AgentWorkspaceMetric
                    label="Plan"
                    value={row.latestPlan ? row.latestPlan.status.replaceAll("_", " ") : "Pending"}
                  />
                  <AgentWorkspaceMetric label="Next Action" value={row.nextAction} />
                </div>
                <div className="mt-3">
                  <AgentWorkspaceMetric
                    label="Launch Package"
                    value={`${buildCandidateLaunchReadiness({
                      candidate: row.candidate,
                      latestResearch: row.latestResearch,
                      latestPlan: row.latestPlan,
                    }).score}% ready`}
                  />
                </div>

                <div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-950/20 p-3 text-xs leading-5 text-emerald-50">
                  Guardrails active: geography, public sources, USPS logistics, budget, timing, and production readiness only. Human approval remains required.
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href="/political/maps"
                    className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-blue-500"
                  >
                    Validate Map
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <PoliticalCandidateAgentChat />
      </section>
    </main>
  );
}

function AgentWorkspaceMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-2 truncate text-sm font-bold capitalize text-white" title={value}>
        {value}
      </div>
    </div>
  );
}
