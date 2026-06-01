import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Brain, CheckCircle2, Gauge, Lightbulb, MapPin, TrendingUp } from "lucide-react";
import { BusinessMemorySyncButton } from "@/components/business-memory/business-memory-sync-button";
import { formatUsdCents, isBusinessMemoryClientViewEnabled } from "@/lib/business-memory/config";
import { loadClientBusinessMemory } from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Memory | HomeReach" };

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function label(value: string | null | undefined) {
  return value ? value.replace(/_/g, " ") : "-";
}

export default async function ClientBusinessMemoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!isBusinessMemoryClientViewEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory is not enabled for client view yet.
      </div>
    );
  }

  const data = await loadClientBusinessMemory({
    supabase: createServiceClient(),
    user: { id: user.id, email: user.email },
  });

  if (data.safeMode) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory is in safe mode: {data.message ?? "memory is unavailable."}
      </div>
    );
  }

  if (!data.profile) {
    return (
      <div className="max-w-5xl space-y-6">
        <header className="rounded-lg border border-blue-100 bg-blue-700 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-100">Business Memory</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">Your business memory starts here.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
            HomeReach will remember campaigns, target areas, offers, savings, and recommendations as work happens.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <BusinessMemorySyncButton endpoint="/api/business-memory/sync" label="Check For Memory" />
            <Link href="/market-capture" className="inline-flex min-h-11 items-center justify-center rounded-lg bg-white px-4 py-2 text-sm font-black text-blue-700 hover:bg-blue-50">
              Start Market Capture
            </Link>
          </div>
        </header>
      </div>
    );
  }

  const score = data.score?.memory_completeness_score ?? 0;
  const wins = [
    data.insights.find((row) => row.insight_type === "most_active_geography"),
    data.insights.find((row) => row.insight_type === "most_successful_campaign"),
    data.insights.find((row) => row.insight_type === "highest_savings_category"),
  ].filter(Boolean);

  return (
    <div className="max-w-5xl space-y-6">
      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Business Memory</p>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">{data.profile.business_name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              HomeReach remembers what has happened so future recommendations become clearer, faster, and more useful.
            </p>
          </div>
          <BusinessMemorySyncButton endpoint="/api/business-memory/sync" label="Refresh Memory" />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Gauge} label="Memory Score" value={`${score}%`} detail="Completeness" />
        <Metric icon={TrendingUp} label="Campaigns" value={String(data.campaigns.length)} detail="History saved" />
        <Metric icon={MapPin} label="Target Areas" value={String(data.geographies.length)} detail="Areas remembered" />
        <Metric icon={Lightbulb} label="Insights" value={String(data.insights.length)} detail="Patterns found" />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Panel title="Business Snapshot">
          <Definition label="Industry" value={data.profile.industry ?? "Pending"} />
          <Definition label="Markets" value={(data.profile.markets_served ?? []).slice(0, 4).join(", ") || "Building from your campaign history"} />
          <Definition label="Preferred Campaigns" value={(data.profile.preferred_campaign_types ?? []).map(label).join(", ") || "Learning from your approvals"} />
          <Definition label="Offers" value={(data.profile.preferred_offers ?? []).slice(0, 3).join(" / ") || "No offer history yet"} />
        </Panel>

        <Panel title="Recent Wins">
          {wins.length === 0 ? (
            <Empty text="Wins will appear as campaigns, savings, reviews, and recommendations build history." />
          ) : (
            <div className="space-y-3">
              {wins.map((win) => (
                <div key={win!.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    <p className="text-sm font-black text-slate-950">{win!.title}</p>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-blue-700">{win!.value_text ?? (win!.value_cents ? formatUsdCents(win!.value_cents) : "Progress saved")}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Panel title="Campaign History">
          {data.campaigns.length === 0 ? <Empty text="No campaign history remembered yet." /> : (
            <div className="space-y-3">
              {data.campaigns.slice(0, 5).map((campaign) => (
                <div key={campaign.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">{campaign.campaign_name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label(campaign.status)} / {formatUsdCents(campaign.budget_cents ?? 0)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recent Opportunities">
          {data.opportunities.length === 0 ? <Empty text="No opportunities remembered yet." /> : (
            <div className="space-y-3">
              {data.opportunities.slice(0, 5).map((opportunity) => (
                <div key={opportunity.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">{label(opportunity.opportunity_type)}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">{label(opportunity.opportunity_status)} / {fmtDate(opportunity.date_created)}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <Panel title="Next Steps">
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/dashboard" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-900 transition hover:bg-blue-50 hover:text-blue-700">
            Review opportunities
          </Link>
          <Link href="/campaign" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-900 transition hover:bg-blue-50 hover:text-blue-700">
            View campaigns
          </Link>
          <Link href="/replies" className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-black text-slate-900 transition hover:bg-blue-50 hover:text-blue-700">
            Message support
          </Link>
        </div>
      </Panel>
    </div>
  );
}

function Metric({ icon: Icon, label, value, detail }: { icon: typeof Brain; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <Icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
      <p className="mt-1 text-xs font-semibold text-slate-500">{detail}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-lg font-black text-slate-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Definition({ label: labelText, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-slate-100 py-2 last:border-0">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">{labelText}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-500">{text}</p>;
}
