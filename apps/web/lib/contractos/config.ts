import "server-only";

function flagEnabled(key: string, fallback: boolean) {
  const value = process.env[key]?.trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export function contractOSFeatureFlags() {
  return {
    enabled: flagEnabled("ENABLE_CONTRACTOS", true),
    publicDashboard: flagEnabled("ENABLE_CONTRACTOS_PUBLIC_DASHBOARD", true),
    documentAnalyzer: flagEnabled("ENABLE_CONTRACTOS_DOCUMENT_ANALYZER", true),
    aiDocumentAnalysis: flagEnabled("ENABLE_CONTRACTOS_AI_ANALYSIS", false),
    billing: flagEnabled("ENABLE_CONTRACTOS_BILLING", true),
    samSync: flagEnabled("ENABLE_GOV_CONTRACTS_SAM_SYNC", true),
  };
}

export function isContractOSEnabled() {
  return contractOSFeatureFlags().enabled;
}

export function isContractOSAiAnalysisEnabled() {
  const flags = contractOSFeatureFlags();
  return flags.enabled && flags.documentAnalyzer && flags.aiDocumentAnalysis;
}
