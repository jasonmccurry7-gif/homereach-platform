import type { Metadata } from "next";
import { db, waitlistEntries, cities, categories } from "@homereach/db";
import { desc, eq } from "drizzle-orm";

export const metadata: Metadata = { title: "Waitlist - HomeReach Admin" };

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

function formatProductIntent(productIntent: string | null) {
  if (!productIntent) return "General waitlist";

  const labels: Record<string, string> = {
    "procurement-savings-review": "Procurement savings review",
    "ai-website-assistant": "AI website assistant",
    "local-seo": "Local SEO plan",
    "local-growth-review": "Local growth review",
    reputation: "Reputation support",
    "social-content": "Social content",
    "government-contracts": "Government contracts",
    "contractos-readiness-scan": "ContractOS readiness scan",
    "contractos-managed-bid-help": "ContractOS bid support",
    "contractos-document-review": "ContractOS document review",
    "contractos-watchlist": "ContractOS watchlist",
  };

  return (
    labels[productIntent] ??
    productIntent
      .split("-")
      .filter(Boolean)
      .map((word) => word[0]?.toUpperCase() + word.slice(1))
      .join(" ")
  );
}

type ProductContextRow = { label: string; value: string };

function getProductContext(
  productContext: Record<string, unknown> | null,
): ProductContextRow[] | null {
  if (!productContext) return null;

  const contextRows: ProductContextRow[] = [
    {
      label: "Business type",
      value: readContextValue(productContext.businessType),
    },
    {
      label: "Monthly spend",
      value: readContextValue(productContext.monthlySupplySpend),
    },
    {
      label: "Purchasing priority",
      value: readContextValue(productContext.biggestProcurementPain),
    },
    {
      label: "Suppliers",
      value: readContextValue(productContext.primarySuppliers),
    },
    { label: "Website", value: readContextValue(productContext.website) },
    {
      label: "Primary service",
      value: readContextValue(productContext.seoPrimaryService),
    },
    {
      label: "Target geography",
      value: readContextValue(productContext.seoTargetGeography),
    },
    { label: "Page goal", value: readContextValue(productContext.seoPageGoal) },
    { label: "Page type", value: readContextValue(productContext.seoPageType) },
    {
      label: "Existing page",
      value: readContextValue(productContext.seoExistingPageUrl),
    },
    {
      label: "Proof notes",
      value: readContextValue(productContext.seoProofPoints),
    },
    {
      label: "Reputation goal",
      value: readContextValue(productContext.reputationGoal),
    },
    {
      label: "Recent customers",
      value: readContextValue(productContext.recentCustomerCount),
    },
    {
      label: "Review profile",
      value: readContextValue(productContext.reviewProfileUrl),
    },
    {
      label: "Industry",
      value: readContextValue(productContext.growthIndustry),
    },
    {
      label: "Primary market",
      value: readContextValue(productContext.primaryMarket),
    },
    {
      label: "Growth goal",
      value: readContextValue(productContext.growthGoal),
    },
    {
      label: "Current marketing",
      value: readContextValue(productContext.currentMarketing),
    },
    {
      label: "Growth budget",
      value: readContextValue(productContext.monthlyGrowthBudget),
    },
    {
      label: "Growth notes",
      value: readContextValue(productContext.growthNotes),
    },
  ].filter((row): row is ProductContextRow => Boolean(row.value));

  return contextRows.length > 0 ? contextRows : null;
}

function readContextValue(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : "";
}

export default async function AdminWaitlistPage() {
  const rows = await getWaitlist();

  const converted = rows.filter((r) => r.entry.convertedToBusinessId).length;
  const pending = rows.length - converted;

  return (
    <div className="max-w-6xl">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">
            {rows.length} sign-up{rows.length !== 1 ? "s" : ""}{" "}
            <span className="text-amber-600 font-medium">
              {pending} unconverted
            </span>{" "}
            <span className="text-green-600 font-medium">
              {converted} converted
            </span>
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
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Contact
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Business
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Request
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  City / Category
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 font-semibold text-gray-600">
                  Signed up
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(({ entry, city, category }) => {
                const productContext = getProductContext(entry.productContext);

                return (
                  <tr
                    key={entry.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-4">
                      <p className="font-semibold text-gray-900">
                        {entry.name ?? "-"}
                      </p>
                      <p className="text-xs text-gray-500">{entry.email}</p>
                      {entry.phone ? (
                        <p className="text-xs text-gray-400">{entry.phone}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-gray-700">
                      {entry.businessName ?? "-"}
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {formatProductIntent(entry.productIntent)}
                      </span>
                      {productContext ? (
                        <div className="mt-2 space-y-0.5 text-xs text-gray-500">
                          {productContext.slice(0, 6).map((row) => (
                            <p key={`${entry.id}-${row.label}`}>
                              <span className="font-medium text-gray-600">
                                {row.label}:
                              </span>{" "}
                              {row.value}
                            </p>
                          ))}
                          {productContext.length > 6 ? (
                            <p className="font-medium text-gray-400">
                              +{productContext.length - 6} more context field
                              {productContext.length - 6 === 1 ? "" : "s"}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-gray-700">
                        {city ? `${city.name}, ${city.state}` : "-"}
                      </p>
                      <p className="text-xs text-gray-400">
                        {category?.icon} {category?.name ?? "-"}
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
