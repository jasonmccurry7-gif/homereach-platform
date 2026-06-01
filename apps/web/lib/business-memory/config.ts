function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isBusinessMemoryEnabled() {
  return enabled("ENABLE_BUSINESS_MEMORY");
}

export function isBusinessMemoryTimelineEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_BUSINESS_MEMORY_TIMELINE");
}

export function isBusinessMemoryInsightsEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_BUSINESS_MEMORY_INSIGHTS");
}

export function isBusinessMemorySearchEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_BUSINESS_MEMORY_SEARCH");
}

export function isBusinessMemoryClientViewEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_BUSINESS_MEMORY_CLIENT_VIEW");
}

export function isBusinessMemoryAdminViewEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_BUSINESS_MEMORY_ADMIN_VIEW");
}

export function isMemoryHealthScoreEnabled() {
  return isBusinessMemoryEnabled() && enabled("ENABLE_MEMORY_HEALTH_SCORE");
}

export function hasBusinessMemoryPersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function formatUsdCents(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
