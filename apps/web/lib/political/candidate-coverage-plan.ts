import {
  DEFAULT_ADD_ON_PRICES,
  MINIMUM_TOTAL_PIECES,
  POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
  POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
  resolvePoliticalPostcardPriceCents,
} from "./pricing-config";
import type { DistrictType } from "./queries";
import type { OhioCandidateSelectorOption } from "./ohio-candidate-selector";

export type CandidateCoverageTier = "standard" | "expanded" | "premium" | "command";
export type CandidateCoverageDistrictLayer = "congressional" | "state_senate" | "state_house";

export interface CandidateCoverageMapHighlight {
  kind: "statewide_counties" | "official_district";
  title: string;
  summary: string;
  countyNames: string[];
  districtLayer?: CandidateCoverageDistrictLayer;
  districtNumber?: string;
  sourceLabel: string;
  readinessLabel: string;
}

export interface CandidateCoveragePhase {
  phaseNumber: number;
  name: string;
  objective: string;
  targetGeography: string;
  mailQuantity: number;
  timing: string;
  messageFocus: string;
  expectedOutcome: string;
}

export interface CandidateAgentCoverageOption {
  key: CandidateCoverageTier;
  label: string;
  budgetLevel: string;
  title: string;
  tagline: string;
  coveragePct: number;
  households: number;
  routeCount: number;
  drops: number;
  totalPieces: number;
  pricePerPieceCents: number;
  printEstimateCents: number;
  postageEstimateCents: number;
  totalEstimateCents: number;
  costPerHouseholdCents: number;
  recommendedGeographies: string[];
  mapHighlight: CandidateCoverageMapHighlight;
  phases: CandidateCoveragePhase[];
  whyThisPlan: string;
  operationalComplexity: "low" | "medium" | "high";
  readinessNote: string;
}

export interface CandidateAgentCoveragePlan {
  agentName: string;
  candidate: OhioCandidateSelectorOption;
  planFrame: string;
  strategicNeeds: string[];
  recommendedGeographies: string[];
  universeHouseholds: number;
  universeLabel: string;
  sourceNotice: string;
  methodology: string;
  options: CandidateAgentCoverageOption[];
}

const AVG_ROUTE_HOUSEHOLDS = 650;
const STATEWIDE_OHIO_PLANNING_HOUSEHOLDS = 4_900_000;
const STATE_SENATE_PLANNING_HOUSEHOLDS = 170_000;
const STATE_HOUSE_PLANNING_HOUSEHOLDS = 58_000;
const APPEALS_DISTRICT_PLANNING_HOUSEHOLDS = 330_000;

const NEUTRAL_STATEWIDE_COUNTIES_BY_TIER: Record<CandidateCoverageTier, string[]> = {
  standard: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"],
  expanded: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery", "Stark", "Lorain", "Mahoning", "Butler", "Delaware", "Lake"],
  premium: [
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Summit",
    "Lucas",
    "Montgomery",
    "Stark",
    "Lorain",
    "Mahoning",
    "Butler",
    "Delaware",
    "Lake",
    "Warren",
    "Medina",
    "Portage",
    "Fairfield",
    "Licking",
    "Clark",
    "Greene",
    "Wood",
  ],
  command: [
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Summit",
    "Lucas",
    "Montgomery",
    "Stark",
    "Lorain",
    "Mahoning",
    "Butler",
    "Delaware",
    "Lake",
    "Warren",
    "Medina",
    "Portage",
    "Fairfield",
    "Licking",
    "Clark",
    "Greene",
    "Wood",
    "Trumbull",
    "Erie",
    "Wayne",
    "Richland",
    "Ashland",
    "Knox",
    "Tuscarawas",
    "Columbiana",
    "Ashtabula",
    "Geauga",
    "Pickaway",
    "Madison",
    "Union",
  ],
};

