import type {
  BestPriceDeliveryBoard,
  BestPriceDeliveryRecommendation,
} from "@/lib/operations-copilot/delivery-intelligence";
import { getSupplierConnectors } from "@/lib/operations-copilot/supplier-connectors";

export type SupplierCheckoutMethod =
  | "supplier_search_redirect"
  | "b2b_portal_redirect"
  | "quote_request"
  | "punchout_ready"
  | "api_ready_reference";

export type SupplierCheckoutOption = {
  id: string;
  itemName: string;
  currentSupplier: string;
  recommendedSupplier: string;
  currentPriceCents: number;
  recommendedPriceCents: number;
  estimatedSavingsCents: number;
  trueLandedCostCents: number;
  deliveryEstimate: string;
  confidenceScore: number;
  confidenceLabel: "Low" | "Medium" | "High";
  sourceQuality: "verified" | "observed" | "estimated";
  sourceQualityLabel: string;
  checkoutMethod: SupplierCheckoutMethod;
  checkoutUrl: string | null;
  actionLabel: string;
  trustSignals: string[];
  disclaimer: string;
  trackingPayload: Record<string, unknown>;
};

export function buildSupplierCheckoutOptions({
  deliveryBoard,
}: {
  deliveryBoard: BestPriceDeliveryBoard;
}): SupplierCheckoutOption[] {
  return deliveryBoard.recommendations
    .filter((recommendation) => recommendation.savingsAudit.monthlyEstimatedSavingsCents > 0)
    .map(buildSupplierCheckoutOption)
    .sort((a, b) => b.estimatedSavingsCents - a.estimatedSavingsCents);
}

function buildSupplierCheckoutOption(
  recommendation: BestPriceDeliveryRecommendation
): SupplierCheckoutOption {
  const sourceQuality = dataQualityToSourceQuality(recommendation.savingsAudit.dataQuality);
  const confidenceScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        recommendation.supplierReliabilityScore * 0.45 +
          connectorModeConfidence(recommendation.connector.mode) * 0.35 +
          itemMatchScore(recommendation.itemMatchConfidence) * 0.2
      )
    )
  );
  const checkoutMethod = resolveCheckoutMethod(recommendation);
  const checkoutUrl = readApprovedSupplierCheckoutUrl(recommendation.searchUrl);
  const hasSupplierLink = Boolean(checkoutUrl);
  const actionLabel = hasSupplierLink
    ? "Review & Checkout with Supplier"
    : "Request Supplier Quote";

  return {
    id: `supplier-checkout-${recommendation.id}`,
    itemName: recommendation.itemName,
    currentSupplier: recommendation.currentVendorName,
    recommendedSupplier: recommendation.supplierName,
    currentPriceCents: recommendation.savingsAudit.currentVendorTotalCostCents,
    recommendedPriceCents:
      recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
    estimatedSavingsCents: Math.max(
      0,
      recommendation.savingsAudit.monthlyEstimatedSavingsCents
    ),
    trueLandedCostCents:
      recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
    deliveryEstimate: recommendation.estimatedDeliveryDateLabel,
    confidenceScore,
    confidenceLabel: confidenceScore >= 76 ? "High" : confidenceScore >= 58 ? "Medium" : "Low",
    sourceQuality,
    sourceQualityLabel: formatSourceQuality(sourceQuality),
    checkoutMethod,
    checkoutUrl,
    actionLabel,
    trustSignals: [
      `${recommendation.supplierReliabilityScore}/100 supplier reliability`,
      recommendation.deliveryLabel,
      `${formatSourceQuality(sourceQuality)} price basis`,
      recommendation.connector.liveOrderingEnabled
        ? "Live ordering available"
        : "Direct supplier checkout only",
    ],
    disclaimer:
      "HomeReach does not process this supplier payment. Review availability, account pricing, taxes, delivery fees, and substitutions at the supplier checkout before buying.",
    trackingPayload: {
      source: "supplier_checkout_orchestration",
      recommendationId: recommendation.id,
      sku: recommendation.sku,
      itemName: recommendation.itemName,
      category: recommendation.category,
      currentSupplier: recommendation.currentVendorName,
      recommendedSupplier: recommendation.supplierName,
      checkoutUrl,
      checkoutMethod,
      currentPriceCents: recommendation.savingsAudit.currentVendorTotalCostCents,
      recommendedPriceCents:
        recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
      trueLandedCostCents:
        recommendation.savingsAudit.recommendedTotalDeliveredCostCents,
      estimatedSavingsCents: Math.max(
        0,
        recommendation.savingsAudit.monthlyEstimatedSavingsCents
      ),
      confidence: confidenceScore >= 76 ? "high" : confidenceScore >= 58 ? "medium" : "low",
      confidenceScore,
      sourceQuality,
      sourceQualityLabel: formatSourceQuality(sourceQuality),
      deliveryEstimate: recommendation.estimatedDeliveryDateLabel,
      approvalOnly: true,
      supplierPaymentProcessedByHomeReach: false,
      liveOrderingEnabled: false,
    },
  };
}

export function readApprovedSupplierCheckoutUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  let candidate: URL;
  try {
    candidate = new URL(value);
  } catch {
    return null;
  }

  if (candidate.protocol !== "https:") return null;
  if (candidate.username || candidate.password) return null;

  const normalizedCandidate = normalizeUrl(candidate);
  const allowed = getSupplierConnectors()
    .map((connector) => connector.searchUrlPattern)
    .filter((pattern): pattern is string => Boolean(pattern))
    .some((pattern) => supplierUrlMatchesPattern(normalizedCandidate, pattern));

  return allowed ? normalizedCandidate.toString() : null;
}

function supplierUrlMatchesPattern(candidate: URL, pattern: string) {
  let reference: URL;
  try {
    reference = new URL(pattern.replace("{query}", "supplies"));
  } catch {
    return false;
  }

  if (candidate.protocol !== "https:") return false;
  if (candidate.hostname.toLowerCase() !== reference.hostname.toLowerCase()) return false;

  const referencePath = reference.pathname ?? "";
  const candidatePath = candidate.pathname ?? "";
  const queryPathIndex = referencePath.indexOf("supplies");
  if (queryPathIndex === -1) {
    if (candidatePath !== referencePath) return false;
  } else {
    const pathPrefix = referencePath.slice(0, queryPathIndex);
    const pathSuffix = referencePath.slice(queryPathIndex + "supplies".length);
    if (!candidatePath.startsWith(pathPrefix)) return false;
    if (!candidatePath.endsWith(pathSuffix)) return false;
    if (candidatePath.length <= pathPrefix.length + pathSuffix.length) return false;
  }

  const referenceParams = Array.from(reference.searchParams.entries());
  if (referenceParams.length === 0) return candidate.searchParams.size === 0;
  if (candidate.searchParams.size !== reference.searchParams.size) return false;

  return referenceParams.every(([key, referenceValue]) => {
    const candidateValue = candidate.searchParams.get(key);
    if (!candidateValue) return false;
    return referenceValue === "supplies" || candidateValue === referenceValue;
  });
}

function normalizeUrl(url: URL) {
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";
  return url;
}

function resolveCheckoutMethod(
  recommendation: BestPriceDeliveryRecommendation
): SupplierCheckoutMethod {
  if (!recommendation.searchUrl) return "quote_request";
  if (recommendation.connector.mode === "api_ready") return "api_ready_reference";
  if (recommendation.connector.mode === "edi_cxml_ready") return "b2b_portal_redirect";
  if (recommendation.connector.mode === "search_reference") {
    return "supplier_search_redirect";
  }
  return "supplier_search_redirect";
}

function dataQualityToSourceQuality(
  quality: BestPriceDeliveryRecommendation["savingsAudit"]["dataQuality"]
): "verified" | "observed" | "estimated" {
  if (quality === "verified") return "verified";
  if (quality === "benchmark") return "observed";
  return "estimated";
}

function formatSourceQuality(quality: "verified" | "observed" | "estimated") {
  return quality === "verified"
    ? "Verified"
    : quality === "observed"
      ? "Observed"
      : "Estimated";
}

function itemMatchScore(match: BestPriceDeliveryRecommendation["itemMatchConfidence"]) {
  if (match === "high") return 90;
  if (match === "medium") return 68;
  return 44;
}

function connectorModeConfidence(
  mode: BestPriceDeliveryRecommendation["connector"]["mode"]
) {
  if (mode === "api_ready") return 74;
  if (mode === "edi_cxml_ready") return 68;
  if (mode === "search_reference") return 62;
  if (mode === "csv_import") return 58;
  return 52;
}
