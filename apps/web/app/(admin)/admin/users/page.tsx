import type { Metadata } from "next";
import { db, profiles } from "@homereach/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Users — HomeReach Admin" };

const ROLE_COLORS: Record<string, string> = {
  admin:     "bg-red-50 text-red-700 border-red-200",
  client:    "bg-blue-50 text-blue-700 border-blue-200",
  nonprofit: "bg-purple-50 text-purple-700 border-purple-200",
  sponsor:   "bg-amber-50 text-amber-700 border-amber-200",
};

export default async function AdminUsersPage() {
  const rows = await db
    .select()
    .from(profiles)
    .orderBy(desc(profiles.createdAt));

  const byRole = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.role] = (acc[r.role] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-5xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} user{rows.length !== 1 ? "s" : ""} total
          </p>
        </div>

        {/* Role breakdown */}
        <div className="flex items-center gap-2">
          {Object.entries(byRole).map(([role, count]) => (
            <span
              key={role}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                ROLE_COLORS[role] ?? "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {count} {role}
            </span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No users yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((profile) => (
                <tr key={profile.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">
                      {profile.fullName || "—"}
                    </p>
                    <p className="font-mono text-xs text-gray-400">{profile.id}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{profile.email}</td>
                  <td className="px-4 py-4 text-gray-500 text-xs">
                    {profile.phone ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        ROLE_COLORS[profile.role] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {profile.role}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-400">
                    {new Date(profile.createdAt).toLocaleDateString("en-US", {
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
