import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Brain, CalendarClock, Gauge, Lightbulb, MapPin, Search, Sparkles } from "lucide-react";
import { BusinessMemorySyncButton } from "@/components/business-memory/business-memory-sync-button";
import { formatUsdCents, isBusinessMemoryAdminViewEnabled } from "@/lib/business-memory/config";
import { loadBusinessMemoryProfile } from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Memory Detail | HomeReach Admin" };

type PageProps = {
  params: Promise<{ profileId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function label(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "-";
}

function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 45) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

export default async function BusinessMemoryDetailPage({ params, searchParams }: PageProps) {
  const { profileId } = await params;
  const q = firstParam((await searchParams).q);

  if (!isBusinessMemoryAdminViewEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory admin view is disabled.
      </div>
    );
  }

  const data = await loadBusinessMemoryProfile({ supabase: createServiceClient(), profileId, search: q });

  if (data.safeMode) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory is in safe mode: {data.message ?? "profile unavailable."}
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="space-y-4">
        <Link href="/admin/business-memory" className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Business Memory
        </Link>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <Brain className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
          <h1 className="mt-3 text-xl font-black text-slate-950">Memory profile not found</h1>
        </div>
      </div>
    );
  }

  const score = data.score?.memory_completeness_score ?? 0;
  const recentTimeline = data.timeline.slice(0, 12);

  return (
    <div className="space-y-6">
      <Link href="/admin/business-memory" className="inline-flex items-center gap-2 text-sm font-black text-blue-700">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to Business Memory
      </Link>

      <header className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Business Memory Profile</p>
              <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(score)}`}>{score}% complete</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{data.profile.business_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              {data.profile.industry ?? "Industry pending"} / {data.profile.client_email ?? "client email pending"}
            </p>
          </div>
          <BusinessMemorySyncButton endpoint="/api/admin/business-memory/sync" label="Refresh Memory" />
        </div>
      </header>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search this memory profile"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
            Search
          </button>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Gauge} label="Health Score" value={`${score}%`} detail={`${data.score?.missing_areas?.length ?? 0} gaps`} />
        <Metric icon={MapPin} label="Geographies" value={String(data.geographies.length)} detail="Areas remembered" />
        <Metric icon={Sparkles} label="Opportunities" value={String(data.opportunities.length)} detail={`${data.aiCoo.length} AI COO`} />
        <Metric icon={Lightbulb} label="Insights" value={String(data.insights.length)} detail="Patterns found" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Business Identity">
          <Definition label="Website" value={data.profile.website ?? "-"} />
          <Definition label="Markets Served" value={(data.profile.markets_served ?? []).join(", ") || "-"} />
          <Definition label="Primary Goals" value={(data.profile.primary_goals ?? []).map(label).join(", ") || "-"} />
          <Definition label="Preferred Campaigns" value={(data.profile.preferred_campaign_types ?? []).map(label).join(", ") || "-"} />
          <Definition label="Remembered Offers" value={(data.profile.preferred_offers ?? []).join(" / ") || "-"} />
        </Panel>

        <Panel title="Memory Health">
          <div className="grid gap-2 sm:grid-cols-2">
            <Mini label="Profile" value={`${data.score?.business_profile_score ?? 0}%`} />
            <Mini label="Campaigns" value={`${data.score?.campaign_history_score ?? 0}%`} />
            <Mini label="Opportunities" value={`${data.score?.opportunity_history_score ?? 0}%`} />
            <Mini label="Geography" value={`${data.score?.geography_data_score ?? 0}%`} />
            <Mini label="Suppliers" value={`${data.score?.supplier_data_score ?? 0}%`} />
            <Mini label="AI COO" value={`${data.score?.recommendation_data_score ?? 0}%`} />
          </div>
          {(data.score?.recommended_data_to_collect ?? []).length > 0 ? (
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
              {(data.score?.recommended_data_to_collect ?? []).slice(0, 4).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
        </Panel>
      </section>

      <Panel title="Business Insights">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.insights.length === 0 ? <Empty text="No insights calculated yet." /> : data.insights.map((insight) => (
            <div key={insight.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label(insight.insight_type)}</p>
              <h3 className="mt-1 text-sm font-black text-slate-950">{insight.title}</h3>
              <p className="mt-1 text-sm font-semibold text-blue-700">{insight.value_text ?? (insight.value_cents ? formatUsdCents(insight.value_cents) : "-")}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{insight.recommended_action ?? "Keep collecting context."}</p>
            </div>
          ))}
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-2">
        <RowsPanel title="Geography Memory" rows={data.geographies} empty="No geographies remembered yet." columns={[
          ["Area", (row) => String(row.name ?? "-")],
          ["Type", (row) => label(String(row.geography_type ?? ""))],
          ["Score", (row) => `${row.performance_score ?? 0}%`],
          ["Status", (row) => label(String(row.performance_status ?? ""))],
        ]} />
        <RowsPanel title="Campaign Memory" rows={data.campaigns} empty="No campaigns remembered yet." columns={[
          ["Campaign", (row) => String(row.campaign_name ?? "-")],
          ["Type", (row) => label(String(row.campaign_type ?? ""))],
          ["Budget", (row) => formatUsdCents(Number(row.budget_cents ?? 0))],
          ["Status", (row) => label(String(row.status ?? ""))],
        ]} />
        <RowsPanel title="Opportunity Memory" rows={data.opportunities} empty="No opportunities remembered yet." columns={[
          ["Opportunity", (row) => label(String(row.opportunity_type ?? ""))],
          ["Status", (row) => label(String(row.opportunity_status ?? ""))],
          ["Estimated", (row) => formatUsdCents(Number(row.estimated_value_cents ?? 0))],
          ["Created", (row) => fmtDate(String(row.date_created ?? ""))],
        ]} />
        <RowsPanel title="Savings Memory" rows={data.savings} empty="No savings remembered yet." columns={[
          ["Savings", (row) => String(row.opportunity_name ?? "-")],
          ["Category", (row) => label(String(row.category ?? ""))],
          ["Estimated", (row) => formatUsdCents(Number(row.estimated_savings_cents ?? 0))],
          ["Status", (row) => label(String(row.status ?? ""))],
        ]} />
        <RowsPanel title="Offer Memory" rows={data.offers} empty="No offers remembered yet." columns={[
          ["Offer", (row) => String(row.offer_text ?? "-")],
          ["Type", (row) => label(String(row.offer_type ?? ""))],
          ["Status", (row) => label(String(row.performance_status ?? ""))],
          ["Notes", (row) => String(row.campaign_performance ?? "-")],
        ]} />
        <RowsPanel title="Supplier Memory" rows={data.suppliers} empty="No suppliers remembered yet." columns={[
          ["Supplier", (row) => String(row.supplier_name ?? "-")],
          ["Category", (row) => label(String(row.category ?? ""))],
          ["Notes", (row) => String(row.vendor_notes ?? "-")],
          ["Updated", (row) => fmtDate(String(row.updated_at ?? ""))],
        ]} />
      </section>

      <Panel title="Timeline">
        <div className="space-y-3">
          {recentTimeline.length === 0 ? <Empty text="No timeline events yet." /> : recentTimeline.map((event) => (
            <div key={event.id} className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden="true" />
              <div>
                <p className="text-sm font-black text-slate-950">{event.title}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label(event.event_type)} / {fmtDate(event.event_date)}</p>
                {event.description ? <p className="mt-1 text-sm leading-6 text-slate-600">{event.description}</p> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Brain; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Definition({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{labelText}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Mini({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{labelText}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}

function RowsPanel({
  title,
  rows,
  columns,
  empty,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  columns: Array<[string, (row: Record<string, unknown>) => string]>;
  empty: string;
}) {
  return (
    <Panel title={title}>
      {rows.length === 0 ? (
        <Empty text={empty} />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr>
                {columns.map(([heading]) => (
                  <th key={heading} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 8).map((row) => (
                <tr key={String(row.id)}>
                  {columns.map(([heading, render]) => (
                    <td key={heading} className="max-w-[16rem] px-3 py-2 align-top font-semibold text-slate-700">
                      {render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</p>;
}
