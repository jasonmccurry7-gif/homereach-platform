export const POLITICAL_DISTRICT_MIN_PLANNING_PACKAGE_CENTS = 150000;
export const POLITICAL_DISTRICT_RUSH_BUSINESS_DAY_THRESHOLD = 14;
export const POLITICAL_DISTRICT_TOO_CLOSE_BUSINESS_DAY_THRESHOLD = 5;

export type PoliticalDistrictDeadlineStatus =
  | "not_requested"
  | "date_missing"
  | "feasible"
  | "rush_review"
  | "too_close"
  | "past_election";

export type PoliticalDistrictPriority = "low" | "medium" | "high";

export interface PoliticalDistrictGeography {
  name: string;
  geographyType: string;
  source: string | null;
  priority: PoliticalDistrictPriority;
  notes: string | null;
}

export interface PoliticalDistrictSaturationMetadata {
  enabled: boolean;
  geographies: PoliticalDistrictGeography[];
  state: string | null;
  geographyType: string | null;
  geographyValue: string | null;
  districtType: string | null;
  districtSource: string | null;
  districtSourceConfirmed: boolean;
  audienceSource: string | null;
  disclaimerStatus: string | null;
  complianceAcknowledged: boolean;
  noSensitiveTargetingAcknowledged: boolean;
  electionDate: string | null;
  dropWindow: string | null;
  mailQuantityEstimate: number | null;
  desiredDropCount: number | null;
  budgetEstimateCents: number | null;
  businessDaysUntilElection: number | null;
  deadlineStatus: PoliticalDistrictDeadlineStatus;
  readinessScore: number;
  priority: PoliticalDistrictPriority;
  missingItems: string[];
  policyWarnings: string[];
  scoreReasons: string[];
  nextAction: string;
}

interface BuildPoliticalDistrictSaturationInput {
  enabled?: boolean;
  targetGeographies?: string | null;
  state?: string | null;
  geographyType?: string | null;
  geographyValue?: string | null;
  districtType?: string | null;
  districtSource?: string | null;
  districtSourceConfirmed?: boolean;
  audienceSource?: string | null;
  disclaimerStatus?: string | null;
  complianceAcknowledged?: boolean;
  noSensitiveTargetingAcknowledged?: boolean;
  electionDate?: string | null;
  dropWindow?: string | null;
  mailQuantityEstimate?: number | null;
  desiredDropCount?: number | null;
  budgetEstimateCents?: number | null;
  notes?: string | null;
  campaignGoal?: string | null;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "yes";
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function priority(value: unknown): PoliticalDistrictPriority {
  const normalized = clean(value)?.toLowerCase();
  if (normalized === "high" || normalized === "urgent" || normalized === "primary") return "high";
  if (normalized === "low" || normalized === "watch") return "low";
  return "medium";
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function businessDaysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null;
  const target = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  const cursor = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 12));
  let days = 0;
  const direction = target.getTime() >= cursor.getTime() ? 1 : -1;

  while (
    direction === 1
      ? cursor.getTime() < target.getTime()
      : cursor.getTime() > target.getTime()
  ) {
    cursor.setUTCDate(cursor.getUTCDate() + direction);
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) days += direction;
  }

  return days;
}

function deadlineStatus(days: number | null): PoliticalDistrictDeadlineStatus {
  if (days === null) return "date_missing";
  if (days < 0) return "past_election";
  if (days <= POLITICAL_DISTRICT_TOO_CLOSE_BUSINESS_DAY_THRESHOLD) return "too_close";
  if (days <= POLITICAL_DISTRICT_RUSH_BUSINESS_DAY_THRESHOLD) return "rush_review";
  return "feasible";
}

function splitLines(raw: string | null | undefined): string[] {
  return (raw ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 25);
}

