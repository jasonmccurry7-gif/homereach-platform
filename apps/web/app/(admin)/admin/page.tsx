import type { Metadata } from "next";
import { MainProductCommandCenter } from "@/components/admin-command-center/main-product-command-center";
import { loadMainProductCommandCenter } from "@/lib/admin/main-product-command";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "HomeReach Primary Product Command Center",
  description:
    "Admin command center focused on StormReach, political campaigns, targeted local campaigns, creative automation, outreach, payment readiness, and team access.",
};

export default async function AdminDashboardPage() {
  const [productCommandResult] = await Promise.allSettled([
    loadMainProductCommandCenter(),
  ]);

  const loadErrors = [
    resultError("Primary Product Command Center", productCommandResult),
  ].filter((error): error is string => Boolean(error));

  if (productCommandResult.status === "rejected") {
    return <PrimaryProductCommandCenterError errors={loadErrors} />;
  }

  return <MainProductCommandCenter data={productCommandResult.value} />;
}

function resultError(label: string, result: PromiseSettledResult<unknown>) {
  if (result.status === "fulfilled") return null;
  const message = result.reason instanceof Error ? result.reason.message : "Unknown loader failure";
  return `${label}: ${message}`;
}

function PrimaryProductCommandCenterError({ errors }: { errors: string[] }) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
      <section className="mx-auto max-w-4xl rounded-xl border border-rose-300/25 bg-rose-300/10 p-6 shadow-2xl shadow-slate-950/40">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-100">Primary Product Command Center</p>
        <h1 className="mt-3 text-2xl font-black tracking-tight">Dashboard data could not load</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-rose-50/80">
          The command center is protected from showing stale or partial product data when the loader fails.
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
