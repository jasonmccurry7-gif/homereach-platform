import {
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  type CandidateCampaignAgent,
  type CandidateCampaignStrategy,
} from "@/lib/political/candidate-agent-recommendations";
import { resolvePoliticalPostcardPriceCents } from "@/lib/political/pricing-config";

export type StrategySelectionCandidateStatus =
  | "source_backed"
  | "needs_source_verification"
  | "admin_review";

export type StrategySelectionCandidate = {
  id: string;
  candidateName: string;
  office: string;
  party: string;
  geography: string;
  county: string;
  district: string;
  electionYear: string;
  raceType: string;
  campaignStatus: string;
  status: StrategySelectionCandidateStatus;
  sourceNote: string;
  agent?: CandidateCampaignAgent;
};

export type StrategySelectionMetric = {
  label: string;
  value: string;
};

export type StrategySelectionPostcard = {
  id: string;
  category: string;
  headline: string;
  subheadline: string;
  cta: string;
  tone: string;
  frontBody: string;
  backBody: string;
};

export type StrategySelectionPlan = {
  id: string;
  optionLabel: "A" | "B" | "C" | "D";
  title: string;
  tagline: string;
  strategyOverview: string;
  whyThisPlan: string;
  candidateFit: string;
  estimatedVoterReach: number;
  estimatedHouseholds: number;
  estimatedImpressions: number;
  estimatedFrequency: number;
  totalCampaignCostCents: number;
  costPerHouseholdCents: number;
  drops: number;
  durationWeeks: number;
  countiesIncluded: string[];
  citiesIncluded: string[];
  districtsIncluded: string[];
  uspsRoutesIncluded: number;
  mailFormat: string;
  saturationPct: number;
  timelineLength: string;
  mapHighlights: string[];
  routeDensity: "medium" | "high" | "very high";
  productionStatus: "planning_estimate" | "needs_usps_counts" | "ready_for_admin_review";
  indicators: Array<{
    label: string;
    value: "MEDIUM" | "HIGH" | "VERY HIGH";
  }>;
  timeline: Array<{
    week: string;
    label: string;
  }>;
  postcards: StrategySelectionPostcard[];
  metrics: StrategySelectionMetric[];
};

const MONEY_WHOLE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const MONEY_TWO = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const INTEGER = new Intl.NumberFormat("en-US");

const EXISTING_CANDIDATES: StrategySelectionCandidate[] =
  MULTI_CANDIDATE_CAMPAIGN_AGENTS.map((agent) => ({
    id: agent.profile.id,
    candidateName: agent.profile.candidateName,
    office: agent.profile.office,
    party: agent.profile.partyOrCommittee,
    geography: agent.profile.state,
    county: agent.profile.topCounties[0] ?? "Ohio",
    district: agent.profile.office.includes("U.S.") ? "Federal statewide" : "Ohio statewide",
    electionYear: agent.profile.electionDate.slice(0, 4),
    raceType: resolveRaceType(agent.profile.office),
    campaignStatus: "Prebuilt AI agent ready",
    status: "source_backed",
    sourceNote: "Uses the existing HomeReach prebuilt candidate-agent profile and source list.",
    agent,
  }));

