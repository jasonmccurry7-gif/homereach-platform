import Link from "next/link";
import type { FollowUpRow, UpcomingElectionRow } from "@/lib/political/dashboard-queries";
import { ElectionCountdown } from "./ElectionCountdown";

// Follow-up queue — soonest-first. Rendered on /admin/political.
export function FollowUpQueue({
  title,
  rows,
  emptyLabel,
  showCountdown = true,
}: {
  title: string;
  rows: FollowUpRow[];
  emptyLabel: string;
  showCountdown?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        <span className="text-[10px] text-slate-400">{rows.length}</span>
      </header>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/political/${r.id}?tab=outreach`}
                className="font-medium text-slate-900 hover:text-blue-700"
              >
                {r.candidateName}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {r.officeSought && <span>{r.officeSought}</span>}
                <span>{r.state}</span>
                {r.priorityScore !== null && (
                  <span className="font-medium text-slate-700">
                    Priority {r.priorityScore}
                  </span>
                )}
                {r.lastContactedAt && (
                  <span>
                    Last contact: {new Date(r.lastContactedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            {showCountdown && <ElectionCountdown electionDate={r.electionDate} compact />}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UpcomingElections({ rows }: { rows: UpcomingElectionRow[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Upcoming elections (90d)
        </h3>
        <span className="text-[10px] text-slate-400">{rows.length}</span>
      </header>
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
            <div className="min-w-0 flex-1">
              <Link
                href={`/admin/political/${r.id}`}
                className="font-medium text-slate-900 hover:text-blue-700"
              >
                {r.candidateName}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                {r.officeSought && <span>{r.officeSought}</span>}
                <span>{r.state}</span>
                <span>
                  {new Date(r.electionDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </div>
            <ElectionCountdown electionDate={r.electionDate} compact />
          </li>
        ))}
      </ul>
    </section>
  );
}
