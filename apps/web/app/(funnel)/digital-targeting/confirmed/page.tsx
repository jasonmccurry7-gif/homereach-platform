import Link from "next/link";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DigitalTargetingConfirmedPage({
  searchParams,
}: {
  searchParams: Promise<{ campaign?: string; manual?: string }>;
}) {
  const params = await searchParams;
  const manual = params.manual === "true";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-white">
      <main className="w-full max-w-2xl rounded-lg border border-white/10 bg-white/[0.08] p-6 text-center shadow-2xl shadow-slate-950/40">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20">
          <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight">
          {manual ? "Your campaign is in the payment queue." : "Your campaign request is confirmed."}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-slate-300">
          HomeReach will review your target areas, payment state, ad spend plan, creative assets, and launch readiness.
          Nothing goes live until approvals are complete.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Payment", value: manual ? "Manual task created" : "Webhook will reconcile", icon: Clock3 },
            { label: "Launch", value: "Approval required", icon: ShieldCheck },
            { label: "Reporting", value: "Monthly cadence", icon: CheckCircle2 },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="rounded-lg border border-white/10 bg-white/10 p-3">
                <Icon className="mx-auto h-5 w-5 text-cyan-200" aria-hidden="true" />
                <p className="mt-3 text-xs font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</p>
                <p className="mt-1 text-sm font-black text-white">{item.value}</p>
              </div>
            );
          })}
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard/digital-targeting" className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-black text-white transition hover:bg-blue-500">
            View Client Dashboard
          </Link>
          <Link href="/digital-targeting" className="rounded-lg border border-white/15 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10">
            Back to Product Page
          </Link>
        </div>
      </main>
    </div>
  );
}
