import { Gauge, ShieldCheck, Sparkles } from "lucide-react";

export default function SupplifyLoading() {
  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-emerald-300/20 bg-white/[0.03] p-5">
        <div className="flex items-center gap-2 text-emerald-100">
          <Sparkles className="h-5 w-5" aria-hidden="true" />
          <p className="text-xs font-black uppercase tracking-[0.18em]">
            Supplify is checking margin signals
          </p>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          <SkeletonMetric icon={Gauge} label="Savings" />
          <SkeletonMetric icon={ShieldCheck} label="Approvals" />
          <SkeletonMetric icon={Gauge} label="Price drift" />
          <SkeletonMetric icon={ShieldCheck} label="Source quality" />
        </div>
      </section>
      <div className="grid gap-4 xl:grid-cols-3">
        <SkeletonPanel />
        <SkeletonPanel />
        <SkeletonPanel />
      </div>
    </div>
  );
}

function SkeletonMetric({
  icon: Icon,
  label,
}: {
  icon: typeof Gauge;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-4">
      <div className="flex items-center gap-2 text-neutral-500">
        <Icon className="h-4 w-4" aria-hidden="true" />
        <span className="text-xs font-black uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <div className="mt-4 h-8 animate-pulse rounded-md bg-white/10" />
      <div className="mt-3 h-4 w-3/4 animate-pulse rounded-md bg-white/5" />
    </div>
  );
}

function SkeletonPanel() {
  return (
    <div className="rounded-lg border border-white/10 bg-neutral-900 p-5">
      <div className="h-4 w-28 animate-pulse rounded-md bg-white/10" />
      <div className="mt-4 h-8 w-3/4 animate-pulse rounded-md bg-white/10" />
      <div className="mt-4 space-y-2">
        <div className="h-4 animate-pulse rounded-md bg-white/5" />
        <div className="h-4 w-5/6 animate-pulse rounded-md bg-white/5" />
        <div className="h-4 w-2/3 animate-pulse rounded-md bg-white/5" />
      </div>
    </div>
  );
}
