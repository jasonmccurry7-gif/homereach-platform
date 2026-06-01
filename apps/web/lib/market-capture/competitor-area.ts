export const COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT = 10;
export const COMPETITOR_AREA_ADDITIONAL_VALIDATION_CENTS = 4900;

export type CompetitorAreaLocation = {
  name: string;
  address: string;
  category?: string | null;
  priority: "primary" | "secondary";
  radiusMiles: number;
  notes?: string | null;
  validationStatus: "needs_review";
};

export type CompetitorAreaMetadata = {
  enabled: boolean;
  includedLocationLimit: number;
  additionalValidationFeeCents: number;
  defaultRadiusMiles: number;
  radiusPreference?: string | null;
  radiusReason: string;
  campaignGoal?: string | null;
  complianceAcknowledged: boolean;
  platformPolicyReviewRequired: boolean;
  locations: CompetitorAreaLocation[];
  duplicateCount: number;
  additionalLocationCount: number;
  readinessScore: number;
  priority: "high" | "medium" | "low";
  scoreReasons: string[];
  policyWarnings: string[];
  missingItems: string[];
  nextAction: string;
};

const STRONG_COMPETITOR_FIT = [
  "roof",
  "hvac",
  "lawn",
  "landscap",
  "pest",
  "concrete",
  "siding",
  "window",
  "solar",
  "plumb",
  "electric",
  "real estate",
  "realtor",
  "med spa",
  "dent",
  "restaurant",
] as const;

const PROHIBITED_LANGUAGE = [
  "spy",
  "steal",
  "track people",
  "track every",
  "follow customers",
  "follow their customers",
  "target their customers",
  "competitor customers",
] as const;

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parsePriority(value: string | null | undefined): "primary" | "secondary" {
  return String(value ?? "").toLowerCase().includes("secondary") ? "secondary" : "primary";
}

function normalizeRadiusPreference(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const numeric = Number(raw.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      radiusMiles: 1,
      reason: "Default competitor-area radius keeps the first launch focused on local visibility.",
    };
  }

  const radiusMiles = Math.min(5, Math.max(0.25, numeric));
  return {
    radiusMiles,
    reason:
      radiusMiles !== numeric
        ? "Client preference was constrained to the safe 0.25-5 mile competitor-area operating range."
        : "Client-provided competitor-area radius preference.",
  };
}

function splitCompetitorLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 25);
}

function findPolicyWarnings(...values: Array<string | null | undefined>) {
  const text = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return PROHIBITED_LANGUAGE.filter((phrase) => text.includes(phrase)).map(
    (phrase) => `Remove or rewrite '${phrase}' language before client approval.`,
  );
}

export function parseCompetitorAreaLocations(input: {
  rawLocations?: string | null;
  radiusPreference?: string | null;
}) {
  const radius = normalizeRadiusPreference(input.radiusPreference);
  const seen = new Set<string>();
  let duplicateCount = 0;
  const locations: CompetitorAreaLocation[] = [];

  for (const [index, line] of splitCompetitorLines(input.rawLocations).entries()) {
    const [namePart, addressPart, categoryPart, priorityPart, notesPart] = line.split("|").map((part) => normalizeLine(part ?? ""));
    const address = String(addressPart || namePart);
    const key = address.toLowerCase();
    if (seen.has(key)) {
      duplicateCount += 1;
      continue;
    }
    seen.add(key);

    locations.push({
      name: addressPart ? namePart || `Competitor Area ${index + 1}` : `Competitor Area ${index + 1}`,
      address,
      category: categoryPart || null,
      priority: parsePriority(priorityPart),
      radiusMiles: radius.radiusMiles,
      notes: notesPart || null,
      validationStatus: "needs_review",
    });
  }

  return {
    locations,
    duplicateCount,
    defaultRadiusMiles: radius.radiusMiles,
    radiusReason: radius.reason,
  };
}