const ADDITIONAL_WORKSPACES: StrategySelectionCandidate[] = [
  workspace("frank-larose", "Frank LaRose", "Secretary of State", "Republican", "Ohio", "Franklin", "Ohio statewide", "2026", "Statewide", "Source verification needed"),
  workspace("columbus-mayor", "Columbus Mayor Program", "Mayor", "Nonpartisan/local", "Columbus", "Franklin", "Citywide", "2027", "Mayoral", "Campaign workspace"),
  workspace("cleveland-mayor", "Cleveland Mayor Program", "Mayor", "Nonpartisan/local", "Cleveland", "Cuyahoga", "Citywide", "2025", "Mayoral", "Campaign workspace"),
  workspace("cincinnati-mayor", "Cincinnati Mayor Program", "Mayor", "Nonpartisan/local", "Cincinnati", "Hamilton", "Citywide", "2025", "Mayoral", "Campaign workspace"),
  workspace("toledo-mayor", "Toledo Mayor Program", "Mayor", "Nonpartisan/local", "Toledo", "Lucas", "Citywide", "2025", "Mayoral", "Campaign workspace"),
  workspace("akron-mayor", "Akron Mayor Program", "Mayor", "Nonpartisan/local", "Akron", "Summit", "Citywide", "2027", "Mayoral", "Campaign workspace"),
  workspace("dayton-mayor", "Dayton Mayor Program", "Mayor", "Nonpartisan/local", "Dayton", "Montgomery", "Citywide", "2025", "Mayoral", "Campaign workspace"),
  workspace("franklin-county-commissioner", "Franklin County Commissioner Program", "County Commissioner", "Local", "Franklin County", "Franklin", "Countywide", "2026", "County", "Campaign workspace"),
  workspace("cuyahoga-county-judicial", "Cuyahoga County Judicial Program", "Judicial", "Nonpartisan/local", "Cuyahoga County", "Cuyahoga", "Countywide", "2026", "Judicial", "Campaign workspace"),
  workspace("hamilton-county-commissioner", "Hamilton County Commissioner Program", "County Commissioner", "Local", "Hamilton County", "Hamilton", "Countywide", "2026", "County", "Campaign workspace"),
  workspace("summit-county-executive", "Summit County Executive Program", "County Executive", "Local", "Summit County", "Summit", "Countywide", "2026", "County", "Campaign workspace"),
  workspace("lucas-county-commissioner", "Lucas County Commissioner Program", "County Commissioner", "Local", "Lucas County", "Lucas", "Countywide", "2026", "County", "Campaign workspace"),
  workspace("delaware-legislative", "Delaware County Legislative Program", "State Legislative", "Local", "Delaware County", "Delaware", "State House/Senate", "2026", "Legislative", "Campaign workspace"),
  workspace("stark-county-judicial", "Stark County Judicial Program", "Judicial", "Nonpartisan/local", "Stark County", "Stark", "Countywide", "2026", "Judicial", "Campaign workspace"),
  workspace("mahoning-valley-legislative", "Mahoning Valley Legislative Program", "State Legislative", "Local", "Mahoning Valley", "Mahoning", "State House/Senate", "2026", "Legislative", "Campaign workspace"),
  workspace("lorain-school-board", "Lorain County School Board Program", "School Board", "Nonpartisan/local", "Lorain County", "Lorain", "School district", "2025", "School Board", "Campaign workspace"),
  workspace("warren-township", "Warren County Township Program", "Township Trustee", "Nonpartisan/local", "Warren County", "Warren", "Township", "2025", "Township", "Campaign workspace"),
  workspace("butler-legislative", "Butler County Legislative Program", "State Legislative", "Local", "Butler County", "Butler", "State House/Senate", "2026", "Legislative", "Campaign workspace"),
  workspace("ohio-house-battleground", "Ohio House Battleground Program", "State House", "Coordinated", "Ohio", "Multiple", "Priority House districts", "2026", "Legislative", "Campaign workspace"),
  workspace("ohio-senate-battleground", "Ohio Senate Battleground Program", "State Senate", "Coordinated", "Ohio", "Multiple", "Priority Senate districts", "2026", "Legislative", "Campaign workspace"),
];

export const STRATEGY_SELECTION_CANDIDATES: StrategySelectionCandidate[] = [
  ...EXISTING_CANDIDATES,
  ...ADDITIONAL_WORKSPACES,
];

export function getDefaultStrategySelectionCandidateId() {
  return "amy-acton";
}

export function getStrategySelectionCandidate(candidateId: string) {
  return (
    STRATEGY_SELECTION_CANDIDATES.find((candidate) => candidate.id === candidateId) ??
    STRATEGY_SELECTION_CANDIDATES.find(
      (candidate) => candidate.id === getDefaultStrategySelectionCandidateId(),
    ) ??
    STRATEGY_SELECTION_CANDIDATES[0]!
  );
}

