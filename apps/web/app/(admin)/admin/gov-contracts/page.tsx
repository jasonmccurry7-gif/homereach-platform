import type { Metadata } from "next";
import Link from "next/link";
import { loadGovContractDashboard } from "@/lib/gov-contracts/data";
import { GOV_CONTRACT_FOCUS_DEFINITIONS, getGovContractFocusMatches, isGovContractFocus } from "@/lib/gov-contracts/focus";
import type { GovContractDashboardFilters, GovContractOpportunity } from "@/lib/gov-contracts/types";
import { GovContractsSyncControl } from "./_components/GovContractsSyncControl";
import { OpportunityStatusActions } from "./_components/OpportunityStatusActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contracts - HomeReach Admin" };

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFilters(params: Record<string, string | string[] | undefined>): GovContractDashboardFilters {
  const focus = first(params.focus)?.trim();
  return {
    keyword: first(params.keyword)?.trim() || undefined,
    focus: focus === "all" || isGovContractFocus(focus) ? focus : undefined,
    naics: first(params.naics)?.trim() || undefined,
    psc: first(params.psc)?.trim() || undefined,
    agency: first(params.agency)?.trim() || undefined,
    state: first(params.state)?.trim().toUpperCase() || undefined,
    setAside: first(params.setAside)?.trim() || undefined,
    noticeType: first(params.noticeType)?.trim() || undefined,
    status: (first(params.status)?.trim() as GovContractDashboardFilters["status"]) || "all",
    sort: (first(params.sort)?.trim() as GovContractDashboardFilters["sort"]) || "fit",
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

function SummaryCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function OpportunityCard({ opportunity }: { opportunity: GovContractOpportunity }) {
  const focusMatches = getGovContractFocusMatches(opportunity);
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
            {focusMatches.map((match) => (
              <span
                key={match.id}
                className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 ring-1 ring-emerald-200"
              >
                {match.shortLabel}
              </span>
            ))}
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
          </div>
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Recommended next step</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{opportunity.recommendedNextAction}</p>
          </div>
        </div>
        <div className="w-full shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 lg:w-64">
          <div className="grid grid-cols-3 gap-2 text-center">
            <Score label="Fit" value={opportunity.fitScore} />
            <Score label="Risk" value={opportunity.riskScore} />
            <Score label="Urgency" value={opportunity.urgencyScore} />
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-blue-700"
            >
              Review
            </Link>
            <Link
              href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}/bid-room`}
              className="rounded-lg bg-slate-950 px-4 py-2 text-center text-sm font-black text-white shadow-sm hover:bg-slate-800"
            >
              Open Bid Room
            </Link>
            <button
              type="button"
              disabled
              title="Phase 2: subcontractor matching will use the Gov Contracts subcontractor network."
              className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-400 ring-1 ring-slate-200"
            >
              Match Subs - Phase 2
            </button>
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
  const activeFocus = filters.focus ?? "all";

  return (
    <div className="space-y-6">
      <header className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.35),transparent_42%),linear-gradient(135deg,#020617,#0f172a)] p-6 lg:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-blue-200">Admin only - Phase 1</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight lg:text-4xl">Gov Contracts Command Center</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Discover, score, review, and organize government opportunities without creating commitments. Final submission,
                pricing, certification claims, and subcontractor commitments stay under explicit human approval.
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

      <GovContractsSyncControl
        samConfigured={data.sync.configured}
        databaseReady={data.sync.databaseReady}
        lastRunAt={data.sync.lastRunAt}
      />

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Home services pursuit lane</p>
            <h2 className="mt-1 text-lg font-black text-slate-950">Focus the feed on contractor-friendly work</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
              Prioritize HVAC, landscaping, and roofing opportunities that can be worked through local subcontractor matching,
              RFQs, insurance checks, and bid-room follow-up.
            </p>
          </div>
          <Link
            href="/admin/gov-contracts?focus=home_services&sort=fit"
            className="rounded-lg bg-emerald-700 px-4 py-2 text-center text-sm font-black text-white hover:bg-emerald-800"
          >
            View all home services
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <FocusLink href="/admin/gov-contracts?sort=fit" label="All opportunities" active={activeFocus === "all"} />
          {GOV_CONTRACT_FOCUS_DEFINITIONS.filter((definition) => definition.id !== "home_services").map((definition) => (
            <FocusLink
              key={definition.id}
              href={`/admin/gov-contracts?focus=${definition.id}&sort=fit`}
              label={definition.label}
              detail={definition.naicsCodes.join(", ")}
              active={activeFocus === definition.id}
            />
          ))}
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
        <form className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
          <FilterInput name="keyword" label="Keyword" defaultValue={filters.keyword} placeholder="mailing, courier..." />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Focus</span>
            <select
              name="focus"
              defaultValue={filters.focus ?? "all"}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="all">All</option>
              <option value="home_services">Home services</option>
              {GOV_CONTRACT_FOCUS_DEFINITIONS.filter((definition) => definition.id !== "home_services").map((definition) => (
                <option key={definition.id} value={definition.id}>
                  {definition.label}
                </option>
              ))}
            </select>
          </label>
          <FilterInput name="naics" label="NAICS" defaultValue={filters.naics} placeholder="541860" />
          <FilterInput name="psc" label="PSC" defaultValue={filters.psc} placeholder="R701" />
          <FilterInput name="agency" label="Agency" defaultValue={filters.agency} placeholder="GSA, VA..." />
          <FilterInput name="state" label="State" defaultValue={filters.state} placeholder="OH" />
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sort</span>
            <select
              name="sort"
              defaultValue={filters.sort ?? "fit"}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="fit">Fit score</option>
              <option value="due">Due date</option>
              <option value="urgency">Urgency</option>
              <option value="value">Value</option>
              <option value="agency">Agency</option>
              <option value="status">Status</option>
            </select>
          </label>
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

function FocusLink({
  href,
  label,
  detail,
  active,
}: {
  href: string;
  label: string;
  detail?: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-xl border p-3 text-sm shadow-sm ${
        active ? "border-emerald-300 bg-white text-emerald-900" : "border-emerald-100 bg-white/70 text-slate-700 hover:bg-white"
      }`}
    >
      <span className="font-black">{label}</span>
      {detail ? <span className="mt-1 block text-xs text-slate-500">NAICS {detail}</span> : null}
    </Link>
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
