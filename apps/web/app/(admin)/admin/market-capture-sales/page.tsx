import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CircleDollarSign, CreditCard, Megaphone, Target, Trophy, UsersRound, XCircle } from "lucide-react";
import { MARKET_CAPTURE_STAGE_LABELS, MARKET_CAPTURE_PIPELINE_STAGES, badgeClass } from "@/lib/market-capture/campaign";
import {
  MARKET_CAPTURE_MANAGEMENT_FEE_CENTS,
  formatUsd,
  isMarketCaptureSalesDashboardEnabled,
} from "@/lib/market-capture/config";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Market Capture Sales | HomeReach Admin" };

type LeadRow = {
  id: string;
  business_name: string;
  contact_name: string;
  email: string;
  phone: string;
  industry: string;
  monthly_ad_budget: number | null;
  payment_status: string;
  created_at: string;
};

type PipelineRow = {
  id: string;
  market_capture_lead_id: string;
  stage: string;
  owner: string;
  status: string;
  estimated_mrr_cents: number | null;
  pipeline_value_cents: number | null;
  next_action: string | null;
};

function stageLabel(stage: string) {
  return MARKET_CAPTURE_STAGE_LABELS[stage] ?? stage.replace(/_/g, " ");
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MarketCaptureSalesPage() {
  if (!isMarketCaptureSalesDashboardEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Market Capture Sales is disabled. Set ENABLE_MARKET_CAPTURE_SALES_DASHBOARD=true or omit the flag to activate this surface.
      </div>
    );
  }

  const supabase = createServiceClient();
  const [leadsRes, pipelineRes] = await Promise.all([
    supabase
      .from("market_capture_leads")
      .select("id, business_name, contact_name, email, phone, industry, monthly_ad_budget, payment_status, created_at")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("market_capture_pipeline")
      .select("id, market_capture_lead_id, stage, owner, status, estimated_mrr_cents, pipeline_value_cents, next_action")
      .limit(250),
  ]);

  if (leadsRes.error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-red-800">
        Market Capture tables are not available yet: {leadsRes.error.message}
      </div>
    );
  }

  const leads = (leadsRes.data ?? []) as LeadRow[];
  const pipelineRows = (pipelineRes.data ?? []) as PipelineRow[];
  const pipelineByLead = new Map(pipelineRows.map((row) => [row.market_capture_lead_id, row]));
  const stageCount = (stage: string) => pipelineRows.filter((row) => row.stage === stage).length;
  const openPipeline = pipelineRows.filter((row) => !["closed_won", "closed_lost"].includes(row.stage));
  const closedWon = pipelineRows.filter((row) => row.stage === "closed_won");
  const metrics = [
    { label: "New Leads", value: String(stageCount("new_lead") + stageCount("intake_complete") + stageCount("needs_review")), icon: UsersRound },
    { label: "Qualified Leads", value: String(stageCount("qualified") + stageCount("ready_for_fulfillment")), icon: Target },
    { label: "Payment Pending", value: String(stageCount("payment_pending")), icon: CreditCard },
    { label: "Closed Won", value: String(stageCount("closed_won")), icon: Trophy },
    { label: "Closed Lost", value: String(stageCount("closed_lost")), icon: XCircle },
    {
      label: "Pipeline Value",
      value: formatUsd(openPipeline.reduce((sum, row) => sum + Number(row.pipeline_value_cents ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS), 0)),
      icon: CircleDollarSign,
    },
    {
      label: "MRR Potential",
      value: formatUsd(openPipeline.reduce((sum, row) => sum + Number(row.estimated_mrr_cents ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS), 0)),
      icon: Megaphone,
    },
    {
      label: "MRR Closed",
      value: formatUsd(closedWon.reduce((sum, row) => sum + Number(row.estimated_mrr_cents ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS), 0)),
      icon: Trophy,
    },
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Revenue Engine Phase 1A</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">Market Capture Sales</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Sales acquisition, intake, qualification, payment readiness, and pipeline handoff. Fulfillment systems are intentionally out of scope.
            </p>
          </div>
          <Link href="/market-capture" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
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

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">Pipeline</h2>
            <p className="text-sm text-slate-500">Phase 1A stages from intake to fulfillment handoff.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
            {leads.length} opportunities
          </span>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-4 xl:grid-cols-8">
          {MARKET_CAPTURE_PIPELINE_STAGES.map((stage) => (
            <div key={stage} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-black uppercase tracking-[0.1em] text-slate-500">{stageLabel(stage)}</p>
              <p className="mt-2 text-xl font-black text-slate-950">{stageCount(stage)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-black text-slate-950">Sales Opportunities</h2>
          <p className="text-sm text-slate-500">Open a record to review intake, payment status, tasks, notes, and sales drafts.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {leads.length === 0 ? (
            <div className="p-8 text-center">
              <Target className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-950">No Market Capture leads yet</h3>
              <p className="mt-1 text-sm text-slate-500">New intake submissions will appear here.</p>
            </div>
          ) : (
            leads.map((lead) => {
              const pipeline = pipelineByLead.get(lead.id);
              const stage = pipeline?.stage ?? "intake_complete";
              return (
                <Link key={lead.id} href={`/admin/market-capture-sales/${lead.id}`} className="block p-4 transition hover:bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">{lead.business_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(stage)}`}>
                          {stageLabel(stage)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(lead.payment_status)}`}>
                          {lead.payment_status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-500">
                        {lead.contact_name} · {lead.email} · {lead.industry}
                      </p>
                    </div>
                    <div className="grid gap-2 text-sm sm:grid-cols-3 lg:min-w-[32rem]">
                      <Info label="Ad budget" value={formatUsd(Number(lead.monthly_ad_budget ?? 0))} />
                      <Info label="Next action" value={pipeline?.next_action ?? "Review intake"} />
                      <Info label="Created" value={fmtDate(lead.created_at)} />
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
