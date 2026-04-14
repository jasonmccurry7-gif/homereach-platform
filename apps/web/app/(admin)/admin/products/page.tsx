import type { Metadata } from "next";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products — HomeReach Admin" };

const TYPE_COLORS: Record<string, string> = {
  postcard:   "bg-blue-50 text-blue-700 border-blue-200",
  print:      "bg-sky-50 text-sky-700 border-sky-200",
  digital:    "bg-purple-50 text-purple-700 border-purple-200",
  automation: "bg-amber-50 text-amber-700 border-amber-200",
  addon:      "bg-gray-100 text-gray-600 border-gray-200",
  nonprofit:  "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default async function AdminProductsPage() {
  const db = createServiceClient();

  const { data: rows = [] } = await db
    .from("products")
    .select("*")
    .order("type")
    .order("name");

  const active = (rows as any[]).filter(r => r.is_active).length;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} product{rows.length !== 1 ? "s" : ""} · <span className="text-green-600 font-medium">{active} active</span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No products yet.</p>
          <p className="mt-2 text-xs text-gray-400">Run SEED_PRODUCTS.sql in Supabase to populate the catalog.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Price</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Billing</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {(rows as any[]).map((row) => (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{row.name}</p>
                    {row.description && <p className="text-xs text-gray-400 mt-0.5">{row.description}</p>}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                      TYPE_COLORS[row.type] ?? "bg-gray-100 text-gray-600 border-gray-200"
                    }`}>{row.type}</span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">{row.slug}</td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-gray-900">
                    ${Number(row.base_price ?? row.price ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-4 text-xs text-gray-500 capitalize">
                    {row.billing_interval ?? row.billing ?? "one-time"}
                  </td>
                  <td className="px-4 py-4">
                    {row.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">Inactive</span>
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
