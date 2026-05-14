import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/routes
//
// Production view of political_routes. Lists by-state / by-zip aggregates
// and recent imports. The map visualization (Phase 2 / 13) will land on top
// of this in a follow-up; until then operators can verify their imports
// here and click through to the importer.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Routes · Political · HomeReach" };

interface ZipAggregate {
  state: string;
  zip5: string;
  county: string | null;
  city: string | null;
  routes: number;
  households: number;
  source: string | null;
  most_recent_import: string | null;
}

export default async function PoliticalRoutesPage() {
  const supabase = await createClient();

  // Aggregate per (state, zip5). Cap at 200 ZIPs for the dashboard view.
  const { data: routes, error } = await supabase
    .from("political_routes")
    .select("state, zip5, county, city, total_count, source, source_imported_at")
    .eq("active", true)
    .order("source_imported_at", { ascending: false })
    .limit(5000);

  // Roll up client-side (small N — typical operator view is a few thousand routes)
  const aggMap = new Map<string, ZipAggregate>();
  if (routes) {
    for (const r of routes) {
      const key = `${r.state}|${r.zip5}`;
      const cur = aggMap.get(key);
      if (cur) {
        cur.routes += 1;
        cur.households += r.total_count ?? 0;
        if (r.source_imported_at && (!cur.most_recent_import || r.source_imported_at > cur.most_recent_import)) {
          cur.most_recent_import = r.source_imported_at;
        }
      } else {
        aggMap.set(key, {
          state: r.state,
          zip5: r.zip5,
          county: r.county,
          city: r.city,
          routes: 1,
          households: r.total_count ?? 0,
          source: r.source,
          most_recent_import: r.source_imported_at,
        });
      }
    }
  }

  const aggregates = Array.from(aggMap.values()).sort(
    (a, b) => (b.households - a.households),
  );

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Carrier Routes
          </h1>
          <p className="text-sm text-slate-600">
            USPS carrier-route catalog by ZIP. Used for coverage planning,
            scenario quoting, and reservation calendars.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/political/routes/import"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/political/routes/find-source"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Where do I get the data?
          </Link>
          <Link
            href="/admin/political/imports?kind=routes"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import history
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          Failed to load routes: {error.message}
        </div>
      )}

      {!error && aggregates.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center space-y-2">
          <p className="text-sm text-slate-600">
            No carrier routes loaded yet. Get a CSV from USPS EDDM, an
            approved partner, or a vendor like 48HrPrint, then upload it.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Link
              href="/admin/political/routes/import"
              className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
            >
              Import first batch
            </Link>
            <Link
              href="/admin/political/routes/find-source"
              className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Where do I get the data?
            </Link>
          </div>
        </div>
      )}

      {aggregates.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
            {aggregates.length.toLocaleString()} ZIP{aggregates.length === 1 ? "" : "s"} loaded
          </div>
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">State</th>
                <th className="px-3 py-2 font-semibold">ZIP</th>
                <th className="px-3 py-2 font-semibold">County / City</th>
                <th className="px-3 py-2 font-semibold text-right">Routes</th>
                <th className="px-3 py-2 font-semibold text-right">Households</th>
                <th className="px-3 py-2 font-semibold">Source</th>
                <th className="px-3 py-2 font-semibold">Imported</th>
              </tr>
            </thead>
            <tbody>
              {aggregates.map((a) => (
                <tr key={`${a.state}|${a.zip5}`} className="border-t border-slate-100">
                  <td className="px-3 py-2 text-slate-700">{a.state}</td>
                  <td className="px-3 py-2 font-mono text-slate-700">{a.zip5}</td>
                  <td className="px-3 py-2 text-slate-700">
                    {[a.city, a.county].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-700">{a.routes.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{a.households.toLocaleString()}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">{a.source ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {a.most_recent_import
                      ? new Date(a.most_recent_import).toLocaleDateString()
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
