// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Content Intelligence: Canonical Category Lists
//
// Two audiences, filtered at the API layer:
//
//   HOME_SERVICE_CATEGORIES  → shown to sales agents on the sales dashboard.
//                               These are HomeReach's live service verticals.
//
//   ADMIN_ONLY_CATEGORIES    → admin-only (you, Jason). Includes Dan Martell's
//                               sales/scaling content and anything not tied to
//                               a specific service vertical.
//
// The admin content-intel dashboard shows everything (admin sees all).
// The sales-dashboard cards API filters to HOME_SERVICE_CATEGORIES only.
// ─────────────────────────────────────────────────────────────────────────────

export const HOME_SERVICE_CATEGORIES = [
  "pressure_washing",
  "lawn_care",
  "window_cleaning",
  "gutter_cleaning",
  "pest_control",
  "roofing",
] as const;

export const ADMIN_ONLY_CATEGORIES = [
  "sales_scaling", // Dan Martell, general sales/ops content
] as const;

export type HomeServiceCategory = (typeof HOME_SERVICE_CATEGORIES)[number];
export type AdminOnlyCategory   = (typeof ADMIN_ONLY_CATEGORIES)[number];

/** Coerce the `'*'` "all categories" marker (used in ci_trusted_channels)
 *  into a concrete artifact category. Dan Martell is tagged '*' at the
 *  channel level but his artifacts need a stable category. */
export function resolveChannelCategory(rawCategory: string | null | undefined): string {
  if (!rawCategory || rawCategory === "*") return "sales_scaling";
  return rawCategory;
}

/** True when an artifact should appear on the sales dashboard. */
export function isAgentVisibleCategory(category: string): boolean {
  return (HOME_SERVICE_CATEGORIES as readonly string[]).includes(category);
}
