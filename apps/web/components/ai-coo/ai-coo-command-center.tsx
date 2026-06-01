import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeDollarSign, CheckCircle2, Gauge, Sparkles, TrendingUp } from "lucide-react";
import { AiCooActions } from "./ai-coo-actions";
import { formatUsdCents, hasAiCooPersistence, isAiCooClientFeedEnabled } from "@/lib/ai-coo/config";
import { loadClientAiCooCommandCenter, type AiCooCategory, type AiCooRecommendationRow } from "@/lib/ai-coo/recommendations";
import { createServiceClient } from "@/lib/supabase/service";

type Props = {
  user: { id: string; email?: string | null };
};

const CATEGORY_STYLES: Record<AiCooCategory, string> = {
  revenue: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  cost_savings: "bg-teal-50 text-teal-700 ring-teal-200",
  reputation: "bg-violet-50 text-violet-700 ring-violet-200",
  growth: "bg-blue-50 text-blue-700 ring-blue-200",
  risk: "bg-amber-50 text-amber-800 ring-amber-200",
  renewal: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  upsell: "bg-sky-50 text-sky-700 ring-sky-200",
};

const CATEGORY_LABELS: Record<AiCooCategory, string> = {
  revenue: "Revenue",
  cost_savings: "Cost Savings",
  reputation: "Reputation",
  growth: "Growth",
  risk: "Risk",
  renewal: "Renewal",
  upsell: "Upsell",
};

function impactLabel(row: AiCooRecommendationRow) {
  if (row.estimated_value_cents > 0) return formatUsdCents(row.estimated_value_cents);
  if (row.estimated_savings_cents > 0) return formatUsdCents(row.estimated_savings_cents);
  return row.estimated_impact_label ?? "Impact";
}

function confidence(row: AiCooRecommendationRow) {
  return `${row.confidence_level} / ${row.confidence_score}%`;
}

export async function AiCooCommandCenter({ user }: Props) {
  if (!isAiCooClientFeedEnabled()) return null;

  if (!hasAiCooPersistence()) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">AI COO safe mode</p>
            <h2 className="mt-2 text-lg font-bold text-amber-950">Recommendations are waiting for database configuration.</h2>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              HomeReach will keep the dashboard stable and show recommendations after Supabase service persistence is available.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const data = await loadClientAiCooCommandCenter({ supabase: createServiceClient(), user });
  if (!data.enabled) return null;

  const recommendations = data.recommendations.slice(0, 5);
  const totalHidden = Math.max(0, data.recommendations.length - recommendations.length);
  const score = data.score;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 bg-slate-950 px-5 py-5 text-white">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-widest text-cyan-100">AI COO Command Center</p>
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Opportunities Found Today</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-300">
              Recommended actions to help grow your business.
            </p>
          </div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:min-w-72">
            <div className="rounded-xl border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">Success Score</p>
              <p className="mt-1 text-3xl font-black tabular-nums">{score?.score ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">Top Items</p>
              <p className="mt-1 text-3xl font-black tabular-nums">{data.recommendations.length}</p>
            </div>
          </div>
        </div>
      </div>

      {data.safeMode ? (
        <div className="border-b border-amber-100 bg-amber-50 px-5 py-3 text-sm font-semibold text-amber-900">
          AI COO is in safe mode: {data.message ?? "recommendations are unavailable."}
        </div>
      ) : null}

      {score ? (
        <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <MiniScore icon={Gauge} label="Campaign Activity" value={score.campaign_activity_score} />
          <MiniScore icon={TrendingUp} label="Opportunity Action" value={score.opportunity_acceptance_score} />
          <MiniScore icon={CheckCircle2} label="Task Completion" value={score.task_completion_score} />
          <MiniScore icon={BadgeDollarSign} label="Reporting Health" value={score.reporting_compliance_score} />
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:col-span-2 lg:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Next Action</p>
            <p className="mt-1 text-sm font-black leading-5 text-slate-900">{score.recommended_next_action}</p>
          </div>
        </div>
      ) : null}

      {recommendations.length === 0 ? (
        <div className="p-6">
          <h3 className="text-lg font-black text-slate-950">No urgent AI COO items right now.</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            New revenue, savings, reputation, growth, and risk recommendations will appear here as HomeReach records more campaign and operations activity.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/market-capture" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white hover:bg-blue-600">
              Start Market Capture
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href="/operations-copilot" className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50">
              Review Savings
            </Link>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {recommendations.map((row) => (
            <article key={row.id} className="p-5">
              <div className="grid gap-4 xl:grid-cols-[1fr_20rem]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ring-1 ${CATEGORY_STYLES[row.category]}`}>
                      {CATEGORY_LABELS[row.category]}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                      Priority {row.priority_score}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-600">
                      Confidence {confidence(row)}
                    </span>
                  </div>
                  <h3 className="mt-3 text-lg font-black leading-snug text-slate-950">{row.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{row.why_it_matters}</p>
                  <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recommended Action</p>
                    <p className="mt-1 text-sm font-black leading-5 text-slate-900">{row.recommended_action}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Estimated Impact</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">{impactLabel(row)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Advisory estimate. Results vary and actions require approval.</p>
                  <div className="mt-4">
                    <AiCooActions recommendation={row} drafts={data.draftsByRecommendation[row.id] ?? []} compact />
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalHidden > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-500">
          {totalHidden} lower-priority recommendation{totalHidden === 1 ? "" : "s"} hidden to keep today focused.
        </div>
      ) : null}
    </section>
  );
}

function MiniScore({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-blue-700" aria-hidden="true" />
        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      </div>
      <p className="mt-2 text-xl font-black text-slate-950">{value}%</p>
    </div>
  );
}
