import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrdersForUser } from "@/lib/dashboard/queries";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Billing - HomeReach" };

const statusStyle: Record<string, string> = {
  paid: "bg-green-100 text-green-700",
  active: "bg-green-100 text-green-700",
  pending: "bg-amber-100 text-amber-700",
  processing: "bg-blue-100 text-blue-700",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-red-100 text-red-600",
  completed: "bg-gray-100 text-gray-500",
};

const statusLabel: Record<string, string> = {
  paid: "Paid",
  active: "Active",
  pending: "Needs payment",
  processing: "In progress",
  cancelled: "Cancelled",
  refunded: "Refunded",
  completed: "Completed",
};

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const orders = await getOrdersForUser(user.id);
  const activeOrder = orders.find(
    (o) => o.order.status === "paid" || o.order.status === "active",
  );
  const pendingOrders = orders.filter((o) => o.order.status === "pending");
  const totalPaid = orders
    .filter((o) =>
      ["paid", "active", "processing", "completed"].includes(o.order.status),
    )
    .reduce((sum, { order }) => sum + Number(order.total), 0);

  const fmt = (d: Date | string | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Not recorded";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Account billing
          </p>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Billing</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
            See what is paid, what needs attention, and which campaign order
            each payment supports.
          </p>
        </div>
        <Link
          href="/get-started"
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
        >
          Add city
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <BillingStat
          label="Current service"
          value={activeOrder?.bundle?.name ?? "No active plan"}
          note={
            activeOrder
              ? "HomeReach work is connected."
              : "Start a campaign to activate."
          }
        />
        <BillingStat
          label="Needs payment"
          value={String(pendingOrders.length)}
          note={
            pendingOrders.length > 0
              ? "Review pending orders."
              : "Nothing due here."
          }
        />
        <BillingStat
          label="Paid to date"
          value={`$${totalPaid.toLocaleString()}`}
          note="From recorded campaign orders."
        />
      </div>

      {activeOrder && (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Current campaign order
              </p>
              <p className="mt-1 text-lg font-bold text-blue-950">
                {activeOrder.bundle?.name ?? "HomeReach Campaign"}
              </p>
              <p className="mt-1 text-sm text-blue-700">
                Paid on {fmt(activeOrder.order.paidAt ?? null)} for{" "}
                {activeOrder.business?.name ?? "your business"}.
              </p>
            </div>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700">
              Active
            </span>
          </div>
        </div>
      )}

      {pendingOrders.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-950">
            Payment may be needed.
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-700">
            {pendingOrders.length} order{pendingOrders.length !== 1 ? "s" : ""}{" "}
            are still pending. Contact HomeReach if you expected a campaign to
            be live.
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="font-semibold text-gray-900">Payment history</h2>
          <p className="mt-1 text-sm text-gray-500">
            Orders are shown with the campaign or business they support.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <h3 className="font-bold text-gray-900">No payments yet.</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
              Your first campaign payment will appear here after checkout is
              complete.
            </p>
            <Link
              href="/get-started"
              className="mt-4 inline-flex text-sm font-bold text-blue-600 hover:underline"
            >
              Start first campaign
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orders.map(({ order, bundle, business }) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {bundle?.name ?? "HomeReach Campaign"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {business?.name ?? "Business not linked"} | Ordered{" "}
                    {fmt(order.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      statusStyle[order.status] ?? "bg-gray-100 text-gray-500",
                    )}
                  >
                    {statusLabel[order.status] ?? order.status}
                  </span>
                  <p className="text-sm font-bold tabular-nums text-gray-900">
                    ${Number(order.total).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-5 py-4 text-sm leading-6 text-gray-500">
        Questions about a charge or campaign order?{" "}
        <a
          href="mailto:billing@home-reach.com"
          className="font-semibold text-blue-600 hover:underline"
        >
          Contact billing support
        </a>
        .
      </div>
    </div>
  );
}

function BillingStat({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        {label}
      </p>
      <p className="mt-2 truncate text-lg font-black text-gray-900">{value}</p>
      <p className="mt-1 text-xs leading-5 text-gray-500">{note}</p>
    </div>
  );
}
