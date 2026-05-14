import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// /admin/political/organizations
//
// Top-of-funnel view for political_organizations. Lists current rows + the
// link into the importer. No fake data: an empty table is the correct
// state until real orgs are imported or admin-entered.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";
export const metadata = { title: "Organizations · Political · HomeReach" };

interface OrgRow {
  id: string;
  legal_name: string;
  display_name: string | null;
  org_type: string;
  state: string | null;
  ein: string | null;
  primary_contact_email: string | null;
  import_id: string | null;
  created_at: string;
}

export default async function PoliticalOrganizationsPage() {
  const supabase = await createClient();
  const { data: orgs, error } = await supabase
    .from("political_organizations")
    .select("id, legal_name, display_name, org_type, state, ein, primary_contact_email, import_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Organizations
          </h1>
          <p className="text-sm text-slate-600">
            PACs, party committees, advocacy orgs, and other entities that
            sponsor political campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/political/organizations/import"
            className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Import CSV
          </Link>
          <Link
            href="/admin/political/imports?kind=organizations"
            className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import history
          </Link>
        </div>
      </header>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900">
          Failed to load organizations: {error.message}
        </div>
      )}

      {orgs && orgs.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            No organizations yet. This is correct — the system starts empty
            and is filled by importing real data from FEC bulk files,
            Ohio Secretary of State filings, or admin entry.
          </p>
          <Link
            href="/admin/political/organizations/import"
            className="mt-3 inline-block rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Import first batch
          </Link>
        </div>
      )}

      {orgs && orgs.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
          <table className="w-full border-collapse text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Legal name</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">State</th>
                <th className="px-3 py-2 font-semibold">EIN</th>
                <th className="px-3 py-2 font-semibold">Primary contact</th>
                <th className="px-3 py-2 font-semibold">Imported</th>
              </tr>
            </thead>
            <tbody>
              {(orgs as OrgRow[]).map((o) => (
                <tr key={o.id} className="border-t border-slate-100 align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{o.legal_name}</div>
                    {o.display_name && (
                      <div className="text-xs text-slate-500">{o.display_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-slate-700">{o.org_type}</td>
                  <td className="px-3 py-2 text-slate-700">{o.state ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-600">{o.ein ?? "—"}</td>
                  <td className="px-3 py-2 text-slate-700">{o.primary_contact_email ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-slate-500">
                    {o.import_id ? (
                      <Link
                        href={`/admin/political/imports?highlight=${o.import_id}`}
                        className="text-blue-700 hover:underline"
                      >
                        batch
                      </Link>
                    ) : "manual"}
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
