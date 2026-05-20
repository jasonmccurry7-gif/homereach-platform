// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - ScarcityLive (server component)
//
// Reads spot_assignments at render time. Output reflects current inventory
// truth, not a stored snapshot. Wrapped in ISR via the consuming route's
// `revalidate` export (usually 300s / 5min).
// ─────────────────────────────────────────────────────────────────────────────

import { getLiveScarcity } from "@/lib/seo/inventory-rules";

export async function ScarcityLive({
  cityId,
  categoryId,
  cityName,
  categoryName,
}: {
  cityId: string;
  categoryId: string | null;
  cityName: string;
  categoryName?: string | null;
}) {
  const scarcity = await getLiveScarcity(cityId, categoryId);

  if (!categoryId) {
    // City-only page: show open-category count instead of slot lock
    return (
      <div className="rounded-xl border border-blue-600/30 bg-blue-950/30 p-6">
        <p className="text-sm font-semibold text-blue-300">Availability in {cityName}</p>
        <p className="mt-2 text-2xl font-bold text-white">
          Multiple categories open
        </p>
        <p className="mt-1 text-sm text-gray-400">
          Each category is exclusive to one business. Claim yours before a competitor does.
        </p>
      </div>
    );
  }

  if (scarcity.is_locked) {
    return (
      <div className="rounded-xl border border-amber-600/30 bg-amber-950/30 p-6">
        <p className="text-sm font-semibold text-amber-300">
          The {cityName} {categoryName} slot is currently held
        </p>
        <p className="mt-2 text-lg text-white">
          Join the waitlist for when it opens, or explore other {cityName} categories.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-green-600/30 bg-green-950/30 p-6">
      <p className="text-sm font-semibold text-green-300">Open now</p>
      <p className="mt-2 text-2xl font-bold text-white">
        1 {categoryName} slot available in {cityName}
      </p>
      <p className="mt-1 text-sm text-gray-400">
        When it's claimed, it's gone until the current advertiser churns.
      </p>
    </div>
  );
}
