import type { LucideIcon } from "lucide-react";
import { BarChart3, CloudLightning, FileImage, FileText, Mail, MapPinned, RadioTower, Search, ShieldCheck, Sparkles } from "lucide-react";
import { StormReachActions } from "@/components/stormreach/stormreach-actions";
import { StormReachMap } from "@/components/stormreach/stormreach-map";
import { StormReachOverdriveCommandCenter } from "@/components/stormreach/stormreach-overdrive-command-center";
import { StormReachOutreachActions } from "@/components/stormreach/stormreach-outreach-actions";
import { isRecentStormEvent } from "@/lib/stormreach/geo";
import { stormReachOverdriveState } from "@/lib/stormreach/overdrive";
import { loadStormReachDashboard, stormReachPersistenceConfigured } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "StormReach - HomeReach Admin",
};

type SearchParams = Promise<{ tab?: string }>;

const TABS = [
  { key: "overdrive", label: "Live Storm Events", icon: RadioTower },
  { key: "map", label: "Impact Zones", icon: MapPinned },
  { key: "prospects", label: "Business Prospects", icon: Search },
  { key: "outreach", label: "Outreach Drafts", icon: Mail },
  { key: "assets", label: "Storm Images", icon: FileImage },
  { key: "campaigns", label: "Campaigns", icon: FileText },
  { key: "agent", label: "Agent Logs", icon: Sparkles },
  { key: "analytics", label: "ROI Dashboard", icon: BarChart3 },
  { key: "settings", label: "Settings", icon: ShieldCheck },
];

