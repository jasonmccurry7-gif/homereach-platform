import type { Metadata } from "next";
import { DailyRevenueCommandCenter } from "@/components/revenue-os/daily-revenue-command-center";
import { loadDailyRevenueCommandCenter } from "@/lib/revenue-os/snapshot";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Revenue Command Center | HomeReach",
  description: "Executive revenue operating center for HomeReach pipeline, outreach, replies, follow-ups, and sender health.",
};

export default async function AdminDashboardPage() {
  const [revenueCommandResult] = await Promise.allSettled([
    loadDailyRevenueCommandCenter(),
  ]);

  const loadErrors = [
    resultError("Daily Revenue Command Center", revenueCommandResult),
  ].filter((error): error is string => Boolean(error));

  if (revenueCommandResult.status === "rejected") {
    return <DailyRevenueCommandCenterError errors={loadErrors} />;
  }

  return <DailyRevenueCommandCenter data={revenueCommandResult.value} />;
}

function resultError(label: string, result: PromiseSettledResult<unknown>) {
  if (result.status === "fulfilled") return null;
  const message = result.reason instanceof Error ? result.reason.message : "Unknown loader failure";
  return `${label}: ${message}`;
}

function DailyRevenueCommandCenterError({ errors }: { errors: string[] }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-xl border border-rose-300/25 bg-rose-300/10 p-6 shadow-2xl shadow-slate-950/40">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-100">Daily Revenue Command Center</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight">Revenue data could not load</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-50/80">
          The command center is protected from showing stale or partial executive data when the loader fails.
        </p>
        <div className="mt-4 space-y-2">
          {(errors.length ? errors : ["Unknown loader failure"]).map((error) => (
            <div key={error} className="rounded-lg border border-rose-200/20 bg-black/20 px-3 py-2 text-sm text-rose-50">
              {error}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
