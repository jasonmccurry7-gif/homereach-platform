export const EVENT_AREA_RUSH_REVIEW_CENTS = 25000;
export const EVENT_AREA_RUSH_BUSINESS_DAY_THRESHOLD = 7;
export const EVENT_AREA_TOO_CLOSE_BUSINESS_DAY_THRESHOLD = 3;

export type EventAreaDeadlineStatus = "not_requested" | "date_missing" | "feasible" | "rush_review" | "too_close" | "past_event";

export type EventAreaLocation = {
  name: string;
  address: string;
  eventDate?: string | null;
  promotionWindow?: string | null;
  priority: "primary" | "secondary";
  radiusMiles: number;
  notes?: string | null;
  sourceStatus: "client_supplied";
};

export type EventAreaMetadata = {
  enabled: boolean;
  rushReviewFeeCents: number;
  rushReviewRequired: boolean;
  deadlineStatus: EventAreaDeadlineStatus;
  daysUntilEvent?: number | null;
  businessDaysUntilEvent?: number | null;
  launchCutoffDate?: string | null;
  defaultRadiusMiles: number;
  radiusPreference?: string | null;
  radiusReason: string;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  promotionWindow?: string | null;
  campaignGoal?: string | null;
  sourceConfirmed: boolean;
  complianceAcknowledged: boolean;
  platformPolicyReviewRequired: boolean;
  locations: EventAreaLocation[];
  readinessScore: number;
  priority: "high" | "medium" | "low";
  scoreReasons: string[];
  policyWarnings: string[];
  missingItems: string[];
  nextAction: string;
};

const STRONG_EVENT_FIT = [
  "restaurant",
  "med spa",
  "dent",
  "fitness",
  "real estate",
  "realtor",
  "political",
  "campaign",
  "roof",
  "hvac",
  "lawn",
  "landscap",
  "pest",
  "nonprofit",
] as const;

const PROHIBITED_EVENT_LANGUAGE = [
  "guarantee attendance",
  "guaranteed attendance",
  "guarantee sales",
  "guaranteed sales",
  "guarantee leads",
  "track attendees",
  "follow attendees",
  "spy",
] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parsePriority(value: string | null | undefined): "primary" | "secondary" {
  return String(value ?? "").toLowerCase().includes("secondary") ? "secondary" : "primary";
}

