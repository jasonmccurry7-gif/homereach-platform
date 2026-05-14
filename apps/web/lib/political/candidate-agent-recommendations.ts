import { resolvePoliticalPostcardPriceCents } from "./pricing-config";

export interface CandidateCampaignSource {
  label: string;
  url: string;
  sourceType: "campaign" | "election" | "population" | "home_reach";
}

export interface CandidateCampaignProfile {
  candidateName: string;
  office: string;
  state: string;
  partyOrCommittee: string;
  runningMate: string;
  electionDate: string;
  publicCampaignFrame: string;
  complianceMode: string;
  sources: CandidateCampaignSource[];
}

export interface CandidateCampaignRecommendation {
  id: string;
  title: string;
  planType: string;
  summary: string;
  candidateFit: string;
  cities: string[];
  geographyRationale: string;
  drops: number;
  households: number;
  estimatedVoterReach: number;
  pricePerPostcardCents: number;
  totalPieces: number;
  estimatedTotalCents: number;
  costPerVoterCents: number;
  phaseCadence: string[];
  nextAction: string;
  confidenceScore: number;
}

const ESTIMATED_VOTER_REACH_PER_HOUSEHOLD = 1.5;

function buildRecommendation(input: Omit<
  CandidateCampaignRecommendation,
  "pricePerPostcardCents" | "totalPieces" | "estimatedTotalCents" | "costPerVoterCents"
>): CandidateCampaignRecommendation {
  const totalPieces = input.households * input.drops;
  const pricePerPostcardCents = resolvePoliticalPostcardPriceCents("state", totalPieces);
  const estimatedTotalCents = totalPieces * pricePerPostcardCents;
  const costPerVoterCents = Math.round(estimatedTotalCents / Math.max(1, input.estimatedVoterReach));

  return {
    ...input,
    pricePerPostcardCents,
    totalPieces,
    estimatedTotalCents,
    costPerVoterCents,
  };
}

export const AMY_ACTON_CAMPAIGN_PROFILE: CandidateCampaignProfile = {
  candidateName: "Dr. Amy Acton",
  office: "Governor of Ohio",
  state: "Ohio",
  partyOrCommittee: "Democrat",
  runningMate: "David Pepper",
  electionDate: "2026-11-03",
  publicCampaignFrame:
    "Statewide executive campaign with public-service, doctor, affordability, health care, and Ohio-family themes visible on the campaign site.",
  complianceMode:
    "Public aggregate geography, household counts, mail logistics, timing, and cost modeling only. No individual voter scoring, ideology inference, sensitive demographic targeting, or turnout suppression.",
  sources: [
    {
      label: "Dr. Amy Acton for Governor campaign site",
      url: "https://actonforgovernor.com/",
      sourceType: "campaign",
    },
    {
      label: "Ohio Secretary of State candidate qualification release",
      url: "https://www.ohiosos.gov/office/media-center/categories/press-releases/2026-02-19",
      sourceType: "election",
    },
    {
      label: "Ohio Secretary of State 2026 voting schedule",
      url: "https://www.ohiosos.gov/elections/voting-schedule-text-only",
      sourceType: "election",
    },
    {
      label: "U.S. Census Bureau QuickFacts: Ohio households",
      url: "https://www.census.gov/quickfacts/OH",
      sourceType: "population",
    },
    {
      label: "HomeReach political postcard pricing model",
      url: "/political/pricing",
      sourceType: "home_reach",
    },
  ],
};

