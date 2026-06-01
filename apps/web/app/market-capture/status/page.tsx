import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  CheckCircle2,
  Clock3,
  CreditCard,
  FileImage,
  Gauge,
  MapPinned,
  MessageSquareText,
  Upload,
} from "lucide-react";
import { MARKET_CAPTURE_STAGE_LABELS, badgeClass } from "@/lib/market-capture/campaign";
import {
  formatUsd,
  isMarketCaptureClientPortalEnabled,
  isMarketCaptureEnabled,
} from "@/lib/market-capture/config";
import { verifyPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Market Capture Status | HomeReach",
  description: "Simple Market Capture campaign request and fulfillment status.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type StatusTokenPayload = {
  scope: "market_capture_checkout";
  marketCaptureLeadId: string;
  iat: number;
  exp: number;
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function statusLabel(value: string | null | undefined) {
  if (!value) return "Campaign Requested";
  return MARKET_CAPTURE_STAGE_LABELS[value] ?? value.replace(/_/g, " ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function MarketCaptureStatusPage({ searchParams }: { searchParams: SearchParams }) {
  if (!isMarketCaptureEnabled()) notFound();

  const params = await searchParams;
  const token = firstParam(params.token);
  const updated = firstParam(params.updated) === "1";
  const verified = verifyPublicFlowToken<StatusTokenPayload>(token, "market_capture_checkout");
  if (!verified.ok || !token) notFound();

  const supabase = createServiceClient();
  const [{ data: lead }, { data: pipeline }, campaignRes] = await Promise.all([
    supabase
      .from("market_capture_leads")
      .select("id, business_name, contact_name, email, payment_status, monthly_management_fee, monthly_ad_budget, target_area, postcard_addon, landing_page_needed, creative_package_needed")
      .eq("id", verified.payload.marketCaptureLeadId)
      .single(),
    supabase
      .from("market_capture_pipeline")
      .select("stage, next_action, updated_at")
      .eq("market_capture_lead_id", verified.payload.marketCaptureLeadId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("market_capture_campaigns")
      .select("*")
      .eq("market_capture_lead_id", verified.payload.marketCaptureLeadId)
      .maybeSingle(),
  ]);

  if (!lead) notFound();

  const campaign = campaignRes.data as any | null;
  const [locationsRes, checklistsRes, assetsRes, approvalsRes, reportsRes, readinessRes, notesRes] = campaign
    ? await Promise.all([
        supabase.from("market_capture_campaign_locations").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: true }),
        supabase.from("market_capture_checklists").select("*").eq("campaign_id", campaign.id).order("item_order", { ascending: true }),
        supabase.from("market_capture_assets").select("*").eq("market_capture_lead_id", lead.id).eq("client_visible", true).order("created_at", { ascending: false }),
        supabase.from("market_capture_approvals").select("*").eq("campaign_id", campaign.id).order("created_at", { ascending: false }),
        supabase.from("market_capture_reports").select("*").eq("campaign_id", campaign.id).order("reporting_period_end", { ascending: false }).limit(6),
        supabase.from("market_capture_launch_readiness").select("*").eq("campaign_id", campaign.id).maybeSingle(),
        supabase.from("market_capture_notes").select("*").eq("market_capture_lead_id", lead.id).in("note_type", ["fulfillment", "client_question", "payment"]).order("created_at", { ascending: false }).limit(20),
      ])
    : [
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: [] },
        { data: null },
        { data: [] },
      ];

  const stage = String(campaign?.campaign_status ?? pipeline?.stage ?? "intake_complete");
  const paymentStatus = String(campaign?.payment_status ?? lead.payment_status ?? "payment_required");
  const approvalStatus = String(campaign?.approval_status ?? "awaiting_approval");
  const creativeStatus = String(campaign?.creative_status ?? "missing");
  const readiness = readinessRes.data as any | null;
  const portalEnabled = isMarketCaptureClientPortalEnabled();

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-6 text-white sm:py-10">
      <main className="mx-auto max-w-5xl space-y-5">
        <Link href="/market-capture" className="inline-flex items-center gap-2 text-sm font-black text-slate-200">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-xs">HR</span>
          HomeReach Market Capture
        </Link>

        {updated ? (
          <div className="rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-100">
            Update received. HomeReach will review it with the campaign record.
          </div>
        ) : null}

        <section className="rounded-lg border border-white/10 bg-white/[0.08] p-6">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Campaign status</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight">{lead.business_name}</h1>
          <p className="mt-2 text-sm text-slate-300">{lead.contact_name} / {lead.email}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(stage)}`}>{statusLabel(stage)}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(paymentStatus)}`}>{paymentStatus.replace(/_/g, " ")}</span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${badgeClass(approvalStatus)}`}>{approvalStatus.replace(/_/g, " ")}</span>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-4">
          <StatusCard icon={CheckCircle2} label="Campaign Requested" value="Received" />
          <StatusCard icon={Clock3} label="Review In Progress" value={statusLabel(stage)} />
          <StatusCard icon={CreditCard} label="Payment Status" value={paymentStatus.replace(/_/g, " ")} />
          <StatusCard icon={Gauge} label="Readiness" value={`${Number(readiness?.readiness_score ?? 0)}%`} />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-6 text-slate-950">
          <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <h2 className="text-xl font-black">Next steps</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                {readiness?.recommended_next_action ?? campaign?.next_best_action ?? pipeline?.next_action ?? "HomeReach will review your target area, assets, offer, and payment path."}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Management fee" value={`${formatUsd(Number(campaign?.monthly_management_fee ?? lead.monthly_management_fee ?? 0))}/month`} />
                <Info label="Ad budget" value={`${formatUsd(Number(campaign?.monthly_ad_budget ?? lead.monthly_ad_budget ?? 0))}/month separate`} />
                <Info label="Creative status" value={creativeStatus.replace(/_/g, " ")} />
                <Info label="Direct mail" value={String(campaign?.direct_mail_status ?? (lead.postcard_addon ? "requested" : "not requested")).replace(/_/g, " ")} />
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2">
                <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
                <h2 className="text-lg font-black">Target area summary</h2>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{campaign?.target_geography ?? lead.target_area}</p>
              <div className="mt-3 grid gap-2">
                {(locationsRes.data ?? []).map((location: any) => (
                  <div key={location.id} className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
                    <p className="font-black">{location.name}</p>
                    <p className="text-slate-500">{String(location.location_type).replace(/_/g, " ")} / radius {location.radius_miles ?? "-"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {portalEnabled ? (
          <section className="grid gap-4 lg:grid-cols-3">
            <ClientPanel title="Approvals" icon={CheckCircle2}>
              <div className="grid gap-2">
                {(approvalsRes.data ?? []).map((approval: any) => (
                  <div key={approval.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                    <p className="font-black text-slate-950">{String(approval.approval_type).replace(/_/g, " ")}</p>
                    <p className="mt-1 text-slate-500">{String(approval.status).replace(/_/g, " ")}</p>
                  </div>
                ))}
              </div>
              <form action="/api/market-capture/client-action" method="post" className="mt-4 grid gap-2">
                <input type="hidden" name="token" value={token} />
                <textarea name="notes" rows={3} placeholder="Optional approval notes..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <div className="grid gap-2 sm:grid-cols-3">
                  <button name="action" value="approve" className="min-h-10 rounded-lg bg-emerald-700 px-3 text-sm font-black text-white">Approve</button>
                  <button name="action" value="request_changes" className="min-h-10 rounded-lg bg-amber-600 px-3 text-sm font-black text-white">Request Changes</button>
                  <button name="action" value="reject" className="min-h-10 rounded-lg bg-red-700 px-3 text-sm font-black text-white">Reject</button>
                </div>
              </form>
            </ClientPanel>

            <ClientPanel title="Uploaded assets" icon={FileImage}>
              <div className="grid gap-2">
                {(assetsRes.data ?? []).length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-200 p-3 text-sm text-slate-500">No assets uploaded yet.</p>
                ) : (
                  (assetsRes.data ?? []).map((asset: any) => (
                    <div key={asset.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                      <p className="font-black text-slate-950">{asset.file_name ?? asset.asset_type}</p>
                      <p className="mt-1 text-slate-500">{asset.asset_type} / {asset.approval_status}</p>
                    </div>
                  ))
                )}
              </div>
              <form action="/api/market-capture/client-action" method="post" encType="multipart/form-data" className="mt-4 grid gap-2">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="action" value="upload_asset" />
                <select name="assetType" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  <option value="logo">Logo</option>
                  <option value="image">Image</option>
                  <option value="postcard">Postcard</option>
                  <option value="landing_page_asset">Landing Page Asset</option>
                  <option value="offer_asset">Offer Asset</option>
                </select>
                <input name="asset" type="file" accept="image/png,image/jpeg,image/webp,application/pdf" multiple className="text-sm" />
                <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-blue-700 px-3 text-sm font-black text-white">
                  <Upload className="h-4 w-4" aria-hidden="true" />
                  Upload Asset
                </button>
              </form>
            </ClientPanel>

            <ClientPanel title="Messages" icon={MessageSquareText}>
              <form action="/api/market-capture/client-action" method="post" className="grid gap-2">
                <input type="hidden" name="token" value={token} />
                <input type="hidden" name="action" value="question" />
                <textarea name="content" rows={5} placeholder="Ask a question or send an update..." className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                <button className="min-h-10 rounded-lg bg-slate-950 px-3 text-sm font-black text-white">Send Message</button>
              </form>
            </ClientPanel>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
          <ClientPanel title="Timeline" icon={Clock3}>
            <div className="grid gap-2">
              {(notesRes.data ?? []).map((note: any) => (
                <div key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="leading-6 text-slate-700">{note.content}</p>
                  <p className="mt-1 text-xs text-slate-400">{fmtDate(note.created_at)}</p>
                </div>
              ))}
              {(notesRes.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Timeline updates will appear here.</p> : null}
            </div>
          </ClientPanel>

          <ClientPanel title="Reports" icon={Gauge}>
            <div className="grid gap-2">
              {(reportsRes.data ?? []).map((report: any) => (
                <div key={report.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-black text-slate-950">{fmtDate(report.reporting_period_start)} - {fmtDate(report.reporting_period_end)}</p>
                  <p className="mt-1 text-slate-600">
                    {report.impressions} impressions / {report.clicks} clicks / {formatUsd(Number(report.spend ?? 0))} spend
                  </p>
                  <p className="mt-2 leading-6 text-slate-600">{report.recommendations || report.notes || "No recommendations entered yet."}</p>
                </div>
              ))}
              {(reportsRes.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Manual report metrics will appear once HomeReach enters them.</p> : null}
            </div>
          </ClientPanel>
        </section>

        <section className="rounded-lg border border-white/10 bg-white/[0.08] p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="mailto:jason@home-reach.com?subject=Market%20Capture%20Support" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
              <MessageSquareText className="h-4 w-4" aria-hidden="true" />
              Support
            </Link>
            <Link href="mailto:jason@home-reach.com?subject=Market%20Capture%20Assets" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-black text-white hover:bg-white/10">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Email Assets
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.08] p-4">
      <Icon className="h-5 w-5 text-cyan-200" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-950">{value}</p>
    </div>
  );
}

function ClientPanel({ title, icon: Icon, children }: { title: string; icon: typeof CheckCircle2; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 text-slate-950">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
        <h2 className="text-lg font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}
