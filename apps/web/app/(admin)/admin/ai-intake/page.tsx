import { revalidatePath } from "next/cache";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { formatCents, syncAiIntakeTotals } from "@/lib/ai-intake/shared-postcard-cart";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AI Intake Carts - HomeReach Admin",
};

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?redirect=/admin/ai-intake");
  if (user.app_metadata?.user_role !== "admin") redirect("/dashboard");
}

async function updateConfirmationStatus(formData: FormData) {
  "use server";

  await requireAdmin();
  const confirmationId = String(formData.get("confirmationId") ?? "");
  const adminStatus = String(formData.get("adminStatus") ?? "pending");
  const adminNotes = String(formData.get("adminNotes") ?? "").trim();
  const overrideReason = String(formData.get("overrideReason") ?? "").trim();

  if (!confirmationId) return;

  const supabase = createServiceClient();
  await supabase
    .from("ai_intake_confirmations")
    .update({
      admin_status: adminStatus,
      admin_notes: adminNotes || null,
      override_reason: overrideReason || null,
    })
    .eq("id", confirmationId);

  revalidatePath("/admin/ai-intake");
}

async function updateCartItem(formData: FormData) {
  "use server";

  await requireAdmin();
  const itemId = String(formData.get("itemId") ?? "");
  const sessionId = String(formData.get("sessionId") ?? "");
  const quantity = Math.max(1, Number(formData.get("quantity") ?? 1));
  const monthlyDollars = Math.max(0, Number(formData.get("monthlyDollars") ?? 0));
  const availabilityStatus = String(formData.get("availabilityStatus") ?? "available");

  if (!itemId || !sessionId) return;

  const supabase = createServiceClient();
  await supabase
    .from("ai_intake_cart_items")
    .update({
      quantity,
      monthly_price_cents: Math.round(monthlyDollars * 100),
      subtotal_cents: Math.round(monthlyDollars * 100),
      availability_status: availabilityStatus,
      availability_message: "Edited by admin.",
    })
    .eq("id", itemId)
    .eq("session_id", sessionId);

  await syncAiIntakeTotals(supabase, sessionId);
  revalidatePath("/admin/ai-intake");
}

type AdminSessionRow = {
  id: string;
  status: string;
  business_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  total_monthly_cents: number | null;
  total_contract_value_cents: number | null;
  checkout_url: string | null;
  created_at: string;
  ai_intake_cart_items?: Array<{
    id: string;
    city_name_snapshot: string;
    category_name_snapshot: string;
    placement_label: string;
    quantity: number;
    subtotal_cents: number;
    availability_status: string;
  }>;
  ai_intake_confirmations?: Array<{
    id: string;
    confirmation_status: string;
    admin_status: string;
    admin_notes: string | null;
    override_reason: string | null;
    confirmed_at: string;
  }>;
};

