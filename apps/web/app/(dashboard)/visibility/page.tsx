import {
  AlertTriangle,
  ArrowRight,
  Globe2,
  MessageSquareText,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from "lucide-react";
import { getLocalVisibilitySnapshot } from "@/lib/local-visibility/sample-data";

export default function CustomerVisibilityPage() {
  const snapshot = getLocalVisibilitySnapshot();
  const scorecard = snapshot.scorecard;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 pb-24 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-lg bg-slate-950 p-5 text-white shadow-sm lg:p-7">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-200">Local Visibility Command Center</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
                Know how customers see you online and what to fix next.
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-300">
                Review momentum, Google profile health, listings consistency, local SEO opportunities, and reputation
                alerts stay in one simple view.
              </p>
            </div>
            <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-50">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-100">Next best action</p>
              <p className="mt-2 text-lg font-black">Approve review replies</p>
              <p className="mt-1 text-sm leading-6 text-emerald-50/85">Three reviews need responses before the weekly report.</p>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreTile label="Visibility Score" value={scorecard.overallVisibilityScore} icon={Globe2} />
          <ScoreTile label="Trust Score" value={scorecard.trustScore} icon={ShieldCheck} />
          <ScoreTile label="Listings Score" value={scorecard.listingsScore} icon={Search} />
          <ScoreTile label="Review Momentum" value={scorecard.reviewMomentumScore} icon={Star} />
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">AI Executive Assistant</p>
                <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">This week looks fixable.</h2>
              </div>
              <Sparkles className="h-6 w-6 text-blue-600" />
            </div>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              I found {snapshot.metrics.listingIssues} listing items to verify, {snapshot.metrics.unansweredReviews} reviews
              waiting for replies, and {snapshot.metrics.reviewRequestsSent} recent review request opportunities. The highest
              value move is to approve review replies and start a steady request rhythm.
            </p>
            <div className="mt-4 rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">Estimated opportunity</p>
              <p className="mt-2 text-sm font-bold leading-6 text-emerald-950">{scorecard.estimatedRevenueOpportunity}</p>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Action Center</p>
            <div className="mt-4 grid gap-3">
              {snapshot.actions.map((action) => (
                <div key={action.title} className="grid gap-3 rounded-lg border border-slate-100 bg-slate-50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black text-slate-950">{action.title}</p>
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-blue-700">
                        {action.impact}
                      </span>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{action.detail}</p>
                  </div>
                  <button className="inline-flex min-h-10 items-center justify-center rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white transition hover:bg-blue-700">
                    {action.cta}
                    <ArrowRight className="ml-2 h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <Panel title="Review Engine" icon={MessageSquareText}>
            <Stat label="Requests sent" value={snapshot.metrics.reviewRequestsSent.toString()} />
            <Stat label="Reviews generated" value={snapshot.metrics.reviewsGenerated.toString()} />
            <Stat label="Average rating" value={snapshot.metrics.averageRating} />
            <Stat label="Unanswered reviews" value={snapshot.metrics.unansweredReviews.toString()} danger />
          </Panel>
          <Panel title="Listings Health" icon={Search}>
            <Stat label="Listing issues" value={snapshot.metrics.listingIssues.toString()} danger />
            <Stat label="NAP consistency" value="Needs check" />
            <Stat label="Hours" value="Verify" />
            <Stat label="Services" value="Update" />
          </Panel>
          <Panel title="Google Profile" icon={Globe2}>
            <Stat label="Completeness" value={`${scorecard.googleProfileCompleteness}%`} />
            <Stat label="Weekly profile actions" value={snapshot.metrics.weeklyProfileActions.toString()} />
            <Stat label="Posts" value="Draft ready" />
            <Stat label="Photos" value="Add more" />
          </Panel>
        </section>

        <section className="mt-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">Alerts</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {snapshot.alerts.map((alert) => (
              <div key={alert.title} className="flex gap-3 rounded-lg border border-amber-100 bg-amber-50 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-black text-amber-950">{alert.title}</p>
                  <p className="mt-1 text-sm leading-6 text-amber-900">{alert.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function ScoreTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Globe2 }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <p className="mt-4 text-4xl font-black text-slate-950">{value}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-blue-600" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, icon: Icon, children }: { title: string; icon: typeof Globe2; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-black tracking-tight text-slate-950">{title}</h2>
        <Icon className="h-5 w-5 text-blue-700" />
      </div>
      <div className="mt-4 grid gap-2">{children}</div>
    </div>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <span className={danger ? "text-sm font-black text-amber-700" : "text-sm font-black text-slate-950"}>{value}</span>
    </div>
  );
}
