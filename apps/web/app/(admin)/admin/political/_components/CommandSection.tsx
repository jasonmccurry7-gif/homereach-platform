import Link from "next/link";
import type {
  PoliticalCommandMetric,
  PoliticalCommandRow,
  PoliticalSectionData,
} from "@/lib/political/admin-command";
import { formatCurrency } from "@/lib/political/admin-command";

interface CommandSectionProps {
  eyebrow: string;
  title: string;
  subtitle: string;
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  data: PoliticalSectionData;
  emptyLabel?: string;
}

const metricTone = {
  navy: "border-blue-300/20 bg-blue-950/50 text-blue-100",
  red: "border-red-300/20 bg-red-950/40 text-red-100",
  gold: "border-amber-300/25 bg-amber-950/40 text-amber-100",
  green: "border-emerald-300/20 bg-emerald-950/40 text-emerald-100",
} as const;

export function CommandSection({
  eyebrow,
  title,
  subtitle,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
  data,
  emptyLabel = "No records have landed in this section yet.",
}: CommandSectionProps) {
  return (
    <section className="space-y-5">
      <header className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-red-300">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            {subtitle}
          </p>
        </div>
        {(primaryHref || secondaryHref) && (
          <div className="flex flex-wrap gap-2">
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/10"
              >
                {secondaryLabel}
              </Link>
            )}
            {primaryHref && primaryLabel && (
              <Link
                href={primaryHref}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500"
              >
                {primaryLabel}
              </Link>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {data.metrics.map((metric) => (
          <MetricTile key={metric.label} metric={metric} />
        ))}
      </div>

      {data.errors.length > 0 && (
        <div className="rounded-lg border border-amber-300/30 bg-amber-950/30 p-4 text-sm text-amber-100">
          <p className="font-semibold">Some live data could not be loaded.</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
            {data.errors.slice(0, 4).map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.04] shadow-2xl shadow-slate-950/40">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.03] px-4 py-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200">
              Live Operations Queue
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Refreshed {new Date(data.refreshedAt).toLocaleString()}
            </p>
          </div>
          <div className="rounded-full border border-emerald-300/25 bg-emerald-950/40 px-3 py-1 text-xs font-semibold text-emerald-200">
            Connected to Supabase
          </div>
        </div>

        {data.rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-300">
            {emptyLabel}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {data.rows.map((row) => (
              <CommandRow key={row.id} row={row} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function MetricTile({ metric }: { metric: PoliticalCommandMetric }) {
  const tone = metricTone[metric.tone ?? "navy"];
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.18em] opacity-75">
        {metric.label}
      </div>
      <div className="mt-2 text-3xl font-black tracking-tight">
        {metric.value}
      </div>
      <div className="mt-1 truncate text-xs opacity-75" title={metric.detail}>
        {metric.detail}
      </div>
    </div>
  );
}

function CommandRow({ row }: { row: PoliticalCommandRow }) {
  const content = (
    <article className="grid gap-4 px-4 py-4 transition hover:bg-white/[0.04] md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-sm font-bold text-white">{row.title}</h3>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-300">
            {row.status}
          </span>
        </div>
        <p className="mt-1 truncate text-sm text-slate-300">{row.subtitle}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {row.meta.map((item) => (
            <span
              key={item}
              className="rounded border border-white/10 bg-slate-950/60 px-2 py-1 text-xs text-slate-300"
            >
              {item}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        {typeof row.amountCents === "number" && (
          <div className="font-mono text-sm font-bold text-amber-200">
            {formatCurrency(row.amountCents)}
          </div>
        )}
        {row.href && (
          <span className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-100">
            Open
          </span>
        )}
      </div>
    </article>
  );

  if (!row.href) return content;
  return (
    <Link href={row.href} className="block">
      {content}
    </Link>
  );
}