function parseDate(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T12:00:00`) : new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function businessDaysBetween(start: Date, end: Date) {
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  const target = new Date(end);
  target.setHours(12, 0, 0, 0);

  if (target < cursor) return -1;

  let days = 0;
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return days;
}

function launchCutoffDate(eventDate: Date | null) {
  if (!eventDate) return null;
  const cursor = new Date(eventDate);
  let businessDays = 0;
  while (businessDays < EVENT_AREA_RUSH_BUSINESS_DAY_THRESHOLD) {
    cursor.setDate(cursor.getDate() - 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) businessDays += 1;
  }
  return cursor;
}

function normalizeRadiusPreference(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  const numeric = Number(raw.replace(/[^0-9.]/g, ""));

  if (!Number.isFinite(numeric) || numeric <= 0) {
    return {
      radiusMiles: 1,
      reason: "Default event-area radius keeps the campaign focused near the venue or event geography.",
    };
  }

  const radiusMiles = Math.min(10, Math.max(0.25, numeric));
  return {
    radiusMiles,
    reason:
      radiusMiles !== numeric
        ? "Client preference was constrained to the safe 0.25-10 mile event-area operating range."
        : "Client-provided event-area radius preference.",
  };
}

function splitEventLines(value: string | null | undefined) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean)
    .slice(0, 20);
}

function findPolicyWarnings(...values: Array<string | null | undefined>) {
  const text = values
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return PROHIBITED_EVENT_LANGUAGE.filter((phrase) => text.includes(phrase)).map(
    (phrase) => `Remove or rewrite '${phrase}' language before client approval.`,
  );
}

export function parseEventAreaLocations(input: {
  rawEvents?: string | null;
  radiusPreference?: string | null;
  fallbackEventDate?: string | null;
  fallbackPromotionWindow?: string | null;
}) {
  const radius = normalizeRadiusPreference(input.radiusPreference);

  return splitEventLines(input.rawEvents).map((line, index) => {
    const [namePart, addressPart, datePart, windowPart, priorityPart, notesPart] = line.split("|").map((part) => normalizeLine(part ?? ""));
    const address = String(addressPart || namePart);
    const eventDate = formatDate(parseDate(datePart || input.fallbackEventDate));
    const promotionWindow = windowPart || input.fallbackPromotionWindow?.trim() || null;

    return {
      name: addressPart ? namePart || `Event Area ${index + 1}` : `Event Area ${index + 1}`,
      address,
      eventDate,
      promotionWindow,
      priority: parsePriority(priorityPart),
      radiusMiles: radius.radiusMiles,
      notes: notesPart || null,
      sourceStatus: "client_supplied",
    } satisfies EventAreaLocation;
  });
}

function earliestEventDate(input: {
  locations: EventAreaLocation[];
  eventStartDate?: string | null;
}) {
  const dates = [
    parseDate(input.eventStartDate),
    ...input.locations.map((location) => parseDate(location.eventDate)),
  ].filter((date): date is Date => Boolean(date));

  if (!dates.length) return null;
  return dates.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;
}

function deadlineStatus(input: {
  enabled: boolean;
  eventDate: Date | null;
  now?: Date;
}) {
  if (!input.enabled) {
    return {
      deadlineStatus: "not_requested" as const,
      daysUntilEvent: null,
      businessDaysUntilEvent: null,
      launchCutoffDate: null,
      rushReviewRequired: false,
    };
  }

  if (!input.eventDate) {
    return {
      deadlineStatus: "date_missing" as const,
      daysUntilEvent: null,
      businessDaysUntilEvent: null,
      launchCutoffDate: null,
      rushReviewRequired: false,
    };
  }

  const now = input.now ?? new Date();
  const daysUntilEvent = Math.ceil((input.eventDate.getTime() - now.getTime()) / DAY_MS);
  const businessDaysUntilEvent = businessDaysBetween(now, input.eventDate);
  const cutoff = launchCutoffDate(input.eventDate);

  if (daysUntilEvent < 0) {
    return {
      deadlineStatus: "past_event" as const,
      daysUntilEvent,
      businessDaysUntilEvent,
      launchCutoffDate: formatDate(cutoff),
      rushReviewRequired: false,
    };
  }

  if (businessDaysUntilEvent < EVENT_AREA_TOO_CLOSE_BUSINESS_DAY_THRESHOLD) {
    return {
      deadlineStatus: "too_close" as const,
      daysUntilEvent,
      businessDaysUntilEvent,
      launchCutoffDate: formatDate(cutoff),
      rushReviewRequired: true,
    };
  }

  if (businessDaysUntilEvent < EVENT_AREA_RUSH_BUSINESS_DAY_THRESHOLD) {
    return {
      deadlineStatus: "rush_review" as const,
      daysUntilEvent,
      businessDaysUntilEvent,
      launchCutoffDate: formatDate(cutoff),
      rushReviewRequired: true,
    };
  }

  return {
    deadlineStatus: "feasible" as const,
    daysUntilEvent,
    businessDaysUntilEvent,
    launchCutoffDate: formatDate(cutoff),
    rushReviewRequired: false,
  };
}

function scoreEventArea(input: {
  enabled: boolean;
  industry?: string | null;
  targetArea?: string | null;
  campaignGoal?: string | null;
  promotionWindow?: string | null;
  sourceConfirmed: boolean;
  complianceAcknowledged: boolean;
  locations: EventAreaLocation[];
  policyWarnings: string[];
  deadline: ReturnType<typeof deadlineStatus>;
}) {
  const scoreReasons: string[] = [];
  const missingItems: string[] = [];
  let score = 45;
  const lowerIndustry = String(input.industry ?? "").toLowerCase();

  if (!input.enabled) {
    return {
      readinessScore: 0,
      priority: "low" as const,
      scoreReasons,
      missingItems,
      nextAction: "No Event Area Campaign requested.",
    };
  }

  if (input.locations.length === 0) {
    score -= 30;
    missingItems.push("Collect event name and location.");
  } else {
    score += 20;
    scoreReasons.push("Event location is available for campaign planning.");
  }

  if (input.deadline.deadlineStatus === "feasible") {
    score += 20;
    scoreReasons.push("Event timing is feasible without rush review.");
  } else if (input.deadline.deadlineStatus === "rush_review") {
    score += 5;
    missingItems.push("Confirm rush review fee and launch cutoff before accepting.");
  } else if (input.deadline.deadlineStatus === "too_close") {
    score -= 25;
    missingItems.push("Deadline is very close; approve only if manual launch is realistically feasible.");
  } else if (input.deadline.deadlineStatus === "past_event") {
    score -= 40;
    missingItems.push("Event date has passed; propose post-event follow-up instead.");
  } else {
    score -= 20;
    missingItems.push("Confirm event date before launch planning.");
  }

  if (STRONG_EVENT_FIT.some((token) => lowerIndustry.includes(token))) {
    score += 10;
    scoreReasons.push("Industry is a strong fit for time-sensitive local visibility.");
  }

  if (String(input.targetArea ?? "").trim()) {
    score += 5;
    scoreReasons.push("Target area context is available.");
  }

  if (String(input.campaignGoal ?? "").trim()) {
    score += 10;
    scoreReasons.push("Campaign goal is available for creative planning.");
  } else {
    missingItems.push("Confirm the event campaign goal.");
  }

  if (String(input.promotionWindow ?? "").trim() || input.locations.some((location) => location.promotionWindow)) {
    score += 5;
    scoreReasons.push("Promotion window is available.");
  } else {
    missingItems.push("Confirm promotion window.");
  }

  if (input.sourceConfirmed) {
    score += 5;
    scoreReasons.push("Client confirmed event source/details.");
  } else {
    missingItems.push("Confirm event source/details before approval.");
  }

  if (input.complianceAcknowledged) {
    score += 5;
    scoreReasons.push("Client acknowledged results vary and event claims need approval.");
  } else {
    missingItems.push("Confirm event compliance acknowledgement before approval.");
  }

  if (input.policyWarnings.length > 0) {
    score -= 25;
    missingItems.push("Rewrite event-area notes with compliance-safe language.");
  }

  missingItems.push("Complete launch cutoff approval before paid ads.");

  const readinessScore = clampScore(score);
  const nextAction =
    input.deadline.deadlineStatus === "past_event"
      ? "Propose post-event follow-up or decline launch"
      : input.deadline.deadlineStatus === "too_close"
        ? "Escalate deadline before accepting event launch"
        : input.deadline.deadlineStatus === "rush_review"
          ? "Confirm rush review fee and launch cutoff"
          : input.deadline.deadlineStatus === "date_missing"
            ? "Confirm event date and location"
            : "Review event timing, source, and launch package";

  return {
    readinessScore,
    priority: readinessScore >= 75 ? ("high" as const) : readinessScore >= 55 ? ("medium" as const) : ("low" as const),
    scoreReasons,
    missingItems: Array.from(new Set(missingItems)),
    nextAction,
  };
}

export function buildEventAreaMetadata(input: {
  targetingTypes?: string[] | null;
  objectives?: string[] | null;
  industry?: string | null;
  targetArea?: string | null;
  rawEvents?: string | null;
  radiusPreference?: string | null;
  eventStartDate?: string | null;
  eventEndDate?: string | null;
  promotionWindow?: string | null;
  campaignGoal?: string | null;
  sourceConfirmed?: boolean | null;
  complianceAcknowledged?: boolean | null;
  now?: Date;
}) {
  const locations = parseEventAreaLocations({
    rawEvents: input.rawEvents,
    radiusPreference: input.radiusPreference,
    fallbackEventDate: input.eventStartDate,
    fallbackPromotionWindow: input.promotionWindow,
  });
  const enabled =
    Boolean(input.targetingTypes?.includes("event_area")) ||
    Boolean(input.objectives?.includes("event_promotion")) ||
    locations.length > 0 ||
    Boolean(String(input.eventStartDate ?? "").trim()) ||
    Boolean(String(input.campaignGoal ?? "").trim());
  const radius = normalizeRadiusPreference(input.radiusPreference);
  const eventDate = earliestEventDate({ locations, eventStartDate: input.eventStartDate });
  const deadline = deadlineStatus({ enabled, eventDate, now: input.now });
  const policyWarnings = findPolicyWarnings(input.rawEvents, input.campaignGoal, input.promotionWindow);
  const score = scoreEventArea({
    enabled,
    industry: input.industry,
    targetArea: input.targetArea,
    campaignGoal: input.campaignGoal,
    promotionWindow: input.promotionWindow,
    sourceConfirmed: Boolean(input.sourceConfirmed),
    complianceAcknowledged: Boolean(input.complianceAcknowledged),
    locations,
    policyWarnings,
    deadline,
  });

  return {
    enabled,
    rushReviewFeeCents: EVENT_AREA_RUSH_REVIEW_CENTS,
    rushReviewRequired: deadline.rushReviewRequired,
    deadlineStatus: deadline.deadlineStatus,
    daysUntilEvent: deadline.daysUntilEvent,
    businessDaysUntilEvent: deadline.businessDaysUntilEvent,
    launchCutoffDate: deadline.launchCutoffDate,
    defaultRadiusMiles: radius.radiusMiles,
    radiusPreference: input.radiusPreference?.trim() || null,
    radiusReason: radius.reason,
    eventStartDate: formatDate(parseDate(input.eventStartDate)),
    eventEndDate: formatDate(parseDate(input.eventEndDate)),
    promotionWindow: input.promotionWindow?.trim() || null,
    campaignGoal: input.campaignGoal?.trim() || null,
    sourceConfirmed: Boolean(input.sourceConfirmed),
    complianceAcknowledged: Boolean(input.complianceAcknowledged),
    platformPolicyReviewRequired: enabled,
    locations,
    readinessScore: score.readinessScore,
    priority: score.priority,
    scoreReasons: score.scoreReasons,
    policyWarnings,
    missingItems: score.missingItems,
    nextAction: score.nextAction,
  } satisfies EventAreaMetadata;
}

export function getEventAreaMetadata(metadata: unknown): EventAreaMetadata | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = (metadata as { event_area?: unknown }).event_area;
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<EventAreaMetadata>;
  const locations = Array.isArray(candidate.locations)
    ? candidate.locations
        .filter((item): item is EventAreaLocation => Boolean(item && typeof item.address === "string"))
        .map((item, index) => ({
          name: item.name || `Event Area ${index + 1}`,
          address: item.address,
          eventDate: item.eventDate ?? null,
          promotionWindow: item.promotionWindow ?? null,
          priority: (item.priority === "secondary" ? "secondary" : "primary") as "primary" | "secondary",
          radiusMiles: Number.isFinite(Number(item.radiusMiles)) ? Number(item.radiusMiles) : Number(candidate.defaultRadiusMiles ?? 1),
          notes: item.notes ?? null,
          sourceStatus: "client_supplied" as const,
        }))
    : [];

  return {
    enabled: Boolean(candidate.enabled || locations.length > 0),
    rushReviewFeeCents: Number.isFinite(Number(candidate.rushReviewFeeCents)) ? Number(candidate.rushReviewFeeCents) : EVENT_AREA_RUSH_REVIEW_CENTS,
    rushReviewRequired: Boolean(candidate.rushReviewRequired),
    deadlineStatus: candidate.deadlineStatus || "date_missing",
    daysUntilEvent: Number.isFinite(Number(candidate.daysUntilEvent)) ? Number(candidate.daysUntilEvent) : null,
    businessDaysUntilEvent: Number.isFinite(Number(candidate.businessDaysUntilEvent)) ? Number(candidate.businessDaysUntilEvent) : null,
    launchCutoffDate: candidate.launchCutoffDate ?? null,
    defaultRadiusMiles: Number.isFinite(Number(candidate.defaultRadiusMiles)) ? Number(candidate.defaultRadiusMiles) : 1,
    radiusPreference: candidate.radiusPreference ?? null,
    radiusReason: candidate.radiusReason || "Default event-area radius.",
    eventStartDate: candidate.eventStartDate ?? null,
    eventEndDate: candidate.eventEndDate ?? null,
    promotionWindow: candidate.promotionWindow ?? null,
    campaignGoal: candidate.campaignGoal ?? null,
    sourceConfirmed: Boolean(candidate.sourceConfirmed),
    complianceAcknowledged: Boolean(candidate.complianceAcknowledged),
    platformPolicyReviewRequired: Boolean(candidate.platformPolicyReviewRequired || candidate.enabled),
    locations,
    readinessScore: Number.isFinite(Number(candidate.readinessScore)) ? Number(candidate.readinessScore) : 0,
    priority: candidate.priority === "high" || candidate.priority === "medium" ? candidate.priority : "low",
    scoreReasons: Array.isArray(candidate.scoreReasons) ? candidate.scoreReasons.filter((item) => typeof item === "string") : [],
    policyWarnings: Array.isArray(candidate.policyWarnings) ? candidate.policyWarnings.filter((item) => typeof item === "string") : [],
    missingItems: Array.isArray(candidate.missingItems) ? candidate.missingItems.filter((item) => typeof item === "string") : [],
    nextAction: candidate.nextAction || "Review event timing, source, and launch package",
  };
}

export function buildEventAreaCampaignLocationRows(input: {
  campaignId: string;
  metadata: unknown;
  fallbackTargetArea?: string | null;
}) {
  const eventArea = getEventAreaMetadata(input.metadata);
  if (!eventArea?.locations.length) return [];

  return eventArea.locations.map((location) => ({
    campaign_id: input.campaignId,
    location_type: "event",
    name: location.name,
    address: location.address,
    radius_miles: location.radiusMiles,
    notes: [
      location.eventDate ? `Event date: ${location.eventDate}` : null,
      location.promotionWindow ? `Promotion window: ${location.promotionWindow}` : null,
      `Priority: ${location.priority}`,
      eventArea.deadlineStatus ? `Deadline status: ${eventArea.deadlineStatus}` : null,
      eventArea.launchCutoffDate ? `Launch cutoff: ${eventArea.launchCutoffDate}` : null,
      eventArea.campaignGoal ? `Goal: ${eventArea.campaignGoal}` : null,
      location.notes,
      input.fallbackTargetArea,
      "Use event/location context only. No guaranteed attendance, sales, or individual-level tracking claims.",
    ]
      .filter(Boolean)
      .join(" | ")
      .slice(0, 1800),
  }));
}

export function summarizeEventArea(input: EventAreaMetadata | null) {
  if (!input?.enabled) return "No structured Event Area details submitted.";
  const count = input.locations.length;
  const locationWord = count === 1 ? "location" : "locations";
  return `${count} event-area ${locationWord}; deadline ${input.deadlineStatus}; readiness ${input.readinessScore}/100 (${input.priority} priority).`;
}
