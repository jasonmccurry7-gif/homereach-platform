export function isGrowthOsEnabled() {
  return process.env.ENABLE_FOOD_SERVICE_GROWTH_OS === "true";
}

export function getGrowthOsCronSecret() {
  return process.env.FSGOS_CRON_SECRET ?? "";
}

export function getGrowthOsBenchmarkSystemUserId() {
  return process.env.FSGOS_BENCHMARK_SYSTEM_USER_ID ?? "";
}
