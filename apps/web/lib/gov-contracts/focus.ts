import type { GovContractFocus, GovContractOpportunity } from "./types";

export interface GovContractFocusDefinition {
  id: GovContractFocus;
  label: string;
  shortLabel: string;
  description: string;
  naicsCodes: string[];
  keywords: string[];
}

export const GOV_CONTRACT_FOCUS_DEFINITIONS: GovContractFocusDefinition[] = [
  {
    id: "home_services",
    label: "Home services",
    shortLabel: "Home services",
    description: "HVAC, landscaping, roofing, facilities maintenance, and local subcontractor-ready scopes.",
    naicsCodes: ["238220", "561730", "238160"],
    keywords: [
      "hvac",
      "heating",
      "ventilation",
      "air conditioning",
      "landscaping",
      "grounds maintenance",
      "mowing",
      "roofing",
      "roof repair",
    ],
  },
  {
    id: "hvac",
    label: "HVAC",
    shortLabel: "HVAC",
    description: "Heating, ventilation, air conditioning, mechanical service, boiler, chiller, and maintenance work.",
    naicsCodes: ["238220"],
    keywords: ["hvac", "heating", "ventilation", "air conditioning", "mechanical", "boiler", "chiller"],
  },
  {
    id: "landscaping",
    label: "Landscaping",
    shortLabel: "Landscaping",
    description: "Grounds maintenance, mowing, seasonal cleanup, snow, turf, tree, and exterior site support.",
    naicsCodes: ["561730"],
    keywords: ["landscaping", "grounds maintenance", "mowing", "turf", "tree", "snow removal", "seasonal cleanup"],
  },
  {
    id: "roofing",
    label: "Roofing",
    shortLabel: "Roofing",
    description: "Roofing contractors, roof repair, replacement, inspection, gutters, and exterior envelope work.",
    naicsCodes: ["238160"],
    keywords: ["roofing", "roof repair", "roof replacement", "roof inspection", "gutter", "exterior envelope"],
  },
];

const FOCUS_BY_ID = new Map(GOV_CONTRACT_FOCUS_DEFINITIONS.map((definition) => [definition.id, definition]));

export function isGovContractFocus(value: unknown): value is GovContractFocus {
  return typeof value === "string" && FOCUS_BY_ID.has(value as GovContractFocus);
}

export function getGovContractFocusDefinition(focus: GovContractFocus) {
  return FOCUS_BY_ID.get(focus) ?? GOV_CONTRACT_FOCUS_DEFINITIONS[0]!;
}

export function getGovContractFocusTargets(focus: GovContractFocus | "all" | undefined) {
  if (!focus || focus === "all") return [];
  if (focus === "home_services") {
    return GOV_CONTRACT_FOCUS_DEFINITIONS.filter((definition) => definition.id !== "home_services");
  }
  const definition = getGovContractFocusDefinition(focus);
  return definition ? [definition] : [];
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term.toLowerCase()));
}

export function getGovContractFocusMatches(opportunity: Pick<GovContractOpportunity, "title" | "summary" | "naicsCode" | "pscCode">) {
  const text = [opportunity.title, opportunity.summary, opportunity.naicsCode, opportunity.pscCode]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return GOV_CONTRACT_FOCUS_DEFINITIONS.filter((definition) => definition.id !== "home_services").filter((definition) => {
    if (opportunity.naicsCode && definition.naicsCodes.includes(opportunity.naicsCode)) return true;
    return includesAny(text, definition.keywords);
  });
}

export function matchesGovContractFocus(
  opportunity: Pick<GovContractOpportunity, "title" | "summary" | "naicsCode" | "pscCode">,
  focus: GovContractFocus | "all" | undefined
) {
  if (!focus || focus === "all") return true;
  const matches = getGovContractFocusMatches(opportunity);
  if (focus === "home_services") return matches.length > 0;
  return matches.some((match) => match.id === focus);
}

export function buildSamGovFocusQueries(
  focus: GovContractFocus | undefined,
  base: {
    keyword?: string;
    state?: string;
    psc?: string;
    setAside?: string;
    noticeType?: string;
    limit?: number;
  }
) {
  if (!focus) return [];
  const targets = getGovContractFocusTargets(focus);
  const limit = Math.min(Math.max(base.limit ?? 30, 1), 100);

  return targets.flatMap((target) => [
    ...target.naicsCodes.map((naics) => ({
      ...base,
      naics,
      keyword: undefined,
      limit,
    })),
    {
      ...base,
      keyword: target.keywords[0],
      naics: undefined,
      limit: Math.min(limit, 25),
    },
  ]);
}