export function buildStrategySelectionPlans(
  candidate: StrategySelectionCandidate,
): StrategySelectionPlan[] {
  if (candidate.agent) {
    return candidate.agent.strategies.slice(0, 4).map((strategy, index) =>
      fromExistingStrategy(candidate, strategy, index),
    );
  }

  return buildWorkspacePlans(candidate);
}

function workspace(
  id: string,
  candidateName: string,
  office: string,
  party: string,
  geography: string,
  county: string,
  district: string,
  electionYear: string,
  raceType: string,
  campaignStatus: string,
): StrategySelectionCandidate {
  return {
    id,
    candidateName,
    office,
    party,
    geography,
    county,
    district,
    electionYear,
    raceType,
    campaignStatus,
    status: "needs_source_verification",
    sourceNote:
      "Prebuilt campaign workspace. Candidate/contact/platform/source details must be verified before proposal, checkout, creative approval, or production.",
  };
}

function fromExistingStrategy(
  candidate: StrategySelectionCandidate,
  strategy: CandidateCampaignStrategy,
  index: number,
): StrategySelectionPlan {
  const optionLabel = optionLabels[index] ?? "A";
  const counties = candidate.agent?.profile.topCounties.slice(index, index + 5) ?? [];
  const cities = candidate.agent?.profile.topCities.slice(index, index + 5) ?? [];
  const districts = [
    candidate.district,
    ...((candidate.agent?.profile.mediaMarkets.slice(0, 2) ?? []).map(
      (market) => `${market} media market`,
    )),
  ];
  const saturationPct = clamp(42 + index * 11, 38, 86);
  const routeCount = Math.max(12, Math.round(strategy.households / 620));
  const frequency = strategy.drops;
  const postcards = strategy.phases[0]?.postcardConcepts.slice(0, 4).map((concept) => ({
    id: concept.id,
    category: concept.category,
    headline: concept.headline,
    subheadline: concept.subheadline,
    cta: concept.cta,
    tone: concept.visualDirection,
    frontBody: concept.frontBody,
    backBody: concept.backBody,
  })) ?? [];

  return completePlan({
    id: strategy.id,
    optionLabel,
    title: strategy.title,
    tagline: strategy.campaignTheme,
    strategyOverview: strategy.strategyOverview,
    whyThisPlan: `${strategy.rolloutStrategy} ${strategy.mailQuantityAssumptions}`,
    candidateFit: strategy.emotionalPositioning,
    estimatedVoterReach: strategy.estimatedReach,
    estimatedHouseholds: strategy.households,
    estimatedImpressions: Math.round(strategy.totalPieces * 2.1),
    estimatedFrequency: frequency,
    totalCampaignCostCents: strategy.estimatedTotalCents,
    costPerHouseholdCents: Math.round(strategy.estimatedTotalCents / Math.max(1, strategy.households)),
    drops: strategy.drops,
    durationWeeks: strategy.drops * 2,
    countiesIncluded: counties.length > 0 ? counties : [candidate.county],
    citiesIncluded: cities.length > 0 ? cities : [candidate.geography],
    districtsIncluded: districts,
    uspsRoutesIncluded: routeCount,
    mailFormat: "6x11 political postcard",
    saturationPct,
    timelineLength: `${strategy.drops * 2} weeks`,
    mapHighlights: [...counties.slice(0, 5), ...cities.slice(0, 3)],
    routeDensity: index === 0 ? "very high" : index === 1 ? "high" : "medium",
    productionStatus: "needs_usps_counts",
    postcards,
  });
}

