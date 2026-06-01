function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isAiCooEnabled() {
  return enabled("ENABLE_AI_COO");
}

export function isAiCooQueueEnabled() {
  return isAiCooEnabled() && enabled("ENABLE_AI_COO_QUEUE");
}

export function isAiCooRecommendationsEnabled() {
  return isAiCooEnabled() && enabled("ENABLE_AI_COO_RECOMMENDATIONS");
}

export function isAiCooDraftsEnabled() {
  return isAiCooEnabled() && enabled("ENABLE_AI_COO_DRAFTS");
}

export function isAiCooScoresEnabled() {
  return isAiCooEnabled() && enabled("ENABLE_AI_COO_SCORES");
}

export function isAiCooClientFeedEnabled() {
  return isAiCooEnabled() && enabled("ENABLE_AI_COO_CLIENT_FEED");
}

export function isAiCooAdminQueueEnabled() {
  return isAiCooQueueEnabled() && enabled("ENABLE_AI_COO_ADMIN_QUEUE");
}

export function hasAiCooPersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function formatUsdCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