const DEMOCRATIC_STATEWIDE_COUNTIES_BY_TIER: Record<CandidateCoverageTier, string[]> = {
  standard: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"],
  expanded: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery", "Lorain", "Mahoning", "Delaware", "Lake"],
  premium: [
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Summit",
    "Lucas",
    "Montgomery",
    "Lorain",
    "Mahoning",
    "Delaware",
    "Lake",
    "Warren",
    "Butler",
    "Stark",
    "Portage",
    "Athens",
    "Wood",
  ],
  command: [
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Summit",
    "Lucas",
    "Montgomery",
    "Lorain",
    "Mahoning",
    "Delaware",
    "Lake",
    "Warren",
    "Butler",
    "Stark",
    "Portage",
    "Athens",
    "Wood",
    "Trumbull",
    "Erie",
    "Fairfield",
    "Licking",
    "Clark",
    "Greene",
    "Medina",
    "Ashtabula",
    "Jefferson",
    "Belmont",
  ],
};

const REPUBLICAN_STATEWIDE_COUNTIES_BY_TIER: Record<CandidateCoverageTier, string[]> = {
  standard: ["Delaware", "Warren", "Butler", "Clermont", "Medina", "Stark"],
  expanded: ["Delaware", "Warren", "Butler", "Clermont", "Medina", "Stark", "Lake", "Mahoning", "Trumbull", "Lorain", "Fairfield", "Licking"],
  premium: [
    "Delaware",
    "Warren",
    "Butler",
    "Clermont",
    "Medina",
    "Stark",
    "Lake",
    "Mahoning",
    "Trumbull",
    "Lorain",
    "Fairfield",
    "Licking",
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Greene",
    "Miami",
    "Portage",
    "Wood",
    "Allen",
    "Hancock",
  ],
  command: [
    "Delaware",
    "Warren",
    "Butler",
    "Clermont",
    "Medina",
    "Stark",
    "Lake",
    "Mahoning",
    "Trumbull",
    "Lorain",
    "Fairfield",
    "Licking",
    "Franklin",
    "Cuyahoga",
    "Hamilton",
    "Greene",
    "Miami",
    "Portage",
    "Wood",
    "Allen",
    "Hancock",
    "Wayne",
    "Richland",
    "Ashland",
    "Knox",
    "Tuscarawas",
    "Columbiana",
    "Ashtabula",
    "Geauga",
    "Pickaway",
    "Madison",
    "Union",
  ],
};

const STATEWIDE_TIERS: Array<{
  key: CandidateCoverageTier;
  label: string;
  budgetLevel: string;
  coveragePct: number;
  drops: number;
  complexity: CandidateAgentCoverageOption["operationalComplexity"];
}> = [
  { key: "standard", label: "Standard Coverage", budgetLevel: "Lower budget", coveragePct: 5, drops: 2, complexity: "low" },
  { key: "expanded", label: "Expanded Coverage", budgetLevel: "Mid budget", coveragePct: 12, drops: 3, complexity: "medium" },
  { key: "premium", label: "Premium Coverage", budgetLevel: "High budget", coveragePct: 25, drops: 4, complexity: "high" },
  { key: "command", label: "Command Coverage", budgetLevel: "Maximum coverage", coveragePct: 45, drops: 5, complexity: "high" },
];

const DISTRICT_TIERS: typeof STATEWIDE_TIERS = [
  { key: "standard", label: "Standard Coverage", budgetLevel: "Lower budget", coveragePct: 35, drops: 2, complexity: "low" },
  { key: "expanded", label: "Expanded Coverage", budgetLevel: "Mid budget", coveragePct: 60, drops: 3, complexity: "medium" },
  { key: "premium", label: "Premium Coverage", budgetLevel: "High budget", coveragePct: 85, drops: 4, complexity: "high" },
  { key: "command", label: "Command Coverage", budgetLevel: "Maximum coverage", coveragePct: 100, drops: 5, complexity: "high" },
];

