import { AlertTriangle, CheckCircle2, Database, ShieldCheck } from "lucide-react";

export type DataMode = "live" | "mixed" | "fallback" | "demo" | "partial";

const MODE_COPY: Record<DataMode, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  live: {
    label: "Live data",
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    icon: CheckCircle2,
  },
  mixed: {
    label: "Live + seed",
    className: "border-blue-200 bg-blue-50 text-blue-950",
    icon: Database,
  },
  partial: {
    label: "Partial live",
    className: "border-amber-200 bg-amber-50 text-amber-950",
    icon: AlertTriangle,
  },
  fallback: {
    label: "Seed fallback",
    className: "border-amber-200 bg-amber-50 text-amber-950",
    icon: AlertTriangle,
  },
  demo: {
    label: "Demo data",
    className: "border-slate-300 bg-slate-100 text-slate-900",
    icon: ShieldCheck,
  },
};

export function DataModeBanner({
  mode,
  title,
  detail,
  items = [],
}: {
  mode: DataMode;
  title: string;
  detail: string;
  items?: string[];
}) {
  const copy = MODE_COPY[mode];
  const Icon = copy.icon;

  return (
    <section className={`rounded-xl border p-4 shadow-sm ${copy.className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className="rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em]">
              {copy.label}
            </span>
            <p className="font-black">{title}</p>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 opacity-85">{detail}</p>
        </div>
      </div>
      {items.length > 0 ? (
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {items.map((item) => (
            <p key={item} className="rounded-lg bg-white/60 px-3 py-2 text-xs font-bold leading-5">
              {item}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}
