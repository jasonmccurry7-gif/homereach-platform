export const DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS = 49900;
export const DIGITAL_TARGETING_PRODUCT_NAME = "Neighborhood Digital Targeting";

export function isDigitalTargetingEnabled() {
  return process.env.ENABLE_DIGITAL_TARGETING !== "false";
}

export function isGeofenceIntakeEnabled() {
  return isDigitalTargetingEnabled() && process.env.ENABLE_GEOFENCE_INTAKE !== "false";
}

export function isManualAdLaunchModeEnabled() {
  return process.env.ENABLE_MANUAL_AD_LAUNCH_MODE !== "false";
}

export function isAdApiLaunchEnabled() {
  return process.env.ENABLE_AD_API_LAUNCH === "true";
}

export function isClientGeofenceDashboardEnabled() {
  return isDigitalTargetingEnabled() && process.env.ENABLE_CLIENT_GEOFENCE_DASHBOARD !== "false";
}

export function hasDigitalTargetingStripeCheckout() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function formatUsd(cents: number) {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function parseDollarInputToCents(value: unknown, fallbackCents = 0) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value * 100));
  }

  if (typeof value !== "string") return fallbackCents;
  const normalized = value.replace(/[$,\s]/g, "");
  if (!normalized) return fallbackCents;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return fallbackCents;
  return Math.max(0, Math.round(parsed * 100));
}