export function parsePoliticalDistrictGeographies(
  raw: string | null | undefined,
  fallback: {
    geographyType?: string | null;
    geographyValue?: string | null;
    districtSource?: string | null;
  } = {},
): PoliticalDistrictGeography[] {
  const rows = splitLines(raw).map((line, index) => {
    const [namePart, typePart, sourcePart, priorityPart, ...notesParts] = line
      .split("|")
      .map((part) => part.trim());
    const fallbackName = fallback.geographyValue || `Political Geography ${index + 1}`;
    return {
      name: clean(namePart) ?? fallbackName,
      geographyType: clean(typePart) ?? fallback.geographyType ?? "district",
      source: clean(sourcePart) ?? clean(fallback.districtSource),
      priority: priority(priorityPart),
      notes: clean(notesParts.join(" | ")),
    };
  });

  if (rows.length > 0) return rows;

  if (fallback.geographyValue) {
    return [
      {
        name: fallback.geographyValue,
        geographyType: fallback.geographyType ?? "district",
        source: clean(fallback.districtSource),
        priority: "high",
        notes: "Fallback geography from political plan request.",
      },
    ];
  }

  return [];
}

function detectPoliticalPolicyWarnings(text: string): string[] {
  const normalized = text.toLowerCase();
  const checks: Array<[RegExp, string]> = [
    [/\b(voter|person|people)\s+(score|scoring|rank|ranking)\b/, "Remove individual voter scoring language."],
    [/\b(predict|infer|guess)\s+[^.]{0,50}\b(vote|belief|ideology|support)\b/, "Remove ideology or belief inference language."],
    [/\bpersuadable\s+voters?\b/, "Do not classify individuals as persuadable voters."],
    [/\btarget\s+(democrats|republicans|liberals|conservatives)\b/, "Use geography or campaign-provided audiences, not inferred political traits."],
    [/\bguarantee\s+(votes?|win|turnout|victory|results?)\b/, "Remove guaranteed political outcome claims."],
    [/\btrack\s+(voters?|people|individuals?)\b/, "Do not imply individual tracking."],
    [/\bfollow\s+(voters?|people|individuals?)\b/, "Do not imply individual tracking or surveillance."],
  ];

  return checks
    .filter(([pattern]) => pattern.test(normalized))
    .map(([, warning]) => warning);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function buildPoliticalDistrictSaturationMetadata(
  input: BuildPoliticalDistrictSaturationInput,
): PoliticalDistrictSaturationMetadata {
  const geographies = parsePoliticalDistrictGeographies(input.targetGeographies, {
    geographyType: input.geographyType,
    geographyValue: input.geographyValue,
    districtSource: input.districtSource,
  });
  const enabled = input.enabled ?? geographies.length > 0;
  const electionDate = dateOnly(input.electionDate);
  const days = businessDaysUntil(electionDate);
  const status = enabled ? deadlineStatus(days) : "not_requested";
  const budgetEstimateCents = numberOrNull(input.budgetEstimateCents);
  const mailQuantityEstimate = numberOrNull(input.mailQuantityEstimate);
  const desiredDropCount = numberOrNull(input.desiredDropCount);
  const sourceConfirmed = Boolean(input.districtSourceConfirmed);
  const complianceAcknowledged = Boolean(input.complianceAcknowledged);
  const noSensitiveTargetingAcknowledged = Boolean(input.noSensitiveTargetingAcknowledged);
  const districtSource = clean(input.districtSource);
  const audienceSource = clean(input.audienceSource);
  const disclaimerStatus = clean(input.disclaimerStatus);
  const policyWarnings = unique(
    detectPoliticalPolicyWarnings(
      [
        input.targetGeographies,
        input.notes,
        input.campaignGoal,
        input.dropWindow,
        districtSource,
        audienceSource,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  );

  const missingItems: string[] = [];
  const scoreReasons: string[] = [];
  let score = 0;

  if (!enabled) {
    return {
      enabled: false,
      geographies: [],
      state: clean(input.state),
      geographyType: clean(input.geographyType),
      geographyValue: clean(input.geographyValue),
      districtType: clean(input.districtType),
      districtSource,
      districtSourceConfirmed: false,
      audienceSource,
      disclaimerStatus,
      complianceAcknowledged: false,
      noSensitiveTargetingAcknowledged: false,
      electionDate,
      dropWindow: clean(input.dropWindow),
      mailQuantityEstimate,
      desiredDropCount,
      budgetEstimateCents,
      businessDaysUntilElection: days,
      deadlineStatus: "not_requested",
      readinessScore: 0,
      priority: "low",
      missingItems: ["No Political District Saturation request was submitted."],
      policyWarnings: [],
      scoreReasons: [],
      nextAction: "No Political District Saturation request submitted.",
    };
  }

  if (geographies.length > 0) {
    score += 15;
    scoreReasons.push(`${geographies.length} geography item(s) captured.`);
  } else {
    missingItems.push("Capture at least one district, county, city, ZIP, or route geography.");
  }

  if (clean(input.state) && clean(input.geographyType) && clean(input.geographyValue)) {
    score += 10;
    scoreReasons.push("State and geography type are present.");
  } else {
    missingItems.push("Confirm state, geography level, and geography value.");
  }

  if (budgetEstimateCents && budgetEstimateCents >= POLITICAL_DISTRICT_MIN_PLANNING_PACKAGE_CENTS) {
    score += 10;
    scoreReasons.push("Budget clears the minimum planning package.");
  } else {
    missingItems.push("Confirm budget or quote basis before proposal.");
  }

  if (desiredDropCount && desiredDropCount > 0) {
    score += 8;
    scoreReasons.push("Desired drop count is captured.");
  } else {
    missingItems.push("Confirm desired mail drop count.");
  }

  if (status === "feasible") {
    score += 12;
    scoreReasons.push("Election timing appears feasible for planning.");
  } else if (status === "rush_review") {
    score += 6;
    missingItems.push("Rush review required before proposal or production.");
  } else if (status === "too_close") {
    missingItems.push("Election window is too close for normal production review.");
  } else if (status === "past_election") {
    missingItems.push("Election date is in the past.");
  } else {
    missingItems.push("Confirm election date before proposal.");
  }

  if (sourceConfirmed) {
    score += 12;
    scoreReasons.push("District source confirmation acknowledged.");
  } else {
    missingItems.push("Confirm district/geography source before quote or checkout.");
  }

  if (complianceAcknowledged) {
    score += 12;
    scoreReasons.push("Political compliance acknowledgement captured.");
  } else {
    missingItems.push("Capture political compliance acknowledgement.");
  }

  if (noSensitiveTargetingAcknowledged) {
    score += 8;
    scoreReasons.push("Sensitive targeting boundary acknowledged.");
  } else {
    missingItems.push("Confirm no voter ideology inference, voter scoring, or individual belief targeting.");
  }

  if (disclaimerStatus && disclaimerStatus !== "not_sure") {
    score += 8;
    scoreReasons.push("Disclaimer status is captured.");
  } else {
    missingItems.push("Confirm required disclaimer status before proof approval.");
  }

  if (policyWarnings.length === 0) {
    score += 5;
    scoreReasons.push("No prohibited political targeting language detected.");
  } else {
    missingItems.push("Rewrite political notes with compliance-safe language.");
  }

  const readinessScore = Math.max(0, Math.min(100, score));
  const highPriority =
    policyWarnings.length > 0 ||
    status === "too_close" ||
    status === "past_election" ||
    readinessScore < 65;
  const mediumPriority = status === "rush_review" || readinessScore < 85;
  const resolvedPriority: PoliticalDistrictPriority = highPriority ? "high" : mediumPriority ? "medium" : "low";
  const nextAction =
    policyWarnings.length > 0
      ? "Rewrite political targeting language before approval"
      : status === "past_election"
        ? "Decline production path or create a post-election follow-up plan"
        : status === "too_close"
          ? "Run urgent feasibility review before any proposal"
          : status === "rush_review"
            ? "Run rush timing review and confirm print/drop window"
            : missingItems.length > 0
              ? missingItems[0] ?? "Review political district plan."
              : "Ready for political compliance review and verified count check";

  return {
    enabled,
    geographies,
    state: clean(input.state),
    geographyType: clean(input.geographyType),
    geographyValue: clean(input.geographyValue),
    districtType: clean(input.districtType),
    districtSource,
    districtSourceConfirmed: sourceConfirmed,
    audienceSource,
    disclaimerStatus,
    complianceAcknowledged,
    noSensitiveTargetingAcknowledged,
    electionDate,
    dropWindow: clean(input.dropWindow),
    mailQuantityEstimate,
    desiredDropCount,
    budgetEstimateCents,
    businessDaysUntilElection: days,
    deadlineStatus: status,
    readinessScore,
    priority: resolvedPriority,
    missingItems: unique(missingItems),
    policyWarnings,
    scoreReasons,
    nextAction,
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readGeographies(value: unknown): PoliticalDistrictGeography[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = asRecord(item);
      if (!record) return null;
      return {
        name: clean(record.name) ?? `Political Geography ${index + 1}`,
        geographyType: clean(record.geographyType) ?? clean(record.geography_type) ?? "district",
        source: clean(record.source),
        priority: priority(record.priority),
        notes: clean(record.notes),
      };
    })
    .filter((item): item is PoliticalDistrictGeography => Boolean(item));
}

export function getPoliticalDistrictSaturationMetadata(
  value: unknown,
): PoliticalDistrictSaturationMetadata | null {
  const record = asRecord(value);
  if (!record) return null;
  const nested =
    asRecord(record.political_district_saturation) ??
    asRecord(record.politicalDistrictSaturation) ??
    (Array.isArray(record.geographies) && typeof record.enabled !== "undefined" ? record : null);
  if (!nested) return null;

  const geographies = readGeographies(nested.geographies);
  return {
    enabled: bool(nested.enabled),
    geographies,
    state: clean(nested.state),
    geographyType: clean(nested.geographyType) ?? clean(nested.geography_type),
    geographyValue: clean(nested.geographyValue) ?? clean(nested.geography_value),
    districtType: clean(nested.districtType) ?? clean(nested.district_type),
    districtSource: clean(nested.districtSource) ?? clean(nested.district_source),
    districtSourceConfirmed: bool(nested.districtSourceConfirmed ?? nested.district_source_confirmed),
    audienceSource: clean(nested.audienceSource) ?? clean(nested.audience_source),
    disclaimerStatus: clean(nested.disclaimerStatus) ?? clean(nested.disclaimer_status),
    complianceAcknowledged: bool(nested.complianceAcknowledged ?? nested.compliance_acknowledged),
    noSensitiveTargetingAcknowledged: bool(
      nested.noSensitiveTargetingAcknowledged ?? nested.no_sensitive_targeting_acknowledged,
    ),
    electionDate: clean(nested.electionDate) ?? clean(nested.election_date),
    dropWindow: clean(nested.dropWindow) ?? clean(nested.drop_window),
    mailQuantityEstimate: numberOrNull(nested.mailQuantityEstimate ?? nested.mail_quantity_estimate),
    desiredDropCount: numberOrNull(nested.desiredDropCount ?? nested.desired_drop_count),
    budgetEstimateCents: numberOrNull(nested.budgetEstimateCents ?? nested.budget_estimate_cents),
    businessDaysUntilElection: numberOrNull(
      nested.businessDaysUntilElection ?? nested.business_days_until_election,
    ),
    deadlineStatus:
      (clean(nested.deadlineStatus) ?? clean(nested.deadline_status) ?? "date_missing") as PoliticalDistrictDeadlineStatus,
    readinessScore: numberOrNull(nested.readinessScore ?? nested.readiness_score) ?? 0,
    priority: priority(nested.priority),
    missingItems: Array.isArray(nested.missingItems)
      ? nested.missingItems.map(String)
      : Array.isArray(nested.missing_items)
        ? nested.missing_items.map(String)
        : [],
    policyWarnings: Array.isArray(nested.policyWarnings)
      ? nested.policyWarnings.map(String)
      : Array.isArray(nested.policy_warnings)
        ? nested.policy_warnings.map(String)
        : [],
    scoreReasons: Array.isArray(nested.scoreReasons)
      ? nested.scoreReasons.map(String)
      : Array.isArray(nested.score_reasons)
        ? nested.score_reasons.map(String)
        : [],
    nextAction: clean(nested.nextAction) ?? clean(nested.next_action) ?? "Review political district plan.",
  };
}

export function summarizePoliticalDistrictSaturation(
  input: PoliticalDistrictSaturationMetadata | null | undefined,
): string {
  if (!input?.enabled) return "No structured Political District Saturation details submitted.";
  const count = input.geographies.length;
  const geographyWord = count === 1 ? "geography" : "geographies";
  return [
    `${count} political ${geographyWord}; readiness ${input.readinessScore}/100`,
    `deadline ${input.deadlineStatus}`,
    input.businessDaysUntilElection !== null
      ? `${input.businessDaysUntilElection} business days until election`
      : null,
    input.nextAction ? `next action: ${input.nextAction}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}
