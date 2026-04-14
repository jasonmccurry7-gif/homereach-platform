import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Businesses — HomeReach Admin" };

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-green-50 text-green-700 border-green-200",
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  paused:  "bg-gray-100 text-gray-600 border-gray-200",
  churned: "bg-red-50 text-red-700 border-red-200",
};

export default async function AdminBusinessesPage() {
  const db = createServiceClient();

  const { data: rows = [] } = await db
    .from("businesses")
    .select(`
      id, name, website, status, is_nonprofit, created_at,
      profiles:owner_id ( email, full_name ),
      cities:city_id ( name, state ),
      categories:category_id ( name, icon )
    `)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Businesses</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} business{rows.length !== 1 ? "es" : ""} registered
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No businesses yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Business</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Owner</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City / Category</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((row: any) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    {row.website && (
                      <a href={row.website} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-blue-500 hover:underline">{row.website}</a>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-gray-700">{row.profiles?.full_name || "—"}</p>
                    <p className="text-xs text-gray-400">{row.profiles?.email}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-gray-700">
                      {row.cities ? `${row.cities.name}, ${row.cities.state}` : "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {row.categories?.icon} {row.categories?.name ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    {row.is_nonprofit ? (
                      <span className="inline-flex items-center rounded-full bg-purple-50 border border-purple-200 px-2.5 py-0.5 text-xs font-semibold text-purple-700">Nonprofit</span>
                    ) : (
                      <span className="text-xs text-gray-400">Standard</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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