function buildWorkspacePlans(candidate: StrategySelectionCandidate): StrategySelectionPlan[] {
  const geography = candidate.geography || candidate.county || "Ohio";
  const baseHouseholds = baseHouseholdsFor(candidate);
  const names = resolveStrategyNames(candidate);
  const counties = resolveCounties(candidate);
  const cities = resolveCities(candidate);

  return names.map((seed, index) => {
    const drops = [5, 4, 4, 3][index] ?? 4;
    const householdFactor = [1, 0.68, 0.48, 0.34][index] ?? 0.5;
    const households = Math.round(baseHouseholds * householdFactor);
    const pieces = households * drops;
    const priceCents = resolvePoliticalPostcardPriceCents(resolveDistrictType(candidate), pieces);
    const totalCostCents = pieces * priceCents;

    return completePlan({
      id: seed.id,
      optionLabel: optionLabels[index] ?? "A",
      title: seed.title,
      tagline: seed.tagline,
      strategyOverview: `${seed.tagline} Built for ${candidate.candidateName} in ${geography} using aggregate geography, route density, and production feasibility only.`,
      whyThisPlan: `This plan gives ${candidate.office} staff a clean route to compare ${counties
        .slice(0, 3)
        .join(", ")} and ${cities.slice(0, 3).join(", ")} before USPS counts and final source verification.`,
      candidateFit: seed.fit,
      estimatedVoterReach: Math.round(households * 1.5),
      estimatedHouseholds: households,
      estimatedImpressions: Math.round(pieces * 2.1),
      estimatedFrequency: drops,
      totalCampaignCostCents: totalCostCents,
      costPerHouseholdCents: Math.round(totalCostCents / Math.max(1, households)),
      drops,
      durationWeeks: drops * 2,
      countiesIncluded: counties,
      citiesIncluded: cities,
      districtsIncluded: [candidate.district, candidate.raceType],
      uspsRoutesIncluded: Math.max(8, Math.round(households / 620)),
      mailFormat: candidate.raceType === "School Board" ? "6x9 local postcard" : "6x11 political postcard",
      saturationPct: clamp(38 + index * 12, 35, 82),
      timelineLength: `${drops * 2} weeks`,
      mapHighlights: [...counties.slice(0, 5), ...cities.slice(0, 3)],
      routeDensity: index === 0 ? "high" : index === 1 ? "very high" : "medium",
      productionStatus: "needs_usps_counts",
      postcards: buildWorkspacePostcards(candidate, seed.title, seed.fit),
    });
  });
}

function completePlan(
  plan: Omit<StrategySelectionPlan, "metrics" | "indicators" | "timeline">,
): StrategySelectionPlan {
  const metrics = [
    { label: "Voter reach", value: INTEGER.format(plan.estimatedVoterReach) },
    { label: "Households", value: INTEGER.format(plan.estimatedHouseholds) },
    { label: "Impressions", value: INTEGER.format(plan.estimatedImpressions) },
    { label: "Frequency", value: `${plan.estimatedFrequency}x` },
    { label: "Total cost", value: MONEY_WHOLE.format(plan.totalCampaignCostCents / 100) },
    { label: "Cost/HH", value: MONEY_TWO.format(plan.costPerHouseholdCents / 100) },
    { label: "Drops", value: String(plan.drops) },
    { label: "Duration", value: `${plan.durationWeeks} weeks` },
    { label: "Counties", value: String(plan.countiesIncluded.length) },
    { label: "Cities", value: String(plan.citiesIncluded.length) },
    { label: "Districts", value: String(plan.districtsIncluded.length) },
    { label: "USPS routes", value: INTEGER.format(plan.uspsRoutesIncluded) },
    { label: "Format", value: plan.mailFormat },
    { label: "Saturation", value: `${plan.saturationPct}%` },
    { label: "Timeline", value: plan.timelineLength },
  ];

  return {
    ...plan,
    metrics,
    indicators: [
      { label: "Turnout Potential", value: plan.drops >= 4 ? "VERY HIGH" : "HIGH" },
      { label: "Persuasion Potential", value: plan.saturationPct >= 60 ? "HIGH" : "MEDIUM" },
      { label: "Cost Efficiency", value: plan.costPerHouseholdCents <= 260 ? "VERY HIGH" : "HIGH" },
      { label: "Geographic Coverage", value: plan.countiesIncluded.length >= 5 ? "VERY HIGH" : "HIGH" },
      { label: "Frequency Strength", value: plan.estimatedFrequency >= 4 ? "VERY HIGH" : "HIGH" },
      { label: "Candidate Alignment", value: "HIGH" },
      { label: "Expansion Opportunity", value: plan.routeDensity === "very high" ? "VERY HIGH" : "HIGH" },
    ],
    timeline: buildTimeline(plan.drops),
  };
}

