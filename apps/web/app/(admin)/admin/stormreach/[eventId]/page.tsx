import { ArrowLeft, FileText, Mail, MapPinned, Search, ShieldCheck, Sparkles } from "lucide-react";
import { StormReachActions } from "@/components/stormreach/stormreach-actions";
import { StormReachMap } from "@/components/stormreach/stormreach-map";
import { StormReachOutreachActions } from "@/components/stormreach/stormreach-outreach-actions";
import { loadStormReachEventDetail } from "@/lib/stormreach/repository";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ eventId: string }>;
};

export default async function AdminStormReachEventPage({ params }: Params) {
  const { eventId } = await params;
  const detail = await loadStormReachEventDetail(eventId);

  if (!detail.event) {
    return (
      <main className="space-y-4 pb-20">
        <a href="/admin/stormreach" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          StormReach
        </a>
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h1 className="text-lg font-black">Event not found</h1>
          <p className="mt-1 text-sm font-semibold">The StormReach event could not be loaded.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="space-y-6 pb-20">
      <a href="/admin/stormreach" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        StormReach
      </a>

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge>{detail.event.severity_level}</Badge>
              <Badge>{detail.event.status}</Badge>
              <Badge>{detail.event.event_type}</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{detail.event.title}</h1>
            <p className="mt-3 max-w-5xl text-sm font-semibold leading-6 text-slate-600">{detail.event.description}</p>
            <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
              {detail.event.source} - Confidence {detail.event.confidence_score}% - Score {detail.event.severity_score}
            </p>
          </div>
          <StormReachActions eventId={detail.event.id} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <StormReachMap events={[detail.event]} selectedEventId={detail.event.id} height={420} />
        <div className="space-y-4">
          <InfoPanel icon={MapPinned} title="Impacted Area" rows={[
            ["State", detail.event.impacted_state ?? ""],
            ["Cities", detail.event.impacted_cities.join(", ")],
            ["Counties", detail.event.impacted_counties.join(", ")],
            ["Zip codes", detail.event.impacted_zip_codes.join(", ")],
            ["Households", numberFormat(detail.event.estimated_households)],
            ["Homeowners", numberFormat(detail.event.estimated_homeowners)],
          ]} />
          <InfoPanel icon={ShieldCheck} title="Approval Boundary" rows={[
            ["Outreach", "Human review required"],
            ["Geofence", "Export-first"],
            ["Postcards", "Draft only until approved"],
            ["Payments", "No charge from StormReach"],
          ]} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ListPanel icon={Search} title="Recommended Services" rows={detail.industryMatches} primary="industry" secondary="reason" badge="match_score" />
        <ListPanel icon={Search} title="Prospect Count" rows={detail.prospects} primary="business_name" secondary="category" badge="suppression_status" />
        <OutreachListPanel rows={detail.outreachMessages} />
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <ListPanel icon={FileText} title="Campaign Packages" rows={detail.packages} primary="package_name" secondary="event_summary" badge="approval_status" />
        <ListPanel icon={MapPinned} title="Geofence Builder" rows={detail.geofenceCampaigns} primary="industry" secondary="campaign_brief" badge="external_platform_status" />
        <ListPanel icon={FileText} title="Postcard Builder" rows={detail.postcardCampaigns} primary="headline" secondary="body" badge="approval_status" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <ListPanel icon={Sparkles} title="Agent Improvements" rows={detail.improvements} primary="title" secondary="description" badge="priority" />
        <ListPanel icon={ShieldCheck} title="Activity Log" rows={detail.auditLogs} primary="summary" secondary="action" badge="approval_status" />
      </section>
    </main>
  );
}

function InfoPanel({ icon: Icon, rows, title }: { icon: typeof MapPinned; title: string; rows: Array<[string, string]> }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-orange-700" aria-hidden="true" />
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      <dl className="mt-4 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[7rem_1fr] gap-3 text-sm">
            <dt className="font-black text-slate-500">{label}</dt>
            <dd className="font-semibold text-slate-800">{value || "Not available"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ListPanel({ badge, icon: Icon, primary, rows, secondary, title }: { icon: typeof Search; title: string; rows: Record<string, unknown>[]; primary: string; secondary: string; badge: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <Icon className="h-5 w-5 text-orange-700" aria-hidden="true" />
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 40).map((row, index) => (
          <article key={String(row.id ?? index)} className="p-4">
            <div className="flex flex-wrap gap-2"><Badge>{formatCell(row[badge])}</Badge></div>
            <h3 className="mt-2 text-sm font-black text-slate-950">{formatCell(row[primary])}</h3>
            <p className="mt-1 line-clamp-4 text-xs font-semibold leading-5 text-slate-500">{formatCell(row[secondary])}</p>
          </article>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No rows yet.</p> : null}
      </div>
    </section>
  );
}

function OutreachListPanel({ rows }: { rows: Record<string, unknown>[] }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-4">
        <Mail className="h-5 w-5 text-orange-700" aria-hidden="true" />
        <h2 className="text-lg font-black text-slate-950">Outreach Drafts</h2>
      </div>
      <div className="divide-y divide-slate-100">
        {rows.slice(0, 40).map((row, index) => (
          <article key={String(row.id ?? index)} className="p-4">
            <div className="flex flex-wrap gap-2">
              <Badge>{formatCell(row.channel)}</Badge>
              <Badge>{formatCell(row.approval_status)}</Badge>
              <Badge>{formatCell(row.status)}</Badge>
            </div>
            <h3 className="mt-2 text-sm font-black text-slate-950">{formatCell(row.subject) || "StormReach script"}</h3>
            <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">{formatCell(row.recipient_email) || formatCell(row.recipient_phone)}</p>
            <StormReachOutreachActions row={row} compact />
            <div className="mt-3">
              <StormReachActions messageId={String(row.id)} compact />
            </div>
          </article>
        ))}
        {!rows.length ? <p className="p-4 text-sm font-semibold text-slate-500">No outreach drafts yet.</p> : null}
      </div>
    </section>
  );
}

function Badge({ children }: { children: string | number }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{String(children).replaceAll("_", " ")}</span>;
}

function formatCell(value: unknown) {
  if (Array.isArray(value)) return value.slice(0, 6).join(", ");
  if (typeof value === "number") return numberFormat(value);
  if (typeof value === "string") return value.replaceAll("_", " ");
  if (value == null) return "";
  return JSON.stringify(value).slice(0, 220);
}

function numberFormat(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}
