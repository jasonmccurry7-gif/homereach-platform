import type { Metadata } from "next";
import { db, waitlistEntries, cities, categories } from "@homereach/db";
import { desc, eq, isNull } from "drizzle-orm";

export const metadata: Metadata = { title: "Waitlist — HomeReach Admin" };

async function getWaitlist() {
  return db
    .select({
      entry: waitlistEntries,
      city: { name: cities.name, state: cities.state },
      category: { name: categories.name, icon: categories.icon },
    })
    .from(waitlistEntries)
    .leftJoin(cities, eq(waitlistEntries.cityId, cities.id))
    .leftJoin(categories, eq(waitlistEntries.categoryId, categories.id))
    .orderBy(desc(waitlistEntries.createdAt));
}

export default async function AdminWaitlistPage() {
  const rows = await getWaitlist();

  const converted = rows.filter((r) => r.entry.convertedToBusinessId).length;
  const pending = rows.length - converted;

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} sign-up{rows.length !== 1 ? "s" : ""} ·{" "}
            <span className="text-amber-600 font-medium">{pending} unconverted</span> ·{" "}
            <span className="text-green-600 font-medium">{converted} converted</span>
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No waitlist entries yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Contact</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Business</th>
                <th className="px-4 py-3 font-semibold text-gray-600">City / Category</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Signed up</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ entry, city, category }) => (
                <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{entry.name ?? "—"}</p>
                    <p className="text-xs text-gray-500">{entry.email}</p>
                    {entry.phone && (
                      <p className="text-xs text-gray-400">{entry.phone}</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-gray-700">
                    {entry.businessName ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-gray-700">
                      {city ? `${city.name}, ${city.state}` : "—"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {category?.icon} {category?.name ?? "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    {entry.convertedToBusinessId ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        Converted
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {new Date(entry.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
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
