import "server-only";

import { getContractOSBillingStatus } from "./billing";
import { contractOSFeatureFlags } from "./config";

export type ContractOSProductionDepthItem = {
  label: string;
  status: "ready" | "needs_key" | "needs_setup" | "locked";
  detail: string;
  action: string;
};

export function getContractOSProductionDepth() {
  const flags = contractOSFeatureFlags();
  const billing = getContractOSBillingStatus();
  const hasAiSummaryProvider = flags.aiDocumentAnalysis && Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);

  const items: ContractOSProductionDepthItem[] = [
    {
      label: "SAM.gov live sync",
      status: !flags.samSync ? "locked" : process.env.SAM_GOV_API_KEY ? "ready" : "needs_key",
      detail: !flags.samSync
        ? "Live sync is intentionally disabled by feature flag; manual/internal records and sample fallback remain safe."
        : process.env.SAM_GOV_API_KEY
        ? "SAM_GOV_API_KEY is visible in this runtime; the protected sync route can pull active opportunities."
        : "Live sync is blocked until SAM_GOV_API_KEY is added to production.",
      action: flags.samSync
        ? "Add SAM_GOV_API_KEY in Vercel and run /api/admin/gov-contracts/sync as admin or cron."
        : "Enable GOV_CONTRACTS_SAM_SYNC only after the operating owner wants live refreshes.",
    },
    {
      label: "USAspending.gov award history",
      status: "ready",
      detail: "Connector uses the public USAspending.gov award search API for recent comparable award context.",
      action: "Use historical awards as pricing context only; never as a bid price by itself.",
    },
    {
      label: "SBA guidance source library",
      status: "ready",
      detail: "Structured SBA guidance is available for readiness, certifications, set-asides, and subcontracting education.",
      action: "Show guidance in owner-facing readiness and bid workspace screens.",
    },
    {
      label: "Document upload and summarization",
      status: flags.documentAnalyzer ? (hasAiSummaryProvider ? "ready" : "locked") : "needs_setup",
      detail: hasAiSummaryProvider
        ? "Uploads can be parsed and summarized with the configured AI provider."
        : flags.documentAnalyzer
          ? "Upload parsing is live. AI summarization is intentionally opt-in; deterministic extraction runs until ENABLE_CONTRACTOS_AI_ANALYSIS is true and a provider key exists."
          : "Document analysis is disabled by feature flag.",
      action: "Enable AI analysis only when public usage, cost controls, and human review expectations are acceptable.",
    },
    {
      label: "Subscription and paid workspace checkout",
      status: !flags.billing ? "locked" : billing.fullyConfigured ? "ready" : "needs_setup",
      detail: !flags.billing
        ? "Checkout is intentionally disabled by feature flag; managed sales can still use manual quoting."
        : billing.fullyConfigured
        ? "Stripe secret and ContractOS price IDs are configured."
        : `Checkout is gated until these env vars are present: ${billing.missingEnv.join(", ")}.`,
      action: flags.billing
        ? "Create Stripe products/prices and set ContractOS price IDs before exposing paid workspace CTAs at scale."
        : "Use manual quote/payment process until ContractOS billing is enabled.",
    },
    {
      label: "Bid submission",
      status: "locked",
      detail: "Submission remains intentionally locked behind human review. ContractOS prepares review packets only.",
      action: "Keep official submission outside automation until an authorized human confirms final package, representations, and method.",
    },
  ];

  return {
    generatedAt: new Date().toISOString(),
    score: Math.round((items.filter((item) => item.status === "ready" || item.status === "locked").length / items.length) * 100),
    items,
    billing,
  };
}
