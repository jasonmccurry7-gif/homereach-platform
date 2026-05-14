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
  ] = await Promise.all([
    loadCandidates(filters, 200),
    countCandidates(filters),
    loadDashboardKpis(),
    loadFollowUpQueue(15),
    loadHotQueue(10),
    loadUpcomingElections(90, 10),
    loadLatestRescoreInfo(),
    loadCandidateAgentDashboard(40),
  ]);

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
            Political Command Center
          </h1>
          <p className="mt-1 text-sm text-slate-300">
            Candidate database, operational priority, and follow-up queue.
          </p>
        </div>
        <RescoreButton lastRunLabel={lastRunLabel} />
      </header>

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
          title="Hot priority"
          rows={hotQueue}
          emptyLabel="No candidates scored 70+ yet. Click ‘Rescore now’ to compute priorities from current data."
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
        Phase 2 — read-only view. Actions (outreach, quotes, proposals) land in
        Phase 3+.
      </p>
    </div>
  );
}
