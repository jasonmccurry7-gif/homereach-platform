"use client";

import { useMemo, useState } from "react";
import { Download, Plus, ShieldCheck } from "lucide-react";
import { StormReachActions } from "./stormreach-actions";
import { StormReachMap } from "./stormreach-map";
import { StormReachOutreachActions } from "./stormreach-outreach-actions";
import type { StormDashboardData, StormDashboardEvent } from "@/lib/stormreach/types";

type Props = {
  data: StormDashboardData;
  stateCode?: string;
};

const DEFAULT_STATE = "OH";

export function StormReachOverdriveCommandCenter({ data, stateCode = DEFAULT_STATE }: Props) {
  const state = stateCode.toUpperCase();
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    headline: "",
    description: "",
    windMph: "75",
    eventType: "high_wind",
    counties: "",
    cities: "",
    zipCodes: "",
  });
  const [manualStatus, setManualStatus] = useState<string | null>(null);

  const events = useMemo(
    () => data.events
      .filter((event) => (event.impacted_state ?? "").toUpperCase() === state)
      .filter((event) => !["archived", "dismissed"].includes(event.status))
      .sort((a, b) => overdriveScore(b) - overdriveScore(a)),
    [data.events, state],
  );
  const urgent = events.filter((event) => overdriveScore(event) >= 95);
  const high = events.filter((event) => overdriveScore(event) >= 80 && overdriveScore(event) < 95);
  const recent = events.filter((event) => isRecent(event));
  const prospects = data.prospects.filter((row) => String(row.state ?? "").toUpperCase() === state);
  const drafts = data.outreachMessages.filter((row) => row.approval_status === "needs_review" || row.status === "draft");
  const packages = data.packages.filter((row) => row.approval_status === "needs_review" || row.status === "draft");
  const assets = data.generatedAssets.filter((row) => row.status !== "archived");

  async function createManualEvent() {
    setManualStatus("Creating manual event...");
    const response = await fetch("/api/admin/stormreach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "manual_overdrive_event",
        manualEvent: { ...manual, state },
      }),
    });
    const result = await response.json().catch(() => ({}));
    setManualStatus(result.error ? String(result.error) : "Manual event created. Refresh Overdrive to build prospects, drafts, and packages.");
  }

  return (
    <section className="space-y-4">
      <div className="rounded-lg border-2 border-red-200 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-red-100 bg-red-50 p-5 xl:grid-cols-[1fr_auto] xl:items-center">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">StormReach Overdrive Mode</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">Tonight&apos;s Storm Command Center - {state}</h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-700">
              Live severe-weather operations for storm-response contractors. All outreach, proposals, ad launches, postcard orders, and payment actions remain approval-gated.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StormReachActions compact />
            <button
              type="button"
              onClick={() => setManualOpen((open) => !open)}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-xs font-black text-red-800 hover:bg-red-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Manual Storm Event
            </button>
          </div>
        </div>

        <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-6">
          <OverdriveMetric label="Urgent" value={urgent.length} tone="red" />
          <OverdriveMetric label="High" value={high.length} tone="orange" />
          <OverdriveMetric label="Last 24h" value={recent.length} tone="yellow" />
          <OverdriveMetric label="Prospects" value={prospects.length} tone="gray" />
          <OverdriveMetric label="Drafts" value={drafts.length} tone="gray" />
          <OverdriveMetric label="Images" value={assets.length} tone="gray" />
        </div>
      </div>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-black leading-6">
            Do not claim damage occurred unless confirmed. Use "storm impacted," "potential damage," or "storm response" language until verified.
          </p>
        </div>
      </div>

      {manualOpen ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input label="Headline" value={manual.headline} onChange={(value) => setManual({ ...manual, headline: value })} />
            <Input label="Event type" value={manual.eventType} onChange={(value) => setManual({ ...manual, eventType: value })} />
            <Input label="Wind mph" value={manual.windMph} onChange={(value) => setManual({ ...manual, windMph: value })} />
            <Input label="Counties" value={manual.counties} onChange={(value) => setManual({ ...manual, counties: value })} />
            <Input label="Cities" value={manual.cities} onChange={(value) => setManual({ ...manual, cities: value })} />
            <Input label="ZIP codes" value={manual.zipCodes} onChange={(value) => setManual({ ...manual, zipCodes: value })} />
            <label className="md:col-span-2">
              <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">Description</span>
              <textarea
                value={manual.description}
                onChange={(event) => setManual({ ...manual, description: event.target.value })}
                className="mt-1 min-h-20 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={createManualEvent}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create Manual Event
            </button>
            {manualStatus ? <p className="text-sm font-bold text-slate-600">{manualStatus}</p> : null}
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <StormReachMap events={events} height={360} />
        <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <h3 className="text-lg font-black text-slate-950">Live Alert Feed</h3>
            <div className="flex flex-wrap gap-2">
              <ExportLink type="events" state={state} />
              <ExportLink type="prospects" state={state} />
              <ExportLink type="outreach" state={state} />
              <ExportLink type="prospects" state={state} format="xlsx" />
              <ExportLink type="prospects" state={state} format="word" />
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {events.slice(0, 10).map((event) => (
              <article key={event.id} className="p-4">
                <div className="flex flex-wrap gap-2">
                  <ToneBadge score={overdriveScore(event)} />
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{event.status}</span>
                  {isRecent(event) ? <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">Last 24h</span> : null}
                </div>
                <h4 className="mt-2 text-sm font-black text-slate-950">{event.title}</h4>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{areaSummary(event)}</p>
                <p className="mt-2 text-xs font-bold text-slate-700">{services(event).join(", ")}</p>
                <EventStats event={event} data={data} />
                <div className="mt-3">
                  <StormReachActions eventId={event.id} compact />
                </div>
              </article>
            ))}
            {!events.length ? (
              <div className="p-6 text-sm font-semibold text-slate-500">
                No active {state} storm events are queued. Use Refresh Overdrive or create a manual event when verified source information is available.
              </div>
            ) : null}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <QueueCard title="Contractor Prospect Queue" rows={prospects} columns={["business_name", "category", "city", "phone", "email"]} exportType="prospects" state={state} />
        <OutreachQueue rows={drafts.slice(0, 12)} />
        <PackageQueue rows={packages.slice(0, 12)} />
      </div>
    </section>
  );
}

function OverdriveMetric({ label, tone, value }: { label: string; tone: "red" | "orange" | "yellow" | "gray"; value: number }) {
  const toneClass = tone === "red" ? "bg-red-50 text-red-800" : tone === "orange" ? "bg-orange-50 text-orange-800" : tone === "yellow" ? "bg-yellow-50 text-yellow-800" : "bg-slate-50 text-slate-700";
  return (
    <div className={`rounded-lg border border-slate-200 p-4 ${toneClass}`}>
      <p className="text-xs font-black uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function Input({ label, onChange, value }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label>
      <span className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-800" />
    </label>
  );
}

function EventStats({ data, event }: { data: StormDashboardData; event: StormDashboardEvent }) {
  const prospects = data.prospects.filter((row) => row.storm_event_id === event.id).length;
  const drafts = data.outreachMessages.filter((row) => row.storm_event_id === event.id).length;
  const images = data.generatedAssets.filter((row) => row.storm_event_id === event.id && row.status !== "archived").length;
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
  const plan = metadata.autopilot_plan && typeof metadata.autopilot_plan === "object" ? metadata.autopilot_plan as Record<string, unknown> : {};
  const homes = Number(plan.estimatedHomesImpacted ?? event.estimated_households ?? 0);
  const mail = Number(plan.recommendedMailQuantity ?? Math.max(500, Math.round((event.estimated_households ?? 0) * 0.12)));

  return (
    <div className="mt-3 grid gap-2 text-xs font-black text-slate-700 md:grid-cols-5">
      <MiniStat label="Homes" value={numberCell(homes)} />
      <MiniStat label="Mail drop" value={numberCell(mail)} />
      <MiniStat label="Businesses" value={numberCell(prospects)} />
      <MiniStat label="Drafts" value={numberCell(drafts)} />
      <MiniStat label="Images" value={images ? "ready" : "needed"} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-1 truncate">{value}</p>
    </div>
  );
}

function ExportLink({ format = "csv", state, type }: { state: string; type: "events" | "prospects" | "outreach" | "packages"; format?: "csv" | "xlsx" | "word" }) {
  return (
    <a href={`/api/admin/stormreach/export?type=${type}&state=${state}&format=${format}`} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:bg-slate-50">
      <Download className="h-4 w-4" aria-hidden="true" />
      {type} {format.toUpperCase()}
    </a>
  );
}

function ToneBadge({ score }: { score: number }) {
  const classes = score >= 95 ? "bg-red-600 text-white" : score >= 80 ? "bg-orange-500 text-white" : score >= 50 ? "bg-yellow-300 text-yellow-950" : "bg-slate-200 text-slate-700";
  const label = score >= 95 ? "urgent" : score >= 80 ? "high" : score >= 50 ? "watch" : "inactive";
  return <span className={`rounded-full px-2 py-1 text-xs font-black uppercase ${classes}`}>{label} {score}</span>;
}

function QueueCard({ columns, exportType, rows, state, title }: { title: string; rows: Record<string, unknown>[]; columns: string[]; exportType: "events" | "prospects" | "outreach" | "packages"; state: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        <ExportLink type={exportType} state={state} />
      </div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 12).map((row, index) => (
          <div key={String(row.id ?? index)} className="p-4">
            {columns.map((column) => (
              <p key={column} className="truncate text-xs font-semibold text-slate-600">
                <span className="font-black text-slate-900">{column.replaceAll("_", " ")}:</span> {formatCell(row[column])}
              </p>
            ))}
          </div>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No rows yet.</p> : null}
      </div>
    </section>
  );
}

function OutreachQueue({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-base font-black text-slate-950">Outreach Draft Queue</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <article key={String(row.id)} className="p-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{formatCell(row.channel)}</span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">{formatCell(row.approval_status)}</span>
            </div>
            <h4 className="mt-2 text-sm font-black text-slate-950">{formatCell(row.subject) || "StormReach script"}</h4>
            <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{formatCell(row.body)}</p>
            <StormReachOutreachActions row={row} compact />
            <div className="mt-3">
              <StormReachActions messageId={String(row.id)} compact />
            </div>
          </article>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No drafts yet.</p> : null}
      </div>
    </section>
  );
}

