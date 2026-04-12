import type { Metadata } from "next";
import {
  db,
  nonprofitApplications,
  publicNonprofitApplications,
  businesses,
  profiles,
} from "@homereach/db";
import { desc, eq } from "drizzle-orm";

export const dynamic  = "force-dynamic";
export const metadata: Metadata = { title: "Nonprofits — HomeReach Admin" };

async function getNonprofitApplications() {
  return db
    .select({
      application: nonprofitApplications,
      business: { name: businesses.name, email: businesses.email },
      reviewer: { fullName: profiles.fullName },
    })
    .from(nonprofitApplications)
    .leftJoin(businesses, eq(nonprofitApplications.businessId, businesses.id))
    .leftJoin(profiles, eq(nonprofitApplications.reviewedBy, profiles.id))
    .orderBy(desc(nonprofitApplications.createdAt));
}

async function getPublicApplications() {
  return db
    .select()
    .from(publicNonprofitApplications)
    .orderBy(desc(publicNonprofitApplications.createdAt))
    .catch(() => []);
}

const STATUS_COLORS: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-green-50 text-green-700 border-green-200",
  rejected: "bg-red-50 text-red-700 border-red-200",
};

export default async function AdminNonprofitsPage() {
  const [rows, publicRows] = await Promise.all([
    getNonprofitApplications(),
    getPublicApplications(),
  ]);

  const pending       = rows.filter((r) => r.application.status === "pending").length;
  const publicPending = publicRows.filter((r) => r.status === "pending").length;

  return (
    <div className="max-w-5xl space-y-10">

      {/* ── Section 1: Public registrations (from /nonprofit form) ─────────── */}
      <div>
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">Nonprofit Applications</h1>
          <p className="mt-1 text-sm text-gray-500">
            Public registrations from the /nonprofit form.{" "}
            {publicRows.length} submitted
            {publicPending > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {publicPending} need review
              </span>
            )}
          </p>
        </div>

        {publicRows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-400 text-sm">No public nonprofit registrations yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Contact</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">EIN</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">City</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {publicRows.map((row) => (
                  <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{row.orgName}</p>
                      {row.website && (
                        <a
                          href={row.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          {row.website}
                        </a>
                      )}
                      {row.mission && (
                        <p className="mt-0.5 text-xs text-gray-400 line-clamp-2">{row.mission}</p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">{row.contactName}</p>
                      <p className="text-xs text-gray-400">{row.email}</p>
                      {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-gray-600">
                      {row.ein ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-600">
                      {row.city ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400">
                      {new Date(row.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Section 2: Business-linked nonprofit applications ──────────────── */}
      <div>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-gray-900">Business-Linked Applications</h2>
          <p className="mt-1 text-sm text-gray-500">
            Submitted by existing customers claiming nonprofit status.{" "}
            {rows.length} total
            {pending > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {pending} pending review
              </span>
            )}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <p className="text-gray-400 text-sm">No business-linked applications yet.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Organization</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Business</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">EIN</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Reviewed by</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Submitted</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(({ application, business, reviewer }) => (
                  <tr key={application.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">{application.orgName}</p>
                      {application.documentUrl && (
                        <a
                          href={application.documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-500 hover:underline"
                        >
                          View 501c3 doc →
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">{business?.name ?? "—"}</p>
                      <p className="text-xs text-gray-400">{business?.email}</p>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs text-gray-600">
                      {application.ein ?? "—"}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          STATUS_COLORS[application.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        }`}
                      >
                        {application.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-gray-600 text-xs">
                      {reviewer?.fullName ?? "—"}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400">
                      {new Date(application.createdAt).toLocaleDateString("en-US", {
                        month: "short", day: "numeric", year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
