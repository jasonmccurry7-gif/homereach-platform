import Link from "next/link";
import { Bot, CalendarDays, FileText, MapPinned, ShieldCheck } from "lucide-react";
import { AmyActonCampaignCommandCenter } from "../_components/AmyActonCampaignCommandCenter";
import { CampaignReadinessChecklist } from "../_components/CampaignReadinessChecklist";
import {
  CandidateAgentLaunchQueue,
  type CandidateAgentLaunchQueueItem,
} from "../_components/CandidateAgentLaunchQueue";
import { PoliticalCandidateAgentChat } from "../_components/PoliticalCandidateAgentChat";
import {
  buildCandidateLaunchReadiness,
  type CandidateLaunchReadiness,
} from "@/lib/political/candidate-readiness";
import { loadCandidateAgentDashboard } from "@/lib/political/candidate-launch-agent";
import {
  buildOhioCandidateSelectorOptions,
  findOhioCandidateSelectorOption,
  formatOhioCandidateSelectorLabel,
  optionValueForCandidateRow,
  type OhioCandidateSelectorOption,
} from "@/lib/political/ohio-candidate-selector";

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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function isActonSelection(value: string) {
  return value === "amy-acton" || value === "acton" || value === "public-acton-source-backed-profile";
}

function isAmyActonName(value: string) {
  return /amy\s+acton|dr\.?\s+amy\s+acton/i.test(value);
}

async function loadPublicAgentDashboard(): Promise<CandidateAgentDashboard | null> {
  try {
    return await loadCandidateAgentDashboard(40);
  } catch {
    return null;
  }
}

function buildPrebuiltCandidateReadiness(
  option: OhioCandidateSelectorOption,
): CandidateLaunchReadiness {
  return {
    score: option.sourceUrl ? 18 : 12,
    statusLabel: "Prebuilt profile",
    checkoutEnabled: false,
    approvalEnabled: false,
    productionEnabled: false,
    proposalDraftAllowed: false,
    nextRequiredAction:
      "Verify campaign contact, official boundary, USPS route counts, and final print/postage pricing before proposal or checkout.",
    gates: [
      {
        key: "source",
        label: "Source verified",
        status: option.sourceUrl ? "review" : "blocked",
        detail: `${option.sourceLabel}. This selector entry is a planning profile, not a finished campaign package.`,
        action: "Confirm official campaign and election source freshness before quoting.",
      },
      {
        key: "contact",
        label: "Campaign contact verified",
        status: "blocked",
        detail: "No verified campaign manager/contact record is attached to this public selector profile yet.",
        action: "Attach verified contact fields in the admin candidate record.",
      },
      {
        key: "boundary",
        label: "Boundary verified",
        status: option.geography.includes("statewide") ? "review" : "blocked",
        detail: `${option.geography} is loaded as the planning geography. Official boundary files still need verification before quoting.`,
        action: "Attach official boundary/source timestamp for the race geography.",
      },
      {
        key: "usps",
        label: "USPS counts loaded",
        status: "blocked",
        detail: "No production USPS EDDM/carrier-route counts are attached to this selector profile.",
        action: "Load route polygons, deliverable counts, exclusions, and source timestamp.",
      },
      {
        key: "quote",
        label: "Quote verified",
        status: "blocked",
        detail: "Print, postage, list/data, and total campaign pricing are not locked.",
        action: "Generate a verified quote after USPS counts and mail quantity are attached.",
      },
      {
        key: "approval",
        label: "Human approval",
        status: "blocked",
        detail: "No HomeReach operator approval is attached to this prebuilt profile.",
        action: "Review strategy, source freshness, compliance, pricing, and creative before release.",
      },
      {
        key: "checkout",
        label: "Checkout enabled",
        status: "blocked",
        detail: "Checkout is locked until all readiness gates pass.",
        action: "Finish source, contact, boundary, USPS, quote, and approval gates before checkout.",
      },
    ],
  };
}