export const AMY_ACTON_CAMPAIGN_RECOMMENDATIONS: CandidateCampaignRecommendation[] = [
  buildRecommendation({
    id: "statewide-foundation",
    title: "Statewide Name-ID Foundation",
    planType: "Broad statewide coverage",
    summary:
      "A five-drop governor-level mail arc that introduces Acton early, reinforces statewide public-service credibility, and keeps the campaign present through the ballot window.",
    candidateFit:
      "Best fit for a statewide governor race where the candidate needs broad familiarity across Ohio media markets before late-cycle noise increases.",
    cities: [
      "Columbus",
      "Cleveland",
      "Cincinnati",
      "Toledo",
      "Dayton",
      "Akron",
      "Youngstown",
      "Canton",
      "Lorain",
      "Springfield",
    ],
    geographyRationale:
      "Route clusters around Ohio's largest city and metro regions, with surrounding county seats layered in to avoid an overly urban-only plan.",
    drops: 5,
    households: 1_250_000,
    estimatedVoterReach: Math.round(1_250_000 * ESTIMATED_VOTER_REACH_PER_HOUSEHOLD),
    phaseCadence: [
      "May: statewide introduction and public-service biography",
      "Late June: affordability and family-cost priority",
      "Mid August: credibility and Ohio leadership proof",
      "Early October: absentee and early-vote information window",
      "Late October: final election reminder",
    ],
    nextAction: "Open the statewide route planner and split coverage by metro, county seat, and remaining regional household capacity.",
    confidenceScore: 86,
  }),
  buildRecommendation({
    id: "metro-trust",
    title: "Metro Trust and Health-Cost Corridor",
    planType: "Major-city concentration",
    summary:
      "A four-drop plan concentrated in high-density Ohio metros where mail can carry consistent public-service and cost-of-living context at efficient volume.",
    candidateFit:
      "Dr. Acton's public-health background makes this plan strongest when the creative stays biography-forward and connects health care, affordability, and steady leadership.",
    cities: [
      "Columbus",
      "Cleveland",
      "Cincinnati",
      "Akron",
      "Dayton",
      "Toledo",
      "Youngstown",
    ],
    geographyRationale:
      "Uses dense mail routes in the largest Ohio metros first, then expands to adjacent first-ring cities for repeated statewide executive visibility.",
    drops: 4,
    households: 680_000,
    estimatedVoterReach: Math.round(680_000 * ESTIMATED_VOTER_REACH_PER_HOUSEHOLD),
    phaseCadence: [
      "June: doctor and advocate introduction",
      "August: health care and household cost message",
      "Early October: ballot-window reminder",
      "Late October: final visibility drop",
    ],
    nextAction: "Generate city-level route lists for the seven metro clusters and confirm household counts before proposal.",
    confidenceScore: 84,
  }),
  buildRecommendation({
    id: "suburban-visibility",
    title: "Suburban Statewide Visibility Ring",
    planType: "Metro-suburban route layer",
    summary:
      "A four-drop suburban and exurban visibility plan that gives the campaign repeated presence around fast-growing Ohio route clusters.",
    candidateFit:
      "Useful for a governor race because statewide campaigns need more than core-city repetition; this plan adds surrounding route coverage without voter-level scoring.",
    cities: [
      "Delaware",
      "Westerville",
      "Dublin",
      "Mason",
      "Loveland",
      "Lakewood",
      "Parma",
      "Strongsville",
      "Beavercreek",
      "Perrysburg",
    ],
    geographyRationale:
      "Focuses on public geography around major metros, growing county corridors, and practical delivery density rather than inferred political traits.",
    drops: 4,
    households: 420_000,
    estimatedVoterReach: Math.round(420_000 * ESTIMATED_VOTER_REACH_PER_HOUSEHOLD),
    phaseCadence: [
      "June: statewide biography",
      "August: practical Ohio priorities",
      "Late September: leadership and credibility reminder",
      "Late October: election reminder",
    ],
    nextAction: "Compare this plan against the metro plan inside pricing to decide whether suburbs are additive or replacement budget.",
    confidenceScore: 79,
  }),
  buildRecommendation({
    id: "ballot-window",
    title: "Ballot-Window Acceleration",
    planType: "Final 30-day mail push",
    summary:
      "A three-drop plan aligned to Ohio's absentee, early in-person, and final election reminder windows for campaigns that need a shorter, focused mail run.",
    candidateFit:
      "Strong as a late-cycle supplement for a statewide race once the candidate profile is already established through earned media, field, or digital.",
    cities: [
      "Columbus",
      "Cleveland",
      "Cincinnati",
      "Toledo",
      "Dayton",
      "Akron",
      "Athens",
      "Kent",
      "Bowling Green",
      "Oxford",
    ],
    geographyRationale:
      "Prioritizes high-density city and campus-region routes for timing efficiency, ballot-window repetition, and production feasibility.",
    drops: 3,
    households: 530_000,
    estimatedVoterReach: Math.round(530_000 * ESTIMATED_VOTER_REACH_PER_HOUSEHOLD),
    phaseCadence: [
      "October 6 week: absentee and early-vote information",
      "October 19 week: credibility and election date reminder",
      "October 27 week: final in-home reminder before Election Day",
    ],
    nextAction: "Lock creative approvals before the October absentee window and reserve print capacity for all three waves.",
    confidenceScore: 82,
  }),
];

export function summarizeAmyActonRecommendations() {
  const households = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.reduce((sum, plan) => sum + plan.households, 0);
  const estimatedVoterReach = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.reduce(
    (sum, plan) => sum + plan.estimatedVoterReach,
    0,
  );
  const investmentCents = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.reduce(
    (sum, plan) => sum + plan.estimatedTotalCents,
    0,
  );

  return {
    plans: AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.length,
    households,
    estimatedVoterReach,
    investmentCents,
  };
}
