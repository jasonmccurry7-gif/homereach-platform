export type PriceSourceQuality = "verified" | "observed" | "estimated";

export type PriceFreshness = "fresh" | "aging" | "stale" | "missing";

export const verifiedPriceSourceTypes = new Set([
  "invoice_upload",
  "csv_import",
  "manual_quote",
  "supplier_api",
  "supplier_portal_api",
  "edi_832",
  "cxml_punchout",
  "supplier_portal",
]);

export const observedPriceSourceTypes = new Set([
  "public_web",
  "public_web_search",
  "web_search_reference",
  "supplier_search_reference",
]);

export const estimatedPriceSourceTypes = new Set([
  "benchmark_estimate",
  "ai_estimate",
  "quote_request",
]);

export const supportedPriceSourceTypes = [
  "invoice_upload",
  "csv_import",
  "manual_quote",
  "supplier_api",
  "supplier_portal_api",
  "edi_832",
  "cxml_punchout",
  "supplier_portal",
  "public_web",
  "public_web_search",
  "web_search_reference",
  "supplier_search_reference",
  "benchmark_estimate",
  "ai_estimate",
  "quote_request",
] as const;

export function resolvePriceSourceQuality(sourceType: string): PriceSourceQuality {
  if (verifiedPriceSourceTypes.has(sourceType)) return "verified";
  if (observedPriceSourceTypes.has(sourceType)) return "observed";
  return "estimated";
}

export function formatPriceSourceQuality(quality: PriceSourceQuality) {
  if (quality === "verified") return "Verified";
  if (quality === "observed") return "Observed";
  return "Estimated";
}

export function formatPriceSourceType(sourceType: string) {
  return sourceType
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isVerifiedPriceSource(sourceType: string) {
  return resolvePriceSourceQuality(sourceType) === "verified";
}

export function isLiveSupplierFeedSource(sourceType: string) {
  return [
    "supplier_api",
    "supplier_portal_api",
    "edi_832",
    "cxml_punchout",
    "live_supplier_feed",
  ].includes(sourceType);
}

export function resolvePriceFreshness({
  capturedAt,
  sourceQuality,
  now = new Date(),
}: {
  capturedAt: Date | string | null | undefined;
  sourceQuality: PriceSourceQuality;
  now?: Date;
}): PriceFreshness {
  if (!capturedAt) return "missing";
  const captured = capturedAt instanceof Date ? capturedAt : new Date(capturedAt);
  if (Number.isNaN(captured.getTime())) return "missing";

  const ageHours = Math.max(0, now.getTime() - captured.getTime()) / 36e5;
  const freshHours = sourceQuality === "verified" ? 36 : sourceQuality === "observed" ? 72 : 168;
  const staleHours = sourceQuality === "verified" ? 96 : sourceQuality === "observed" ? 168 : 336;

  if (ageHours <= freshHours) return "fresh";
  if (ageHours <= staleHours) return "aging";
  return "stale";
}

export function formatFreshnessLabel(freshness: PriceFreshness) {
  if (freshness === "fresh") return "Fresh";
  if (freshness === "aging") return "Needs refresh soon";
  if (freshness === "stale") return "Stale";
  return "No snapshot";
}

export function formatLastUpdatedLabel(value: Date | string | null | undefined) {
  if (!value) return "Not updated";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Not updated";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