function PackageQueue({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4">
        <h3 className="text-base font-black text-slate-950">Campaign Package Builder</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.map((row) => (
          <article key={String(row.id)} className="p-4">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{formatCell(row.package_type)}</span>
              <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-black text-amber-800">{formatCell(row.approval_status)}</span>
            </div>
            <h4 className="mt-2 text-sm font-black text-slate-950">{formatCell(row.package_name)}</h4>
            <p className="mt-1 text-xs font-semibold text-slate-500">{formatCell(row.industry)}</p>
            <div className="mt-3">
              <StormReachActions packageId={String(row.id)} compact />
            </div>
          </article>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No packages yet.</p> : null}
      </div>
    </section>
  );
}

function overdriveScore(event: StormDashboardEvent) {
  const metadata = event.metadata && typeof event.metadata === "object" ? event.metadata as Record<string, unknown> : {};
  const score = Number(metadata.storm_damage_opportunity_score ?? event.severity_score ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function isRecent(event: StormDashboardEvent) {
  const value = event.detected_at || event.start_time || event.created_at;
  const time = Date.parse(value);
  return Number.isFinite(time) && Date.now() - time <= 24 * 60 * 60 * 1000;
}

function areaSummary(event: StormDashboardEvent) {
  const parts = [
    event.impacted_counties?.slice(0, 3).join(", "),
    event.impacted_cities?.slice(0, 3).join(", "),
    event.impacted_zip_codes?.slice(0, 5).join(", "),
  ].filter(Boolean);
  return parts.join(" | ") || event.impacted_state || "Area pending enrichment";
}

function services(event: StormDashboardEvent) {
  return event.recommended_industries?.length ? event.recommended_industries.slice(0, 8) : ["Roofing", "Tree service", "Restoration", "Siding", "Windows"];
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) return value.join(", ");
  if (value === null || value === undefined || value === "") return "n/a";
  return String(value);
}

function numberCell(value: number) {
  return Number.isFinite(value) ? new Intl.NumberFormat("en-US").format(value) : "n/a";
}
