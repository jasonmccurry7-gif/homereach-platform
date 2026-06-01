import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileImage,
  Gauge,
  MapPinned,
  RadioTower,
  Target,
} from "lucide-react";
import { MarketCaptureFulfillmentActions } from "./market-capture-fulfillment-actions";
import { MARKET_CAPTURE_OBJECTIVE_LABELS, MARKET_CAPTURE_TARGETING_LABELS, badgeClass } from "@/lib/market-capture/campaign";
import { getCompetitorAreaMetadata } from "@/lib/market-capture/competitor-area";
import { getEventAreaMetadata } from "@/lib/market-capture/event-area";
import { formatUsd, isMarketCaptureFulfillmentEnabled } from "@/lib/market-capture/config";
import { signPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Capture Fulfillment Campaign | HomeReach Admin" };

type Params = Promise<{ campaignId: string }>;

function labelList(value: string | null | undefined, labels: Record<string, string>) {
  return String(value ?? "")
    .split(",")
    .map((item) => labels[item.trim()] ?? item.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(", ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function pct(value: number | null | undefined) {
  return `${Number(value ?? 0)}%`;
}

export default async function MarketCaptureFulfillmentDetailPage({ params }: { params: Params }) {
  if (!isMarketCaptureFulfillmentEnabled()) notFound();
  const { campaignId } = await params;
  const supabase = createServiceClient();

  const [
    campaignRes,
    locationsRes,
    checklistsRes,
    approvalsRes,
    reportsRes,
    readinessRes,
  ] = await Promise.all([
    supabase.from("market_capture_campaigns").select("*").eq("id", campaignId).single(),
    supabase.from("market_capture_campaign_locations").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: true }),
    supabase.from("market_capture_checklists").select("*").eq("campaign_id", campaignId).order("item_order", { ascending: true }),
    supabase.from("market_capture_approvals").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    supabase.from("market_capture_reports").select("*").eq("campaign_id", campaignId).order("reporting_period_end", { ascending: false }),
    supabase.from("market_capture_launch_readiness").select("*").eq("campaign_id", campaignId).maybeSingle(),
  ]);

  if (campaignRes.error || !campaignRes.data) notFound();
  const campaign = campaignRes.data as any;

  const [leadRes, tasksRes, assetsRes, notesRes, draftsRes] = await Promise.all([
    supabase.from("market_capture_leads").select("*").eq("id", campaign.market_capture_lead_id).single(),
    supabase.from("market_capture_tasks").select("*").eq("market_capture_lead_id", campaign.market_capture_lead_id).eq("task_type", "fulfillment").order("due_date", { ascending: true }),
    supabase.from("market_capture_assets").select("*").eq("market_capture_lead_id", campaign.market_capture_lead_id).order("created_at", { ascending: false }),
    supabase.from("market_capture_notes").select("*").eq("market_capture_lead_id", campaign.market_capture_lead_id).order("created_at", { ascending: false }).limit(80),
    supabase.from("market_capture_drafts").select("*").eq("market_capture_lead_id", campaign.market_capture_lead_id).eq("created_by", "fulfillment_draft_generator").order("created_at", { ascending: false }),
  ]);

  if (leadRes.error || !leadRes.data) notFound();
  const lead = leadRes.data as any;
  const competitorArea = getCompetitorAreaMetadata(lead.metadata);
  const eventArea = getEventAreaMetadata(lead.metadata);
  const readiness = readinessRes.data as any;
  const clientToken = signPublicFlowToken({
    scope: "market_capture_checkout",
    marketCaptureLeadId: lead.id,
  });
  const clientPortalHref = `/market-capture/status?token=${encodeURIComponent(clientToken)}`;

  const checklistRows = (checklistsRes.data ?? []) as any[];
  const completedChecklist = checklistRows.filter((item) => item.status === "completed").length;
  const checklistProgress = checklistRows.length > 0 ? Math.round((completedChecklist / checklistRows.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <Link href="/admin/market-capture-fulfillment" className="inline-flex items-center gap-2 text-sm font-black text-slate-600 hover:text-slate-950">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Market Capture Fulfillment
      </Link>

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Fulfillment Campaign</p>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(String(campaign.campaign_status))}`}>
                {String(campaign.campaign_status).replace(/_/g, " ")}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(String(campaign.launch_status))}`}>
                {String(campaign.launch_status).replace(/_/g, " ")}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{campaign.campaign_name}</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              {lead.contact_name} / {lead.email} / {lead.phone}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={clientPortalHref} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
              Client Portal
            </Link>
            <Link href={`/admin/market-capture-sales/${lead.id}`} className="inline-flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-sm font-black text-white hover:bg-slate-800">
              Sales Record
            </Link>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Gauge} label="Readiness" value={pct(readiness?.readiness_score)} />
        <Metric icon={CreditCard} label="Payment" value={String(campaign.payment_status).replace(/_/g, " ")} />
        <Metric icon={Target} label="Ad Budget" value={`${formatUsd(Number(campaign.monthly_ad_budget ?? 0))}/mo`} />
        <Metric icon={FileImage} label="Creative" value={String(campaign.creative_status).replace(/_/g, " ")} />
        <Metric icon={ClipboardList} label="Checklist" value={`${checklistProgress}%`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Campaign Management</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Update internal roles, statuses, direct mail add-on tracking, landing/tracking URLs, and launch state.</p>
          <MarketCaptureFulfillmentActions mode="campaign" campaignId={campaign.id} campaign={campaign} />
        </div>

        <div className="space-y-4">
          <Panel title="Next Best Action" icon={CheckCircle2}>
            <p className="rounded-lg border border-blue-100 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-900">
              {readiness?.recommended_next_action ?? campaign.next_best_action ?? "Review campaign setup"}
            </p>
            <div className="mt-3 grid gap-2">
              {(readiness?.missing_items ?? []).map((item: string) => (
                <p key={item} className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900">{item}</p>
              ))}
            </div>
          </Panel>

          <Panel title="Client And Business" icon={Target}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Info label="Business" value={lead.business_name} />
              <Info label="Industry" value={lead.industry} />
              <Info label="Objective" value={labelList(lead.targeting_objective, MARKET_CAPTURE_OBJECTIVE_LABELS)} />
              <Info label="Targeting Type" value={labelList(lead.targeting_type, MARKET_CAPTURE_TARGETING_LABELS)} />
              <Info label="Management Fee" value={`${formatUsd(Number(campaign.monthly_management_fee ?? 0))}/mo`} />
              <Info label="Direct Mail" value={String(campaign.direct_mail_status).replace(/_/g, " ")} />
            </div>
          </Panel>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Targeting And Locations" icon={MapPinned}>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Target Geography</p>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{campaign.target_geography ?? lead.target_area}</p>
          </div>
          <div className="mt-4 grid gap-2">
            {(locationsRes.data ?? []).map((location: any) => (
              <div key={location.id} className="rounded-lg border border-slate-200 bg-white p-3">
                <p className="font-black text-slate-950">{location.name}</p>
                <p className="mt-1 text-xs text-slate-500">{String(location.location_type).replace(/_/g, " ")} / radius {location.radius_miles ?? "-"}</p>
                <p className="mt-1 text-sm text-slate-600">{location.address || location.notes || "No location notes."}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <MarketCaptureFulfillmentActions mode="location" campaignId={campaign.id} />
          </div>
          {competitorArea?.enabled ? (
            <div className="mt-4 rounded-lg border border-violet-100 bg-violet-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-700">Competitor Area Review</p>
              <p className="mt-2 text-sm font-bold leading-6 text-violet-950">{competitorArea.nextAction}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Info label="Locations" value={String(competitorArea.locations.length)} />
                <Info label="Readiness" value={`${competitorArea.readinessScore}/100`} />
                <Info label="Policy Review" value={competitorArea.platformPolicyReviewRequired ? "Required" : "Not requested"} />
              </div>
              {competitorArea.policyWarnings.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {competitorArea.policyWarnings.map((warning) => (
                    <p key={warning} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
          {eventArea?.enabled ? (
            <div className="mt-4 rounded-lg border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-orange-700">Event Area Review</p>
              <p className="mt-2 text-sm font-bold leading-6 text-orange-950">{eventArea.nextAction}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Info label="Locations" value={String(eventArea.locations.length)} />
                <Info label="Deadline" value={eventArea.deadlineStatus.replace(/_/g, " ")} />
                <Info label="Launch Cutoff" value={eventArea.launchCutoffDate ?? "Needs date"} />
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Info label="Readiness" value={`${eventArea.readinessScore}/100`} />
                <Info label="Rush Review" value={eventArea.rushReviewRequired ? "$250 review" : "Not required"} />
                <Info label="Source Confirmed" value={eventArea.sourceConfirmed ? "Yes" : "Needs confirmation"} />
              </div>
              {eventArea.policyWarnings.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {eventArea.policyWarnings.map((warning) => (
                    <p key={warning} className="rounded-lg bg-amber-100 px-3 py-2 text-xs font-bold text-amber-900">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>

        <Panel title="Fulfillment Checklist" icon={ClipboardList}>
          <div className="grid gap-2">
            {checklistRows.map((item) => (
              <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.owner} / due {fmtDate(item.due_date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(item.status)}`}>{String(item.status).replace(/_/g, " ")}</span>
                </div>
                <MarketCaptureFulfillmentActions mode="checklist" campaignId={campaign.id} checklistId={item.id} status={item.status} />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Panel title="Creative Assets" icon={FileImage}>
          <div className="grid gap-2">
            {(assetsRes.data ?? []).length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500">No assets uploaded yet.</p>
            ) : (
              (assetsRes.data ?? []).map((asset: any) => (
                <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-black text-slate-950">{asset.file_name ?? asset.asset_type}</p>
                  <p className="mt-1 text-xs text-slate-500">{asset.asset_type} / {asset.status} / {asset.approval_status}</p>
                  <MarketCaptureFulfillmentActions mode="asset" campaignId={campaign.id} assetId={asset.id} status={asset.approval_status ?? asset.status} />
                </div>
              ))
            )}
          </div>
        </Panel>

        <Panel title="Client Approvals" icon={CheckCircle2}>
          <div className="grid gap-2">
            {(approvalsRes.data ?? []).map((approval: any) => (
              <div key={approval.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="font-black text-slate-950">{String(approval.approval_type).replace(/_/g, " ")}</p>
                <p className="mt-1 text-xs text-slate-500">{String(approval.status).replace(/_/g, " ")} / requested {fmtDate(approval.requested_at)}</p>
                <p className="mt-2 text-sm text-slate-600">{approval.notes || approval.content_summary}</p>
                <MarketCaptureFulfillmentActions mode="approval" campaignId={campaign.id} approvalId={approval.id} status={approval.status} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Team Tasks" icon={CalendarDays}>
          <div className="grid gap-2">
            {(tasksRes.data ?? []).map((task: any) => (
              <div key={task.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-slate-950">{task.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{task.owner} / {task.priority} / due {fmtDate(task.due_date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(task.status)}`}>{String(task.status).replace(/_/g, " ")}</span>
                </div>
                <MarketCaptureFulfillmentActions mode="task" campaignId={campaign.id} taskId={task.id} status={task.status} priority={task.priority} />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="AI Drafts" icon={RadioTower}>
          <div className="grid gap-3">
            {(draftsRes.data ?? []).map((draft: any) => (
              <div key={draft.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{String(draft.draft_type).replace(/_/g, " ")}</p>
                    <h3 className="mt-1 font-black text-slate-950">{draft.label}</h3>
                  </div>
                  <MarketCaptureFulfillmentActions mode="copy" copyText={draft.content} />
                </div>
                <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm leading-6 text-slate-700">{draft.content}</pre>
              </div>
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Reporting Foundation" icon={ClipboardList}>
            <MarketCaptureFulfillmentActions mode="report" campaignId={campaign.id} />
            <div className="mt-4 grid gap-2">
              {(reportsRes.data ?? []).map((report: any) => (
                <div key={report.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="font-black text-slate-950">{fmtDate(report.reporting_period_start)} - {fmtDate(report.reporting_period_end)}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {report.impressions} impressions / {report.clicks} clicks / {formatUsd(Number(report.spend ?? 0))} spend
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{report.recommendations || report.notes || "No notes."}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Notes And Activity Timeline" icon={ClipboardList}>
            <MarketCaptureFulfillmentActions mode="note" campaignId={campaign.id} />
            <div className="mt-4 grid gap-2">
              {(notesRes.data ?? []).map((note: any) => (
                <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm leading-6 text-slate-700">{note.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{note.author} / {fmtDate(note.created_at)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-slate-950">{value}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Target; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-lg font-black text-slate-950">{title}</h2>
      </div>
      {children}
    </section>
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