function clampInt(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function includesAny(value: string, needles: string[]) {
  const lower = value.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

function isStatewide(option: OhioCandidateSelectorOption) {
  return (
    option.geography.toLowerCase().includes("statewide") ||
    includesAny(option.officeSought, [
      "governor",
      "u.s. senate",
      "attorney general",
      "secretary of state",
      "treasurer",
      "auditor",
      "supreme court",
    ])
  );
}

function resolveUniverse(option: OhioCandidateSelectorOption) {
  const office = option.officeSought.toLowerCase();
  if (isStatewide(option)) {
    return {
      households: STATEWIDE_OHIO_PLANNING_HOUSEHOLDS,
      label: "Ohio statewide planning universe",
    };
  }
  if (office.includes("state senator")) {
    return {
      households: STATE_SENATE_PLANNING_HOUSEHOLDS,
      label: `${option.geography} planning universe`,
    };
  }
  if (office.includes("state representative")) {
    return {
      households: STATE_HOUSE_PLANNING_HOUSEHOLDS,
      label: `${option.geography} planning universe`,
    };
  }
  if (office.includes("court of appeals")) {
    return {
      households: APPEALS_DISTRICT_PLANNING_HOUSEHOLDS,
      label: `${option.geography} judicial district planning universe`,
    };
  }
  return {
    households: STATE_SENATE_PLANNING_HOUSEHOLDS,
    label: `${option.geography} planning universe`,
  };
}

function resolveDistrictType(option: OhioCandidateSelectorOption): DistrictType {
  if (option.officeSought.toLowerCase().includes("u.s. senate")) return "federal";
  if (isStatewide(option) || option.raceType.includes("state")) return "state";
  return "local";
}

function officeMessageFocus(option: OhioCandidateSelectorOption) {
  const office = option.officeSought.toLowerCase();
  if (office.includes("governor")) return "statewide leadership, affordability, local community priorities, and readiness to serve";
  if (office.includes("u.s. senate")) return "federal representation, Ohio economic priorities, constituent service, and statewide visibility";
  if (office.includes("attorney general")) return "public safety, consumer protection, legal accountability, and office readiness";
  if (office.includes("secretary of state")) return "civic trust, election administration, ballot access education, and public-service credibility";
  if (office.includes("auditor")) return "taxpayer accountability, fiscal oversight, transparency, and competent administration";
  if (office.includes("treasurer")) return "fiscal stewardship, local investment, budget trust, and financial competence";
  if (office.includes("supreme court") || office.includes("judge")) return "judicial experience, trust, ballot-name clarity, and nonpartisan civic familiarity";
  if (office.includes("state senator") || office.includes("state representative")) return "district service, constituent familiarity, local priorities, and election reminder visibility";
  return "candidate introduction, office fit, community credibility, and election reminder visibility";
}

function recommendGeographies(option: OhioCandidateSelectorOption) {
  const office = option.officeSought.toLowerCase();
  const party = option.party.toLowerCase();

  if (!isStatewide(option)) {
    return [
      `${option.geography} district-wide route clusters`,
      "Highest-density ZIP clusters inside the district",
      "County-seat and municipal center carrier routes",
      "Township and outlying route gaps that need coverage completion",
      "Route clusters nearest campaign-provided priority communities",
    ];
  }

  if (office.includes("supreme court") || office.includes("judge")) {
    return [
      "Franklin, Cuyahoga, and Hamilton county ballot-awareness clusters",
      "Summit, Lucas, Montgomery, and Stark regional coverage",
      "County-seat routes for statewide judicial name recognition",
      "Suburban and exurban corridors where ballot roll-off education matters operationally",
      "High-density ZIP clusters with efficient household saturation",
    ];
  }

  if (office.includes("secretary of state")) {
    return [
      "County-seat civic participation corridors",
      "Franklin, Cuyahoga, Hamilton, Summit, Lucas, and Montgomery high-volume mail clusters",
      "College and community-administration route clusters where civic-information mail is efficient",
      "Suburban ZIP clusters with strong household density",
      "Regional media-market mail corridors for consistent statewide visibility",
    ];
  }

  if (office.includes("attorney general")) {
    return [
      "County-seat and courthouse-adjacent civic corridors",
      "Franklin, Cuyahoga, Hamilton, Summit, Lucas, Montgomery, and Stark high-volume clusters",
      "Suburban household-density corridors for public-safety and consumer-protection mail",
      "Small-city regional routes for office-awareness coverage",
      "Route clusters with efficient saturation and clean delivery timing",
    ];
  }

  if (office.includes("auditor") || office.includes("treasurer")) {
    return [
      "County-seat fiscal accountability corridors",
      "Small-business and main-street route clusters at the geography level",
      "Franklin, Cuyahoga, Hamilton, Summit, Montgomery, Lucas, and Stark high-volume clusters",
      "Suburban ZIP clusters with efficient household density",
      "Regional route groupings that balance coverage and production cost",
    ];
  }

  if (party.includes("republican")) {
    return [
      "Delaware, Warren, Butler, Clermont, and Medina high-efficiency suburban/exurban corridors",
      "Stark, Lake, Mahoning, Trumbull, and Lorain regional mail clusters",
      "County-seat routes for statewide name recognition",
      "Rural and township carrier-route clusters where mail density is efficient",
      "Franklin, Cuyahoga, and Hamilton selected route clusters for statewide baseline visibility",
    ];
  }

  if (party.includes("democrat")) {
    return [
      "Franklin, Cuyahoga, and Hamilton high-volume metro route clusters",
      "Summit, Lucas, Montgomery, Lorain, and Mahoning regional coverage",
      "Delaware, Lake, Warren, and Butler selected suburban visibility corridors",
      "College, healthcare, and education-adjacent community route clusters at aggregate geography level",
      "High-density ZIP clusters that support efficient repeat mail touches",
    ];
  }

  return [
    "Franklin, Cuyahoga, Hamilton, Summit, Lucas, and Montgomery high-volume clusters",
    "County-seat routes for statewide awareness",
    "Suburban and exurban route clusters with strong mail efficiency",
    "Regional ZIP clusters that balance coverage and cost",
    "Route groups with clean delivery timing and manageable production complexity",
  ];
}

function strategicNeeds(option: OhioCandidateSelectorOption) {
  const needs = [
    `Build office-specific visibility for ${option.officeSought}.`,
    `Make coverage decisions around ${option.geography}, not individual-level voter predictions.`,
    "Keep USPS route counts, print pricing, postage, and source timestamps locked before proposal or checkout.",
  ];

  if (isStatewide(option)) {
    needs.splice(1, 0, "Balance statewide reach with budget-controlled county and ZIP concentration.");
  } else {
    needs.splice(1, 0, "Maximize district saturation without wasting pieces outside the race geography.");
  }

  return needs;
}

function phaseNames(drops: number) {
  const names = [
    "Introduction",
    "Office fit and trust",
    "Local priorities",
    "Choice and stakes",
    "Election reminder",
  ];
  return names.slice(0, drops);
}

function timingForPhase(phaseNumber: number, drops: number) {
  if (drops >= 5) {
    return ["10-12 weeks out", "8-9 weeks out", "6-7 weeks out", "4-5 weeks out", "Final 10-14 days"][phaseNumber - 1] ?? "Campaign window";
  }
  if (drops === 4) {
    return ["8-10 weeks out", "6-7 weeks out", "4-5 weeks out", "Final 10-14 days"][phaseNumber - 1] ?? "Campaign window";
  }
  if (drops === 3) {
    return ["6-8 weeks out", "4-5 weeks out", "Final 10-14 days"][phaseNumber - 1] ?? "Campaign window";
  }
  return ["4-6 weeks out", "Final 10-14 days"][phaseNumber - 1] ?? "Campaign window";
}

function buildPhases(args: {
  option: OhioCandidateSelectorOption;
  drops: number;
  households: number;
  geographies: string[];
}): CandidateCoveragePhase[] {
  const focus = officeMessageFocus(args.option);
  return phaseNames(args.drops).map((name, index) => {
    const phaseNumber = index + 1;
    const targetGeography = args.geographies[index % args.geographies.length] ?? args.option.geography;
    return {
      phaseNumber,
      name,
      objective:
        phaseNumber === 1
          ? `Introduce ${args.option.candidateName} and establish a clear reason for the office sought.`
          : phaseNumber === args.drops
            ? "Create final-window mail visibility and remind households of the election timeline."
            : `Reinforce ${args.option.officeSought} readiness through aggregate geography-based mail coverage.`,
      targetGeography,
      mailQuantity: args.households,
      timing: timingForPhase(phaseNumber, args.drops),
      messageFocus: focus,
      expectedOutcome:
        "More consistent household-level mail visibility, clearer campaign timing, and a more organized proposal-to-production path.",
    };
  });
}

function titleForTier(option: OhioCandidateSelectorOption, key: CandidateCoverageTier) {
  const race = option.officeSought.replace(/^State Senator - /, "Senate ");
  if (key === "standard") return `${race} Standard Coverage`;
  if (key === "expanded") return `${race} Expanded Coverage`;
  if (key === "premium") return `${race} Premium Coverage`;
  return `${race} Command Coverage`;
}

function taglineForTier(option: OhioCandidateSelectorOption, key: CandidateCoverageTier) {
  const geography = isStatewide(option) ? "Ohio" : option.geography;
  if (key === "standard") return `A budget-controlled launch focused on the highest-efficiency ${geography} route clusters.`;
  if (key === "expanded") return `A broader ${geography} plan with enough repetition to support a clear multi-phase campaign.`;
  if (key === "premium") return `A high-visibility ${geography} plan built for stronger coverage, more phases, and better timing control.`;
  return `The most complete ${geography} coverage path with maximum mail-wave visibility and operational readiness.`;
}

function whyForTier(option: OhioCandidateSelectorOption, key: CandidateCoverageTier) {
  const geography = isStatewide(option) ? "statewide Ohio" : option.geography;
  if (key === "standard") {
    return `This gives ${option.candidateName} a disciplined starting plan in ${geography}: enough route coverage to launch, without pretending demo counts are final USPS counts.`;
  }
  if (key === "expanded") {
    return `This adds coverage depth and a third touch, which helps the campaign sequence introduction, office fit, and election-window reminders across ${geography}.`;
  }
  if (key === "premium") {
    return `This is the strongest balanced option: more route clusters, more phases, and more timing flexibility while still preserving quote-lock guardrails.`;
  }
  return `This is the highest-coverage operational path for ${option.candidateName}, designed for maximum geographic visibility before final USPS verification and human approval.`;
}

function districtNumberFromGeography(value: string) {
  const match = value.match(/district\s*0?(\d+)/i);
  return match?.[1] ?? null;
}

function districtLayerForOption(option: OhioCandidateSelectorOption): CandidateCoverageDistrictLayer | null {
  const office = option.officeSought.toLowerCase();
  if (office.includes("state senator") || office.includes("senate district")) return "state_senate";
  if (office.includes("state representative") || office.includes("house district")) return "state_house";
  if (office.includes("u.s. representative") || office.includes("congress")) return "congressional";
  return null;
}

function statewideCountySetForOption(option: OhioCandidateSelectorOption, tier: CandidateCoverageTier) {
  const party = option.party.toLowerCase();
  if (party.includes("democrat")) return DEMOCRATIC_STATEWIDE_COUNTIES_BY_TIER[tier];
  if (party.includes("republican")) return REPUBLICAN_STATEWIDE_COUNTIES_BY_TIER[tier];
  return NEUTRAL_STATEWIDE_COUNTIES_BY_TIER[tier];
}

function formatTierLabel(tier: CandidateCoverageTier) {
  if (tier === "standard") return "Standard";
  if (tier === "expanded") return "Expanded";
  if (tier === "premium") return "Premium";
  return "Command";
}

function buildMapHighlight(option: OhioCandidateSelectorOption, tier: CandidateCoverageTier): CandidateCoverageMapHighlight {
  const layer = districtLayerForOption(option);
  const districtNumber = districtNumberFromGeography(option.geography);

  if (!isStatewide(option) && layer && districtNumber) {
    return {
      kind: "official_district",
      title: `${option.geography} selected coverage preview`,
      summary:
        tier === "standard"
          ? "The highlighted official district shape shows the race boundary; the standard tier concentrates the first route clusters inside that district."
          : `The highlighted official district shape stays constant while ${tier} coverage increases route saturation and mail-wave repetition inside the district.`,
      countyNames: [],
      districtLayer: layer,
      districtNumber,
      sourceLabel: "Ohio Secretary of State district geometry",
      readinessLabel: "Official district boundary shown; USPS carrier-route counts still required before quoting.",
    };
  }

  const counties = statewideCountySetForOption(option, tier);
  return {
    kind: "statewide_counties",
    title: `${formatTierLabel(tier)} Ohio county coverage preview`,
    summary:
      tier === "standard"
        ? "The highlighted counties show the initial high-efficiency planning footprint for this lower-budget option."
        : `The highlighted counties expand the Ohio planning footprint for the ${tier} option while keeping final USPS quote locks in place.`,
    countyNames: counties,
    sourceLabel: "Census county geometry with HomeReach planning tiers",
    readinessLabel: "County highlights are planning footprints, not final USPS carrier-route selections.",
  };
}

export function buildCandidateCoveragePlan(option: OhioCandidateSelectorOption): CandidateAgentCoveragePlan {
  const universe = resolveUniverse(option);
  const tiers = isStatewide(option) ? STATEWIDE_TIERS : DISTRICT_TIERS;
  const districtType = resolveDistrictType(option);
  const geographies = recommendGeographies(option);

  const options = tiers.map((tier) => {
    const households = clampInt(universe.households * (tier.coveragePct / 100), MINIMUM_TOTAL_PIECES, universe.households);
    const totalPieces = households * tier.drops;
    const billablePieces = Math.max(MINIMUM_TOTAL_PIECES, totalPieces);
    const pricePerPieceCents = resolvePoliticalPostcardPriceCents(districtType, billablePieces);
    const piecesSubtotal = billablePieces * pricePerPieceCents;
    const totalEstimateCents =
      piecesSubtotal + DEFAULT_ADD_ON_PRICES.setupCents + DEFAULT_ADD_ON_PRICES.designCents;
    const phases = buildPhases({
      option,
      drops: tier.drops,
      households,
      geographies,
    });

    return {
      key: tier.key,
      label: tier.label,
      budgetLevel: tier.budgetLevel,
      title: titleForTier(option, tier.key),
      tagline: taglineForTier(option, tier.key),
      coveragePct: tier.coveragePct,
      households,
      routeCount: Math.max(1, Math.ceil(households / AVG_ROUTE_HOUSEHOLDS)),
      drops: tier.drops,
      totalPieces,
      pricePerPieceCents,
      printEstimateCents: billablePieces * POLITICAL_POSTCARD_PRINT_ESTIMATE_CENTS,
      postageEstimateCents: billablePieces * POLITICAL_POSTCARD_POSTAGE_ESTIMATE_CENTS,
      totalEstimateCents,
      costPerHouseholdCents: households > 0 ? Math.round(totalEstimateCents / households) : 0,
      recommendedGeographies: geographies.slice(0, tier.key === "standard" ? 2 : tier.key === "expanded" ? 3 : 5),
      mapHighlight: buildMapHighlight(option, tier.key),
      phases,
      whyThisPlan: whyForTier(option, tier.key),
      operationalComplexity: tier.complexity,
      readinessNote:
        "Planning estimate only. Proposal, checkout, and production stay locked until USPS route counts, print/postage, source timestamp, and human approval are verified.",
    } satisfies CandidateAgentCoverageOption;
  });

  return {
    agentName: `${option.candidateName} Campaign Launch Agent`,
    candidate: option,
    planFrame: `${option.officeSought} mail coverage planning for ${option.geography}`,
    strategicNeeds: strategicNeeds(option),
    recommendedGeographies: geographies,
    universeHouseholds: universe.households,
    universeLabel: universe.label,
    sourceNotice:
      "Coverage tiers are source-backed planning profiles where available, not final USPS-quoted campaigns. Final counts must come from USPS EDDM/carrier-route data or verified campaign lists.",
    methodology:
      "Formula: selected planning households x mail drops = total pieces; total pieces x HomeReach political price band + setup/design = planning estimate. Route count uses 650 households per route until USPS routes are attached.",
    options,
  };
}