export default async function AdminAiIntakePage() {
  await requireAdmin();

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("ai_intake_sessions")
    .select(
      `
      id,
      status,
      business_name,
      contact_name,
      email,
      phone,
      total_monthly_cents,
      total_contract_value_cents,
      checkout_url,
      created_at,
      ai_intake_cart_items (
        id,
        city_name_snapshot,
        category_name_snapshot,
        placement_label,
                        quantity,
                        subtotal_cents,
                        availability_status
      ),
      ai_intake_confirmations (
        id,
        confirmation_status,
        admin_status,
        admin_notes,
        override_reason,
        confirmed_at
      )
    `,
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Intake Carts</h1>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Could not load AI intake carts. Confirm migration 090 has been applied.
        </div>
      </div>
    );
  }

  const sessions = ((data ?? []) as AdminSessionRow[]).map((session) => ({
    ...session,
    cart: session.ai_intake_cart_items ?? [],
    confirmation: session.ai_intake_confirmations?.[0] ?? null,
  }));

  const confirmedCount = sessions.filter((session) => session.status === "confirmed").length;
  const checkoutCount = sessions.filter((session) => session.status === "checkout_created").length;
  const paidCount = sessions.filter((session) => session.status === "paid").length;

  return (
    <div className="mx-auto max-w-7xl p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
            Shared Postcards
          </p>
          <h1 className="mt-2 text-2xl font-black text-gray-950">AI Intake Carts</h1>
          <p className="mt-2 text-sm text-gray-500">
            Review, approve, edit, or override conversational shared-postcard carts before or after payment.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <Metric label="Confirmed" value={confirmedCount} />
          <Metric label="Checkout" value={checkoutCount} />
          <Metric label="Paid" value={paidCount} />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {sessions.length === 0 && (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
            No AI intake carts yet.
          </div>
        )}

        {sessions.map((session) => (
          <section key={session.id} className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-black text-gray-950">
                      {session.business_name || "Business details pending"}
                    </h2>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
                      {session.status.replace(/_/g, " ")}
                    </span>
                    {session.confirmation && (
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                        admin {session.confirmation.admin_status}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {[session.contact_name, session.email, session.phone].filter(Boolean).join(" / ") || "Contact missing"}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Created {new Date(session.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="text-left lg:text-right">
                  <p className="text-sm font-bold text-gray-500">Monthly</p>
                  <p className="text-2xl font-black text-gray-950">
                    {formatCents(Number(session.total_monthly_cents ?? 0))}
                  </p>
                  <p className="text-xs font-semibold text-gray-500">
                    3-month value {formatCents(Number(session.total_contract_value_cents ?? 0))}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 p-5 lg:grid-cols-[1fr_360px]">
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-3 py-2 text-left">City</th>
                      <th className="px-3 py-2 text-left">Category</th>
                      <th className="px-3 py-2 text-left">Placement</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Monthly</th>
                      <th className="px-3 py-2 text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {session.cart.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2 font-semibold text-gray-900">{item.city_name_snapshot}</td>
                        <td className="px-3 py-2 text-gray-600">{item.category_name_snapshot}</td>
                        <td className="px-3 py-2 text-gray-600">{item.placement_label}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                        <td className="px-3 py-2 text-right font-bold text-gray-900">
                          {formatCents(Number(item.subtotal_cents ?? 0))}
                        </td>
                        <td className="px-3 py-2">
                          <form action={updateCartItem} className="flex justify-end gap-2">
                            <input type="hidden" name="itemId" value={item.id} />
                            <input type="hidden" name="sessionId" value={session.id} />
                            <input
                              name="quantity"
                              type="number"
                              min={1}
                              max={12}
                              defaultValue={item.quantity}
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-xs"
                              aria-label="Quantity"
                            />
                            <input
                              name="monthlyDollars"
                              type="number"
                              min={0}
                              step="1"
                              defaultValue={Math.round(Number(item.subtotal_cents ?? 0) / 100)}
                              className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                              aria-label="Monthly dollars"
                            />
                            <select
                              name="availabilityStatus"
                              defaultValue={item.availability_status}
                              className="w-24 rounded border border-gray-300 px-2 py-1 text-xs"
                              aria-label="Availability status"
                            >
                              <option value="available">available</option>
                              <option value="needs_admin_override">override</option>
                              <option value="reserved">reserved</option>
                              <option value="paid">paid</option>
                              <option value="unavailable">unavailable</option>
                            </select>
                            <button
                              type="submit"
                              className="rounded bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700"
                            >
                              Save
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))}
                    {session.cart.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-3 py-8 text-center text-gray-400">
                          Cart is empty.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {session.confirmation ? (
                <form action={updateConfirmationStatus} className="rounded-lg border border-gray-200 p-4">
                  <input type="hidden" name="confirmationId" value={session.confirmation.id} />
                  <label className="block text-sm font-bold text-gray-700">
                    Admin status
                    <select
                      name="adminStatus"
                      defaultValue={session.confirmation.admin_status}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    >
                      <option value="pending">pending</option>
                      <option value="approved">approved</option>
                      <option value="edited">edited</option>
                      <option value="override">override</option>
                      <option value="rejected">rejected</option>
                    </select>
                  </label>
                  <label className="mt-3 block text-sm font-bold text-gray-700">
                    Admin notes
                    <textarea
                      name="adminNotes"
                      defaultValue={session.confirmation.admin_notes ?? ""}
                      rows={3}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="mt-3 block text-sm font-bold text-gray-700">
                    Override reason
                    <textarea
                      name="overrideReason"
                      defaultValue={session.confirmation.override_reason ?? ""}
                      rows={2}
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="submit"
                    className="mt-3 w-full rounded-md bg-gray-950 px-4 py-2 text-sm font-bold text-white hover:bg-gray-800"
                  >
                    Save admin review
                  </button>
                </form>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
                  Cart has not been confirmed by the client yet.
                </div>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xl font-black text-gray-950">{value}</p>
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}
