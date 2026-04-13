import type { Metadata } from "next";
import { db, bundles, cities } from "@homereach/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bundles — HomeReach Admin" };

async function getAllBundles() {
  return db
    .select({
      bundle: bundles,
      city: { name: cities.name, state: cities.state },
    })
    .from(bundles)
    .leftJoin(cities, eq(bundles.cityId, cities.id))
    .orderBy(desc(bundles.createdAt));
}

export default async function AdminBundlesPage() {
  const rows = await getAllBundles();

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Bundles</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} bundle{rows.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-green-600 font-medium">
            {rows.filter((r) => r.bundle.isActive).length} active
          </span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No bundles yet. Run the seed script to populate catalog data.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Bundle</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ bundle, city }) => (
                <tr key={bundle.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{bundle.name}</p>
                    {bundle.description && (
                      <p className="text-xs text-gray-400">{bundle.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {city ? `${city.name}, ${city.state}` : (
                      <span className="text-xs text-gray-400 italic">All cities</span>
                    )}
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">
                    {bundle.slug}
                  </td>
                  {/* Admin reference only — display of DB alignment value, not billing source */}
                  <td className="px-4 py-4 text-right font-mono font-bold text-gray-900">
                    ${Number(bundle.price).toLocaleString("en-US", {
                      minimumFractionDigits: 0,
                    })}
                  </td>
                  <td className="px-4 py-4">
                    {bundle.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                        Inactive
                      </span>
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