function scoreCompetitorArea(input: {
  enabled: boolean;
  industry?: string | null;
  targetArea?: string | null;
  campaignGoal?: string | null;
  complianceAcknowledged: boolean;
  locations: CompetitorAreaLocation[];
  duplicateCount: number;
  policyWarnings: string[];
}) {
  const scoreReasons: string[] = [];
  const missingItems: string[] = [];
  let score = 45;
  const locationCount = input.locations.length;
  const lowerIndustry = String(input.industry ?? "").toLowerCase();

  if (!input.enabled) {
    return {
      readinessScore: 0,
      priority: "low" as const,
      scoreReasons,
      missingItems,
      nextAction: "No Competitor Area Campaign requested.",
    };
  }

  if (locationCount === 0) {
    score -= 35;
    missingItems.push("Collect competitor names and addresses.");
  } else if (locationCount <= COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT) {
    score += 25;
    scoreReasons.push("Competitor location count fits inside the included validation scope.");
  } else {
    score += 5;
    missingItems.push("Quote additional competitor-area validation before launch.");
  }

  if (input.duplicateCount > 0) {
    scoreReasons.push(`${input.duplicateCount} duplicate competitor location ${input.duplicateCount === 1 ? "was" : "were"} removed.`);
  }

  if (STRONG_COMPETITOR_FIT.some((token) => lowerIndustry.includes(token))) {
    score += 10;
    scoreReasons.push("Industry is a strong fit for geography-based competitor visibility.");
  }

  if (String(input.targetArea ?? "").trim()) {
    score += 10;
    scoreReasons.push("Target area context is available for campaign planning.");
  } else {
    missingItems.push("Confirm the broader market or service area around the competitor locations.");
  }

  if (String(input.campaignGoal ?? "").trim()) {
    score += 10;
    scoreReasons.push("Campaign goal is available for compliance-safe copy and launch planning.");
  } else {
    missingItems.push("Confirm the competitor-area campaign goal.");
  }

  if (input.complianceAcknowledged) {
    score += 10;
    scoreReasons.push("Client acknowledged competitor-area campaigns are geography-based visibility, not surveillance.");
  } else {
    missingItems.push("Confirm compliance acknowledgement before approval.");
  }

  if (input.policyWarnings.length > 0) {
    score -= 25;
    missingItems.push("Rewrite competitor-area notes with non-surveillance language.");
  }

  missingItems.push("Complete platform policy review before launch.");

  const readinessScore = clampScore(score);
  const nextAction =
    locationCount === 0
      ? "Collect competitor names and addresses"
      : input.policyWarnings.length > 0
        ? "Rewrite competitor-area language before approval"
        : locationCount > COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT
          ? "Quote additional competitor-area validation and review platform policy"
          : "Review competitor areas for platform policy and launch package";

  return {
    readinessScore,
    priority: readinessScore >= 75 ? ("high" as const) : readinessScore >= 55 ? ("medium" as const) : ("low" as const),
    scoreReasons,
    missingItems: Array.from(new Set(missingItems)),
    nextAction,
  };
}

export function buildCompetitorAreaMetadata(input: {
  targetingTypes?: string[] | null;
  objectives?: string[] | null;
  industry?: string | null;
  targetArea?: string | null;
  rawLocations?: string | null;
  radiusPreference?: string | null;
  campaignGoal?: string | null;
  complianceAcknowledged?: boolean | null;
}) {
  const parsed = parseCompetitorAreaLocations({
    rawLocations: input.rawLocations,
    radiusPreference: input.radiusPreference,
  });
  const enabled =
    Boolean(input.targetingTypes?.includes("competitor_area")) ||
    Boolean(input.objectives?.includes("competitor_visibility")) ||
    parsed.locations.length > 0 ||
    Boolean(String(input.campaignGoal ?? "").trim());
  const policyWarnings = findPolicyWarnings(input.rawLocations, input.campaignGoal);
  const score = scoreCompetitorArea({
    enabled,
    industry: input.industry,
    targetArea: input.targetArea,
    campaignGoal: input.campaignGoal,
    complianceAcknowledged: Boolean(input.complianceAcknowledged),
    locations: parsed.locations,
    duplicateCount: parsed.duplicateCount,
    policyWarnings,
  });

  return {
    enabled,
    includedLocationLimit: COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT,
    additionalValidationFeeCents: COMPETITOR_AREA_ADDITIONAL_VALIDATION_CENTS,
    defaultRadiusMiles: parsed.defaultRadiusMiles,
    radiusPreference: input.radiusPreference?.trim() || null,
    radiusReason: parsed.radiusReason,
    campaignGoal: input.campaignGoal?.trim() || null,
    complianceAcknowledged: Boolean(input.complianceAcknowledged),
    platformPolicyReviewRequired: enabled,
    locations: parsed.locations,
    duplicateCount: parsed.duplicateCount,
    additionalLocationCount: Math.max(0, parsed.locations.length - COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT),
    readinessScore: score.readinessScore,
    priority: score.priority,
    scoreReasons: score.scoreReasons,
    policyWarnings,
    missingItems: score.missingItems,
    nextAction: score.nextAction,
  } satisfies CompetitorAreaMetadata;
}

