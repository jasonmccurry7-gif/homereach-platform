// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - PricingLive (server component)
//
// Reads bundles at render time and uses the existing resolvePrice() engine
// to show authoritative pricing. Falls back gracefully when no bundles are
// defined for the city+category pair.
// ─────────────────────────────────────────────────────────────────────────────

import { getBundlesWithAvailability } from "@/lib/funnel/queries";

export async function PricingLive({
  cityId,
  categoryId,
}: {
  cityId: string;
  categoryId: string | null;
}) {
  if (!categoryId) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
        <p className="text-sm font-semibold text-gray-300">Pricing</p>
        <p className="mt-2 text-white">
          Varies by category. Pick a category to see exact pricing for your slot.
        </p>
      </div>
    );
  }

  const bundles = await getBundlesWithAvailability(cityId, categoryId);
  const availableBundles = bundles.filter((b) => !b.isSoldOut);

  if (availableBundles.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
        <p className="text-sm font-semibold text-gray-300">Pricing</p>
        <p className="mt-2 text-white">
          Exact pricing shown at checkout. All plans include monthly postcard placement + reporting.
        </p>
      </div>
    );
  }

  // Show the lowest-priced available bundle as the anchor price
  const sorted = [...availableBundles].sort(
    (a, b) => a.standardPriceCents - b.standardPriceCents,
  );
  const anchor = sorted[0];
  const displayPrice = anchor.standardPriceCents / 100;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
      <p className="text-sm font-semibold text-gray-300">Starting from</p>
      <p className="mt-2 text-3xl font-bold text-white">
        ${displayPrice.toLocaleString()}
        <span className="ml-2 text-sm font-normal text-gray-400">/ month</span>
      </p>
      <p className="mt-2 text-sm text-gray-400">
        {availableBundles.length} plan{availableBundles.length === 1 ? "" : "s"} available. Exact pricing confirmed at checkout.
      </p>
    </div>
  );
}
