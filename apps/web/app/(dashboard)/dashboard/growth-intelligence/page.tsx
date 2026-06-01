import type { LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { AlertTriangle, BadgeDollarSign, Compass, MapPinned, Rocket, ShieldCheck, Sparkles, Target } from "lucide-react";
import { GrowthIntelligenceActions } from "@/components/growth-intelligence/growth-intelligence-actions";
import { formatGrowthMoney, hasGrowthIntelligencePersistence, isGrowthIntelligenceEnabled } from "@/lib/growth-intelligence/config";
import { loadClientGrowthIntelligenceCenter } from "@/lib/growth-intelligence/engine";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Growth Opportunities - HomeReach",
};

export default async function ClientGrowthIntelligencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isGrowthIntelligenceEnabled()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Growth Intelligence is off" body="This module is disabled by feature flag." />
      </main>
    );
  }

  if (!hasGrowthIntelligencePersistence()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Growth Intelligence safe mode" body="Growth opportunities will appear after database persistence is configured." />
      </main>
    );
  }

  const data = await loadClientGrowthIntelligenceCenter({
    supabase: createServiceClient(),
    user: { id: user.id, email: user.email },
  });
  const topOpportunities = data.opportunities
    .filter((row) => !["dismissed", "expired"].includes(row.status))
    .slice(0, 3);

  return (
    <main className="max-w-6xl space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">
              Growth Intelligence Center
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
              Growth Opportunities
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              HomeReach looks at your campaigns, business context, local notes, savings, and reputation signals to suggest practical next places to grow.
            </p>
          </div>
          <ScoreBadge score={data.score?.score ?? 0} color={data.score?.color ?? "yellow"} />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Growth Intelligence safe mode" body={data.message ?? "Growth opportunities are unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Sparkles} label="Growth Opportunities" value={String(data.metrics.totalOpportunities)} detail={`${data.metrics.highPriority} high priority`} />
        <Metric icon={BadgeDollarSign} label="Potential" value={formatGrowthMoney(data.metrics.estimatedRevenuePotentialCents)} detail="Advisory estimate only" />
        <Metric icon={Target} label="Top Focus" value={data.metrics.topCategory} detail="Current best category" />
        <Metric icon={ShieldCheck} label="Approved" value={String(data.metrics.approved)} detail={`${data.metrics.convertedToCampaigns} campaign tasks`} />
      </section>

      {data.score ? (
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-4 xl:grid-cols-7">
          <MiniScore label="Revenue" value={data.score.revenue_potential_score} />
          <MiniScore label="Client Fit" value={data.score.client_fit_score} />
          <MiniScore label="Timing" value={data.score.timing_score} />
          <MiniScore label="Geography" value={data.score.geography_fit_score} />
          <MiniScore label="Readiness" value={data.score.campaign_readiness_score} />
          <MiniScore label="Urgency" value={data.score.urgency_score} />
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Next Action</p>
            <p className="mt-1 text-sm font-black leading-5 text-slate-950">{data.score.recommended_action}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">Recommended Growth Moves</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              The top three growth opportunities only. Review, approve, request a campaign, or dismiss.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.category}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>{opportunity.priority_label}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.why_it_matters}</p>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recommended Action</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{opportunity.recommended_action}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Potential</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{formatGrowthMoney(opportunity.estimated_revenue_potential_cents)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Score {opportunity.growth_score}. {opportunity.client_fit_summary ?? "HomeReach will review the fit."}</p>
                      <div className="mt-4">
                        <GrowthIntelligenceActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-black text-slate-950">No growth opportunities yet.</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Opportunities appear as HomeReach learns from your campaigns, local areas, savings, reviews, and business notes.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">Target Summary</h2>
            </div>
            <div className="mt-4 space-y-3">
              {topOpportunities.map((opportunity) => (
                <div key={opportunity.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{opportunity.recommended_campaign_type.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">{opportunity.category}</p>
                </div>
              ))}
              {topOpportunities.length === 0 ? <p className="text-sm text-slate-500">Target summaries will appear with growth opportunities.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 shadow-sm">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-lg font-black">Growth Report</h2>
            </div>
            <p className="mt-2 text-sm font-semibold leading-6">
              {data.report
                ? `${data.report.opportunities_found} opportunities found this period, with ${data.report.opportunities_approved} approved and ${data.report.opportunities_converted} converted.`
                : "Reports will appear after growth opportunities are generated."}
            </p>
            <p className="mt-3 text-xs font-bold text-blue-800">
              These are recommendations, not guarantees. HomeReach will not launch campaigns or outreach without approval.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function Metric({ detail, icon: Icon, label, value }: { detail: string; icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-sm leading-6 text-slate-500">{detail}</p>
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-2 text-xl font-black text-slate-950">{value}%</p>
    </div>
  );
}

function Badge({ children }: { children: string | number | Array<string | number> }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{children}</span>;
}

function ScoreBadge({ color, score }: { color: "green" | "yellow" | "red"; score: number }) {
  const styles = color === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : color === "red" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Growth Score</p>
      <p className="mt-1 text-3xl font-black">{score}</p>
    </div>
  );
}

function SafeMode({ body, title }: { body: string; title: string }) {
  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 shadow-sm">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <div>
          <h1 className="text-lg font-black">{title}</h1>
          <p className="mt-1 text-sm font-semibold leading-6">{body}</p>
        </div>
      </div>
    </section>
  );
}
