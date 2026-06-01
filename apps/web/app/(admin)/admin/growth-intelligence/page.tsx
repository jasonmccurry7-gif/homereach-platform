import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  BadgeDollarSign,
  CalendarClock,
  Compass,
  FileText,
  MapPinned,
  Radar,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { AdminIntelligenceEntryForm } from "@/components/growth-intelligence/admin-intelligence-entry-form";
import { GrowthIntelligenceActions } from "@/components/growth-intelligence/growth-intelligence-actions";
import { GrowthIntelligenceSyncButton } from "@/components/growth-intelligence/growth-intelligence-sync-button";
import { formatGrowthMoney, hasGrowthIntelligencePersistence, isGrowthIntelligenceEnabled } from "@/lib/growth-intelligence/config";
import { loadAdminGrowthIntelligenceCenter } from "@/lib/growth-intelligence/engine";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Growth Intelligence Center - HomeReach Admin",
};

export default async function AdminGrowthIntelligencePage() {
  if (!isGrowthIntelligenceEnabled()) {
    return <SafeMode title="Growth Intelligence is off" body="This module is disabled by feature flag." />;
  }

  if (!hasGrowthIntelligencePersistence()) {
    return <SafeMode title="Growth Intelligence safe mode" body="Database persistence is not configured, so the center is intentionally offline." />;
  }

  const data = await loadAdminGrowthIntelligenceCenter({
    supabase: createServiceClient(),
  });
  const active = data.opportunities.filter((row) => !["dismissed", "expired"].includes(row.status));
  const topOpportunities = active.slice(0, 12);
  const pipeline = buildPipeline(data.opportunities);
  const categories = topCategoryRows(data.opportunities);

  return (
    <main className="space-y-6 pb-20">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">
              Growth Intelligence Engine
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
              Growth Intelligence Center
            </h1>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              Admin operating view for new neighborhoods, competitor areas, seasonal timing, local events, political geography, direct mail and digital bundles, and dormant market reactivation. This is advisory intelligence only.
            </p>
          </div>
          <GrowthIntelligenceSyncButton />
        </div>
      </section>

      {data.safeMode ? <SafeMode title="Growth Intelligence safe mode" body={data.message ?? "Growth opportunities are unavailable."} /> : null}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={Sparkles} label="Total Opportunities" value={String(data.metrics.totalOpportunities)} detail={`${data.metrics.highPriority} high priority`} />
        <Metric icon={BadgeDollarSign} label="Revenue Potential" value={formatGrowthMoney(data.metrics.estimatedRevenuePotentialCents)} detail="Advisory estimate only" />
        <Metric icon={Target} label="Client Matches" value={String(data.metrics.clientMatches)} detail="From local intelligence" />
        <Metric icon={FileText} label="Campaign Conversions" value={String(data.metrics.convertedToCampaigns)} detail={`${data.metrics.approved} approved`} />
        <Metric icon={Radar} label="Admin Entries" value={String(data.metrics.adminEntries)} detail={`Top category: ${data.metrics.topCategory}`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Growth Pipeline</h2>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
            {pipeline.map((stage) => (
              <div key={stage.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">{stage.label}</p>
                <p className="mt-2 text-2xl font-black text-slate-950">{stage.count}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{stage.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-700" aria-hidden="true" />
            <h2 className="text-xl font-black text-slate-950">Opportunity Mix</h2>
          </div>
          <div className="mt-4 grid gap-2">
            {categories.map((category) => (
              <div key={category.category} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <span className="text-sm font-black text-slate-700">{category.category}</span>
                <span className="text-sm font-black text-slate-950">{category.count}</span>
              </div>
            ))}
            {categories.length === 0 ? <p className="text-sm text-slate-500">No category data yet.</p> : null}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <MapPinned className="h-5 w-5 text-blue-700" aria-hidden="true" />
          <h2 className="text-xl font-black text-slate-950">Add Local Intelligence</h2>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Add local observations, events, competitors, neighborhoods, developments, seasonal notes, and political geography. The engine matches them to clients; it does not scrape or auto-message anyone.
        </p>
        <div className="mt-4">
          <AdminIntelligenceEntryForm />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h2 className="text-xl font-black text-slate-950">Growth Opportunities</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Review, launch workflow, create campaign task, create proposal, assign, or dismiss. No campaign is launched automatically.
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {topOpportunities.length > 0 ? (
              topOpportunities.map((opportunity) => (
                <article key={opportunity.id} className="p-5">
                  <div className="grid gap-4 lg:grid-cols-[1fr_21rem]">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Badge>{opportunity.category}</Badge>
                        <Badge>{opportunity.status.replaceAll("_", " ")}</Badge>
                        <Badge>{opportunity.priority_label}</Badge>
                        <Badge>Score {opportunity.growth_score}</Badge>
                      </div>
                      <h3 className="mt-3 text-lg font-black text-slate-950">{opportunity.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{opportunity.why_it_matters}</p>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <Mini label="Recommended Action" value={opportunity.recommended_action} />
                        <Mini label="Campaign Type" value={opportunity.recommended_campaign_type.replaceAll("_", " ")} />
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">Potential</p>
                      <p className="mt-1 text-xl font-black text-slate-950">{formatGrowthMoney(opportunity.estimated_revenue_potential_cents)}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">Confidence {opportunity.confidence_score}%. {opportunity.client_fit_summary ?? "Client fit needs review."}</p>
                      <div className="mt-4">
                        <GrowthIntelligenceActions opportunity={opportunity} drafts={data.draftsByOpportunity[opportunity.id] ?? []} compact />
                      </div>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-6 text-sm text-slate-500">No growth opportunities yet. Sync intelligence or add a local observation.</div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-slate-950">Recent Intelligence</h2>
            <div className="mt-4 space-y-3">
              {data.adminEntries.slice(0, 8).map((entry) => (
                <div key={entry.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{entry.entry_type.replaceAll("_", " ")}</p>
                  <p className="mt-2 text-sm font-black text-slate-950">{entry.name}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{entry.location ?? "No location"} / priority {entry.priority}</p>
                </div>
              ))}
              {data.adminEntries.length === 0 ? <p className="text-sm text-slate-500">No admin-entered intelligence yet.</p> : null}
            </div>
          </section>

          <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-blue-950 shadow-sm">
            <h2 className="text-lg font-black">Growth Report</h2>
            <p className="mt-2 text-sm font-semibold leading-6">
              {data.report
                ? `${data.report.opportunities_found} opportunities found, ${data.report.opportunities_approved} approved, and ${data.report.opportunities_converted} converted this period.`
                : "Report will generate after opportunities exist."}
            </p>
            <p className="mt-3 text-xs font-bold text-blue-800">
              Growth Intelligence is an advisory layer. It does not scrape private sources, infer sensitive traits, or auto-launch campaigns.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <h2 className="text-lg font-black text-slate-950">Next Actions</h2>
            </div>
            <div className="mt-3 space-y-2">
              {topOpportunities.slice(0, 3).map((opportunity) => (
                <p key={opportunity.id} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-5 text-slate-700">
                  {opportunity.next_action ?? opportunity.recommended_action}
                </p>
              ))}
              {topOpportunities.length === 0 ? <p className="text-sm text-slate-500">No next action yet.</p> : null}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function buildPipeline(rows: Array<{ status: string; priority_label: string }>) {
  const stages = [
    ["new_opportunity", "New"],
    ["needs_review", "Review"],
    ["recommended_to_client", "Recommended"],
    ["client_approved", "Approved"],
    ["campaign_created", "Campaign"],
    ["in_progress", "In Progress"],
    ["completed", "Completed"],
    ["dismissed", "Dismissed"],
    ["expired", "Expired"],
  ];
  return stages.map(([status, label]) => {
    const matching = rows.filter((row) => row.status === status);
    return {
      label,
      count: matching.length,
      detail: `${matching.filter((row) => row.priority_label === "high").length} high`,
    };
  });
}

function topCategoryRows(rows: Array<{ category: string }>) {
  const map = new Map<string, number>();
  for (const row of rows) map.set(row.category, (map.get(row.category) ?? 0) + 1);
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([category, count]) => ({ category, count }));
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
