function daysUntil(date: string | null): number | null {
  if (!date) return null;

  const target = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  const todayUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    12,
  );

  return Math.ceil((target.getTime() - todayUtc) / 86_400_000);
}

function toneForDays(days: number | null): string {
  if (days === null) return "border-slate-200 bg-slate-50 text-slate-500";
  if (days < 0) return "border-slate-200 bg-slate-50 text-slate-500";
  if (days <= 14) return "border-red-200 bg-red-50 text-red-700";
  if (days <= 45) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function labelForDays(days: number | null): string {
  if (days === null) return "No election date";
  if (days < 0) return "Election passed";
  if (days === 0) return "Election today";
  if (days === 1) return "1 day out";
  return `${days} days out`;
}

export function ElectionCountdown({
  electionDate,
  compact = false,
}: {
  electionDate: string | null;
  compact?: boolean;
}) {
  const days = daysUntil(electionDate);

  return (
    <div
      className={[
        "shrink-0 rounded-full border font-medium",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        toneForDays(days),
      ].join(" ")}
    >
      {labelForDays(days)}
    </div>
  );
}
