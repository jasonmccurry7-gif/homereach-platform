import type { LucideIcon } from "lucide-react";
import { AlertTriangle, HeartHandshake, MessageSquareText, Quote, ShieldCheck, Sparkles, Users } from "lucide-react";
import { ReputationActions } from "@/components/reputation/reputation-actions";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import { formatReputationMoney, hasReputationPersistence, isReputationQueueEnabled } from "@/lib/reputation/config";
import { loadAdminReputationQueue } from "@/lib/reputation/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reputation Queue - HomeReach Admin",
};

export default async function AdminReputationPage() {
  if (!isReputationQueueEnabled()) {
    return <SafeMode title="Reputation Queue is off" body="This module is disabled by feature flag." />;
  }

  if (!hasReputationPersistence()) {
    return <SafeMode title="Reputation safe mode" body="Database persistence is not configured, so the queue is intentionally offline." />;
  }

  const data = await loadAdminReputationQueue({
    supabase: createServiceClient(),
  });

  const topOpportunities = data.opportunities.slice(0, 12);
  const pipeline = buildPipeline(data.opportunities);

  return (
    <main className="space-y-6 pb-20">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-600">
              Reputation Engine
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              Reputation Queue
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Admin operating view for review opportunities, referral follow-up, testimonial capture, and reputation reporting. Drafts stay approval-led and no outreach is sent from this queue.
            </p>
          </div>
          <ReputationSyncButton />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Reputation safe mode" body={data.message ?? "Reputation queue is unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={MessageSquareText} label="Review Opportunities" value={String(data.metrics.reviewOpportunities)} detail="Review actions found" />
        <Metric icon={HeartHandshake} label="Referral Opportunities" value={String(data.metrics.referralOpportunities)} detail="Referral actions found" />
        <Metric icon={Quote} label="Testimonials" value={String(data.metrics.testimonialsCollected)} detail="Proof assets tracked" />
        <Metric icon={ShieldCheck} label="Reputation Score" value={String(data.score?.score ?? 0)} detail={data.score?.current_status.replaceAll("_", " ") ?? "Needs data"} />
        <Metric icon={Users} label="Referral Value" value={formatReputationMoney(data.metrics.potentialReferralValueCents)} detail="Advisory potential only" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-600" aria-hidden="true" />
          <h2 className="text-xl font-black text-slate-950">Reputation Pipeline</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          {pipeline.map((stage) => (
            <div key={stage.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{stage.label}</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{stage.count}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">{stage.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-black text-slate-950">Opportunities</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review, assign, approve, launch, or dismiss. Launch means workflow launch only, never automatic sending.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.opportunity_group}</Badge>
                        <Badge>{opportunity.opportunity_type.replaceAll("_", " ")}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>Priority {opportunity.priority_score}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.reason}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Mini label="Recommended Action" value={opportunity.recommended_action} />
                        <Mini label="Impact" value={opportunity.estimated_impact_label ?? "Trust opportunity"} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Owner</p>
                      <p className="mt-1 text-lg font-black text-slate-950">{opportunity.owner ?? "Unassigned"}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Confidence {opportunity.confidence_score}%. Human approval required before outreach.</p>
                      <div className="mt-4">
                        <ReputationActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-500">No Reputation opportunities yet. Sync from Market Capture and Business Memory.</div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Testimonials</h2>
            <div className="mt-4 space-y-3">
              {data.testimonials.slice(0, 8).map((testimonial) => (
                <div key={testimonial.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{testimonial.status}</p>
                  <p className="mt-2 text-sm font-semibold leading-5 text-slate-700">
                    {testimonial.testimonial_text ?? "Testimonial text pending approval."}
                  </p>
                  <p className="mt-2 text-xs font-bold text-slate-500">{testimonial.customer_name ?? "Customer"} - {testimonial.campaign_source ?? "Reputation Engine"}</p>
                </div>
              ))}
              {data.testimonials.length === 0 ? <p className="text-sm text-slate-500">No testimonials tracked yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950 shadow-sm">
            <h2 className="text-lg font-black">Reputation Report</h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              {data.report
                ? `${data.report.review_opportunities} review opportunities, ${data.report.referral_opportunities} referral opportunities, and ${data.report.testimonials_captured} testimonials tracked this period.`
                : "Report will generate after opportunities exist."}
            </p>
            <p className="mt-3 text-xs font-bold text-violet-800">
              Review and referral drafts require approval and must use transparent customer-friendly language.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

function buildPipeline(rows: Array<{ status: string; opportunity_group: string }>) {
  const stages = [
    ["new_opportunity", "New"],
    ["under_review", "Review"],
    ["assigned", "Assigned"],
    ["approved", "Approved"],
    ["launched", "Launched"],
    ["in_progress", "In Progress"],
    ["dismissed", "Dismissed"],
    ["completed", "Completed"],
  ];
  return stages.map(([status, label]) => {
    const matching = rows.filter((row) => row.status === status);
    return {
      label,
      count: matching.length,
      detail: `${matching.filter((row) => row.opportunity_group === "review").length} review`,
    };
  });
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

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function Badge({ children }: { children: string | number | Array<string | number> }) {
  return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-black capitalize text-slate-600">{children}</span>;
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
