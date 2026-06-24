import type { ScoredStormEvent, StormBusinessProspectInput } from "./types";

export type StormSuppressionRecord = {
  contact_email?: string | null;
  contact_phone?: string | null;
  channel?: string | null;
  reason?: string | null;
  active?: boolean | null;
};

export type ProspectDedupeResult = {
  unique: StormBusinessProspectInput[];
  duplicates: Array<{
    key: string;
    kept: StormBusinessProspectInput;
    duplicate: StormBusinessProspectInput;
  }>;
};

const SUPPRESSED_EMAIL_STATUSES = new Set(["bounced_permanent", "complained", "unsubscribed"]);
const BLOCKED_CRM_STATUSES = new Set(["blocked", "dead", "do_not_contact", "suppressed", "unsubscribed"]);
export const STORMREACH_STORM_OUTREACH_RADIUS_MILES = 50;
export const STORMREACH_STORM_OUTREACH_INDUSTRIES = ["Home services", "Tree service", "Roofing", "Siding"];
export const STORMREACH_CORE_CONTRACTOR_INDUSTRIES = STORMREACH_STORM_OUTREACH_INDUSTRIES;

export function normalizeEmail(value: string | null | undefined) {
  return String(value ?? "").trim().toLowerCase();
}

export function normalizePhone(value: string | null | undefined) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

export function normalizeBusinessName(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(llc|inc|co|company|the)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalProspectKey(prospect: StormBusinessProspectInput) {
  const email = normalizeEmail(prospect.email);
  if (email) return `email:${email}`;
  const phone = normalizePhone(prospect.phone);
  if (phone) return `phone:${phone}`;
  return [
    "name",
    normalizeBusinessName(prospect.businessName),
    String(prospect.city ?? "").trim().toLowerCase(),
    String(prospect.state ?? "").trim().toLowerCase(),
  ].join(":");
}

export function dedupeProspects(prospects: StormBusinessProspectInput[]): ProspectDedupeResult {
  const byKey = new Map<string, StormBusinessProspectInput>();
  const duplicates: ProspectDedupeResult["duplicates"] = [];

  for (const prospect of prospects) {
    const key = canonicalProspectKey(prospect);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, prospect);
      continue;
    }

    const kept = prospectConfidence(prospect) > prospectConfidence(existing)
      ? mergeProspects(prospect, existing)
      : mergeProspects(existing, prospect);
    byKey.set(key, kept);
    duplicates.push({ key, kept, duplicate: prospect === kept ? existing : prospect });
  }

  return { unique: Array.from(byKey.values()), duplicates };
}

export function applySuppression(
  prospects: StormBusinessProspectInput[],
  suppressions: StormSuppressionRecord[],
  channel: "email" | "sms" | "facebook_dm" | "manual" = "email",
) {
  const emailSuppressions = new Map<string, StormSuppressionRecord>();
  const phoneSuppressions = new Map<string, StormSuppressionRecord>();

  for (const row of suppressions) {
    if (row.active === false) continue;
    const rowChannel = String(row.channel ?? "all").toLowerCase();
    if (rowChannel !== "all" && rowChannel !== channel) continue;
    const email = normalizeEmail(row.contact_email);
    const phone = normalizePhone(row.contact_phone);
    if (email) emailSuppressions.set(email, row);
    if (phone) phoneSuppressions.set(phone, row);
  }

  return prospects.map((prospect) => {
    const email = normalizeEmail(prospect.email);
    const phone = normalizePhone(prospect.phone);
    const crmStatus = String(prospect.crmStatus ?? prospect.priorContactStatus ?? "").toLowerCase();
    const emailStatus = String(prospect.metadata?.email_status ?? "").toLowerCase();
    const suppressed =
      (email && emailSuppressions.has(email)) ||
      (phone && phoneSuppressions.has(phone)) ||
      BLOCKED_CRM_STATUSES.has(crmStatus) ||
      SUPPRESSED_EMAIL_STATUSES.has(emailStatus);

    return {
      ...prospect,
      suppressionStatus: suppressed ? "suppressed" as const : "clear" as const,
      notes: suppressed
        ? [prospect.notes, "Suppression or prior opt-out matched. Do not send outreach."].filter(Boolean).join(" ")
        : prospect.notes ?? null,
    };
  });
}

export function searchRadiusForEvent(event: Pick<ScoredStormEvent, "severityLevel" | "eventType" | "severityScore">) {
  if (event.severityLevel === "Extreme" || event.severityScore >= 84) return Number(process.env.STORMREACH_EXTREME_RADIUS_MILES ?? 100);
  if (event.severityLevel === "High" || event.severityScore >= 65) return Number(process.env.STORMREACH_LARGE_EVENT_RADIUS_MILES ?? 50);
  return Number(process.env.STORMREACH_DEFAULT_SEARCH_RADIUS_MILES ?? 25);
}

