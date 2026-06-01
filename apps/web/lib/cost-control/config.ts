function enabled(key: string) {
  return process.env[key] !== "false";
}

export function isCostControlEnabled() {
  return enabled("ENABLE_COST_CONTROL_ENGINE");
}

export function isSupplierDirectoryEnabled() {
  return isCostControlEnabled() && enabled("ENABLE_SUPPLIER_DIRECTORY");
}

export function isSavingsTrackerEnabled() {
  return isCostControlEnabled() && enabled("ENABLE_SAVINGS_TRACKER");
}

export function isCostControlScoreEnabled() {
  return isCostControlEnabled() && enabled("ENABLE_COST_CONTROL_SCORE");
}

export function isCostControlReportingEnabled() {
  return isCostControlEnabled() && enabled("ENABLE_COST_CONTROL_REPORTING");
}

export function isCostControlQueueEnabled() {
  return isCostControlEnabled() && enabled("ENABLE_COST_CONTROL_QUEUE");
}

export function hasCostControlPersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function formatCostControlMoney(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}
