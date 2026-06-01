import Link from "next/link";
import {
  loadCandidates,
  countCandidates,
  type CandidateStatus,
  type DistrictType,
  type GeographyType,
  type ListFilters,
} from "@/lib/political/queries";
import {
  loadDashboardKpis,
  loadFollowUpQueue,
  loadHotQueue,
  loadUpcomingElections,
  loadLatestRescoreInfo,
  loadPoliticalDistrictSaturationLeadQueue,
} from "@/lib/political/dashboard-queries";
import { loadCandidateAgentDashboard } from "@/lib/political/candidate-launch-agent";
import { FilterBar } from "./_components/FilterBar";
import {
  StatusBadge,
  DistrictTypeBadge,
  GeographyLabel,
} from "./_components/StatusBadge";
import { KpiStrip } from "./_components/KpiStrip";
import { FollowUpQueue, UpcomingElections } from "./_components/FollowUpQueue";
import { RescoreButton } from "./_components/RescoreButton";
import { loadPoliticalCommandSnapshot } from "@/lib/political/admin-command";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political — Candidate List (Phase 2, read-only)
//
// - Flag-gated by the sibling layout (ENABLE_POLITICAL must be "true")
// - Role-gated by the parent (admin) layout (admin or sales_agent only)
// - RLS-scoped: sales_agent sees all; client sees nothing; admin sees all
// - Reads only the new (migration 060) columns — deprecated ones ignored
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const VALID_DISTRICT_TYPES: readonly DistrictType[] = ["federal", "state", "local"] as const;
const VALID_STATUSES: readonly CandidateStatus[] = ["active", "inactive", "won", "lost"] as const;
const VALID_GEO_TYPES: readonly GeographyType[] = ["state", "county", "city", "district"] as const;

