import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/service";
import { DataSourcesTable } from "./_components/DataSourcesTable";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/data-sources
//
// Registry of every approved political data source. Each row shows where
// the data comes from, when it was last refreshed, and a per-source
// "Run now" button (currently wired for FEC; OH SoS / BOE arrive in
// later phases).
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Sources · Political · HomeReach" };

export interface DataSourceRow {
  id: string;
  source_key: string;
  display_name: string;
  publisher: string;
  homepage_url: string | null;
  terms_url: string | null;
  license_notes: string | null;
  kind: "api" | "bulk" | "csv" | "crawl" | "manual";
  reliability_tier: "official" | "aggregator" | "community" | "derived";
  refresh_cadence: string;
  enabled: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
  last_run_summary: Record<string, unknown> | null;
  notes: string | null;
}

export default async function PoliticalDataSourcesPage() {
  const supabase = createServiceClient();
  const { data: rows, error } = await supabase
    .from("political_data_sources")
    .select("id, source_key, display_name, publisher, homepage_url, terms_url, license_notes, kind, reliability_tier, refresh_cadence, enabled, last_run_at, last_run_status, last_run_summary, notes")
    .order("kind")
    .order("display_name");

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Data Sources
          </h1>
          <p className="text-sm text-slate-600">
            Approved upstream sources for candidate, campaign, and committee data.
            Records ingested here land in the staging queue at{" "}
            <Link href="/admin/political/review" className="text-blue-700 hover:underline">
              /admin/political/review
            </Link>{" "}
            and are not visible to outreach until an admin approves them.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/political/data-sources/imports"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import history
          </Link>
          <Link
            href="/admin/political/data-sources/crawl-jobs"
            className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Crawl jobs (Phase 2)
          </Link>
        </div>
      </header>

      {!process.env.FEC_API_KEY && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>FEC_API_KEY env var not set.</strong> FEC ingestion will fall back to
          DEMO_KEY (rate-limited to ~30 requests/hour). Get a free key at{" "}
          <a
            href="https://api.data.gov/signup/"
            className="underline"
            target="_blank"
            rel="noreferrer"
          >
            api.data.gov/signup
          </a>{" "}
          and set it before bulk pulls.
        </div>
      )}

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          Failed to load data sources: {error.message}
        </div>
      )}

      <DataSourcesTable rows={(rows ?? []) as DataSourceRow[]} />
    </section>
  );
}