function buildTimeline(drops: number) {
  const labels = ["Introduction", "Trust", "Issue", "Contrast", "GOTV"];
  return Array.from({ length: drops }).map((_, index) => ({
    week: `Week ${index * 2 + 1}`,
    label: labels[index] ?? "Reinforcement",
  }));
}

function buildWorkspacePostcards(
  candidate: StrategySelectionCandidate,
  strategyTitle: string,
  fit: string,
): StrategySelectionPostcard[] {
  const categories = [
    "Emotional/Human",
    "Policy/Issue Focused",
    "Testimonial/Social Proof",
    "Contrast/Urgency",
  ];
  const issue = issueFor(candidate);

  return categories.map((category, index) => ({
    id: `${candidate.id}-${strategyTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index}`,
    category,
    headline:
      category === "Contrast/Urgency"
        ? `${candidate.geography} has a clear choice`
        : `${candidate.candidateName}: ${issue} for ${candidate.geography}`,
    subheadline:
      category === "Testimonial/Social Proof"
        ? "Approved validator quote and source required before print."
        : fit,
    cta: index === 3 ? "Make your voting plan" : "Learn the plan",
    tone: `${category} concept with ${candidate.party} campaign-safe styling and final source review.`,
    frontBody:
      "Front preview uses a candidate-safe headline, Ohio/local visual, and one simple message lane.",
    backBody:
      "Back preview reserves space for proof bullets, QR code, disclaimer, deadline, and campaign-approved contact.",
  }));
}

function resolveStrategyNames(candidate: StrategySelectionCandidate) {
  const party = candidate.party.toLowerCase();
  if (candidate.raceType === "Mayoral") {
    return [
      { id: "city-name-id", title: "Citywide Name Recognition", tagline: "Build simple, repeated citywide awareness.", fit: "Local, practical, civic, and easy to understand." },
      { id: "neighborhood-saturation", title: "Neighborhood Saturation Push", tagline: "Cluster routes around high-density neighborhoods.", fit: "Local proof, neighborhood familiarity, and service delivery." },
      { id: "community-contrast", title: "Community Contrast Lane", tagline: "Frame the public choice with local issues.", fit: "Factual, civic, and deadline-aware." },
      { id: "turnout-window", title: "Municipal Turnout Window", tagline: "Compress reminders around absentee and Election Day.", fit: "Clear, urgent, and voting-plan focused." },
    ];
  }
  if (candidate.raceType === "School Board") {
    return [
      { id: "family-trust", title: "Family Trust Builder", tagline: "Reach households with a calm education-first message.", fit: "Parent-focused, local, and nonpartisan." },
      { id: "district-awareness", title: "District Awareness Layer", tagline: "Explain the office and voting window.", fit: "Simple, civic, and practical." },
      { id: "community-proof", title: "Community Proof Card", tagline: "Use approved local validators and school-community proof.", fit: "Trust-centered and source-dependent." },
      { id: "final-reminder", title: "Final Reminder Push", tagline: "Make the low-turnout election impossible to miss.", fit: "Short, clear, and deadline-heavy." },
    ];
  }
  if (party.includes("republican")) {
    return [
      { id: "suburban-retention", title: "Suburban Retention Push", tagline: "Hold high-efficiency suburban and exurban route clusters.", fit: "Steady, values-forward, and economy-aware." },
      { id: "rural-reinforcement", title: "Rural Reinforcement Push", tagline: "Reinforce county-seat and rural carrier-route coverage.", fit: "Direct, patriotic, and locally grounded." },
      { id: "business-corridor", title: "Business Corridor Mail Plan", tagline: "Focus on growth corridors and local economic confidence.", fit: "Economy, safety, and competence." },
      { id: "gop-gotv", title: "Conservative GOTV Accelerator", tagline: "Tight final-window mail for turnout and deadline clarity.", fit: "Clear, urgent, and voting-window focused." },
    ];
  }
  if (party.includes("democrat")) {
    return [
      { id: "suburban-persuasion", title: "Suburban Persuasion Blitz", tagline: "Build trust in suburban and education-heavy counties.", fit: "Warm, family-centered, and issue-forward." },
      { id: "urban-turnout", title: "Urban Turnout Expansion", tagline: "Reinforce dense city routes and ballot-window timing.", fit: "Energetic, clear, and deadline-focused." },
      { id: "coalition-mail", title: "Coalition Message Ladder", tagline: "Sequence approved issue lanes by geography.", fit: "Healthcare, affordability, labor, and civic trust." },
      { id: "hybrid-gotv", title: "Hybrid Persuasion + GOTV", tagline: "Balance trust-building with final-week turnout reminders.", fit: "Emotionally steady and operationally focused." },
    ];
  }
  return [
    { id: "name-id", title: "Name Recognition Acceleration", tagline: "Make the candidate and office easy to understand.", fit: "Simple, local, and credible." },
    { id: "route-density", title: "Route Density Plan", tagline: "Prioritize efficient mail routes and neighborhood repetition.", fit: "Operationally efficient and local." },
    { id: "trust-proof", title: "Trust + Proof Sequence", tagline: "Use approved public record and validator proof.", fit: "Measured, factual, and review-ready." },
    { id: "final-window", title: "Final Window Reminder", tagline: "Mail around absentee, early vote, and Election Day.", fit: "Direct, urgent, and civic." },
  ];
}

