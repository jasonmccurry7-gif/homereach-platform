import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  CreditCard,
  FileImage,
  MapPinned,
  Megaphone,
  MousePointerClick,
  RadioTower,
  ShieldCheck,
} from "lucide-react";
import { createServiceClient } from "@/lib/supabase/service";
import { DIGITAL_CAMPAIGN_STATUS_LABELS, DIGITAL_PIPELINE_STAGES } from "@/lib/digital-targeting/campaign";
import { formatUsd, isDigitalTargetingEnabled } from "@/lib/digital-targeting/config";
import { getDigitalAdLaunchReadiness } from "@/lib/digital-targeting/ad-platforms";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Digital Targeting - HomeReach Admin" };

type CampaignRow = {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string;
  phone: string | null;
  industry: string | null;
  objective: string;
  targeting_type: string;
  monthly_management_fee: number | null;
  monthly_ad_spend: number | null;
  payment_status: string;
  campaign_status: string;
  direct_mail_addon: boolean;
  landing_page_needed: boolean;
  created_at: string;
};

type TaskRow = {
  id: string;
  campaign_id: string;
  title: string;
  status: string;
};

function statusLabel(status: string) {
  return DIGITAL_CAMPAIGN_STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function badgeClass(status: string) {
  if (["live", "reporting", "paid"].includes(status)) return "bg-emerald-100 text-emerald-700";
  if (["ready_to_launch", "target_area_review", "checkout_created"].includes(status)) return "bg-blue-100 text-blue-700";
  if (["payment_pending", "creative_needed", "ad_spend_needed", "payment_required"].includes(status)) return "bg-amber-100 text-amber-800";
  if (["cancelled", "failed", "refunded"].includes(status)) return "bg-red-100 text-red-700";
  return "bg-slate-100 text-slate-700";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function DigitalTargetingAdminPage() {
  if (!isDigitalTargetingEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Digital Targeting is disabled. Set ENABLE_DIGITAL_TARGETING=true or omit the flag to activate the admin surface.
      </div>
    );
  }

  const supabase = createServiceClient();
  const [campaignsRes, tasksRes] = await Promise.all([
    supabase
      .from("digital_targeting_campaigns")
      .select(
        "id, business_name, contact_name, email, phone, industry, objective, targeting_type, monthly_management_fee, monthly_ad_spend, payment_status, campaign_status, direct_mail_addon, landing_page_needed, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("digital_campaign_tasks").select("id, campaign_id, title, status").limit(2000),
  ]);

  if (campaignsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        Digital Targeting tables are not available yet: {campaignsRes.error.message}
      </div>
    );
  }

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  const readiness = getDigitalAdLaunchReadiness();
  const taskCounts = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    const current = taskCounts.get(task.campaign_id) ?? { total: 0, done: 0 };
    current.total += 1;
    if (task.status === "completed") current.done += 1;
    taskCounts.set(task.campaign_id, current);
  }

  const activeCampaigns = campaigns.filter((row) => !["cancelled"].includes(row.campaign_status));
  const metrics = [
    { label: "Active digital campaigns", value: activeCampaigns.length.toString(), icon: RadioTower },
    { label: "New intake submissions", value: campaigns.filter((row) => row.campaign_status === "intake_complete").length.toString(), icon: Clock3 },
    { label: "Awaiting payment", value: campaigns.filter((row) => row.payment_status !== "paid").length.toString(), icon: CreditCard },
    { label: "Ad spend needed", value: campaigns.filter((row) => !["live", "reporting"].includes(row.campaign_status) && row.campaign_status === "ad_spend_needed").length.toString(), icon: CircleDollarSign },
    { label: "Ready to launch", value: campaigns.filter((row) => row.campaign_status === "ready_to_launch").length.toString(), icon: MousePointerClick },
    { label: "Live", value: campaigns.filter((row) => row.campaign_status === "live").length.toString(), icon: Megaphone },
    {
      label: "Monthly management revenue",
      value: formatUsd(campaigns.filter((row) => row.payment_status === "paid").reduce((sum, row) => sum + Number(row.monthly_management_fee ?? 0), 0)),
      icon: ShieldCheck,
    },
    {
      label: "Client ad spend under management",
      value: formatUsd(activeCampaigns.reduce((sum, row) => sum + Number(row.monthly_ad_spend ?? 0), 0)),
      icon: MapPinned,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Admin language</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Digital Targeting Campaigns</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manual launch mode is the safe default. API launch remains gated by credentials, feature flags, ad spend
              confirmation, creative approval, and admin approval.
            </p>
          </div>
          <Link href="/digital-targeting" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
            Public page
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{metric.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{metric.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-950">Campaign Pipeline</h2>
              <p className="text-sm text-slate-500">Stages match the fulfillment flow from intake to renewal.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
              {campaigns.length} campaigns
            </span>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-5">
            {DIGITAL_PIPELINE_STAGES.map((stage) => {
              const count = campaigns.filter((row) => row.campaign_status === stage).length;
              return (
                <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{statusLabel(stage)}</p>
                  <p className="mt-2 text-xl font-black text-slate-950">{count}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-lg font-black text-slate-950">Launch Mode</h2>
          <div className="mt-4 grid gap-2 text-sm">
            {[
              ["Current mode", readiness.mode === "api_draft" ? "API draft gated" : "Manual launch"],
              ["Manual launch", readiness.manualLaunchEnabled ? "enabled" : "disabled"],
              ["Meta API", readiness.metaReady ? "ready" : "credentials missing"],
              ["Google Ads API", readiness.googleReady ? "ready" : "credentials missing"],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-slate-500">{label}</span>
                <span className="font-black text-slate-900">{value}</span>
              </div>
            ))}
          </div>
          {readiness.blockers.length > 0 ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              {readiness.blockers.join(" ")}
            </p>
          ) : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-black text-slate-950">Campaign Table</h2>
          <p className="text-sm text-slate-500">Open a campaign for locations, checklist, drafts, reporting, and launch controls.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center">
              <FileImage className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-950">No digital targeting campaigns yet</h3>
              <p className="mt-1 text-sm text-slate-500">New intake submissions will appear here.</p>
            </div>
          ) : (
            campaigns.map((campaign) => {
              const counts = taskCounts.get(campaign.id) ?? { total: 0, done: 0 };
              return (
                <Link key={campaign.id} href={`/admin/digital-targeting/${campaign.id}`} className="block p-4 transition hover:bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-slate-950">{campaign.business_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(campaign.campaign_status)}`}>
                          {statusLabel(campaign.campaign_status)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(campaign.payment_status)}`}>
                          {campaign.payment_status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {campaign.industry ?? "Industry needed"} | {campaign.email} | created {fmtDate(campaign.created_at)}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-4 lg:w-[42rem]">
                      <TableStat label="Mgmt" value={formatUsd(Number(campaign.monthly_management_fee ?? 0))} />
                      <TableStat label="Ad spend" value={formatUsd(Number(campaign.monthly_ad_spend ?? 0))} />
                      <TableStat label="Tasks" value={`${counts.done}/${counts.total}`} />
                      <TableStat label="Add-ons" value={[campaign.direct_mail_addon ? "Mail" : null, campaign.landing_page_needed ? "Page" : null].filter(Boolean).join(", ") || "None"} />
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function TableStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-1 truncate font-black text-slate-950">{value}</p>
    </div>
  );
}
