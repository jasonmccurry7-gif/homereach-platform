import type { LucideIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { AlertTriangle, HeartHandshake, MessageSquareText, Quote, ShieldCheck, Sparkles } from "lucide-react";
import { ReputationActions } from "@/components/reputation/reputation-actions";
import { hasReputationPersistence, isReputationEngineEnabled } from "@/lib/reputation/config";
import { loadClientReputationCenter } from "@/lib/reputation/engine";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function ClientReputationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isReputationEngineEnabled()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Reputation Center is off" body="This module is disabled by feature flag." />
      </main>
    );
  }

  if (!hasReputationPersistence()) {
    return (
      <main className="max-w-5xl space-y-6">
        <SafeMode title="Reputation safe mode" body="Reputation opportunities will appear after database persistence is configured." />
      </main>
    );
  }

  const data = await loadClientReputationCenter({
    supabase: createServiceClient(),
    user: { id: user.id, email: user.email },
  });

  const topOpportunities = data.opportunities.slice(0, 6);

  return (
    <main className="max-w-6xl space-y-6 pb-24">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-600">
              Reputation Center
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 md:text-4xl">
              Reputation Opportunities
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              HomeReach helps you turn completed work, customer goodwill, and local trust into clear next actions for reviews, referrals, and testimonials.
            </p>
          </div>
          <ScoreBadge score={data.score?.score ?? 0} color={data.score?.color ?? "yellow"} />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Reputation safe mode" body={data.message ?? "Reputation data is unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={MessageSquareText} label="Review Opportunities" value={String(data.metrics.reviewOpportunities)} detail="Customers to ask for honest feedback" />
        <Metric icon={HeartHandshake} label="Referral Opportunities" value={String(data.metrics.referralOpportunities)} detail="Goodwill to turn into introductions" />
        <Metric icon={Quote} label="Testimonials" value={String(data.metrics.testimonialsCollected)} detail="Customer proof in progress" />
        <Metric icon={ShieldCheck} label="Recent Wins" value={String(data.metrics.recentWins)} detail="Launched or approved reputation actions" />
      </section>

      {data.score ? (
        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-5">
          <MiniScore label="Reviews" value={data.score.review_activity_score} />
          <MiniScore label="Referrals" value={data.score.referral_activity_score} />
          <MiniScore label="Testimonials" value={data.score.testimonial_activity_score} />
          <MiniScore label="Follow-Up" value={data.score.follow_up_activity_score} />
          <div className="rounded-xl border border-slate-200 bg-white p-3 md:col-span-1">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Next Action</p>
            <p className="mt-1 text-sm font-black leading-5 text-slate-950">{data.score.recommended_action}</p>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-violet-600" aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">Recommended Actions</h2>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Approve, launch, or copy drafts when you are ready. Nothing is sent automatically.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.opportunity_group}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>Confidence {opportunity.confidence_score}%</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.reason}</p>
                      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Recommended Action</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{opportunity.recommended_action}</p>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Impact</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{opportunity.estimated_impact_label ?? "Trust opportunity"}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Transparent, customer-friendly language only.</p>
                      <div className="mt-4">
                        <ReputationActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6">
                <h3 className="text-lg font-black text-slate-950">No reputation opportunities yet.</h3>
                <p className="mt-1 text-sm leading-6 text-slate-500">
                  Review, referral, and testimonial actions will appear here after HomeReach has recent customer or campaign context.
                </p>
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Testimonials</h2>
            <div className="mt-4 space-y-3">
              {data.testimonials.slice(0, 5).map((testimonial) => (
                <div key={testimonial.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{testimonial.status}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">
                    {testimonial.testimonial_text ?? "Testimonial text pending approval."}
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-500">{testimonial.customer_name ?? "Customer proof"}</p>
                </div>
              ))}
              {data.testimonials.length === 0 ? <p className="text-sm text-slate-500">No testimonials tracked yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950 shadow-sm">
            <h2 className="text-lg font-black">Reputation Report</h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              {data.report
                ? `${data.report.review_opportunities} review opportunities and ${data.report.referral_opportunities} referral opportunities in the current period.`
                : "Reports will appear after reputation activity is generated."}
            </p>
            <p className="mt-3 text-xs font-bold text-violet-800">
              HomeReach will not create fake reviews, gate review requests, or publish testimonials without approval.
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
        <Icon className="h-5 w-5 text-violet-600" aria-hidden="true" />
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
      <p className="text-[10px] font-black uppercase tracking-[0.14em]">Reputation Score</p>
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
