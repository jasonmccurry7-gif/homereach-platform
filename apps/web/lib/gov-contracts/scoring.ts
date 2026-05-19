import type {
  GovContractFitStatus,
  GovContractOpportunity,
  GovContractScoreBreakdown,
  GovContractUrgency,
} from "./types";

const HIGH_FIT_NAICS = new Set([
  "323111",
  "323117",
  "323120",
  "323113",
  "541860",
  "492110",
  "492210",
  "493110",
  "484110",
  "561210",
  "561720",
  "561730",
  "561920",
  "561990",
]);

const OPERATIONAL_KEYWORDS = [
  "direct mail",
  "printing",
  "postcard",
  "mailing",
  "fulfillment",
  "courier",
  "delivery",
  "logistics",
  "warehouse",
  "warehousing",
  "janitorial",
  "facilities",
  "grounds",
  "maintenance",
  "distribution",
];

const SUBCONTRACTABLE_KEYWORDS = [
  "statewide",
  "regional",
  "multi-site",
  "multiple locations",
  "delivery",
  "printing",
  "janitorial",
  "grounds",
  "logistics",
  "warehouse",
  "subcontract",
];

function includesAny(text: string, needles: string[]) {
  return needles.some((needle) => text.includes(needle));
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function daysUntil(dateIso: string | null) {
  if (!dateIso) return null;
  const due = new Date(dateIso).getTime();
  if (Number.isNaN(due)) return null;
  return Math.ceil((due - Date.now()) / 86_400_000);
}

export function urgencyForDueDate(dueDate: string | null): { score: number; label: GovContractUrgency } {
  const days = daysUntil(dueDate);
  if (days === null) return { score: 35, label: "medium" };
  if (days < 0) return { score: 100, label: "critical" };
  if (days <= 3) return { score: 95, label: "critical" };
  if (days <= 7) return { score: 82, label: "high" };
  if (days <= 14) return { score: 62, label: "medium" };
  return { score: 28, label: "low" };
}

export function fitStatusForScore(score: number): GovContractFitStatus {
  if (score >= 78) return "strong_fit";
  if (score >= 58) return "possible_fit";
  if (score >= 38) return "weak_fit";
  return "no_bid";
}

export function recommendedActionFor(opportunity: Pick<GovContractOpportunity, "fitScore" | "urgency" | "missingItems">) {
  if (opportunity.fitScore >= 78 && opportunity.urgency !== "critical") {
    return "Review scope and open the Bid Room for a go/no-go decision.";
  }
  if (opportunity.fitScore >= 58 && opportunity.missingItems.length > 0) {
    const firstMissingItem = opportunity.missingItems[0] ?? "missing procurement data";
    return `Clarify ${firstMissingItem.toLowerCase()} before committing pursuit resources.`;
  }
  if (opportunity.urgency === "critical") {
    return "Check deadline feasibility before any pursuit decision.";
  }
  if (opportunity.fitScore < 38) {
    return "Mark no-bid unless there is a strategic subcontractor reason to pursue.";
  }
  return "Save for review and reassess after subcontractor availability is known.";
}

export function scoreGovContractOpportunity(input: {
  title: string;
  agency?: string | null;
  noticeType?: string | null;
  naicsCode?: string | null;
  pscCode?: string | null;
  setAsideDescription?: string | null;
  dueDate?: string | null;
  estimatedValueCents?: number | null;
  locationState?: string | null;
  summary?: string | null;
}): {
  fitScore: number;
  riskScore: number;
  urgencyScore: number;
  urgency: GovContractUrgency;
  fitStatus: GovContractFitStatus;
  scoreBreakdown: GovContractScoreBreakdown;
  scoringReason: string;
  missingItems: string[];
} {
  const text = [
    input.title,
    input.agency,
    input.noticeType,
    input.naicsCode,
    input.pscCode,
    input.setAsideDescription,
    input.summary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const naicsFit = input.naicsCode && HIGH_FIT_NAICS.has(input.naicsCode) ? 28 : 0;
  const keywordFit = includesAny(text, OPERATIONAL_KEYWORDS) ? 24 : 8;
  const subcontractability = includesAny(text, SUBCONTRACTABLE_KEYWORDS) ? 72 : 44;
  const value = input.estimatedValueCents ?? 0;
  const revenuePotential = value >= 500_000_00 ? 85 : value >= 100_000_00 ? 70 : value > 0 ? 52 : 42;
  const urgency = urgencyForDueDate(input.dueDate ?? null);
  const days = daysUntil(input.dueDate ?? null);
  const deadlineFeasibility = days === null ? 48 : days >= 14 ? 82 : days >= 7 ? 66 : days >= 3 ? 38 : 18;
  const geographyFeasibility = input.locationState && ["OH", "PA", "MI", "IN", "KY", "WV"].includes(input.locationState.toUpperCase()) ? 74 : 56;
  const complianceComplexity = text.includes("bond") || text.includes("certification") || text.includes("security clearance") ? 38 : 68;
  const pastPerformanceRisk = text.includes("past performance") ? 45 : 70;
  const strategicValue = text.includes("small business") || text.includes("set-aside") ? 72 : 58;

  // Advisory formula: operational fit and deadline feasibility carry the most
  // weight; compliance/past performance lower the score when pursuit risk is high.
  const fitScore = clampScore(
    naicsFit +
      keywordFit +
      subcontractability * 0.12 +
      revenuePotential * 0.12 +
      deadlineFeasibility * 0.14 +
      geographyFeasibility * 0.1 +
      complianceComplexity * 0.08 +
      pastPerformanceRisk * 0.06 +
      strategicValue * 0.08
  );

  const riskScore = clampScore(100 - (deadlineFeasibility * 0.35 + complianceComplexity * 0.35 + pastPerformanceRisk * 0.3));
  const missingItems: string[] = [];
  if (!input.dueDate) missingItems.push("response deadline");
  if (!input.naicsCode) missingItems.push("NAICS code");
  if (!input.pscCode) missingItems.push("PSC code");
  if (!input.estimatedValueCents) missingItems.push("estimated value");

  const fitStatus = fitStatusForScore(fitScore);
  const reasons = [
    naicsFit > 0 ? "NAICS matches HomeReach-adjacent operations" : "NAICS needs review",
    keywordFit >= 24 ? "scope language matches mail/logistics/facilities capabilities" : "scope match is limited",
    deadlineFeasibility >= 66 ? "deadline appears workable" : "deadline is tight",
    complianceComplexity >= 60 ? "compliance complexity appears manageable" : "compliance requirements may be heavy",
  ];

  return {
    fitScore,
    riskScore,
    urgencyScore: urgency.score,
    urgency: urgency.label,
    fitStatus,
    scoreBreakdown: {
      operationalFit: clampScore(naicsFit + keywordFit + 30),
      subcontractability,
      revenuePotential,
      deadlineFeasibility,
      geographyFeasibility,
      complianceComplexity,
      pastPerformanceRisk,
      strategicValue,
    },
    scoringReason: reasons.join("; ") + ".",
    missingItems,
  };
}