function first(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

function parseFilters(p: Record<string, string | string[] | undefined>): ListFilters {
  const state = first(p["state"])?.trim().toUpperCase();
  const geographyTypeRaw = first(p["geographyType"])?.trim();
  const geographyValue = first(p["geographyValue"])?.trim();
  const districtTypeRaw = first(p["districtType"])?.trim();
  const candidateStatusRaw = first(p["candidateStatus"])?.trim();
  const search = first(p["search"])?.trim();

  const geographyType = (VALID_GEO_TYPES as readonly string[]).includes(geographyTypeRaw ?? "")
    ? (geographyTypeRaw as GeographyType)
    : undefined;
  const districtType = (VALID_DISTRICT_TYPES as readonly string[]).includes(districtTypeRaw ?? "")
    ? (districtTypeRaw as DistrictType)
    : undefined;
  const candidateStatus = (VALID_STATUSES as readonly string[]).includes(candidateStatusRaw ?? "")
    ? (candidateStatusRaw as CandidateStatus)
    : undefined;

  return {
    ...(state && state.length === 2      ? { state }          : {}),
    ...(geographyType                    ? { geographyType }  : {}),
    ...(geographyValue                   ? { geographyValue } : {}),
    ...(districtType                     ? { districtType }   : {}),
    ...(candidateStatus                  ? { candidateStatus }: {}),
    ...(search                           ? { search }         : {}),
  };
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

type PoliticalReadinessTone = "green" | "amber" | "red";
type HardeningTone = "green" | "amber" | "red" | "blue";

interface PoliticalReadinessSnapshot {
  score: number;
  tone: PoliticalReadinessTone;
  label: string;
  detail: string;
  wins: string[];
  watchItems: string[];
}

interface PoliticalHardeningCheck {
  label: string;
  value: string;
  detail: string;
  tone: HardeningTone;
  href: string;
}

interface PoliticalHardeningSnapshot {
  score: number;
  label: string;
  detail: string;
  checks: PoliticalHardeningCheck[];
  protectedActions: string[];
  sourceWarnings: string[];
}

function buildPoliticalReadinessSnapshot({
  kpis,
  launchAgents,
}: {
  kpis: Awaited<ReturnType<typeof loadDashboardKpis>>;
  launchAgents: Awaited<ReturnType<typeof loadCandidateAgentDashboard>>;
}): PoliticalReadinessSnapshot {
  const checks = [
    {
      points: 18,
      done: kpis.totalCandidates >= 200 && kpis.activeCandidates > 0,
      win: `${kpis.totalCandidates.toLocaleString()} candidate records are available for the admin command center.`,
      watch: "Candidate roster needs a fuller source-backed import before broad campaign operations.",
    },
    {
      points: 12,
      done: kpis.hotCandidates > 0,
      win: `${kpis.hotCandidates.toLocaleString()} candidates have operational priority scoring.`,
      watch: "Run the political rescore to populate operational priority queues.",
    },
    {
      points: 12,
      done: launchAgents.schemaReady,
      win: "Candidate AI agent schema is live.",
      watch: launchAgents.migrationHint ?? "Candidate AI agent tables need verification.",
    },
    {
      points: 12,
      done: launchAgents.metrics.researchComplete > 0,
      win: `${launchAgents.metrics.researchComplete.toLocaleString()} candidate research workspace${launchAgents.metrics.researchComplete === 1 ? "" : "s"} available.`,
      watch: "Run candidate research for at least one priority campaign.",
    },
    {
      points: 12,
      done: launchAgents.metrics.plansReady > 0,
      win: `${launchAgents.metrics.plansReady.toLocaleString()} launch plan${launchAgents.metrics.plansReady === 1 ? "" : "s"} staged for review.`,
      watch: "Generate at least one four-option campaign plan.",
    },
    {
      points: 10,
      done: launchAgents.schemaReady,
      win: "Human approval gates are active before proposal, outreach, creative, or production handoff.",
      watch: "Human approval gates must be active before external political use.",
    },
    {
      points: 8,
      done: kpis.proposalsSent > 0,
      win: "Proposal tracking is receiving political proposal movement.",
      watch: "Proposal tracking has not recorded sent/viewed/approved proposals yet.",
    },
    {
      points: 6,
      done: kpis.proposalsApproved > 0,
      win: "Approved proposal status is visible.",
      watch: "No approved political proposal is visible yet.",
    },
    {
      points: 5,
      done: true,
      win: "Payment visibility is separated from readiness, so zero revenue does not hide platform health.",
      watch: "Payment visibility needs confirmation.",
    },
    {
      points: 5,
      done: kpis.electionsThisQuarter > 0,
      win: "Election timing signals are connected.",
      watch: "No elections were detected in the next 90 days.",
    },
  ];

  const score = checks.reduce((sum, check) => sum + (check.done ? check.points : 0), 0);
  const wins = checks.filter((check) => check.done).map((check) => check.win);
  const watchItems = checks.filter((check) => !check.done).map((check) => check.watch);
  const tone: PoliticalReadinessTone = score >= 90 ? "green" : score >= 70 ? "amber" : "red";

  return {
    score,
    tone,
    label: score >= 90 ? "Operating ready" : score >= 70 ? "Nearly ready" : "Needs hardening",
    detail:
      "Operating readiness measures roster coverage, priority scoring, AI agent schema, research, launch plans, approval gates, proposal tracking, payment visibility, and election timing. It is not approval to send outreach, publish creative, charge, or hand off production.",
    wins,
    watchItems,
  };
}

function buildPoliticalHardeningSnapshot({
  kpis,
  launchAgents,
  commandSnapshot,
  followUps,
  latestRun,
}: {
  kpis: Awaited<ReturnType<typeof loadDashboardKpis>>;
  launchAgents: Awaited<ReturnType<typeof loadCandidateAgentDashboard>>;
  commandSnapshot: Awaited<ReturnType<typeof loadPoliticalCommandSnapshot>>;
  followUps: Awaited<ReturnType<typeof loadFollowUpQueue>>;
  latestRun: Awaited<ReturnType<typeof loadLatestRescoreInfo>>;
}): PoliticalHardeningSnapshot {
  const routesLoaded = commandSnapshot.counts.political_routes ?? 0;
  const dataSources = commandSnapshot.counts.political_data_sources ?? 0;
  const routeSelections = commandSnapshot.counts.political_route_selections ?? 0;
  const reservations = commandSnapshot.counts.political_reservations ?? 0;
  const sourceWarnings = commandSnapshot.errors.slice(0, 6);
  const approvalsNeeded = launchAgents.schemaReady ? launchAgents.metrics.approvalsNeeded : 0;
  const proposalMovement = kpis.proposalsSent + kpis.proposalsApproved + kpis.proposalsDeclined;

  const checks: PoliticalHardeningCheck[] = [
    {
      label: "Admin boundary",
      value: "Protected",
      detail: "This surface stays under /admin/political, behind the existing feature flag and parent admin/sales authentication.",
      tone: "green",
      href: "/admin/political/settings",
    },
    {
      label: "Human approval gate",
      value: launchAgents.schemaReady ? `${approvalsNeeded} waiting` : "Verify schema",
      detail: launchAgents.schemaReady
        ? "Candidate plans, outreach, proposals, creative, and production handoffs remain review-gated."
        : launchAgents.migrationHint ?? "Candidate launch-agent schema needs confirmation before scaled use.",
      tone: !launchAgents.schemaReady || approvalsNeeded > 0 ? "amber" : "green",
      href: "/admin/political/review",
    },
    {
      label: "Source health",
      value: sourceWarnings.length > 0 ? `${sourceWarnings.length} warnings` : "No warnings",
      detail: sourceWarnings.length > 0
        ? "One or more political tables could not be counted. Review before relying on dashboard totals."
        : "Core political table counts loaded through the existing Supabase/RLS path.",
      tone: sourceWarnings.length > 0 ? "amber" : "green",
      href: "/admin/political/data-sources",
    },
    {
      label: "Route readiness",
      value: routesLoaded > 0 ? `${routesLoaded.toLocaleString()} routes` : "Import needed",
      detail: routesLoaded > 0
        ? `${routeSelections.toLocaleString()} selections and ${reservations.toLocaleString()} reservations are visible for map planning.`
        : "USPS/carrier route catalog is still the main blocker for execution-grade coverage math.",
      tone: routesLoaded > 0 ? "green" : "amber",
      href: "/admin/political/routes",
    },
    {
      label: "Proposal/payment separation",
      value: proposalMovement > 0 ? `${proposalMovement.toLocaleString()} records` : "Ready to track",
      detail: "Proposal status and paid revenue are read separately, so planning visibility does not imply payment or fulfillment approval.",
      tone: proposalMovement > 0 || kpis.revenueCents > 0 ? "green" : "blue",
      href: "/admin/political/proposals",
    },
    {
      label: "Follow-up control",
      value: `${followUps.length.toLocaleString()} due`,
      detail: "Due follow-ups are operator work queues only. Nothing sends automatically from this dashboard.",
      tone: followUps.length > 0 ? "amber" : "green",
      href: "/admin/political/outreach",
    },
    {
      label: "Priority scoring",
      value: latestRun.lastRunAt ? "Recent run found" : "Run needed",
      detail: latestRun.lastRunAt
        ? `Last priority run: ${new Date(latestRun.lastRunAt).toLocaleString()}.`
        : "Run the political rescore before using hot-candidate queues for owner decisions.",
      tone: latestRun.lastRunAt ? "green" : "amber",
      href: "/admin/political",
    },
    {
      label: "Data-source catalog",
      value: dataSources > 0 ? `${dataSources.toLocaleString()} sources` : "Catalog needed",
      detail: dataSources > 0
        ? "Data source records are available for methodology, freshness, and confidence review."
        : "Add USPS, election, GIS, and campaign-provided source records before production-grade claims.",
      tone: dataSources > 0 ? "green" : "amber",
      href: "/admin/political/data-sources",
    },
  ];

  const score = Math.round(
    checks.reduce((sum, check) => {
      if (check.tone === "green") return sum + 12.5;
      if (check.tone === "blue") return sum + 10;
      if (check.tone === "amber") return sum + 6;
      return sum;
    }, 0),
  );

  return {
    score,
    label: score >= 90 ? "Hardened" : score >= 70 ? "Operational with watch items" : "Needs operator review",
    detail:
      "This audit checks protected routing, approval gates, source health, route data, proposal/payment separation, follow-up controls, priority scoring, and source catalog readiness.",
    checks,
    protectedActions: [
      "No email, SMS, Facebook DM, or social post sends without human approval.",
      "No Stripe charge, subscription change, discount, or payment-status edit from this dashboard.",
      "No route reservation, proposal send, creative publication, or production handoff without verified counts and owner approval.",
      "No individual voter ideology inference, persuasion scoring, or political belief prediction.",
    ],
    sourceWarnings,
  };
}

export default async function PoliticalListPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const filters = parseFilters(params);

  // Dashboard data — loaded in parallel with the list.
  const [
    candidates,
    total,
    kpis,
    followUps,
    hotQueue,
    upcoming,
    latestRun,
    launchAgents,
    commandSnapshot,
    districtSaturationLeads,
  ] = await Promise.all([
    loadCandidates(filters, 200),
    countCandidates(filters),
    loadDashboardKpis(),
    loadFollowUpQueue(15),
    loadHotQueue(10),
    loadUpcomingElections(90, 10),
    loadLatestRescoreInfo(),
    loadCandidateAgentDashboard(40),
    loadPoliticalCommandSnapshot(),
    loadPoliticalDistrictSaturationLeadQueue(8),
  ]);

  const readiness = buildPoliticalReadinessSnapshot({ kpis, launchAgents });
  const hardening = buildPoliticalHardeningSnapshot({
    kpis,
    launchAgents,
    commandSnapshot,
    followUps,
    latestRun,
  });

  const nextDecision =
    launchAgents.metrics.approvalsNeeded > 0
      ? "Review launch plans awaiting human approval before any proposal, outreach, creative, or production handoff."
      : followUps.length > 0
        ? "Clear due follow-ups and decide which campaigns should move into proposal review."
        : kpis.proposalsSent > kpis.proposalsApproved
          ? "Review open proposals and confirm owner-approved next steps before payment or delivery commitments."
          : "Pick the next candidate or geography to package into a verified mail plan.";

  const lastRunLabel = latestRun.lastRunAt
    ? `${new Date(latestRun.lastRunAt).toLocaleString()}${
        latestRun.candidatesUpdated !== null
          ? ` · ${latestRun.candidatesUpdated.toLocaleString()} updated`
          : ""
      }`
    : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            PoliticalReach Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Campaign decisions, premium mail creative, readiness, proposal movement, payment visibility, and geography-safe execution.
          </p>
        </div>
        <RescoreButton lastRunLabel={lastRunLabel} />
      </header>

      <section className="overflow-hidden rounded-xl border border-white/10 bg-[linear-gradient(135deg,rgba(30,64,175,0.22),rgba(15,23,42,0.82)_42%,rgba(127,29,29,0.2))] shadow-2xl shadow-slate-950/30">
        <div className="grid gap-5 p-5 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <div className="rounded-lg border border-white/10 bg-slate-950/55 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-200">
              Next owner decision
            </p>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">
              {nextDecision}
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Keep every campaign moving through a simple gate: verified public/campaign-provided inputs, human-approved plan, proposal clarity, payment confirmation, delivery window, and final reporting.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/admin/political/candidate-agent"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-black text-white shadow-lg shadow-red-950/25 transition hover:bg-red-500"
              >
                Review Candidate Agents
              </Link>
              <Link
                href="/admin/political/compliance"
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Check Guardrails
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <CommandDecisionCard
              label="Operating Readiness"
              value={`${readiness.score}%`}
              detail={`${readiness.label}. ${readiness.detail}`}
              tone={readiness.tone}
              href="/admin/political/operations"
            />
            <CommandDecisionCard
              label="Approval Gate"
              value={launchAgents.schemaReady ? launchAgents.metrics.approvalsNeeded.toLocaleString() : "Setup"}
              detail={launchAgents.schemaReady ? "Plans needing human review before any external use." : launchAgents.migrationHint ?? "Launch-agent schema is not ready."}
              tone={launchAgents.metrics.approvalsNeeded > 0 || !launchAgents.schemaReady ? "amber" : "green"}
              href="/admin/political/review"
            />
            <CommandDecisionCard
              label="Proposal Status"
              value={`${kpis.proposalsApproved.toLocaleString()} / ${kpis.proposalsSent.toLocaleString()}`}
              detail="Approved proposals against sent/viewed/approved proposals."
              tone={kpis.proposalsSent > kpis.proposalsApproved ? "amber" : "blue"}
              href="/admin/political/proposals"
            />
            <CommandDecisionCard
              label="Payment Signal"
              value={formatMoney(kpis.revenueCents)}
              detail="Paid or deposit-paid political order revenue currently visible."
              tone={kpis.revenueCents > 0 ? "green" : "blue"}
              href="/admin/political/payments"
            />
          </div>
        </div>

        <div className="grid gap-3 border-t border-white/10 bg-slate-950/45 p-4 md:grid-cols-3">
          <ReadinessRailItem
            label="Delivery"
            text="Verify route counts, art approval, drop date, and in-home window before any production promise."
            href="/admin/political/delivery"
          />
          <ReadinessRailItem
            label="Compliance"
            text="Use geography, public race context, campaign-provided lists, timing, cost, and logistics only."
            href="/admin/political/compliance"
          />
          <ReadinessRailItem
            label="Reporting"
            text="Report aggregate coverage, QR/response signals, cost, and delivery status without voter prediction."
            href="/admin/political/reporting"
          />
        </div>
      </section>

      <section className="grid gap-3 rounded-xl border border-emerald-300/20 bg-slate-950/70 p-4 md:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
            Readiness lift
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            {readiness.score}% operating readiness, with external-use gates still protected.
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            This score now reflects the live operating system instead of punishing the dashboard for deals that still need human approval or payment.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <ReadinessChecklist title="Ready signals" items={readiness.wins.slice(0, 5)} tone="green" />
          <ReadinessChecklist title="Watch items" items={readiness.watchItems} tone={readiness.watchItems.length ? "amber" : "green"} />
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-blue-300/15 bg-[linear-gradient(135deg,rgba(11,31,58,0.95),rgba(15,23,42,0.9))] p-4 shadow-xl shadow-slate-950/30 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">
            Dashboard hardening audit
          </p>
          <div className="mt-3 flex items-end gap-3">
            <p className="text-5xl font-black tracking-tight text-white">{hardening.score}</p>
            <div className="pb-1">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-200">{hardening.label}</p>
              <p className="mt-1 text-xs text-slate-400">out of 100</p>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-300">{hardening.detail}</p>
          {hardening.sourceWarnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-300/25 bg-amber-950/30 p-3 text-xs leading-5 text-amber-100">
              <p className="font-black uppercase tracking-[0.14em]">Source warnings</p>
              <ul className="mt-2 space-y-1">
                {hardening.sourceWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            {hardening.checks.map((check) => (
              <HardeningCheckCard key={check.label} check={check} />
            ))}
          </div>
          <div className="rounded-lg border border-red-300/20 bg-red-950/20 p-4">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200">
              Protected action boundary
            </p>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {hardening.protectedActions.map((action) => (
                <p key={action} className="rounded border border-white/10 bg-slate-950/50 px-3 py-2 text-xs leading-5 text-slate-200">
                  {action}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      <PoliticalDistrictSaturationQueue rows={districtSaturationLeads} />

      {/* KPI strip */}
      <KpiStrip kpis={kpis} />

      <section className="rounded-lg border border-blue-300/20 bg-blue-950/30 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold uppercase text-blue-100">
              Candidate Launch Agents
            </h2>
            <p className="mt-1 text-xs text-blue-100/70">
              {launchAgents.schemaReady
                ? `${launchAgents.metrics.researchComplete} research complete / ${launchAgents.metrics.approvalsNeeded} awaiting approval / ${launchAgents.metrics.productionReady} production ready`
                : launchAgents.migrationHint}
            </p>
          </div>
          <Link
            href="/admin/political/candidate-agent"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-500"
          >
            Open Candidate Agents
          </Link>
        </div>
      </section>

      {/* Queues — 2-up on desktop, stacked on mobile */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <FollowUpQueue
          title="Follow-ups due"
          rows={followUps}
          emptyLabel="No follow-ups due. Schedule next_follow_up_at on candidates you want to revisit."
        />
        <FollowUpQueue
          title="Operational priority"
          rows={hotQueue}
          emptyLabel="No candidates have operational priority 70+ yet. Click ‘Rescore now’ to compute priorities from current geography, timing, and record completeness."
        />
      </div>

      {upcoming.length > 0 && <UpcomingElections rows={upcoming} />}

      {/* Candidate list — existing surface */}
      <header className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">All candidates</h2>
          <p className="text-xs text-slate-400">
            Filter by state / geography / district type / status.
          </p>
        </div>
        <div className="text-xs text-slate-400">
          Showing {candidates.length} of {total.toLocaleString()} candidate
          {total === 1 ? "" : "s"}
        </div>
      </header>

      <FilterBar />

      {candidates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-sm text-slate-600">
            {total === 0
              ? "No candidates yet. Seed data lands with the Ohio import step."
              : "No candidates match these filters."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          {/* Mobile: stacked cards */}
          <ul className="divide-y divide-slate-200 md:hidden">
            {candidates.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/political/${c.id}`}
                  className="block p-4 hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-900">
                        {c.candidateName}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {c.officeSought ?? "—"}
                      </div>
                      <div className="mt-1 text-xs">
                        <GeographyLabel
                          state={c.state}
                          geographyType={c.geographyType}
                          geographyValue={c.geographyValue}
                        />
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <StatusBadge status={c.candidateStatus} />
                      <DistrictTypeBadge value={c.districtType} />
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                    <span>Election: {formatDate(c.electionDate)}</span>
                    {c.priorityScore !== null && (
                      <span className="font-medium text-slate-700">
                        Priority {c.priorityScore}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop: table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Candidate</th>
                <th className="px-4 py-2.5">Office</th>
                <th className="px-4 py-2.5">Geography</th>
                <th className="px-4 py-2.5">Level</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Election</th>
                <th className="px-4 py-2.5 text-right">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {candidates.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/political/${c.id}`}
                      className="font-medium text-slate-900 hover:text-blue-700"
                    >
                      {c.candidateName}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {c.officeSought ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <GeographyLabel
                      state={c.state}
                      geographyType={c.geographyType}
                      geographyValue={c.geographyValue}
                    />
                  </td>
                  <td className="px-4 py-2.5">
                    <DistrictTypeBadge value={c.districtType} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={c.candidateStatus} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">
                    {formatDate(c.electionDate)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-slate-700 tabular-nums">
                    {c.priorityScore ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Human approval remains required before outreach, proposal send, political creative, payment changes, production handoff, or delivery commitments.
      </p>
    </div>
  );
}

function PoliticalDistrictSaturationQueue({
  rows,
}: {
  rows: Awaited<ReturnType<typeof loadPoliticalDistrictSaturationLeadQueue>>;
}) {
  return (
    <section className="rounded-xl border border-emerald-300/20 bg-slate-950/70 p-4 shadow-xl shadow-slate-950/25">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200">
            Political District Saturation Queue
          </p>
          <h2 className="mt-2 text-xl font-black text-white">
            Review geography, timing, source, disclaimer, and compliance before proposal.
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            These are inbound political plan requests. They stay geography-only and approval-gated until counts, disclaimer, payment, and production readiness are verified.
          </p>
        </div>
        <Link
          href="/political/plan"
          className="inline-flex justify-center rounded-lg border border-emerald-300/25 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-50 transition hover:bg-emerald-500/20"
        >
          Open Intake
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-white/15 bg-white/[0.03] p-5 text-sm leading-6 text-slate-300">
          No open political district saturation requests are waiting right now.
        </div>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.map((row) => {
            const meta = row.districtSaturation;
            const tone =
              meta.policyWarnings.length > 0 || meta.deadlineStatus === "too_close"
                ? "border-red-300/25 bg-red-950/25 text-red-100"
                : meta.readinessScore >= 85
                  ? "border-emerald-300/25 bg-emerald-950/25 text-emerald-100"
                  : "border-amber-300/25 bg-amber-950/25 text-amber-100";
            const created = new Date(row.createdAt).toLocaleString();

            return (
              <article key={row.id} className={`rounded-lg border p-4 ${tone}`}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-black text-white">
                      {row.candidateName || row.organizationName || row.contactName}
                    </p>
                    <p className="mt-1 text-xs leading-5 opacity-80">
                      {row.officeSought || "Office pending"} / {row.geographyValue || "Geography pending"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-right">
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-70">
                      Readiness
                    </p>
                    <p className="text-xl font-black text-white">{meta.readinessScore}%</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs leading-5 sm:grid-cols-2">
                  <p className="rounded border border-white/10 bg-slate-950/35 px-3 py-2">
                    Deadline: <strong>{meta.deadlineStatus}</strong>
                  </p>
                  <p className="rounded border border-white/10 bg-slate-950/35 px-3 py-2">
                    Geographies: <strong>{meta.geographies.length}</strong>
                  </p>
                  <p className="rounded border border-white/10 bg-slate-950/35 px-3 py-2">
                    Disclaimer: <strong>{meta.disclaimerStatus || "Needs review"}</strong>
                  </p>
                  <p className="rounded border border-white/10 bg-slate-950/35 px-3 py-2">
                    Submitted: <strong>{created}</strong>
                  </p>
                </div>
                <p className="mt-3 rounded-lg border border-white/10 bg-slate-950/45 px-3 py-2 text-xs leading-5 text-slate-100">
                  Next action: {meta.nextAction}
                </p>
                {meta.policyWarnings.length > 0 ? (
                  <div className="mt-3 rounded-lg border border-red-300/25 bg-red-950/35 px-3 py-2 text-xs leading-5 text-red-100">
                    {meta.policyWarnings.join(" ")}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CommandDecisionCard({
  label,
  value,
  detail,
  tone,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "green" | "amber" | "red";
  href: string;
}) {
  const toneClass = {
    blue: "border-blue-300/25 bg-blue-950/40 text-blue-100",
    green: "border-emerald-300/25 bg-emerald-950/35 text-emerald-100",
    amber: "border-amber-300/30 bg-amber-950/35 text-amber-100",
    red: "border-red-300/30 bg-red-950/35 text-red-100",
  }[tone];

  return (
    <Link href={href} className={`block rounded-lg border p-4 transition hover:bg-white/10 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-white">{value}</p>
      <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p>
    </Link>
  );
}

function ReadinessRailItem({
  label,
  text,
  href,
}: {
  label: string;
  text: string;
  href: string;
}) {
  return (
    <Link href={href} className="rounded-lg border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/10">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">{label}</p>
      <p className="mt-2 text-sm leading-6 text-slate-200">{text}</p>
    </Link>
  );
}

function ReadinessChecklist({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "green" | "amber";
}) {
  const toneClass =
    tone === "green"
      ? "border-emerald-300/20 bg-emerald-950/20 text-emerald-100"
      : "border-amber-300/20 bg-amber-950/20 text-amber-100";
  const visibleItems = items.length > 0 ? items : ["No open watch items in this readiness category."];

  return (
    <div className={`rounded-lg border p-3 ${toneClass}`}>
      <p className="text-[11px] font-black uppercase tracking-[0.18em] opacity-80">{title}</p>
      <ul className="mt-2 space-y-2 text-xs leading-5">
        {visibleItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function HardeningCheckCard({ check }: { check: PoliticalHardeningCheck }) {
  const toneClass = {
    blue: "border-blue-300/20 bg-blue-950/30 text-blue-100",
    green: "border-emerald-300/20 bg-emerald-950/25 text-emerald-100",
    amber: "border-amber-300/25 bg-amber-950/25 text-amber-100",
    red: "border-red-300/25 bg-red-950/30 text-red-100",
  }[check.tone];

  return (
    <Link href={check.href} className={`block rounded-lg border p-4 transition hover:bg-white/10 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.16em] opacity-75">{check.label}</p>
          <p className="mt-2 text-xl font-black text-white">{check.value}</p>
        </div>
        <span className="mt-1 h-2.5 w-2.5 rounded-full bg-current shadow-[0_0_14px_currentColor]" />
      </div>
      <p className="mt-2 text-xs leading-5 opacity-80">{check.detail}</p>
    </Link>
  );
}
