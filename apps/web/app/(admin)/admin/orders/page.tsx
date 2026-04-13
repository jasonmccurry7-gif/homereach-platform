import type { Metadata } from "next";
import { db, orders, businesses, bundles } from "@homereach/db";
import { desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders — HomeReach Admin" };

async function getAllOrders() {
  return db
    .select({
      order: orders,
      business: { name: businesses.name },
      bundle: { name: bundles.name },
    })
    .from(orders)
    .leftJoin(businesses, eq(orders.businessId, businesses.id))
    .leftJoin(bundles, eq(orders.bundleId, bundles.id))
    .orderBy(desc(orders.createdAt));
}

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
  const rows = await getAllOrders();

  const totalRevenue = rows
    .filter((r) => ["paid", "active", "completed"].includes(r.order.status))
    .reduce((sum, r) => sum + Number(r.order.total), 0);

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} order{rows.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="rounded-xl bg-green-50 border border-green-200 px-5 py-3 text-right">
          <p className="text-xs text-green-600 font-medium uppercase tracking-widest">
            Total revenue
          </p>
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
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Paid at</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Stripe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ order, business, bundle }) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{business?.name ?? "—"}</p>
                    <p className="font-mono text-xs text-gray-400">{order.id}</p>
                  </td>
                  <td className="px-4 py-4 text-gray-700">{bundle?.name ?? "—"}</td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-gray-900">
                    ${Number(order.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500">
                    {order.paidAt
                      ? new Date(order.paidAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-4 py-4">
                    {order.stripePaymentIntentId ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-xs text-blue-500 hover:underline"
                      >
                        {order.stripePaymentIntentId.slice(0, 18)}…
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
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
