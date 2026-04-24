// Pure presentational component — no data fetching, no state.
// Works in server and client components.

export interface ElectionCountdownProps {
  electionDate: string | null | undefined;  // ISO or 'YYYY-MM-DD'
  /** Compact inline variant (for list rows). Otherwise a stacked card. */
  compact?: boolean;
}

export function ElectionCountdown({ electionDate, compact = false }: ElectionCountdownProps) {
  if (!electionDate) {
    return compact ? (
      <span className="text-xs text-slate-400">No election date</span>
    ) : (
      <div className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
        No election date on record
      </div>
    );
  }

  const target = Date.parse(electionDate);
  if (!Number.isFinite(target)) {
    return compact ? (
      <span className="text-xs text-slate-400">Bad date</span>
    ) : null;
  }

  const now = Date.now();
  const days = Math.round((target - now) / (24 * 60 * 60 * 1000));
  const iso = new Date(target).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // Color tier based on operational mail-window semantics.
  // These thresholds match the priority engine's "election proximity" bands.
  const tier =
    days < 0
      ? "past"
      : days < 14
        ? "closing"
        : days < 60
          ? "tight"
          : days < 90
            ? "peak"
            : "wide";

  const toneClasses: Record<string, string> = {
    past:    "bg-slate-100 text-slate-600 ring-slate-200",
    closing: "bg-rose-50 text-rose-800 ring-rose-200",
    tight:   "bg-amber-50 text-amber-800 ring-amber-200",
    peak:    "bg-emerald-50 text-emerald-800 ring-emerald-200",
    wide:    "bg-cyan-50 text-cyan-800 ring-cyan-200",
  };

  const windowText: Record<string, string> = {
    past:    "past",
    closing: "mail window closing",
    tight:   "tight mail window",
    peak:    "ideal mail window",
    wide:    "wide window",
  };

  const label = days < 0
    ? `${Math.abs(days)}d ago`
    : `in ${days}d`;

  if (compact) {
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${toneClasses[tier]}`}>
        {label}
      </span>
    );
  }

  return (
    <div className={`rounded-md px-3 py-2 text-xs ring-1 ring-inset ${toneClasses[tier]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">Election {label}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-70">{windowText[tier]}</span>
      </div>
      <div className="mt-0.5 text-[10px] opacity-80">{iso}</div>
    </div>
  );
}