export default async function AdminStormReachPage({ searchParams }: { searchParams: SearchParams }) {
  const resolved = await searchParams;
  const tab = resolved.tab ?? "overdrive";

  if (!stormReachPersistenceConfigured()) {
    return <SafeMode body="Supabase service-role persistence is not configured, so StormReach cannot load its operating tables." />;
  }

  const data = await loadStormReachDashboard();
  const highEvents = data.events.filter((event) => event.severity_level === "High" || event.severity_level === "Extreme");

  return (
    <main className="space-y-6 pb-20">
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-orange-700">StormReach</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">Severe Weather Opportunity Engine</h1>
            <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Severe weather detection, Ohio Overdrive response, contractor prospecting, approval-required outreach, geofence exports, postcard packages, and agent recommendations.
            </p>
          </div>
          <StormReachActions />
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={CloudLightning} label="Active Events" value={data.metrics.activeEvents} detail="National queue" />
        <Metric icon={RadioTower} label="Last 24h" value={data.metrics.last24HourEvents} detail="Highlighted sweep" />
        <Metric icon={Search} label="Roof/Siding" value={data.metrics.contractorProspectsReady} detail="50-mile prospects" />
        <Metric icon={Mail} label="Drafts" value={data.metrics.outreachDrafts} detail="Approval needed" />
        <Metric icon={FileImage} label="Assets" value={data.metrics.generatedAssets} detail="Images + one-pagers" />
        <Metric icon={BarChart3} label="Pipeline" value={formatCents(data.metrics.projectedRevenueCents)} detail="Review-stage" />
      </section>

      <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-sm font-bold leading-6">
            Human approval is required before outreach, proposals, geofence launches, postcard orders, pricing changes, payment actions, or customer-facing claims.
          </p>
        </div>
      </section>

      {data.errors.length ? <SafeMode body={data.errors.slice(0, 3).join(" ")} /> : null}

      <nav className="flex flex-wrap gap-2" aria-label="StormReach tabs">
        {TABS.map((item) => {
          const Icon = item.icon;
          const active = tab === item.key;
          return (
            <a
              key={item.key}
              href={`/admin/stormreach?tab=${item.key}`}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-black transition ${
                active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
            </a>
          );
        })}
      </nav>

      {tab === "overdrive" ? <StormReachOverdriveCommandCenter data={data} stateCode={stormReachOverdriveState()} /> : null}
      {tab === "map" ? (
        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
          <StormReachMap events={data.events} />
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4">
              <h2 className="text-lg font-black text-slate-950">Urgent Events</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {highEvents.slice(0, 8).map((event) => <EventMini key={event.id} event={event} />)}
              {!highEvents.length ? <p className="p-4 text-sm font-semibold text-slate-500">No high or extreme events in the queue.</p> : null}
            </div>
          </div>
        </section>
      ) : null}

      {tab === "prospects" ? <ProspectsTable rows={data.prospects} /> : null}
      {tab === "outreach" ? <OutreachTable rows={data.outreachMessages} /> : null}
      {tab === "assets" ? <AssetsPanel rows={data.generatedAssets} /> : null}
      {tab === "campaigns" ? <CampaignsPanel campaigns={data.campaigns} packages={data.packages} geofences={data.geofenceCampaigns} postcards={data.postcardCampaigns} /> : null}
      {tab === "agent" ? <AgentPanel rows={data.improvements} providerStatus={data.providerStatus} agentRuns={data.agentRuns} /> : null}
      {tab === "analytics" ? <AnalyticsPanel data={data} /> : null}
      {tab === "settings" ? <SafeguardsPanel /> : null}
    </main>
  );
}

function Metric({ detail, icon: Icon, label, value }: { detail: string; icon: LucideIcon; label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-orange-700" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function EventMini({ event }: { event: Awaited<ReturnType<typeof loadStormReachDashboard>>["events"][number] }) {
  const recent = isRecentStormEvent(event, 24);
  return (
    <article className="p-4">
      <div className="flex flex-wrap gap-2">
        <Badge>{event.severity_level}</Badge>
        <Badge>{event.status}</Badge>
        {recent ? <Badge>Last 24h</Badge> : null}
      </div>
      <h3 className="mt-2 text-sm font-black text-slate-950">{event.title}</h3>
      <p className="mt-1 text-xs font-semibold text-slate-500">{areaSummary(event)}</p>
      <div className="mt-3">
        <StormReachActions eventId={event.id} compact />
      </div>
    </article>
  );
}

function ProspectsTable({ rows }: { rows: Record<string, unknown>[] }) {
  return <SimpleTable title="Business Prospects" rows={rows} columns={["business_name", "category", "email", "phone", "website", "city", "state", "suppression_status", "crm_status"]} />;
}

function OutreachTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = ["channel", "subject", "recipient_email", "recipient_phone", "sender_key", "approval_status", "status", "suppression_status"];
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <TableHeader title="Outreach Drafts" />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="sticky left-0 z-10 bg-slate-50 px-4 py-3">send / approve</th>
              {columns.map((column) => <th key={column} className="px-4 py-3">{column.replaceAll("_", " ")}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)} className="align-top">
                <td className="sticky left-0 z-10 min-w-64 border-r border-slate-100 bg-white px-4 py-4 shadow-sm">
                  <StormReachOutreachActions row={row} compact />
                  <div className="mt-3">
                    <StormReachActions messageId={String(row.id)} compact />
                  </div>
                </td>
                {columns.map((column) => <td key={column} className="max-w-sm px-4 py-4 font-semibold text-slate-700">{formatCell(row[column])}</td>)}
              </tr>
            ))}
            {!rows.length ? <tr><td className="px-4 py-6 text-sm font-semibold text-slate-500" colSpan={columns.length + 1}>No outreach drafts yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AssetsPanel({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-2">
      {rows.map((row, index) => (
        <article key={String(row.id ?? index)} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{formatCell(row.asset_type)}</Badge>
              <Badge>{formatCell(row.format)}</Badge>
              <Badge>{formatCell(row.approval_status)}</Badge>
            </div>
            <h2 className="mt-2 text-base font-black text-slate-950">{formatCell(row.title)}</h2>
            <a href={`/api/admin/stormreach/assets/${String(row.id)}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-800 hover:bg-slate-50">
              Open asset
            </a>
          </div>
          <div className="bg-slate-50 p-4">
            {String(row.format) === "svg" && String(row.content_text ?? "").startsWith("<svg") ? (
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" dangerouslySetInnerHTML={{ __html: String(row.content_text) }} />
            ) : (
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-4 text-xs font-semibold leading-5 text-slate-700">{formatCell(row.content_text)}</pre>
            )}
          </div>
        </article>
      ))}
      {!rows.length ? <p className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-semibold text-slate-500">No StormReach images or one-pagers have been generated yet.</p> : null}
    </section>
  );
}

function CampaignsPanel({ campaigns, geofences, packages, postcards }: { campaigns: Record<string, unknown>[]; packages: Record<string, unknown>[]; geofences: Record<string, unknown>[]; postcards: Record<string, unknown>[] }) {
  return (
    <section className="grid gap-4 xl:grid-cols-4">
      <SimpleList title="Autopilot Campaigns" rows={campaigns} primary="campaign_name" secondary="opportunity_level" badge="status" />
      <SimpleList title="Marketing Packages" rows={packages} primary="package_name" secondary="package_type" badge="approval_status" />
      <SimpleList title="Geofence Campaigns" rows={geofences} primary="industry" secondary="external_platform_status" badge="approval_status" />
      <SimpleList title="Postcard Campaigns" rows={postcards} primary="headline" secondary="mail_quantity" badge="approval_status" />
    </section>
  );
}

function AgentPanel({ agentRuns, providerStatus, rows }: { rows: Record<string, unknown>[]; providerStatus: Record<string, unknown>[]; agentRuns: Record<string, unknown>[] }) {
  return (
    <section className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">StormReach Operator Agent</h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-slate-600">
              Runs the recent-storm workflow up to the approval boundary: weather sweep, 50-mile roofing/siding prospects, varied outreach drafts, conversation playbooks, proposal/intake/payment handoffs, geofence packages, postcard briefs, and social creative briefs.
            </p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.14em] text-amber-700">
              Sends, charges, launches, social publishing, and postcard orders still require approval.
            </p>
          </div>
          <StormReachActions compact />
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <SimpleList title="StormReach Agent Runs" rows={agentRuns} primary="summary" secondary="run_type" badge="status" />
        <SimpleList title="Weather Provider Runs" rows={providerStatus} primary="provider_key" secondary="status" badge="events_upserted" />
      </div>
      <SimpleList title="Strategist Recommendations" rows={rows} primary="title" secondary="description" badge="priority" />
    </section>
  );
}

function AnalyticsPanel({ data }: { data: Awaited<ReturnType<typeof loadStormReachDashboard>> }) {
  const sent = data.outreachMessages.filter((row) => row.status === "sent").length;
  const replies = data.outreachMessages.filter((row) => row.replied_at).length;
  const launched = data.geofenceCampaigns.filter((row) => row.status === "launched").length;
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <Metric icon={CloudLightning} label="Events Detected" value={data.events.length} detail="Stored events" />
      <Metric icon={Mail} label="Emails Sent" value={sent} detail="Provider-tracked" />
      <Metric icon={BarChart3} label="Replies" value={replies} detail="Reply tracking" />
      <Metric icon={RadioTower} label="Geofences" value={launched} detail="Launched records" />
    </section>
  );
}

function SafeguardsPanel() {
  const rows: Array<[string, string]> = [
    ["NOAA/NWS alerts", configured(process.env.STORMREACH_NWS_ALERTS_URL || "default")],
    ["NOAA SPC reports", configured(process.env.STORMREACH_NOAA_STORM_REPORTS_URL || "default")],
    ["FEMA declarations", configured(process.env.STORMREACH_FEMA_DECLARATIONS_URL || "default")],
    ["FEMA IPAWS CAP", configured(process.env.STORMREACH_FEMA_IPAWS_CAP_URL)],
    ["Census geocoder", configured(process.env.STORMREACH_CENSUS_GEOCODER_URL || "default")],
    ["USPS EDDM planning", configured(process.env.STORMREACH_USPS_EDDM_URL || "default")],
    ["Google Places prospects", configured(process.env.STORMREACH_GOOGLE_PLACES_API_KEY)],
    ["StormReach SerpAPI prospects", stormReachSerpApiStatus()],
    ["Autopilot sending", process.env.STORMREACH_AUTOPILOT_ENABLED === "true" || process.env.STORMREACH_AUTO_SEND_ENABLED === "true" ? "Enabled" : "Disabled"],
    ["Daily send cap", String(process.env.STORMREACH_MAX_SENDS_PER_DAY ?? "0")],
    ["15-minute event limit", String(process.env.STORMREACH_15_MINUTE_EVENT_LIMIT ?? "12")],
    ["Prospects per run", String(process.env.STORMREACH_MAX_PROSPECTS_PER_RUN ?? "500")],
    ["Drafts per run", String(process.env.STORMREACH_MAX_DRAFTS_PER_RUN ?? "500")],
  ];
  const guardrails = [
    "Human approval required before outbound email, proposals, launches, postcard orders, pricing changes, or payment actions.",
    "Storm claims must keep source attribution and cannot state that any individual property has damage.",
    "Suppression and opt-out handling are required before any marketing send.",
    "Geofence and postcard workflows are export-first unless an approved external platform integration is enabled.",
    "Storm Reach must not imply government affiliation, emergency-service authority, or insurance outcome guarantees.",
  ];

  return (
    <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <TableHeader title="Source And Automation Settings" />
        <div className="divide-y divide-slate-100">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 p-4">
              <span className="text-sm font-black text-slate-700">{label}</span>
              <Badge>{value}</Badge>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <TableHeader title="Compliance Guardrails" />
        <div className="divide-y divide-slate-100">
          {guardrails.map((item) => (
            <div key={item} className="flex gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-orange-700" aria-hidden="true" />
              <p className="text-sm font-semibold leading-6 text-slate-700">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function SimpleTable({ columns, rows, title }: { title: string; rows: Record<string, unknown>[]; columns: string[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <TableHeader title={title} />
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[0.12em] text-slate-500">
            <tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column.replaceAll("_", " ")}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={String(row.id ?? index)}>
                {columns.map((column) => <td key={column} className="max-w-sm px-4 py-4 font-semibold text-slate-700">{formatCell(row[column])}</td>)}
              </tr>
            ))}
            {!rows.length ? <tr><td className="px-4 py-6 text-sm font-semibold text-slate-500" colSpan={columns.length}>No rows yet.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SimpleList({ badge, primary, rows, secondary, title }: { title: string; rows: Record<string, unknown>[]; primary: string; secondary: string; badge: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <TableHeader title={title} />
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 24).map((row, index) => (
          <article key={String(row.id ?? index)} className="p-4">
            <div className="flex flex-wrap gap-2"><Badge>{formatCell(row[badge])}</Badge></div>
            <h3 className="mt-2 text-sm font-black text-slate-950">{formatCell(row[primary])}</h3>
            <p className="mt-1 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{formatCell(row[secondary])}</p>
          </article>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No rows yet.</p> : null}
      </div>
    </section>
  );
}

function TableHeader({ title }: { title: string }) {
  return (
    <div className="border-b border-slate-100 p-4">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
    </div>
  );
}

function SafeMode({ body }: { body: string }) {
  return (
    <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <h1 className="text-lg font-black">StormReach safe mode</h1>
      <p className="mt-1 text-sm font-semibold leading-6">{body}</p>
    </section>
  );
}

function Badge({ children }: { children: string | number }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{String(children).replaceAll("_", " ")}</span>;
}

function areaSummary(event: { impacted_cities?: string[]; impacted_counties?: string[]; impacted_state?: string | null }) {
  return [event.impacted_cities?.[0] ?? event.impacted_counties?.[0] ?? "Affected area", event.impacted_state].filter(Boolean).join(", ");
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) return value.slice(0, 4).join(", ");
  if (typeof value === "number") return numberFormat(value);
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (value == null) return "";
  return JSON.stringify(value).slice(0, 160);
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(cents / 100);
}

function configured(value: unknown) {
  return String(value ?? "").trim() ? "Configured" : "Needs setup";
}

function stormReachSerpApiStatus() {
  const enabled = process.env.STORMREACH_ENABLE_SERPAPI === "true" || process.env.SERPAPI_PAUSED === "false";
  if (!enabled) return "Disabled";
  const hasKey = Boolean(process.env.STORMREACH_SERPAPI_KEY || process.env.SERPAPI_KEY || process.env.SERP_API || process.env.SERPAPI_API_KEY);
  return hasKey ? "Enabled" : "Needs key";
}
