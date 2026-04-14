import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bundles — HomeReach Admin" };

export default async function AdminBundlesPage() {
  const db = createServiceClient();

  const { data: rows = [] } = await db
    .from("bundles")
    .select(`
      id, name, slug, description, price, standard_price, founding_price,
      is_active, created_at, city_id,
      cities:city_id ( name, state )
    `)
    .order("created_at", { ascending: false });

  const active = (rows as any[]).filter(r => r.is_active).length;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bundles</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} bundle{rows.length !== 1 ? "s" : ""} · <span className="text-green-600 font-medium">{active} active</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No bundles yet. Run SEED_BUNDLES.sql in Supabase.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Bundle</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Founding</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Standard</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(rows as any[]).map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    {row.description && <p className="text-xs text-gray-400">{row.description}</p>}
                    <p className="font-mono text-xs text-gray-300 mt-0.5">{row.slug}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {row.cities ? `${row.cities.name}, ${row.cities.state}` : (
                      <span className="text-xs text-gray-400 italic">All cities</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-bold text-blue-700">
                    {row.founding_price ? `$${(row.founding_price / 100).toLocaleString()}` : `$${Number(row.price).toLocaleString()}`}
                  </td>
                  <td className="px-4 py-4 text-right font-mono text-gray-400 line-through">
                    {row.standard_price ? `$${(row.standard_price / 100).toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-4">
                    {row.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">Inactive</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
