import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  FileImage,
  Mail,
  Megaphone,
  RadioTower,
  Target,
  UsersRound,
} from "lucide-react";
import { MarketCaptureFulfillmentActions } from "./[campaignId]/market-capture-fulfillment-actions";
import { MARKET_CAPTURE_STAGE_LABELS, badgeClass } from "@/lib/market-capture/campaign";
import { formatUsd, isMarketCaptureFulfillmentEnabled } from "@/lib/market-capture/config";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Capture Fulfillment | HomeReach Admin" };

type CampaignRow = {
  id: string;
  market_capture_lead_id: string;
  campaign_name: string;
  campaign_status: string;
  launch_status: string;
  direct_mail_status: string;
  creative_status: string;
  approval_status: string;
  reporting_status: string;
  monthly_ad_budget: number | null;
  monthly_management_fee: number | null;
  payment_status: string;
  owner: string | null;
  next_best_action: string | null;
  updated_at: string;
};

type LeadRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  industry: string;
  payment_status: string;
};

type ReadinessRow = {
  campaign_id: string;
  readiness_score: number;
  recommended_next_action: string | null;
};

function stageLabel(value: string) {
  return MARKET_CAPTURE_STAGE_LABELS[value] ?? value.replace(/_/g, " ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MarketCaptureFulfillmentPage() {
  if (!isMarketCaptureFulfillmentEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Market Capture Fulfillment is disabled. Set ENABLE_MARKET_CAPTURE_FULFILLMENT=true or omit the flag to activate this surface.
      </div>
    );
  }

  const supabase = createServiceClient();
  const [campaignsRes, leadsRes, readinessRes] = await Promise.all([
    supabase
      .from("market_capture_campaigns")
      .select("id, market_capture_lead_id, campaign_name, campaign_status, launch_status, direct_mail_status, creative_status, approval_status, reporting_status, monthly_ad_budget, monthly_management_fee, payment_status, owner, next_best_action, updated_at")
      .order("updated_at", { ascending: false })
      .limit(250),
    supabase
      .from("market_capture_leads")
      .select("id, business_name, contact_name, email, industry, payment_status")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("market_capture_launch_readiness")
      .select("campaign_id, readiness_score, recommended_next_action")
      .limit(250),
  ]);

  if (campaignsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        Market Capture fulfillment tables are not available yet: {campaignsRes.error.message}
      </div>
    );
  }

  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const leads = (leadsRes.data ?? []) as LeadRow[];
  const leadById = new Map(leads.map((lead) => [lead.id, lead]));
  const readinessByCampaign = new Map((readinessRes.data ?? []).map((row) => [(row as ReadinessRow).campaign_id, row as ReadinessRow]));
  const campaignLeadIds = new Set(campaigns.map((campaign) => campaign.market_capture_lead_id));
  const soldWithoutFulfillment = leads.filter((lead) => lead.payment_status === "paid" && !campaignLeadIds.has(lead.id));
  const activeCampaigns = campaigns.filter((campaign) => !["closed"].includes(campaign.campaign_status));
  const needingReports = campaigns.filter((campaign) => ["due", "scheduled"].includes(campaign.reporting_status) || campaign.campaign_status === "reporting");

  const metrics = [
    { label: "Active Campaigns", value: String(activeCampaigns.length), icon: Target },
    { label: "Awaiting Review", value: String(campaigns.filter((c) => ["ready_for_fulfillment", "campaign_setup"].includes(c.campaign_status)).length), icon: ClipboardList },
    { label: "Awaiting Assets", value: String(campaigns.filter((c) => c.creative_status === "missing").length), icon: FileImage },
    { label: "Awaiting Approval", value: String(campaigns.filter((c) => ["awaiting_approval", "needs_revision"].includes(c.approval_status)).length), icon: CheckCircle2 },
    { label: "Ready For Launch", value: String(campaigns.filter((c) => c.launch_status === "ready" || c.campaign_status === "ready_for_launch").length), icon: RadioTower },
    { label: "Live", value: String(campaigns.filter((c) => c.campaign_status === "live" || c.launch_status === "live").length), icon: Megaphone },
    { label: "Needs Reports", value: String(needingReports.length), icon: ClipboardList },
    { label: "Direct Mail Add-Ons", value: String(campaigns.filter((c) => c.direct_mail_status !== "not_requested").length), icon: Mail },
    {
      label: "Revenue Under Management",
      value: formatUsd(activeCampaigns.reduce((sum, c) => sum + Number(c.monthly_management_fee ?? 0), 0)),
      icon: BadgeDollarSign,
    },
    {
      label: "Est. Ad Spend Managed",
      value: formatUsd(activeCampaigns.reduce((sum, c) => sum + Number(c.monthly_ad_budget ?? 0), 0)),
      icon: UsersRound,
    },
  ];

  const pipelineStages = [
    "ready_for_fulfillment",
    "campaign_setup",
    "asset_collection",
    "creative_review",
    "client_approval",
    "ready_for_launch",
    "live",
    "reporting",
    "renewal_opportunity",
    "closed",
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Revenue Engine Phase 1B</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Market Capture Fulfillment</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Manage setup, assets, approvals, launch readiness, direct mail add-ons, manual reports, and internal team workflow after a Market Capture sale.
            </p>
          </div>
          <Link href="/admin/market-capture-sales" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
            Sales Pipeline
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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

      {soldWithoutFulfillment.length > 0 ? (
        <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-lg font-black text-blue-950">Sold Campaigns Ready For Fulfillment Setup</h2>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {soldWithoutFulfillment.map((lead) => (
              <div key={lead.id} className="rounded-lg border border-blue-200 bg-white p-4">
                <p className="font-black text-slate-950">{lead.business_name}</p>
                <p className="mt-1 text-sm text-slate-500">{lead.contact_name} / {lead.email}</p>
                <div className="mt-3">
                  <MarketCaptureFulfillmentActions mode="init" leadId={lead.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-black text-slate-950">Fulfillment Pipeline</h2>
        <p className="text-sm text-slate-500">Operational stages from setup through live reporting and renewal.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-5 xl:grid-cols-10">
          {pipelineStages.map((stage) => (
            <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{stageLabel(stage)}</p>
              <p className="mt-2 text-xl font-black text-slate-950">{campaigns.filter((campaign) => campaign.campaign_status === stage).length}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-black text-slate-950">Campaigns</h2>
          <p className="text-sm text-slate-500">Open a campaign to manage checklist, assets, approvals, readiness, reports, and team tasks.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {campaigns.length === 0 ? (
            <div className="p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-950">No fulfillment campaigns yet</h3>
              <p className="mt-1 text-sm text-slate-500">Paid Market Capture opportunities will appear here after fulfillment setup.</p>
            </div>
          ) : (
            campaigns.map((campaign) => {
              const lead = leadById.get(campaign.market_capture_lead_id);
              const readiness = readinessByCampaign.get(campaign.id);
              return (
                <Link key={campaign.id} href={`/admin/market-capture-fulfillment/${campaign.id}`} className="block p-4 transition hover:bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">{campaign.campaign_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(campaign.campaign_status)}`}>
                          {stageLabel(campaign.campaign_status)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(campaign.approval_status)}`}>
                          {campaign.approval_status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {lead?.business_name ?? "Unknown business"} / {lead?.industry ?? "Industry pending"} / owner {campaign.owner ?? "jason"}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-4 lg:min-w-[40rem]">
                      <Info label="Readiness" value={`${readiness?.readiness_score ?? 0}%`} />
                      <Info label="Next action" value={readiness?.recommended_next_action ?? campaign.next_best_action ?? "Review campaign"} />
                      <Info label="Ad spend" value={formatUsd(Number(campaign.monthly_ad_budget ?? 0))} />
                      <Info label="Updated" value={fmtDate(campaign.updated_at)} />
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

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 truncate font-black text-slate-900">{value}</p>
    </div>
  );
}
