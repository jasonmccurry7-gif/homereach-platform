import type { Metadata } from "next";
import {
  BadgeDollarSign,
  CheckCircle2,
  ClipboardList,
  DollarSign,
  Gauge,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { AiCooActions } from "@/components/ai-coo/ai-coo-actions";
import { formatUsdCents, hasAiCooPersistence, isAiCooAdminQueueEnabled } from "@/lib/ai-coo/config";
import { loadAdminAiCooQueue, type AiCooCategory, type AiCooRecommendationRow } from "@/lib/ai-coo/recommendations";
import { createServiceClient } from "@/lib/supabase/service";
import { AiCooGenerateButton } from "./ai-coo-queue-actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "AI COO Queue | HomeReach Admin" };

const CATEGORY_LABELS: Record<AiCooCategory, string> = {
  revenue: "Revenue",
  cost_savings: "Cost Savings",
  reputation: "Reputation",
  growth: "Growth",
  risk: "Risk",
  renewal: "Renewal",
  upsell: "Upsell",
};

const CATEGORY_CLASS: Record<AiCooCategory, string> = {
  revenue: "bg-emerald-100 text-emerald-800",
  cost_savings: "bg-teal-100 text-teal-800",
  reputation: "bg-violet-100 text-violet-800",
  growth: "bg-blue-100 text-blue-800",
  risk: "bg-amber-100 text-amber-900",
  renewal: "bg-indigo-100 text-indigo-800",
  upsell: "bg-sky-100 text-sky-800",
};

function statusClass(status: string) {
  if (["approved", "in_progress", "completed"].includes(status)) return "bg-emerald-100 text-emerald-800";
  if (["reviewed", "new"].includes(status)) return "bg-blue-100 text-blue-800";
  if (status === "dismissed") return "bg-slate-100 text-slate-600";
  if (status === "expired") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-700";
}

function impact(row: AiCooRecommendationRow) {
  if (row.estimated_value_cents > 0) return formatUsdCents(row.estimated_value_cents);
  if (row.estimated_savings_cents > 0) return formatUsdCents(row.estimated_savings_cents);
  return row.estimated_impact_label ?? "-";
}

function withAdminActions(row: AiCooRecommendationRow): AiCooRecommendationRow {
  const base = row.action_labels ?? [];
  const campaignActions = ["revenue", "growth", "renewal", "upsell"].includes(row.category)
    ? ["Create Campaign", "Create Proposal"]
    : ["Create Proposal"];
  const labels = ["Approve", ...campaignActions, "Assign Task", ...base, "Dismiss"];
  return {
    ...row,
    action_labels: Array.from(new Set(labels)),
  };
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function AiCooQueuePage() {
  if (!isAiCooAdminQueueEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        AI COO Queue is disabled. Set ENABLE_AI_COO=true and ENABLE_AI_COO_ADMIN_QUEUE=true or omit the flags to activate this surface.
      </div>
    );
  }

  if (!hasAiCooPersistence()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        AI COO Queue is in safe mode because Supabase service persistence is not configured.
      </div>
    );
  }

  const data = await loadAdminAiCooQueue({ supabase: createServiceClient() });
  const activeRows = data.recommendations.filter((row) => row.status !== "dismissed" && row.status !== "expired");
  const riskRows = activeRows.filter((row) => row.category === "risk").slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">AI COO Queue</p>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Opportunities Found Today</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Review revenue, savings, reputation, growth, renewal, upsell, and risk recommendations across clients. Every action is approval-gated and advisory.
            </p>
          </div>
          <AiCooGenerateButton />
        </div>
      </header>

      {data.safeMode ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          AI COO Queue safe mode: {data.message ?? "recommendations are unavailable."}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric icon={TrendingUp} label="Revenue Found" value={String(data.metrics.revenueFound)} detail={formatUsdCents(data.metrics.estimatedRevenueValueCents)} />
        <Metric icon={CheckCircle2} label="Revenue Approved" value={String(data.metrics.revenueApproved)} detail={`${data.metrics.revenueCompleted} completed`} />
        <Metric icon={BadgeDollarSign} label="Savings Found" value={String(data.metrics.costSavingsFound)} detail={formatUsdCents(data.metrics.estimatedSavingsCents)} />
        <Metric icon={Sparkles} label="Reputation/Growth" value={String(data.metrics.reputationOpportunities + data.metrics.growthOpportunities)} detail={`${data.metrics.growthOpportunities} growth`} />
        <Metric icon={Gauge} label="Acceptance Rate" value={`${data.metrics.acceptanceRate}%`} detail={`${data.metrics.dismissedOpportunities} dismissed`} />
      </section>

      {riskRows.length > 0 ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-amber-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-amber-950">Highest Risk Alerts</h2>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {riskRows.map((row) => (
              <div key={row.id} className="rounded-lg border border-amber-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-900">Priority {row.priority_score}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-700">{row.risk_level ?? "medium"} risk</span>
                </div>
                <h3 className="mt-2 font-black text-slate-950">{row.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{row.recommended_action}</p>
                <div className="mt-3">
                  <AiCooActions recommendation={withAdminActions(row)} drafts={data.draftsByRecommendation[row.id] ?? []} compact />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-lg font-black text-slate-950">Recommendation Queue</h2>
          </div>
          <p className="mt-1 text-sm text-slate-500">Approve, assign, propose, copy drafts, or dismiss. No paid ads, outreach, payment, or vendor action happens automatically.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {activeRows.length === 0 ? (
            <div className="p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-950">No recommendations yet</h3>
              <p className="mt-1 text-sm text-slate-500">Run generation to create advisory AI COO recommendations from Market Capture and Operations Copilot records.</p>
            </div>
          ) : (
            activeRows.map((row) => (
              <article key={row.id} className="p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_24rem]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${CATEGORY_CLASS[row.category]}`}>
                        {CATEGORY_LABELS[row.category]}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass(row.status)}`}>
                        {row.status.replace(/_/g, " ")}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                        Priority {row.priority_score}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                        Confidence {row.confidence_score}%
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-black leading-snug text-slate-950">{row.title}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      {row.business_name ?? "Unknown business"} / {row.client_name ?? row.client_email ?? "client pending"} / updated {fmtDate(row.updated_at)}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{row.why_it_matters}</p>
                    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recommended Action</p>
                      <p className="mt-1 text-sm font-black leading-5 text-slate-900">{row.recommended_action}</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-2">
                      <Mini label="Impact" value={impact(row)} />
                      <Mini label="Type" value={row.opportunity_type.replace(/_/g, " ")} />
                    </div>
                    <div className="mt-4">
                      <AiCooActions recommendation={withAdminActions(row)} drafts={data.draftsByRecommendation[row.id] ?? []} />
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof DollarSign; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