export function getCompetitorAreaMetadata(metadata: unknown): CompetitorAreaMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { competitor_area?: unknown }).competitor_area;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<CompetitorAreaMetadata>;
  const locations = Array.isArray(candidate.locations)
    ? candidate.locations
        .filter((item): item is CompetitorAreaLocation => Boolean(item && typeof item.address === "string"))
        .map((item, index) => ({
          name: item.name || `Competitor Area ${index + 1}`,
          address: item.address,
          category: item.category ?? null,
          priority: (item.priority === "secondary" ? "secondary" : "primary") as "primary" | "secondary",
          radiusMiles: Number.isFinite(Number(item.radiusMiles)) ? Number(item.radiusMiles) : Number(candidate.defaultRadiusMiles ?? 1),
          notes: item.notes ?? null,
          validationStatus: "needs_review" as const,
        }))
    : [];

  return {
    enabled: Boolean(candidate.enabled || locations.length > 0),
    includedLocationLimit: Number.isFinite(Number(candidate.includedLocationLimit))
      ? Number(candidate.includedLocationLimit)
      : COMPETITOR_AREA_INCLUDED_LOCATION_LIMIT,
    additionalValidationFeeCents: Number.isFinite(Number(candidate.additionalValidationFeeCents))
      ? Number(candidate.additionalValidationFeeCents)
      : COMPETITOR_AREA_ADDITIONAL_VALIDATION_CENTS,
    defaultRadiusMiles: Number.isFinite(Number(candidate.defaultRadiusMiles)) ? Number(candidate.defaultRadiusMiles) : 1,
    radiusPreference: candidate.radiusPreference ?? null,
    radiusReason: candidate.radiusReason || "Default competitor-area radius.",
    campaignGoal: candidate.campaignGoal ?? null,
    complianceAcknowledged: Boolean(candidate.complianceAcknowledged),
    platformPolicyReviewRequired: Boolean(candidate.platformPolicyReviewRequired || candidate.enabled),
    locations,
    duplicateCount: Number.isFinite(Number(candidate.duplicateCount)) ? Number(candidate.duplicateCount) : 0,
    additionalLocationCount: Number.isFinite(Number(candidate.additionalLocationCount)) ? Number(candidate.additionalLocationCount) : 0,
    readinessScore: Number.isFinite(Number(candidate.readinessScore)) ? Number(candidate.readinessScore) : 0,
    priority: candidate.priority === "high" || candidate.priority === "medium" ? candidate.priority : "low",
    scoreReasons: Array.isArray(candidate.scoreReasons) ? candidate.scoreReasons.filter((item) => typeof item === "string") : [],
    policyWarnings: Array.isArray(candidate.policyWarnings) ? candidate.policyWarnings.filter((item) => typeof item === "string") : [],
    missingItems: Array.isArray(candidate.missingItems) ? candidate.missingItems.filter((item) => typeof item === "string") : [],
    nextAction: candidate.nextAction || "Review competitor areas for platform policy and launch package",
  };
}

export function buildCompetitorAreaCampaignLocationRows(input: {
  campaignId: string;
  metadata: unknown;
  fallbackTargetArea?: string | null;
}) {
  const competitorArea = getCompetitorAreaMetadata(input.metadata);
  if (!competitorArea?.locations.length) return [];

  return competitorArea.locations.map((location) => ({
    campaign_id: input.campaignId,
    location_type: "competitor",
    name: location.name,
    address: location.address,
    radius_miles: location.radiusMiles,
    notes: [
      location.category ? `Category: ${location.category}` : null,
      `Priority: ${location.priority}`,
      `Validation: ${location.validationStatus}`,
      competitorArea.campaignGoal ? `Goal: ${competitorArea.campaignGoal}` : null,
      location.notes,
      input.fallbackTargetArea,
      "Use geography-based visibility only. No surveillance or individual-level targeting claims.",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1800),
  }));
}

export function summarizeCompetitorArea(input: CompetitorAreaMetadata | null) {
  if (!input?.enabled) return "No structured Competitor Area details submitted.";
  const count = input.locations.length;
  const locationWord = count === 1 ? "location" : "locations";
  return `${count} competitor-area ${locationWord}; readiness ${input.readinessScore}/100 (${input.priority} priority).`;
}
