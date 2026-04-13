import type { Metadata } from "next";
import { db, products } from "@homereach/db";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Products — HomeReach Admin" };

const TYPE_COLORS: Record<string, string> = {
  postcard:   "bg-blue-50 text-blue-700 border-blue-200",
  print:      "bg-sky-50 text-sky-700 border-sky-200",
  digital:    "bg-purple-50 text-purple-700 border-purple-200",
  automation: "bg-amber-50 text-amber-700 border-amber-200",
  addon:      "bg-gray-100 text-gray-600 border-gray-200",
};

export default async function AdminProductsPage() {
  let rows: Awaited<ReturnType<typeof db.select>> = [];
  try {
    rows = await db.select().from(products).orderBy(desc(products.createdAt));
  } catch {
    // DB unavailable — render empty state
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="mt-1 text-sm text-gray-500">
          {rows.length} product{rows.length !== 1 ? "s" : ""} ·{" "}
          <span className="text-green-600 font-medium">
            {rows.filter((r) => r.isActive).length} active
          </span>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-12 text-center">
          <p className="text-gray-500">No products yet. Run the seed script to populate catalog data.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-4 py-3 font-semibold text-gray-600">Product</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Type</th>
                <th className="px-4 py-3 font-semibold text-gray-600">Slug</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">
                  Base price
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    {product.description && (
                      <p className="text-xs text-gray-400">{product.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${
                        TYPE_COLORS[product.type] ?? "bg-gray-100 text-gray-600 border-gray-200"
                      }`}
                    >
                      {product.type}
                    </span>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-gray-500">
                    {product.slug}
                  </td>
                  <td className="px-4 py-4 text-right font-mono font-semibold text-gray-900">
                    ${Number(product.basePrice).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-4">
                    {product.isActive ? (
                      <span className="inline-flex items-center rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-xs font-semibold text-gray-500">
                        Inactive
                      </span>
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
