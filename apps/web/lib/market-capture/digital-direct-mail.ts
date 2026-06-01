export const DIGITAL_DIRECT_MAIL_BUNDLE_SKU = "market_capture_digital_mail_founder";

export type DigitalDirectMailPath = "targeted_direct_mail" | "shared_postcard" | "political_mail" | "needs_quote";

export type DigitalDirectMailBundleMetadata = {
  enabled: boolean;
  bundleSku: typeof DIGITAL_DIRECT_MAIL_BUNDLE_SKU;
  directMailPath: DigitalDirectMailPath;
  estimatedMailQuantity?: number | null;
  format?: string | null;
  inHomeWindow?: string | null;
  trackingDestination?: string | null;
  proofApprovalContact?: string | null;
  sameAreaForMail: boolean;
  planningNotes?: string | null;
  quoteStatus: "needs_quote" | "quote_pending" | "quote_ready";
  readinessScore: number;
  missingItems: string[];
  nextAction: string;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDirectMailPath(value: string | null | undefined): DigitalDirectMailPath {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized.includes("shared")) return "shared_postcard";
  if (normalized.includes("political")) return "political_mail";
  if (normalized.includes("target")) return "targeted_direct_mail";
  return "needs_quote";
}

function parseQuantity(value: string | null | undefined) {
  const numeric = Number(String(value ?? "").replace(/[^0-9]/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return null;
  return Math.min(250000, Math.round(numeric));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function scoreBundle(input: {
  enabled: boolean;
  targetArea?: string | null;
  campaignOffer?: string | null;
  estimatedMailQuantity?: number | null;
  trackingDestination?: string | null;
  proofApprovalContact?: string | null;
  sameAreaForMail: boolean;
}) {
  const missingItems: string[] = [];
  let score = input.enabled ? 35 : 0;

  if (!input.enabled) {
    return {
      readinessScore: 0,
      missingItems: ["Direct mail add-on was not requested."],
      nextAction: "No direct mail bundle action needed.",
    };
  }

  if (normalizeText(input.targetArea)) score += 15;
  else missingItems.push("Confirm the target geography for both channels.");

  if (normalizeText(input.campaignOffer)) score += 15;
  else missingItems.push("Confirm the campaign offer before creative proofing.");

  if (Number(input.estimatedMailQuantity ?? 0) > 0) score += 10;
  else missingItems.push("Estimate or verify direct mail quantity before quoting.");

  if (normalizeText(input.trackingDestination)) score += 10;
  else missingItems.push("Confirm QR or landing page tracking destination.");

  if (normalizeText(input.proofApprovalContact)) score += 10;
  else missingItems.push("Confirm the proof approval contact.");

  if (input.sameAreaForMail) score += 5;
  else missingItems.push("Confirm whether mail should match the digital target area.");

  const readinessScore = clampScore(score);
  return {
    readinessScore,
    missingItems,
    nextAction: missingItems[0] ?? "Prepare direct mail quote and proof packet.",
  };
}

export function buildDigitalDirectMailBundleMetadata(input: {
  postcardAddon: boolean;
  targetingTypes?: string[];
  targetArea?: string | null;
  campaignOffer?: string | null;
  directMailPath?: string | null;
  directMailQuantity?: string | null;
  directMailFormat?: string | null;
  directMailDropWindow?: string | null;
  directMailTrackingDestination?: string | null;
  directMailProofContact?: string | null;
  sameAreaForMail?: boolean;
  directMailBundleNotes?: string | null;
}) {
  const directMailPath = parseDirectMailPath(input.directMailPath);
  const estimatedMailQuantity = parseQuantity(input.directMailQuantity);
  const enabled =
    input.postcardAddon ||
    Boolean(input.targetingTypes?.includes("digital_direct_mail")) ||
    Boolean(estimatedMailQuantity) ||
    Boolean(normalizeText(input.directMailBundleNotes));
  const sameAreaForMail = Boolean(input.sameAreaForMail || enabled);
  const score = scoreBundle({
    enabled,
    targetArea: input.targetArea,
    campaignOffer: input.campaignOffer,
    estimatedMailQuantity,
    trackingDestination: input.directMailTrackingDestination,
    proofApprovalContact: input.directMailProofContact,
    sameAreaForMail,
  });

  return {
    enabled,
    bundleSku: DIGITAL_DIRECT_MAIL_BUNDLE_SKU,
    directMailPath,
    estimatedMailQuantity,
    format: normalizeText(input.directMailFormat) || null,
    inHomeWindow: normalizeText(input.directMailDropWindow) || null,
    trackingDestination: normalizeText(input.directMailTrackingDestination) || null,
    proofApprovalContact: normalizeText(input.directMailProofContact) || null,
    sameAreaForMail,
    planningNotes: normalizeText(input.directMailBundleNotes) || null,
    quoteStatus: enabled && estimatedMailQuantity ? "quote_pending" : enabled ? "needs_quote" : "needs_quote",
    readinessScore: score.readinessScore,
    missingItems: score.missingItems,
    nextAction: score.nextAction,
  } satisfies DigitalDirectMailBundleMetadata;
}

export function getDigitalDirectMailBundleMetadata(metadata: unknown): DigitalDirectMailBundleMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { digital_direct_mail_bundle?: unknown }).digital_direct_mail_bundle;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<DigitalDirectMailBundleMetadata>;
  return {
    enabled: Boolean(candidate.enabled),
    bundleSku: DIGITAL_DIRECT_MAIL_BUNDLE_SKU,
    directMailPath: parseDirectMailPath(candidate.directMailPath),
    estimatedMailQuantity: Number.isFinite(Number(candidate.estimatedMailQuantity)) ? Number(candidate.estimatedMailQuantity) : null,
    format: candidate.format ?? null,
    inHomeWindow: candidate.inHomeWindow ?? null,
    trackingDestination: candidate.trackingDestination ?? null,
    proofApprovalContact: candidate.proofApprovalContact ?? null,
    sameAreaForMail: Boolean(candidate.sameAreaForMail),
    planningNotes: candidate.planningNotes ?? null,
    quoteStatus: candidate.quoteStatus === "quote_ready" || candidate.quoteStatus === "quote_pending" ? candidate.quoteStatus : "needs_quote",
    readinessScore: Number.isFinite(Number(candidate.readinessScore)) ? Number(candidate.readinessScore) : 0,
    missingItems: Array.isArray(candidate.missingItems) ? candidate.missingItems.filter((item) => typeof item === "string") : [],
    nextAction: candidate.nextAction || "Review direct mail bundle scope.",
  };
}

export function summarizeDigitalDirectMailBundle(input: DigitalDirectMailBundleMetadata | null) {
  if (!input?.enabled) return "No structured Digital + Direct Mail bundle details submitted.";
  const quantity = input.estimatedMailQuantity ? `${input.estimatedMailQuantity.toLocaleString()} estimated mail pieces` : "quantity needs quote";
  return `Digital + Direct Mail bundle requested (${input.directMailPath}); ${quantity}; readiness ${input.readinessScore}/100.`;
}
