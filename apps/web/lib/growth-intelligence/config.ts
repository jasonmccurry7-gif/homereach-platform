function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isGrowthIntelligenceEnabled() {
  return enabled("ENABLE_GROWTH_INTELLIGENCE_ENGINE");
}

export function isGrowthOpportunityCardsEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_GROWTH_OPPORTUNITY_CARDS");
}

export function isAdminIntelligenceEntriesEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_ADMIN_INTELLIGENCE_ENTRIES");
}

export function isGrowthScoringEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_GROWTH_SCORING");
}

export function isGrowthClientMatchingEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_GROWTH_CLIENT_MATCHING");
}

export function isGrowthReportingEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_GROWTH_REPORTING");
}

export function isGrowthAiDraftsEnabled() {
  return isGrowthIntelligenceEnabled() && enabled("ENABLE_GROWTH_AI_DRAFTS");
}

export function hasGrowthIntelligencePersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function formatGrowthMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
