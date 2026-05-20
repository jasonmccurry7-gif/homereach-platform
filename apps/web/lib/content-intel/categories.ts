// HomeReach - Content Intelligence / Learning Engine: canonical category lists.
//
// HOME_SERVICE_CATEGORIES are the only categories shown to sales agents on
// sales-dashboard cards. The broader Learning Engine categories are admin-only
// research and optimization lanes until a human promotes an idea into an
// implementation task.

export const HOME_SERVICE_CATEGORIES = [
  "pressure_washing",
  "lawn_care",
  "window_cleaning",
  "gutter_cleaning",
  "pest_control",
  "roofing",
] as const;

export const ADMIN_ONLY_CATEGORIES = [
  "sales_scaling",
  "shared_postcards",
  "targeted_campaigns",
  "political",
  "procurement",
  "outreach",
  "seo",
  "inventory",
  "ai_agents",
  "revenue",
  "executive_operations",
  "system_reliability",
  "automation",
  "dashboard_ux",
  "gov_contracts",
  "creative",
] as const;

export const LEARNING_ENGINE_CATEGORIES = [
  ...HOME_SERVICE_CATEGORIES,
  ...ADMIN_ONLY_CATEGORIES,
] as const;

export type HomeServiceCategory = (typeof HOME_SERVICE_CATEGORIES)[number];
export type AdminOnlyCategory = (typeof ADMIN_ONLY_CATEGORIES)[number];
export type LearningEngineCategory = (typeof LEARNING_ENGINE_CATEGORIES)[number];

/** Coerce the '*' all-categories marker into a concrete artifact category. */
export function resolveChannelCategory(rawCategory: string | null | undefined): string {
  if (!rawCategory || rawCategory === "*") return "sales_scaling";
  return rawCategory;
}

/** True when an artifact should appear on the sales dashboard. */
export function isAgentVisibleCategory(category: string): boolean {
  return (HOME_SERVICE_CATEGORIES as readonly string[]).includes(category);
}

/** True when a category belongs to the full admin-only Learning Engine. */
export function isLearningEngineCategory(category: string): boolean {
  return (LEARNING_ENGINE_CATEGORIES as readonly string[]).includes(category);
}
