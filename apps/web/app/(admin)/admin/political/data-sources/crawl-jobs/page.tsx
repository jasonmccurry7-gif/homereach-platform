import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/data-sources/crawl-jobs  (PHASE 2 PLACEHOLDER)
//
// The schema for crawl_sources + crawl_jobs is provisioned (migration 071)
// but no crawl execution code ships in Phase 1A. This page exists so:
//   • Operators see the planned shape of the system
//   • Future-Phase 2 work has a stable URL to land into
//   • Nobody is misled into thinking unattended crawling is enabled today
//
// Compliance posture: the system MUST NOT scrape any URL until:
//   1. crawl_sources.terms_approved = true for the hostname
//   2. crawl_sources.robots_allowed = true (after a robots.txt check)
//   3. A bonded compliance review has signed off on the source
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Crawl Jobs (Phase 2) · Political · HomeReach" };

interface CrawlSourceRow {
  id: string;
  hostname: string;
  robots_allowed: boolean | null;
  robots_checked_at: string | null;
  terms_approved: boolean;
  enabled: boolean;
  notes: string | null;
}

interface CrawlJobRow {
  id: string;
  target_url: string;
  status: string;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
  created_at: string;
}

export default async function PoliticalCrawlJobsPage() {
  const supabase = createServiceClient();
  const [{ data: sources }, { data: jobs }] = await Promise.all([
    supabase
      .from("crawl_sources")
      .select("id, hostname, robots_allowed, robots_checked_at, terms_approved, enabled, notes")
      .order("hostname"),
    supabase
      .from("crawl_jobs")
      .select("id, target_url, status, scheduled_for, started_at, completed_at, error, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              Crawl jobs
            </h1>
            <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              PHASE 2 — NOT EXECUTING
            </span>
          </div>
          <p className="max-w-3xl text-sm text-slate-600">
            Compliant crawler subsystem is intentionally deferred. The schema
            is provisioned so we can add the executor later without another
            migration, but no automated fetching runs today.
          </p>
        </div>
        <Link
          href="/admin/political/data-sources"
          className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ← Data Sources
        </Link>
      </header>

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 space-y-2">
        <p className="font-semibold">Before any crawler ships, the following gates MUST be wired and green:</p>
        <ul className="ml-4 list-disc space-y-1">
          <li><code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">crawl_sources.terms_approved</code> = true after operator + legal review</li>
          <li>Live <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">robots.txt</code> check that confirms the user-agent is allowed for the target path</li>
          <li>Per-host rate limit (<code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">rate_limit_rps</code>) honored at the fetcher</li>
          <li>Identifying User-Agent string with contact email for opt-out</li>
          <li>No fetching of paywalled, login-gated, or personal data</li>
        </ul>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Registered crawl sources</h2>
        {sources && sources.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Hostname</th>
                  <th className="px-3 py-2 font-semibold">robots.txt</th>
                  <th className="px-3 py-2 font-semibold">Terms approved</th>
                  <th className="px-3 py-2 font-semibold">Enabled</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(sources as CrawlSourceRow[]).map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{s.hostname}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {s.robots_allowed === null ? "not checked"
                        : s.robots_allowed ? "allowed" : "blocked"}
                      {s.robots_checked_at && (
                        <div className="text-[10px] text-slate-500">
                          {new Date(s.robots_checked_at).toLocaleString()}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {s.terms_approved ? "yes" : "no"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {s.enabled ? "yes" : "no"}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{s.notes ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No crawl sources registered. Add hostnames here once Phase 2 begins.
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-slate-900">Recent crawl jobs</h2>
        {jobs && jobs.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <table className="w-full border-collapse text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Target</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Created</th>
                  <th className="px-3 py-2 font-semibold">Completed</th>
                </tr>
              </thead>
              <tbody>
                {(jobs as CrawlJobRow[]).map((j) => (
                  <tr key={j.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{j.target_url}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{j.status}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{new Date(j.created_at).toLocaleString()}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">
                      {j.completed_at ? new Date(j.completed_at).toLocaleString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
            No crawl jobs recorded.
          </div>
        )}
      </section>
    </section>
  );
}
