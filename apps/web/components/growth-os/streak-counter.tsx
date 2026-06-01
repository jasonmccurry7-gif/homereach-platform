export function StreakCounter({ weeks }: { weeks: number }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">
        Streak
      </p>
      <p className="mt-1 text-2xl font-bold text-amber-900">
        {weeks} week{weeks === 1 ? "" : "s"}
      </p>
    </div>
  );
}