function resolveCounties(candidate: StrategySelectionCandidate) {
  if (candidate.county !== "Multiple") return [candidate.county, "Nearby route cluster", "Adjacent county"];
  return ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"];
}

function resolveCities(candidate: StrategySelectionCandidate) {
  const city = candidate.geography.replace(" County", "");
  if (["Ohio", "Multiple"].includes(city)) return ["Columbus", "Cleveland", "Cincinnati", "Akron", "Toledo", "Dayton"];
  return [city, "Primary suburbs", "County seat"];
}

function baseHouseholdsFor(candidate: StrategySelectionCandidate) {
  if (candidate.raceType === "Statewide") return 1_050_000;
  if (candidate.raceType === "Mayoral") return 95_000;
  if (candidate.raceType === "County") return 160_000;
  if (candidate.raceType === "Judicial") return 140_000;
  if (candidate.raceType === "School Board") return 24_000;
  if (candidate.raceType === "Township") return 14_000;
  if (candidate.raceType === "Legislative") return 72_000;
  return 120_000;
}

function resolveDistrictType(candidate: StrategySelectionCandidate) {
  if (candidate.office.includes("U.S.")) return "federal";
  if (candidate.raceType === "Statewide" || candidate.raceType === "Legislative") return "state";
  return "local";
}

function resolveRaceType(office: string) {
  if (office.includes("Party")) return "Coordinated";
  if (office.includes("Governor") || office.includes("Secretary") || office.includes("Attorney")) return "Statewide";
  if (office.includes("U.S.")) return "Federal";
  return "Local";
}

function issueFor(candidate: StrategySelectionCandidate) {
  const office = candidate.office.toLowerCase();
  if (office.includes("attorney")) return "accountability";
  if (office.includes("secretary")) return "civic trust";
  if (office.includes("school")) return "strong local schools";
  if (office.includes("mayor")) return "safer, stronger neighborhoods";
  if (office.includes("governor")) return "Ohio families";
  return "community leadership";
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

const optionLabels: Array<"A" | "B" | "C" | "D"> = ["A", "B", "C", "D"];
