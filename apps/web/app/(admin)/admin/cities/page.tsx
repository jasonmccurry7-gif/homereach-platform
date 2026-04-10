import type { Metadata } from "next";
import { db, cities } from "@homereach/db";
import { desc } from "drizzle-orm";

export const metadata: Metadata = { title: "Cities — HomeReach Admin" };

export default async function AdminCitiesPage() {
  const rows = await db.select().from(cities).orderBy(desc(cities.createdAt));

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Cities</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} market{rows.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-green-600 font-medium">
            {rows.filter((r) => r.isActive).length} active
          </span>{" "}
          ·{" "}
          <span className="text-gray-500">
            {rows.filter((r) => !r.isActive).length} coming soon
          </span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No cities configured yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                <th className="px-4 py-3 font-semibold text-gray-600">State</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Launched</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((city) => (
                <tr key={city.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4 font-semibold text-gray-900">{city.name}</td>
                  <td className="px-4 py-4 text-gray-700">{city.state}</td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{city.slug}</td>
                  <td className="px-4 py-4">
                    {city.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                        Coming soon
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {city.launchedAt
                      ? new Date(city.launchedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
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
