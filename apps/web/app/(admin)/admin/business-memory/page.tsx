import Link from "next/link";
import type { Metadata } from "next";
import { Activity, Brain, ClipboardList, Gauge, Lightbulb, Search, Sparkles, TrendingUp } from "lucide-react";
import { BusinessMemorySyncButton } from "@/components/business-memory/business-memory-sync-button";
import { hasBusinessMemoryPersistence, isBusinessMemoryAdminViewEnabled } from "@/lib/business-memory/config";
import { loadAdminBusinessMemory } from "@/lib/business-memory/memory";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Business Memory | HomeReach Admin" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function scoreClass(score: number) {
  if (score >= 75) return "bg-emerald-100 text-emerald-800";
  if (score >= 45) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

function fmtDate(value: string | null | undefined) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function BusinessMemoryAdminPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = firstParam(params.q);

  if (!isBusinessMemoryAdminViewEnabled()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory admin view is disabled. Set ENABLE_BUSINESS_MEMORY=true and ENABLE_BUSINESS_MEMORY_ADMIN_VIEW=true or omit the flags to activate it.
      </div>
    );
  }

  if (!hasBusinessMemoryPersistence()) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-900">
        Business Memory is in safe mode because Supabase service persistence is not configured.
      </div>
    );
  }

  const data = await loadAdminBusinessMemory({ supabase: createServiceClient(), search: q });

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-white shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-cyan-200" aria-hidden="true" />
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-100">Business Memory</p>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">What HomeReach remembers</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Durable client intelligence from Market Capture, AI COO, campaign history, savings opportunities, geographies, offers, and timeline activity.
            </p>
          </div>
          <BusinessMemorySyncButton endpoint="/api/admin/business-memory/sync" />
        </div>
      </header>

      {data.safeMode ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          Business Memory safe mode: {data.message ?? "memory records are unavailable."}
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Brain} label="Profiles" value={String(data.metrics.profiles)} detail="Clients remembered" />
        <Metric icon={Gauge} label="Avg. Memory Score" value={`${data.metrics.averageScore}%`} detail="Completeness" />
        <Metric icon={Activity} label="Timeline Events" value={String(data.metrics.timelineEvents)} detail="History points" />
        <Metric icon={Lightbulb} label="Insights" value={String(data.metrics.insights)} detail="Patterns found" />
        <Metric icon={TrendingUp} label="Campaigns" value={String(data.metrics.campaignsRemembered)} detail="Campaign memory" />
        <Metric icon={ClipboardList} label="Opportunities" value={String(data.metrics.opportunitiesRemembered)} detail={`${data.metrics.savingsRemembered} savings`} />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-11 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3">
            <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search clients, industries, notes, geographies"
              className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          <button type="submit" className="min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50">
            Search
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <h2 className="text-lg font-black text-slate-950">Memory Profiles</h2>
          <p className="mt-1 text-sm text-slate-500">Open a profile to inspect identity, geography, campaigns, opportunities, savings, AI COO history, timeline, and insights.</p>
        </div>
        <div className="divide-y divide-slate-200">
          {data.profiles.length === 0 ? (
            <div className="p-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-slate-300" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-black text-slate-950">No memory profiles yet</h3>
              <p className="mt-1 text-sm text-slate-500">Sync memory to create profiles from existing Market Capture, AI COO, and Operations records.</p>
            </div>
          ) : (
            data.profiles.map((profile) => {
              const score = data.scoresByProfile[profile.id]?.memory_completeness_score ?? 0;
              return (
                <Link key={profile.id} href={`/admin/business-memory/${profile.id}`} className="block p-4 transition hover:bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-950">{profile.business_name}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${scoreClass(score)}`}>{score}% memory</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold text-slate-500">
                        {profile.industry ?? "Industry pending"} / {profile.client_email ?? "client email pending"} / updated {fmtDate(profile.updated_at)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {(profile.markets_served ?? []).slice(0, 3).join(", ") || "No geography remembered yet"}
                      </p>
                    </div>
                    <span className="text-sm font-black text-blue-700">Open memory -&gt;</span>
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