export function stormReachContractorSearchRadiusMiles() {
  return STORMREACH_STORM_OUTREACH_RADIUS_MILES;
}

export function stormReachStormOutreachRadiusMiles() {
  return STORMREACH_STORM_OUTREACH_RADIUS_MILES;
}

export function stormReachAllowedStormOutreachIndustries(industries?: string[] | null) {
  const requested = (industries ?? []).map((industry) => String(industry ?? "").trim()).filter(Boolean);
  if (!requested.length) return [...STORMREACH_STORM_OUTREACH_INDUSTRIES];

  return STORMREACH_STORM_OUTREACH_INDUSTRIES.filter((allowed) =>
    requested.some((industry) => industryMatchesCategory(allowed, industry) || industryMatchesCategory(industry, allowed))
  );
}

export function isStormReachStormOutreachIndustry(category: string | null | undefined) {
  return STORMREACH_STORM_OUTREACH_INDUSTRIES.some((industry) => industryMatchesCategory(industry, category));
}

export function isWithinStormReachStormOutreachRadius(distanceMiles: unknown) {
  if (distanceMiles === null || distanceMiles === undefined || String(distanceMiles).trim() === "") return false;
  const distance = Number(distanceMiles);
  return Number.isFinite(distance) && distance >= 0 && distance <= STORMREACH_STORM_OUTREACH_RADIUS_MILES;
}

export function isCoreStormReachContractorIndustry(industry: string | null | undefined) {
  return isStormReachStormOutreachIndustry(industry);
}

export function industryMatchesCategory(industry: string, category: string | null | undefined) {
  const haystack = normalizeBusinessName(category);
  const needle = normalizeBusinessName(industry);
  if (!haystack || !needle) return false;
  if (haystack.includes(needle) || needle.includes(haystack)) return true;
  const aliases: Record<string, string[]> = {
    "home services": ["home service", "home services", "home improvement", "home repair", "home remodeling", "general contractor", "exterior contractor", "storm repair", "storm restoration", "property repair"],
    roofing: ["roofer", "roof repair", "roofing contractor"],
    "tree removal": ["tree service", "arborist", "tree trimming"],
    "water restoration": ["restoration", "water damage", "disaster restoration"],
    "mold remediation": ["mold", "restoration"],
    hvac: ["heating", "air conditioning", "hvac"],
    plumbing: ["plumber", "plumbing"],
    electrical: ["electrician", "electrical"],
    electrician: ["electrician", "electrical"],
    electricians: ["electrician", "electrical"],
    gutters: ["gutter", "seamless gutters"],
    siding: ["siding", "exterior"],
    windows: ["window", "glass"],
    "window repair": ["window", "glass"],
    fencing: ["fence", "fencing"],
    "tree service": ["tree service", "tree removal", "arborist", "tree trimming"],
    "generator installation": ["generator", "backup power", "electrician", "electrical"],
    solar: ["solar", "solar panel", "solar energy", "solar installer"],
    "dumpster rental": ["dumpster", "roll off", "roll-off", "junk removal", "debris"],
    "water mitigation": ["water mitigation", "water damage", "water restoration", "flood restoration", "restoration"],
    "debris removal": ["junk removal", "cleanup", "debris"],
    restoration: ["restoration", "disaster restoration"],
    "insurance restoration": ["restoration", "storm restoration"],
  };
  return (aliases[needle] ?? []).some((alias) => haystack.includes(alias));
}

export function prospectConfidence(prospect: StormBusinessProspectInput) {
  let score = Number(prospect.confidenceScore ?? 50);
  if (prospect.email) score += 12;
  if (prospect.phone) score += 4;
  if (prospect.website) score += 4;
  if (prospect.sourceBusinessId || prospect.sourceSalesLeadId || prospect.sourceOutreachProspectId) score += 6;
  if (prospect.suppressionStatus === "suppressed") score -= 35;
  return Math.max(0, Math.min(100, score));
}

function mergeProspects(primary: StormBusinessProspectInput, secondary: StormBusinessProspectInput): StormBusinessProspectInput {
  return {
    ...secondary,
    ...primary,
    ownerName: primary.ownerName ?? secondary.ownerName ?? null,
    email: primary.email ?? secondary.email ?? null,
    phone: primary.phone ?? secondary.phone ?? null,
    website: primary.website ?? secondary.website ?? null,
    confidenceScore: Math.max(Number(primary.confidenceScore ?? 50), Number(secondary.confidenceScore ?? 50)),
    notes: [primary.notes, secondary.notes].filter(Boolean).join(" | ") || null,
    metadata: {
      ...(secondary.metadata ?? {}),
      ...(primary.metadata ?? {}),
      deduped_with: canonicalProspectKey(secondary),
    },
  };
}
