import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadGovContractBidWorkspace } from "@/lib/gov-contracts/execution";
import { runGovContractLiveMarketResearch } from "@/lib/gov-contracts/market-research";
import type { GovContractResearchSource, GovContractSubcontractorCandidate } from "@/lib/gov-contracts/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Gov Contract Market Research - HomeReach Admin" };

interface PageProps {
  params: Promise<{ opportunityId: string }>;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not listed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function tone(status: string) {
  if (["verified", "configured"].includes(status)) return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (["estimated", "manual_review", "open_search", "needs_key", "search_required", "needs_outreach", "unverified"].includes(status)) {
    return "bg-amber-50 text-amber-800 ring-amber-200";
  }
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function Panel({ title, children }: { title: string; children: JSX.Element | JSX.Element[] }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${tone(value)}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

export default async function GovContractMarketResearchPage({ params }: PageProps) {
  const { opportunityId } = await params;
  const { opportunity, workspace } = await loadGovContractBidWorkspace(decodeURIComponent(opportunityId));
  if (!opportunity || !workspace) notFound();

  const packet = await runGovContractLiveMarketResearch(opportunity, workspace.pricing);
  const rawResearchUrl = `/api/admin/gov-contracts/opportunities/${encodeURIComponent(opportunity.id)}/market-research`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}`} className="text-sm font-bold text-blue-700 hover:text-blue-900">
          Back to opportunity
        </Link>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/gov-contracts/${encodeURIComponent(opportunity.id)}/bid-room?tab=subcontractors`}
            className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800"
          >
            Open Subcontractor Tab
          </Link>
          <a
            href={rawResearchUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-white px-4 py-2 text-sm font-black text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Raw Research JSON
          </a>
        </div>
      </div>

      <header className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm lg:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-200">Market research packet</p>
            <h1 className="mt-3 max-w-5xl text-3xl font-black leading-tight">{opportunity.title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Research is advisory until official solicitation terms, prior awards, competitors, and subcontractor quotes
              are verified. This page does not approve pricing or contact vendors.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-300">Generated</p>
            <p className="mt-1 text-sm font-black">{formatDate(packet.generatedAt)}</p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Confidence" value={packet.confidence} />
        <Metric label="Research status" value={packet.researchStatus.replaceAll("_", " ")} />
        <Metric label="Sources" value={String(packet.sourceLinks.length)} />
        <Metric label="Subcontractor candidates" value={String(packet.subcontractorCandidates.length)} />
      </section>

      <Panel title="Executive Market Readout">
        <div className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-blue-950">
            <p className="text-sm font-semibold leading-6">{packet.executiveSummary}</p>
          </div>
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950">
            <p className="text-xs font-black uppercase tracking-[0.16em] opacity-70">Underbid controls</p>
            <ul className="mt-3 space-y-2 text-sm font-semibold leading-6">
              {packet.underbidControls.map((item) => <li key={item}>- {item}</li>)}
            </ul>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Historical Award Signal" items={[packet.historicalAwardSummary]} />
        <InfoCard title="Competitive Range" items={[packet.competitiveRangeSummary]} />
        <InfoCard title="Competitor Signal" items={[packet.likelyCompetitorSummary]} />
      </section>

      <Panel title="Research Sources To Open">
        <div className="grid gap-3 md:grid-cols-2">
          {packet.sourceLinks.map((source) => <ResearchSourceCard key={`${source.label}-${source.url}`} source={source} />)}
        </div>
      </Panel>

      <Panel title="Businesses To Subcontract Near This Job">
        {packet.subcontractorCandidates.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {packet.subcontractorCandidates.map((candidate) => (
              <CandidateCard key={`${candidate.name}-${candidate.sourceUrl}`} candidate={candidate} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
            No live subcontractor candidates came back from configured search sources. Open the sourcing links, verify local providers,
            and do not select or quote a subcontractor without human approval.
          </p>
        )}
      </Panel>

      <Panel title="Pricing Signals">
        <div className="grid gap-3 md:grid-cols-2">
          {packet.pricingSignals.map((signal) => (
            <div key={signal} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-700">
              {signal}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-black leading-5 text-slate-950">{value}</p>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <ul className="mt-3 space-y-2 text-sm font-semibold leading-6 text-slate-700">
        {items.map((item) => <li key={item}>- {item}</li>)}
      </ul>
    </article>
  );
}

function ResearchSourceCard({ source }: { source: GovContractResearchSource }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{source.label}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{source.note}</p>
        </div>
        <Badge value={source.status} />
      </div>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-blue-700 hover:text-blue-900">
          Open source
        </a>
      ) : null}
    </article>
  );
}

function CandidateCard({ candidate }: { candidate: GovContractSubcontractorCandidate }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">{candidate.name}</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            {candidate.workCategory} - {candidate.geography}
          </p>
        </div>
        <Badge value={candidate.verificationStatus} />
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-600">{candidate.distanceSignal}</p>
      <p className="mt-2 text-xs leading-5 text-slate-600">{candidate.nextAction}</p>
      {candidate.sourceUrl ? (
        <a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex text-xs font-black text-blue-700 hover:text-blue-900">
          {candidate.sourceLabel}
        </a>
      ) : null}
    </article>
  );
}