function buildPrebuiltQueueItem(
  option: OhioCandidateSelectorOption,
  readiness: CandidateLaunchReadiness,
): CandidateAgentLaunchQueueItem {
  return {
    id: option.value,
    candidateName: option.candidateName,
    officeSought: option.officeSought,
    party: option.party,
    geography: option.geography,
    electionLabel: option.electionLabel,
    raceType: option.raceType,
    campaignStatus: option.campaignStatus,
    agentStatus: "queued prebuilt profile",
    nextAction: readiness.nextRequiredAction,
    confidenceScore: readiness.score,
    planStatus: "verification required",
    hasResearch: Boolean(option.sourceUrl),
    hasPlan: false,
    hasCampaignWebsite: false,
    hasSource: Boolean(option.sourceUrl),
    readiness,
  };
}

export default async function PoliticalCandidateAgentOverviewPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const selectedCandidate = first(sp.candidate);
  const dashboard = await loadPublicAgentDashboard();
  const liveRows = dashboard?.schemaReady
    ? dashboard.rows.filter((row) => row.agent || row.latestPlan || row.latestResearch)
    : [];
  const candidateOptions = buildOhioCandidateSelectorOptions(liveRows.map((row) => row.candidate));
  const selectedCandidateOption = findOhioCandidateSelectorOption(candidateOptions, selectedCandidate);
  const actonSelected =
    Boolean(selectedCandidateOption?.isAmyActon) || isActonSelection(selectedCandidate);
  const actonRows = liveRows.filter((row) => isAmyActonName(row.candidate.candidateName));
  const selectedLiveRows = selectedCandidateOption?.liveCandidateId
    ? liveRows.filter((row) => row.candidate.id === selectedCandidateOption.liveCandidateId)
    : selectedCandidateOption
      ? liveRows.filter((row) => optionValueForCandidateRow(row.candidate) === selectedCandidateOption.value)
      : [];
  const visibleRows = selectedCandidateOption
    ? actonSelected
      ? actonRows
      : selectedLiveRows
    : liveRows.filter((row) => !isAmyActonName(row.candidate.candidateName));
  const primaryReadinessRow = visibleRows[0] ?? null;
  const prebuiltReadiness =
    selectedCandidateOption && !actonSelected && !primaryReadinessRow
      ? buildPrebuiltCandidateReadiness(selectedCandidateOption)
      : null;
  const primaryReadiness = primaryReadinessRow
    ? buildCandidateLaunchReadiness({
        candidate: primaryReadinessRow.candidate,
        latestResearch: primaryReadinessRow.latestResearch,
        latestPlan: primaryReadinessRow.latestPlan,
      })
    : actonSelected
      ? PUBLIC_ACTON_READINESS
      : prebuiltReadiness;
  const primaryReadinessName =
    primaryReadinessRow?.candidate.candidateName ??
    selectedCandidateOption?.candidateName ??
    "Selected candidate";
  const liveLaunchQueueItems: CandidateAgentLaunchQueueItem[] = visibleRows.map((row) => {
    const readiness = buildCandidateLaunchReadiness({
      candidate: row.candidate,
      latestResearch: row.latestResearch,
      latestPlan: row.latestPlan,
    });

    return {
      id: row.candidate.id,
      candidateName: row.candidate.candidateName,
      officeSought: row.candidate.officeSought ?? "Office pending",
      party: row.candidate.partyOptionalPublic ?? "Party/committee pending",
      geography: row.candidate.geographyValue ?? row.candidate.state,
      electionLabel: row.candidate.electionYear
        ? `${row.candidate.electionYear}`
        : row.candidate.electionDate ?? "Election pending",
      raceType: row.candidate.districtType ?? row.candidate.geographyType ?? "race pending",
      campaignStatus: row.candidate.candidateStatus,
      agentStatus: row.agent?.status.replaceAll("_", " ") ?? "agent not assigned",
      nextAction: row.nextAction,
      confidenceScore:
        row.latestPlan?.confidenceScore ??
        row.latestResearch?.confidenceScore ??
        row.agent?.confidenceScore ??
        0,
      planStatus: row.latestPlan ? row.latestPlan.status.replaceAll("_", " ") : "pending",
      hasResearch: Boolean(row.latestResearch),
      hasPlan: Boolean(row.latestPlan),
      hasCampaignWebsite: Boolean(row.candidate.campaignWebsite),
      hasSource: Boolean(row.candidate.sourceUrl),
      readiness,
    };
  });
  const fallbackActonQueueItem: CandidateAgentLaunchQueueItem = {
    id: "public-acton-source-backed-profile",
    candidateName: "Dr. Amy Acton",
    officeSought: "Governor",
    party: "Democrat",
    geography: "Ohio statewide",
    electionLabel: "2026",
    raceType: "statewide",
    campaignStatus: "active",
    agentStatus: "source-backed public profile",
    nextAction: PUBLIC_ACTON_READINESS.nextRequiredAction,
    confidenceScore: PUBLIC_ACTON_READINESS.score,
    planStatus: "draft planning only",
    hasResearch: true,
    hasPlan: true,
    hasCampaignWebsite: true,
    hasSource: true,
    readiness: PUBLIC_ACTON_READINESS,
  };
  const fallbackSelectedQueueItem =
    selectedCandidateOption && !actonSelected && prebuiltReadiness
      ? buildPrebuiltQueueItem(selectedCandidateOption, prebuiltReadiness)
      : null;
  const launchQueueItems =
    liveLaunchQueueItems.length > 0
      ? liveLaunchQueueItems
      : fallbackSelectedQueueItem
        ? [fallbackSelectedQueueItem]
        : actonSelected
        ? [fallbackActonQueueItem]
        : [];

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

      <section className="mt-10 rounded-lg border border-blue-300/15 bg-slate-950 p-5 shadow-2xl shadow-blue-950/20">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Candidate selection
            </p>
            <h2 className="mt-2 text-2xl font-black text-white">
              Load a candidate before showing candidate-specific intelligence.
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Choose from the top 30 Ohio prebuilt campaign profiles. The dashboard stays generic until a candidate profile is selected. Candidate-specific research,
              strategy, creative, readiness gates, and chat context only appear after selection.
            </p>
          </div>
          <form action="/political/candidate-agent" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto]">
            <label className="sr-only" htmlFor="candidate">
              Candidate profile
            </label>
            <select
              id="candidate"
              name="candidate"
              defaultValue={selectedCandidateOption?.value ?? ""}
              className="h-11 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm font-bold text-white outline-none transition focus:border-blue-300/60"
            >
              <option value="">Select candidate profile</option>
              {candidateOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {formatOhioCandidateSelectorLabel(option)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-500"
            >
              Load Candidate
            </button>
          </form>
        </div>
        {actonSelected ? (
          <div className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-50">
            Candidate-specific Acton intelligence is visible because the candidate profile is selected.
          </div>
        ) : selectedCandidateOption ? (
          <div className="mt-4 rounded-lg border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-50">
            {selectedCandidateOption.candidateName} is loaded as a prebuilt planning profile for{" "}
            {selectedCandidateOption.officeSought}. Final proposal, checkout, and USPS quote actions stay locked until
            contact, source, boundary, route-count, pricing, and human-approval gates are complete.
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-300">
            No candidate-specific campaign intelligence is displayed in this default view.
          </div>
        )}
      </section>

      {primaryReadiness && (
        <section className="mt-10">
          <CampaignReadinessChecklist
            candidateName={primaryReadinessName}
            readiness={primaryReadiness}
          />
        </section>
      )}

      <section className="mt-10">
        <CandidateAgentLaunchQueue items={launchQueueItems} />
      </section>

      {actonSelected && (
        <>
          <section className="mt-10">
            <AmyActonCampaignCommandCenter />
          </section>

          <section className="mt-10">
            <PoliticalCandidateAgentChat />
          </section>
        </>
      )}
    </main>
  );
}
