import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CreditCard, FileImage, MapPinned, Target } from "lucide-react";
import { MarketCaptureLeadActions } from "./market-capture-lead-actions";
import { MARKET_CAPTURE_OBJECTIVE_LABELS, MARKET_CAPTURE_STAGE_LABELS, MARKET_CAPTURE_TARGETING_LABELS, badgeClass } from "@/lib/market-capture/campaign";
import { getCompetitorAreaMetadata } from "@/lib/market-capture/competitor-area";
import { getEventAreaMetadata } from "@/lib/market-capture/event-area";
import { formatUsd, isMarketCaptureSalesDashboardEnabled } from "@/lib/market-capture/config";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Capture Lead | HomeReach Admin" };

type Params = Promise<{ leadId: string }>;

function labelList(value: string | null | undefined, labels: Record<string, string>) {
  return String(value ?? "")
    .split(",")
    .map((item) => labels[item.trim()] ?? item.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(", ");
}

function stageLabel(stage: string | null | undefined) {
  const value = String(stage ?? "intake_complete");
  return MARKET_CAPTURE_STAGE_LABELS[value] ?? value.replace(/_/g, " ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function MarketCaptureLeadDetailPage({ params }: { params: Params }) {
  if (!isMarketCaptureSalesDashboardEnabled()) notFound();
  const { leadId } = await params;
  const supabase = createServiceClient();

  const [leadRes, pipelineRes, tasksRes, assetsRes, notesRes, draftsRes] = await Promise.all([
    supabase.from("market_capture_leads").select("*").eq("id", leadId).single(),
    supabase.from("market_capture_pipeline").select("*").eq("market_capture_lead_id", leadId).limit(1).maybeSingle(),
    supabase.from("market_capture_tasks").select("*").eq("market_capture_lead_id", leadId).order("task_order", { ascending: true }),
    supabase.from("market_capture_assets").select("*").eq("market_capture_lead_id", leadId).order("created_at", { ascending: false }),
    supabase.from("market_capture_notes").select("*").eq("market_capture_lead_id", leadId).order("created_at", { ascending: false }).limit(50),
    supabase.from("market_capture_drafts").select("*").eq("market_capture_lead_id", leadId).order("created_at", { ascending: false }),
  ]);

  if (leadRes.error || !leadRes.data) notFound();
  const lead = leadRes.data;
  const pipeline = pipelineRes.data;
  const stage = String(pipeline?.stage ?? "intake_complete");
  const competitorArea = getCompetitorAreaMetadata(lead.metadata);
  const eventArea = getEventAreaMetadata(lead.metadata);

  return (
    <div className="space-y-6">
      <Link href="/admin/market-capture-sales" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Market Capture Sales
      </Link>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Market Capture Lead</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(stage)}`}>{stageLabel(stage)}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(String(lead.payment_status))}`}>{String(lead.payment_status).replace(/_/g, " ")}</span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{lead.business_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {lead.contact_name} · {lead.email} · {lead.phone}
            </p>
          </div>
          <MarketCaptureLeadActions leadId={lead.id} currentStage={stage} mode="stage" />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={CreditCard} label="Management Fee" value={`${formatUsd(Number(lead.monthly_management_fee ?? 0))}/mo`} />
        <Metric icon={Target} label="Ad Budget" value={`${formatUsd(Number(lead.monthly_ad_budget ?? 0))}/mo`} />
        <Metric icon={MapPinned} label="Targeting" value={labelList(lead.targeting_type, MARKET_CAPTURE_TARGETING_LABELS)} />
        <Metric icon={CalendarDays} label="Preferred Start" value={fmtDate(lead.preferred_start_date)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Business Information</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Contact" value={lead.contact_name} />
            <Info label="Industry" value={lead.industry} />
            <Info label="Website" value={lead.website ?? "-"} />
            <Info label="Objective" value={labelList(lead.targeting_objective, MARKET_CAPTURE_OBJECTIVE_LABELS)} />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Target Area</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.target_area}</p>
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Campaign Offer</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{lead.campaign_offer || "No offer provided yet."}</p>
          </div>
          {competitorArea?.enabled ? (
            <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Competitor Area Plan</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Geography-based visibility only. Review platform policy before launch.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(competitorArea.priority)}`}>
                  {competitorArea.readinessScore}/100
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Info label="Locations" value={String(competitorArea.locations.length)} />
                <Info label="Included Limit" value={String(competitorArea.includedLocationLimit)} />
                <Info label="Extra Validation" value={competitorArea.additionalLocationCount ? `${competitorArea.additionalLocationCount} locations` : "None"} />
              </div>
              <p className="mt-3 rounded-lg border border-white/70 bg-white/80 p-3 text-sm font-bold leading-6 text-violet-950">
                {competitorArea.nextAction}
              </p>
              {competitorArea.policyWarnings.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {competitorArea.policyWarnings.map((warning) => (
                    <p key={warning} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 grid gap-2">
                {competitorArea.locations.slice(0, 10).map((location) => (
                  <div key={`${location.name}-${location.address}`} className="rounded-lg bg-white/80 p-3 text-sm">
                    <p className="font-black text-slate-950">{location.name}</p>
                    <p className="mt-1 text-slate-600">{location.address}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {location.priority} / radius {location.radiusMiles} mi / {location.validationStatus.replace(/_/g, " ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {eventArea?.enabled ? (
            <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Event Area Plan</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">
                    Time-sensitive local visibility. Confirm source, cutoff, offer, and approval before accepting launch.
                  </p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(eventArea.priority)}`}>
                  {eventArea.readinessScore}/100
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Info label="Locations" value={String(eventArea.locations.length)} />
                <Info label="Deadline" value={eventArea.deadlineStatus.replace(/_/g, " ")} />
                <Info label="Rush Review" value={eventArea.rushReviewRequired ? "$250 review" : "Not required"} />
              </div>
              <p className="mt-3 rounded-lg border border-white/70 bg-white/80 p-3 text-sm font-bold leading-6 text-orange-950">
                {eventArea.nextAction}
              </p>
              {eventArea.policyWarnings.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {eventArea.policyWarnings.map((warning) => (
                    <p key={warning} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
              <div className="mt-3 grid gap-2">
                {eventArea.locations.slice(0, 10).map((location) => (
                  <div key={`${location.name}-${location.address}`} className="rounded-lg bg-white/80 p-3 text-sm">
                    <p className="font-black text-slate-950">{location.name}</p>
                    <p className="mt-1 text-slate-600">{location.address}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {location.eventDate ?? "date TBD"} / {location.promotionWindow ?? "window TBD"} / radius {location.radiusMiles} mi
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Next Action</h2>
          <p className="mt-2 rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
            {pipeline?.next_action ?? "Review intake"}
          </p>
          <div className="mt-4 grid gap-3">
            <Info label="Pipeline Owner" value={pipeline?.owner ?? lead.owner ?? "jason"} />
            <Info label="Pipeline Stage" value={stageLabel(stage)} />
            <Info label="Payment Status" value={String(lead.payment_status).replace(/_/g, " ")} />
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Sales Tasks</h2>
          <div className="mt-4 grid gap-2">
            {(tasksRes.data ?? []).map((task) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.owner} · due {fmtDate(task.due_date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(task.status)}`}>{task.status.replace(/_/g, " ")}</span>
                </div>
                <MarketCaptureLeadActions leadId={lead.id} taskId={task.id} taskStatus={task.status} mode="task" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">AI Sales Drafts</h2>
          <div className="mt-4 grid gap-3">
            {(draftsRes.data ?? []).map((draft) => (
              <div key={draft.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{draft.draft_type.replace(/_/g, " ")}</p>
                    <h3 className="mt-1 font-black text-slate-950">{draft.label}</h3>
                  </div>
                  <MarketCaptureLeadActions mode="copy" copyText={draft.content} />
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-slate-700">{draft.content}</pre>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <FileImage className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">Uploaded Assets</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {(assetsRes.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No assets uploaded yet.</p>
            ) : (
              (assetsRes.data ?? []).map((asset) => (
                <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-black text-slate-950">{asset.file_name ?? asset.asset_type}</p>
                  <p className="mt-1 text-slate-500">{asset.asset_type} · {asset.status}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Notes and Activity Log</h2>
          <MarketCaptureLeadActions leadId={lead.id} mode="note" />
          <div className="mt-4 grid gap-2">
            {(notesRes.data ?? []).map((note) => (
              <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-sm leading-6 text-slate-700">{note.content}</p>
                <p className="mt-1 text-xs text-slate-400">{note.author} · {fmtDate(note.created_at)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CreditCard; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value || "-"}</p>
    </div>
  );
}
