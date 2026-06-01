export type IntegrationStatus = "ready" | "degraded" | "not_configured" | "disabled" | "error";

function enabled(key: string) {
  return process.env[key] !== "false";
}

function hasAll(keys: string[]) {
  return keys.every((key) => Boolean(process.env[key]));
}

export function isMetaDraftsEnabled() {
  return enabled("ENABLE_META_DRAFTS");
}

export function isGoogleDraftsEnabled() {
  return enabled("ENABLE_GOOGLE_DRAFTS");
}

export function isGeocodingEnabled() {
  return enabled("ENABLE_GEOCODING");
}

export function isTargetValidationEnabled() {
  return enabled("ENABLE_TARGET_VALIDATION");
}

export function isReportingImportsEnabled() {
  return enabled("ENABLE_REPORTING_IMPORTS");
}

export function isAttributionLayerEnabled() {
  return enabled("ENABLE_ATTRIBUTION_LAYER");
}

export function isLaunchPackagesEnabled() {
  return enabled("ENABLE_LAUNCH_PACKAGES");
}

export function isIntegrationHealthEnabled() {
  return enabled("ENABLE_INTEGRATION_HEALTH");
}

export function hasAdTechPersistence() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function metaCredentials() {
  const accessToken = process.env.META_ACCESS_TOKEN || process.env.META_MARKETING_API_ACCESS_TOKEN || "";
  const adAccountId = process.env.META_AD_ACCOUNT_ID || "";
  return {
    accessToken,
    adAccountId,
    ready: Boolean(accessToken && adAccountId),
  };
}

export function googleAdsCredentials() {
  return {
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || "",
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || "",
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || "",
    refreshToken: process.env.GOOGLE_ADS_REFRESH_TOKEN || "",
    ready: hasAll(["GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_DEVELOPER_TOKEN"]),
    fullOAuthReady: hasAll(["GOOGLE_ADS_CUSTOMER_ID", "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET", "GOOGLE_ADS_REFRESH_TOKEN"]),
  };
}

export function googleMapsCredentials() {
  return {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || "",
    ready: Boolean(process.env.GOOGLE_MAPS_API_KEY),
  };
}

export function adApiLaunchStatus() {
  return {
    enabled: process.env.ENABLE_AD_API_LAUNCH === "true",
    manualMode: process.env.ENABLE_MANUAL_AD_LAUNCH_MODE !== "false",
  };
}

export function formatAdTechMoney(cents: number) {
  return (Math.max(0, cents) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

export function integrationFeatureFlags() {
  return {
    metaDrafts: isMetaDraftsEnabled(),
    googleDrafts: isGoogleDraftsEnabled(),
    geocoding: isGeocodingEnabled(),
    targetValidation: isTargetValidationEnabled(),
    reportingImports: isReportingImportsEnabled(),
    attribution: isAttributionLayerEnabled(),
    launchPackages: isLaunchPackagesEnabled(),
    integrationHealth: isIntegrationHealthEnabled(),
    adApiLaunch: adApiLaunchStatus().enabled,
    manualLaunchMode: adApiLaunchStatus().manualMode,
  };
}
