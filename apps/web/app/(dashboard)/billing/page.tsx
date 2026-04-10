import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrdersForUser } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing — HomeReach" };

const statusStyle: Record<string, string> = {
  paid:       "bg-green-100 text-green-700",
  active:     "bg-green-100 text-green-700",
  pending:    "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  cancelled:  "bg-gray-100 text-gray-500",
  refunded:   "bg-red-100 text-red-600",
  completed:  "bg-gray-100 text-gray-500",
};

const statusLabel: Record<string, string> = {
  paid:       "Paid",
  active:     "Active",
  pending:    "Pending",
  processing: "Processing",
  cancelled:  "Cancelled",
  refunded:   "Refunded",
  completed:  "Completed",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orders = await getOrdersForUser(user.id);

  const fmt = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div className="max-w-3xl space-y-6">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Your payment history and order details
          </p>
        </div>
      </div>

      {/* Active subscription summary */}
      {orders.some((o) => o.order.status === "paid" || o.order.status === "active") && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-500">Current plan</p>
              <p className="mt-1 text-lg font-bold text-blue-900">
                {orders.find(
                  (o) => o.order.status === "paid" || o.order.status === "active"
                )?.bundle?.name ?? "HomeReach Campaign"}
              </p>
              <p className="mt-0.5 text-sm text-blue-700">
                Paid on{" "}
                {fmt(
                  orders.find((o) => o.order.status === "paid" || o.order.status === "active")
                    ?.order.paidAt ?? null
                )}
              </p>
            </div>
            <Link
              href="/get-started"
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 whitespace-nowrap"
            >
              + Add city
            </Link>
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Payment history</h2>
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-gray-400 text-sm">No payments yet.</p>
            <Link
              href="/get-started"
              className="mt-3 inline-block text-sm font-medium text-blue-600 hover:underline"
            >
              Purchase your first campaign →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map(({ order, bundle, business }) => (
              <div
                key={order.id}
                className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-sm">
                    {bundle?.name ?? "HomeReach Campaign"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {business?.name ?? "—"} · {fmt(order.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      statusStyle[order.status] ?? "bg-gray-100 text-gray-500"
                    )}
                  >
                    {statusLabel[order.status] ?? order.status}
                  </span>
                  <p className="text-sm font-bold text-gray-900 tabular-nums">
                    ${Number(order.total).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Help / contact */}
      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm text-gray-500">
        Questions about your bill?{" "}
        <a
          href="mailto:billing@home-reach.com"
          className="font-medium text-blue-600 hover:underline"
        >
          Contact billing support
        </a>
      </div>

    </div>
  );
}
