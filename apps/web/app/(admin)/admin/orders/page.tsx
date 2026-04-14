import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orders — HomeReach Admin" };

const STATUS_COLORS: Record<string, string> = {
  paid:        "bg-green-50 text-green-700 border-green-200",
  active:      "bg-blue-50 text-blue-700 border-blue-200",
  completed:   "bg-gray-100 text-gray-600 border-gray-200",
  pending:     "bg-amber-50 text-amber-700 border-amber-200",
  processing:  "bg-sky-50 text-sky-700 border-sky-200",
  cancelled:   "bg-red-50 text-red-700 border-red-200",
  refunded:    "bg-orange-50 text-orange-700 border-orange-200",
};

export default async function AdminOrdersPage() {
  const db = createServiceClient();

  const { data: rows = [] } = await db
    .from("orders")
    .select(`
      id, status, total, subtotal, locked_price, pricing_type,
      paid_at, created_at,
      stripe_payment_intent_id, stripe_checkout_session_id,
      businesses:business_id ( name ),
      bundles:bundle_id ( name )
    `)
    .order("created_at", { ascending: false });

  const totalRevenue = (rows as any[])
    .filter(r => ["paid", "active", "completed"].includes(r.status))
    .reduce((sum, r) => sum + Number(r.total ?? 0), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">{rows.length} order{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-3 text-right">
          <p className="text-xs text-green-600 font-medium uppercase tracking-widest">Total revenue</p>
          <p className="text-2xl font-bold text-green-800">
            ${totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No orders yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Business</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Bundle</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Pricing</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Paid at</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Stripe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(rows as any[]).map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{row.businesses?.name ?? "—"}</p>
                    <p className="font-mono text-xs text-gray-400">{row.id.slice(0, 8)}…</p>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{row.bundles?.name ?? "—"}</td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      STATUS_COLORS[row.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>{row.status}</span>
                  </td>
                  <td className="px-4 py-4">
                    {row.pricing_type === "founding" ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2 py-0.5 text-xs font-semibold text-green-700">Founding</span>
                    ) : row.pricing_type === "standard" ? (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600">Standard</span>
                    ) : <span className="text-xs text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-gray-900">
                    ${Number(row.total ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {row.paid_at ? new Date(row.paid_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-4 py-4">
                    {row.stripe_payment_intent_id ? (
                      <a href={`https://dashboard.stripe.com/payments/${row.stripe_payment_intent_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-500 hover:underline">
                        {row.stripe_payment_intent_id.slice(0, 16)}…
                      </a>
                    ) : <span className="text-xs text-gray-400">—</span>}
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
