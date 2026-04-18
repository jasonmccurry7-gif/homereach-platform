// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Emergency Inventory Deny-List
//
// Temporary hard-block list. Every entry here is treated as UNAVAILABLE
// by both /api/spots/availability and /api/spots/checkout, regardless of
// what the underlying tables say.
//
// Use this when an integrity issue has been detected in production but
// the structural root fix has not yet shipped or has not yet been
// validated to close the original gap.
//
// Match is case-insensitive on trimmed city + category name. This is the
// same matching rule used by the canonical-availability helper when
// comparing against legacy migration metadata, so adding an entry here
// covers both a UUID-driven request and a slug-driven request.
//
// REMOVE entries once the underlying DB state is reconciled.
// ─────────────────────────────────────────────────────────────────────────────

export type DenyEntry = {
  /** Case-insensitive city name match (normalized: trimmed, lowercased) */
  city: string;
  /** Case-insensitive category name match */
  category: string;
  /** Reason displayed in the 409 response for support diagnostics */
  reason: string;
  /** ISO date the entry was added (for audit) */
  addedAt: string;
};

export const DENY_LIST: DenyEntry[] = [
  {
    city: "wooster",
    category: "pressure washing",
    reason:
      "Inventory integrity lock: Wooster + Pressure Washing is already assigned to a migrated client. Do not re-sell until backfill migration 051 has run and reconciliation is confirmed.",
    addedAt: "2026-04-17",
  },
];

/** Normalize a user-supplied city/category label for deny-list comparison. */
export function normalizeName(s: string | null | undefined): string {
  if (!s) return "";
  // Strip trailing ", OH" / ", XX" state suffix and collapse whitespace
  return s
    .toLowerCase()
    .replace(/,\s*[a-z]{2}$/i, "")
    .trim();
}

/** Returns matching deny entry, or null. */
export function checkDenyList(
  cityName: string | null | undefined,
  categoryName: string | null | undefined,
): DenyEntry | null {
  const c = normalizeName(cityName);
  const k = normalizeName(categoryName);
  if (!c || !k) return null;
  return DENY_LIST.find((e) => e.city === c && e.category === k) ?? null;
}
