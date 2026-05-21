import "server-only";

import {
  MULTI_CANDIDATE_CAMPAIGN_AGENTS,
  type CandidateCampaignAgent,
  type CandidateCampaignStrategy,
  type PostcardConcept,
} from "@/lib/political/candidate-agent-recommendations";
import { loadCandidates, type CandidateRow } from "@/lib/political/queries";

export type OutreachPriorityTier = "tier-1" | "tier-2" | "tier-3" | "tier-4";
export type OutreachDraftKey =
  | "shortFacebookDm"
  | "longFacebookDm"
  | "initialEmail"
  | "followUpEmail"
  | "linkedInMessage"
  | "websiteForm"
  | "phoneTalkingPoints"
  | "voicemail"
  | "sms";

export interface OutreachDraft {
  key: OutreachDraftKey;
  label: string;
  channel: string;
  subject?: string;
  shortVersion: string;
  longVersion: string;
  body: string;
}

export interface OutreachCadenceStep {
  day: string;
  method: string;
  timing: string;
  tone: string;
  attachments: string[];
  cta: string;
  status: "pending" | "due_today" | "completed" | "skipped" | "waiting_on_response";
}

export interface OutreachTimelineItem {
  label: string;
  date: string;
  detail: string;
  status: "draft" | "ready" | "sent" | "response" | "proposal" | "won" | "lost";
}

export interface CampaignOptionPackage {
  id: string;
  optionName: string;
  voterReach: string;
  householdReach: string;
  postcardVolume: string;
  drops: number;
  countiesCovered: string[];
  citiesCovered: string[];
  districtsCovered: string[];
  estimatedCost: string;
  rolloutTiming: string;
  deploymentSchedule: string;
  strategicRationale: string;
  expectedImpact: string;
}

export interface PostcardMockup {
  id: string;
  type: string;
  title: string;
  emotionalStrategy: string;
  targetAudience: string;
  targetGeography: string;
  deploymentTiming: string;
  campaignPhase: string;
  frontHeadline: string;
  frontSubheadline: string;
  backBody: string;
  cta: string;
  palette: "blue" | "red" | "neutral";
  canvaStatus: string;
  figmaStatus: string;
}

export interface CoverageMapPackage {
  title: string;
  counties: string[];
  cities: string[];
  districts: string[];
  routes: string[];
  legend: Array<{ label: string; value: string }>;
}

export interface CampaignOutreachTarget {
  id: string;
  name: string;
  race: string;
  party: string;
  geography: string;
  campaignStatus: string;
  raceType: string;
  priorityTier: OutreachPriorityTier;
  opportunityScore: number;
  estimatedOpportunityValue: string;
  recommendedOutreachMethod: string;
  assignedCampaignOption: string;
  assignedCreativePackage: string;
  outreachStatus: string;
  followUpStatus: string;
  lastContacted: string;
  nextFollowUp: string;
  assignedAgent: string;
  notes: string;
  contact: {
    decisionMaker: string;
    email: string | null;
    phone: string | null;
    website: string | null;
    facebook: string | null;
    instagram: string | null;
    xTwitter: string | null;
    linkedIn: string | null;
  };
  strategy: {
    whyItMatters: string;
    likelyPainPoints: string[];
    geographicStrategy: string;
    campaignStyle: string;
    idealHomeReachPositioning: string;
    bestDecisionMaker: string;
    idealTiming: string;
    suggestedCta: string;
    proposalRecommendation: string;
    recommendedVisualPackage: string;
    recommendedPostcardConcepts: string[];
    followUpCadence: string;
    bestFollowUpMethod: string;
  };
  drafts: OutreachDraft[];
  cadence: OutreachCadenceStep[];
  timeline: OutreachTimelineItem[];
  recommendations: string[];
  responseIntelligence: {
    summary: string;
    nextAction: string;
    suggestedReply: string;
    proposalRecommendation: string;
  };
  optionPackages: CampaignOptionPackage[];
  mockups: PostcardMockup[];
  mapPackage: CoverageMapPackage;
}

export interface PoliticalOutreachCommandData {
  refreshedAt: string;
  metrics: Array<{ label: string; value: string; detail: string }>;
  targets: CampaignOutreachTarget[];
  complianceGuardrails: string[];
  smartRecommendations: string[];
}

const tierLabels: Record<OutreachPriorityTier, string> = {
  "tier-1": "Tier 1 - Immediate Outreach",
  "tier-2": "Tier 2 - High Value",
  "tier-3": "Tier 3 - Relationship Building",
  "tier-4": "Tier 4 - Monitor",
};

const extraTargets = [
  {
    id: "summit-county-party-network",
    name: "Summit County Party Mail Program",
    race: "County party coordinated campaign",
    party: "County party",
    geography: "Summit County",
    raceType: "county parties",
    score: 86,
    valueCents: 6800000,
    method: "Email with Ohio map",
    counties: ["Summit"],
    cities: ["Akron", "Stow", "Cuyahoga Falls", "Barberton"],
    districts: ["Countywide"],
    routes: ["County-seat saturation routes", "Suburban municipal routes"],
    style: "Countywide slate and turnout logistics",
  },
  {
    id: "franklin-school-levy",
    name: "Franklin County Education Levy",
    race: "Levy/issue campaign",
    party: "Nonpartisan issue",
    geography: "Franklin County",
    raceType: "levy/issue campaigns",
    score: 82,
    valueCents: 5400000,
    method: "Website contact form",
    counties: ["Franklin"],
    cities: ["Columbus", "Worthington", "Hilliard", "Bexley"],
    districts: ["School district footprint"],
    routes: ["School household routes", "Community explainer routes"],
    style: "Plain-language issue education",
  },
  {
    id: "cuyahoga-judicial-slate",
    name: "Cuyahoga Judicial Slate",
    race: "Judicial races",
    party: "Judicial/nonpartisan",
    geography: "Cuyahoga County",
    raceType: "judicial races",
    score: 78,
    valueCents: 4900000,
    method: "Consultant outreach",
    counties: ["Cuyahoga"],
    cities: ["Cleveland", "Lakewood", "Parma", "Shaker Heights"],
    districts: ["Countywide judicial ballot"],
    routes: ["High-trust explainer routes", "Courthouse/civic routes"],
    style: "Credential, trust, and ballot-position clarity",
  },
  {
    id: "ohio-consultant-network",
    name: "Ohio Political Consultant Network",
    race: "Consultant outreach",
    party: "Multi-campaign",
    geography: "Ohio statewide",
    raceType: "political consultants",
    score: 74,
    valueCents: 12000000,
    method: "LinkedIn message",
    counties: ["Franklin", "Cuyahoga", "Hamilton", "Summit"],
    cities: ["Columbus", "Cleveland", "Cincinnati", "Akron"],
    districts: ["Statewide consulting pipeline"],
    routes: ["Proposal-ready route bundles", "Rapid mockup review routes"],
    style: "Agency-ready proof and production reliability",
  },
] as const;

export async function loadPoliticalOutreachCommand(): Promise<PoliticalOutreachCommandData> {
  const liveCandidates = await loadLiveCandidates();
  const profileTargets = MULTI_CANDIDATE_CAMPAIGN_AGENTS.map((agent, index) =>
    buildTargetFromAgent(agent, liveCandidates[index]),
  );
  const syntheticTargets = extraTargets.map(buildExtraTarget);
  const liveOnlyTargets = liveCandidates
    .filter((candidate) => !profileTargets.some((target) => sameName(target.name, candidate.candidateName)))
    .slice(0, 10)
    .map((candidate, index) => buildTargetFromCandidate(candidate, index));

  const targets = [...profileTargets, ...liveOnlyTargets, ...syntheticTargets]
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 22);

  const readyToday = targets.filter((target) => target.priorityTier === "tier-1").length;
  const followUpsDue = targets.filter((target) => target.followUpStatus === "Due Today").length;
  const estimatedPipelineCents = targets.reduce(
    (sum, target) => sum + parseMoney(target.estimatedOpportunityValue),
    0,
  );

  return {
    refreshedAt: new Date().toISOString(),
    metrics: [
      { label: "Total Targets", value: String(targets.length), detail: "campaigns, parties, consultants, and issue committees" },
      { label: "Ready Today", value: String(readyToday), detail: "Tier 1 outreach cards with drafts ready" },
      { label: "Follow-Ups Due", value: String(followUpsDue), detail: "scheduled next actions in the cadence engine" },
      { label: "Pipeline Value", value: formatCurrency(estimatedPipelineCents), detail: "estimated operational postcard opportunity" },
      { label: "Mockups Ready", value: String(targets.reduce((sum, target) => sum + target.mockups.length, 0)), detail: "front/back concepts with export actions" },
      { label: "Proposal Packages", value: String(targets.reduce((sum, target) => sum + target.optionPackages.length, 0)), detail: "mail plan options with maps and rollout timing" },
    ],
    targets,
    complianceGuardrails: [
      "Uses campaign, geography, route, and logistics data only.",
      "Does not infer individual political beliefs or create voter ideology scores.",
      "Outreach execution defaults to copy, mailto, sms, tel, and external platform links unless provider send is explicitly approved.",
      "Creative mockups are proposal drafts and require campaign approval before production.",
    ],
    smartRecommendations: [
      "Contact Tier 1 statewide and county party targets first with email plus Ohio map and one postcard concept.",
      "Escalate campaigns with no response after Day 5 from social DM to email plus phone call.",
      "Attach proposal visuals to campaigns with opportunity value above $50K before asking for a meeting.",
      "Prioritize consultant-network outreach when mockups and coverage maps are polished enough for reuse across multiple races.",
    ],
  };
}

async function loadLiveCandidates() {
  try {
    return await loadCandidates({ state: "OH" }, 50);
  } catch {
    return [];
  }
}

function buildTargetFromAgent(agent: CandidateCampaignAgent, candidate?: CandidateRow): CampaignOutreachTarget {
  const profile = agent.profile;
  const strategy = agent.strategies[0]!;
  const option = strategyToOption(profile.candidateName, strategy, profile.topCounties, profile.topCities, [profile.office]);
  const score = candidate?.priorityScore ?? Math.min(98, Math.max(68, strategy.confidenceScore + 8));
  const tier = tierForScore(score);
  const preferredMethod = candidate?.campaignEmail ? "Email" : profile.sources[0]?.url ? "Website contact form" : "LinkedIn";
  const website = candidate?.campaignWebsite ?? profile.sources.find((source) => source.sourceType === "campaign")?.url ?? null;
  const facebook = candidate?.facebookUrl ?? null;
  const decisionMaker = candidate?.campaignManagerName ?? resolveDecisionMaker(profile.office);
  const email = candidate?.campaignManagerEmail ?? candidate?.campaignEmail ?? null;
  const phone = candidate?.campaignPhone ?? null;
  const geography = `${profile.state} / ${profile.topCounties.slice(0, 4).join(", ")}`;

  return buildTarget({
    id: `agent-${profile.id}`,
    name: profile.candidateName,
    race: profile.office,
    party: profile.partyOrCommittee,
    geography,
    campaignStatus: candidate?.candidateStatus ?? "active",
    raceType: raceTypeForOffice(profile.office),
    score,
    estimatedValueCents: option.estimatedCost,
    recommendedMethod: preferredMethod,
    optionName: option.optionName,
    creativePackage: `${profile.shortName} premium political postcard suite`,
    lastContacted: formatDate(candidate?.lastContactedAt),
    nextFollowUp: formatDate(candidate?.nextFollowUpAt) || "Today",
    followUpStatus: candidate?.nextFollowUpAt ? "Pending" : tier === "tier-1" ? "Due Today" : "Pending",
    assignedAgent: `${profile.shortName} Campaign Agent`,
    notes: candidate?.notes ?? profile.riskOrResearchGaps[0] ?? "Verify official contact before sending.",
    decisionMaker,
    email,
    phone,
    website,
    facebook,
    instagram: null,
    xTwitter: null,
    linkedIn: null,
    whyItMatters: `${profile.candidateName} is a ${profile.office} opportunity where repeated household mail can convert campaign strategy into visible deployment across ${profile.mediaMarkets.slice(0, 3).join(", ")}.`,
    painPoints: [
      "Need visible execution, not just strategy decks.",
      "Pressure to show credible county and route coverage.",
      "Creative needs to look campaign-grade before a consultant will forward it.",
    ],
    geographicStrategy: strategy.rolloutStrategy,
    campaignStyle: profile.creativeTone,
    positioning: `Position HomeReach as the operational mail execution layer: map, mockup, proposal, print path, and follow-up cadence in one package.`,
    idealTiming: "Start with a concise proof email, then move to a map/mockup follow-up inside 48 hours.",
    suggestedCta: "Offer a 15-minute walkthrough of the coverage map and first postcard concept.",
    proposalRecommendation: `${option.optionName} with ${option.drops} drops and phased county coverage.`,
    visualPackage: "Ohio coverage map, two postcard concepts, campaign option summary, rollout timeline.",
    postcardConcepts: strategy.phases.flatMap((phase) => phase.postcardConcepts).slice(0, 4).map((concept) => concept.title),
    bestFollowUpMethod: "Email with Ohio map and postcard concept #2.",
    optionPackages: [
      option,
      strategyToOption(`${profile.shortName} accelerator`, agent.strategies[1] ?? strategy, profile.topCounties.slice(0, 5), profile.topCities.slice(0, 5), [profile.office]),
    ],
    mockups: strategy.phases.flatMap((phase) => phase.postcardConcepts).slice(0, 5).map((concept) => conceptToMockup(concept, profile.partyOrCommittee)),
    mapPackage: buildMapPackage(profile.candidateName, profile.topCounties, profile.topCities, [profile.office], profile.routeClusters),
  });
}

function buildExtraTarget(seed: (typeof extraTargets)[number]): CampaignOutreachTarget {
  return buildTarget({
    id: seed.id,
    name: seed.name,
    race: seed.race,
    party: seed.party,
    geography: seed.geography,
    campaignStatus: "active",
    raceType: seed.raceType,
    score: seed.score,
    estimatedValueCents: seed.valueCents,
    recommendedMethod: seed.method,
    optionName: `${seed.geography} persuasion and turnout package`,
    creativePackage: `${seed.race} premium postcard set`,
    lastContacted: "No contact logged",
    nextFollowUp: "Today",
    followUpStatus: seed.score >= 82 ? "Due Today" : "Pending",
    assignedAgent: `${seed.name} AI Campaign Agent`,
    notes: "Requires verified contact owner and approval-safe message source before send.",
    decisionMaker: "Campaign manager or consultant",
    email: null,
    phone: null,
    website: null,
    facebook: null,
    instagram: null,
    xTwitter: null,
    linkedIn: null,
    whyItMatters: `${seed.name} can turn route coverage and polished mockups into a proposal-ready conversation without relying on individual voter profiling.`,
    painPoints: ["Needs fast creative proof.", "Needs clear county coverage.", "Needs easy forwarding to the decision maker."],
    geographicStrategy: `Lead with ${seed.counties.join(", ")} and show route coverage through ${seed.routes.join(", ")}.`,
    campaignStyle: seed.style,
    positioning: "HomeReach provides the execution layer: coverage map, mail plan, postcard mockups, quote path, and follow-up discipline.",
    idealTiming: "Outreach now, proposal-ready follow-up inside two business days.",
    suggestedCta: "Ask for permission to prepare a county-specific mockup and rollout option.",
    proposalRecommendation: `${seed.geography} option package with phased drops and print-ready mockups.`,
    visualPackage: "County map, route legend, two postcard concepts, rollout timeline.",
    postcardConcepts: ["Introduction postcard", "Issue explainer postcard", "Turnout postcard"],
    bestFollowUpMethod: "Email instead of social DM. Attach Ohio map and postcard concept #2.",
    optionPackages: [
      {
        id: `${seed.id}-option`,
        optionName: `${seed.geography} launch package`,
        voterReach: formatNumber(Math.round(seed.valueCents / 210)),
        householdReach: formatNumber(Math.round(seed.valueCents / 315)),
        postcardVolume: formatNumber(Math.round(seed.valueCents / 120)),
        drops: 3,
        countiesCovered: [...seed.counties],
        citiesCovered: [...seed.cities],
        districtsCovered: [...seed.districts],
        estimatedCost: formatCurrency(seed.valueCents),
        rolloutTiming: "Two-week creative approval, then three staged drops.",
        deploymentSchedule: "Day 0 proposal, Day 7 proof approval, Day 14 print lock, Day 21 in-home window.",
        strategicRationale: seed.style,
        expectedImpact: "Creates a tangible proposal package the campaign can forward internally.",
      },
    ],
    mockups: buildGenericMockups(seed.id, seed.name, seed.party, seed.geography),
    mapPackage: buildMapPackage(seed.name, [...seed.counties], [...seed.cities], [...seed.districts], [...seed.routes]),
  });
}

function buildTargetFromCandidate(candidate: CandidateRow, index: number): CampaignOutreachTarget {
  const score = candidate.priorityScore ?? Math.max(62, 88 - index * 3);
  const geography = [candidate.state, candidate.geographyType, candidate.geographyValue].filter(Boolean).join(" / ");
  return buildTarget({
    id: `live-${candidate.id}`,
    name: candidate.candidateName,
    race: candidate.officeSought ?? "Campaign",
    party: candidate.partyOptionalPublic ?? "Public committee",
    geography: geography || candidate.state,
    campaignStatus: candidate.candidateStatus,
    raceType: raceTypeForOffice(candidate.officeSought ?? ""),
    score,
    estimatedValueCents: Math.max(2500000, score * 80000),
    recommendedMethod: candidate.campaignEmail ? "Email" : candidate.facebookUrl ? "Facebook DM" : "Website contact form",
    optionName: "Targeted county route package",
    creativePackage: "Campaign intro plus turnout postcard set",
    lastContacted: formatDate(candidate.lastContactedAt),
    nextFollowUp: formatDate(candidate.nextFollowUpAt) || "Today",
    followUpStatus: candidate.nextFollowUpAt ? "Pending" : "Due Today",
    assignedAgent: `${candidate.candidateName} Campaign Agent`,
    notes: candidate.notes ?? "Live candidate record imported from political candidate database.",
    decisionMaker: candidate.campaignManagerName ?? "Campaign manager",
    email: candidate.campaignManagerEmail ?? candidate.campaignEmail,
    phone: candidate.campaignPhone,
    website: candidate.campaignWebsite,
    facebook: candidate.facebookUrl ?? candidate.messengerUrl,
    instagram: null,
    xTwitter: null,
    linkedIn: null,
    whyItMatters: `${candidate.candidateName} is a live database target with an existing political record and a visible outreach path.`,
    painPoints: ["Needs fast local proof.", "May not have a print execution partner.", "Needs clear pricing and timing."],
    geographicStrategy: `Build a proposal around ${candidate.geographyValue ?? candidate.state} and nearby Ohio route clusters.`,
    campaignStyle: "Professional, practical, and locally grounded.",
    positioning: "HomeReach can package map, mockup, price, delivery window, and follow-up into one campaign-ready asset.",
    idealTiming: "Use a short first touch, then follow with a map and mockup.",
    suggestedCta: "Ask for 15 minutes to review the route map and postcard concept.",
    proposalRecommendation: "Targeted county route package with two creative variations.",
    visualPackage: "Local map, route legend, intro postcard, turnout postcard.",
    postcardConcepts: ["Introduction postcard", "Local proof postcard", "Turnout reminder postcard"],
    bestFollowUpMethod: "Email with route map and intro mockup.",
    optionPackages: [
      {
        id: `candidate-${candidate.id}-option`,
        optionName: "Targeted county route package",
        voterReach: "18,000",
        householdReach: "12,000",
        postcardVolume: "36,000",
        drops: 3,
        countiesCovered: [candidate.geographyValue ?? candidate.state],
        citiesCovered: [candidate.geographyValue ?? "Primary city pending"],
        districtsCovered: [candidate.officeSought ?? "District pending"],
        estimatedCost: formatCurrency(Math.max(2500000, score * 80000)),
        rolloutTiming: "Three drops after creative approval.",
        deploymentSchedule: "Day 0 outreach, Day 2 proposal, Day 7 proof approval, Day 14 print lock.",
        strategicRationale: "Focused enough to be credible, broad enough to demonstrate operational value.",
        expectedImpact: "Moves the conversation from interest to proposal review.",
      },
    ],
    mockups: buildGenericMockups(candidate.id, candidate.candidateName, candidate.partyOptionalPublic ?? "Neutral", candidate.geographyValue ?? candidate.state),
    mapPackage: buildMapPackage(candidate.candidateName, [candidate.geographyValue ?? candidate.state], [candidate.geographyValue ?? "Primary city pending"], [candidate.officeSought ?? "District pending"], ["Primary route cluster pending"]),
  });
}

function buildTarget(input: {
  id: string;
  name: string;
  race: string;
  party: string;
  geography: string;
  campaignStatus: string;
  raceType: string;
  score: number;
  estimatedValueCents: number | string;
  recommendedMethod: string;
  optionName: string;
  creativePackage: string;
  lastContacted: string;
  nextFollowUp: string;
  followUpStatus: string;
  assignedAgent: string;
  notes: string;
  decisionMaker: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  xTwitter: string | null;
  linkedIn: string | null;
  whyItMatters: string;
  painPoints: string[];
  geographicStrategy: string;
  campaignStyle: string;
  positioning: string;
  idealTiming: string;
  suggestedCta: string;
  proposalRecommendation: string;
  visualPackage: string;
  postcardConcepts: string[];
  bestFollowUpMethod: string;
  optionPackages: CampaignOptionPackage[];
  mockups: PostcardMockup[];
  mapPackage: CoverageMapPackage;
}): CampaignOutreachTarget {
  const tier = tierForScore(input.score);
  const estimatedValue =
    typeof input.estimatedValueCents === "string"
      ? input.estimatedValueCents
      : formatCurrency(input.estimatedValueCents);

  return {
    id: input.id,
    name: input.name,
    race: input.race,
    party: input.party,
    geography: input.geography,
    campaignStatus: input.campaignStatus,
    raceType: input.raceType,
    priorityTier: tier,
    opportunityScore: input.score,
    estimatedOpportunityValue: estimatedValue,
    recommendedOutreachMethod: input.recommendedMethod,
    assignedCampaignOption: input.optionName,
    assignedCreativePackage: input.creativePackage,
    outreachStatus: tier === "tier-1" ? "Ready" : "Draft",
    followUpStatus: input.followUpStatus,
    lastContacted: input.lastContacted || "No contact logged",
    nextFollowUp: input.nextFollowUp || "Not scheduled",
    assignedAgent: input.assignedAgent,
    notes: input.notes,
    contact: {
      decisionMaker: input.decisionMaker,
      email: input.email,
      phone: input.phone,
      website: input.website,
      facebook: input.facebook,
      instagram: input.instagram,
      xTwitter: input.xTwitter,
      linkedIn: input.linkedIn,
    },
    strategy: {
      whyItMatters: input.whyItMatters,
      likelyPainPoints: input.painPoints,
      geographicStrategy: input.geographicStrategy,
      campaignStyle: input.campaignStyle,
      idealHomeReachPositioning: input.positioning,
      bestDecisionMaker: input.decisionMaker,
      idealTiming: input.idealTiming,
      suggestedCta: input.suggestedCta,
      proposalRecommendation: input.proposalRecommendation,
      recommendedVisualPackage: input.visualPackage,
      recommendedPostcardConcepts: input.postcardConcepts,
      followUpCadence: "Day 0 DM or email, Day 2 email with map, Day 5 phone, Day 7 proposal package, Day 10 LinkedIn, Day 14 final concise follow-up.",
      bestFollowUpMethod: input.bestFollowUpMethod,
    },
    drafts: buildDrafts(input.name, input.race, input.geography, input.optionName, input.visualPackage, input.suggestedCta),
    cadence: buildCadence(input.bestFollowUpMethod),
    timeline: buildTimeline(input.optionName, input.visualPackage),
    recommendations: [
      `Use ${input.recommendedMethod} first, then escalate to ${input.bestFollowUpMethod.toLowerCase()}.`,
      `Attach ${input.visualPackage.toLowerCase()} before asking for a meeting.`,
      `Lead with ${input.optionName} and keep the CTA to one 15-minute walkthrough.`,
    ],
    responseIntelligence: {
      summary: "No response logged yet. Once a response lands, summarize interest level, objection, requested next step, and any proposal needs.",
      nextAction: input.bestFollowUpMethod,
      suggestedReply: `Thanks for taking a look. I can send a concise ${input.geography} coverage option with a campaign-ready postcard mockup and rollout timing for review.`,
      proposalRecommendation: input.proposalRecommendation,
    },
    optionPackages: input.optionPackages,
    mockups: input.mockups,
    mapPackage: input.mapPackage,
  };
}

function buildDrafts(
  name: string,
  race: string,
  geography: string,
  optionName: string,
  visualPackage: string,
  cta: string,
): OutreachDraft[] {
  const core =
    `I put together a HomeReach political mail concept for ${name} that shows ${geography} coverage, deployment timing, and a proposal-ready postcard direction.`;
  const execution =
    `HomeReach handles operational execution: route planning, print-ready creative, deployment visibility, follow-up tracking, and proposal packaging.`;

  return [
    {
      key: "shortFacebookDm",
      label: "Short Facebook DM",
      channel: "Facebook DM",
      shortVersion: `${core} Worth a 15-minute look?`,
      longVersion: `${core} ${execution} I can send the ${optionName} and ${visualPackage}. ${cta}`,
      body: `${core} ${execution} Worth a quick review this week?`,
    },
    {
      key: "longFacebookDm",
      label: "Long Facebook DM",
      channel: "Facebook DM",
      shortVersion: `${core} I can send map plus mockups.`,
      longVersion: `${core}\n\n${execution}\n\nI would start with ${optionName}, attach the Ohio map, and include one postcard concept so your team can see the execution quality immediately.\n\n${cta}`,
      body: `${core}\n\n${execution}\n\nI would start with ${optionName}, attach the Ohio map, and include one postcard concept so your team can see the execution quality immediately.\n\n${cta}`,
    },
    {
      key: "initialEmail",
      label: "Initial Email",
      channel: "Email",
      subject: `${name}: route map and postcard option`,
      shortVersion: `${core} Can I send the map and mockup?`,
      longVersion: `${core}\n\n${execution}\n\nI recommend ${optionName}. It includes the coverage map, postcard mockups, rollout schedule, and a clean next-step proposal.\n\n${cta}`,
      body: `Hi,\n\n${core}\n\n${execution}\n\nI recommend ${optionName}. It includes the coverage map, postcard mockups, rollout schedule, and a clean next-step proposal.\n\n${cta}\n\nBest,\nHomeReach`,
    },
    {
      key: "followUpEmail",
      label: "Follow-Up Email",
      channel: "Email",
      subject: `Follow-up: ${race} mail option`,
      shortVersion: `Following up with the ${optionName} and map/mockup package.`,
      longVersion: `Following up because ${name} looks like a strong fit for a concise political mail package: map, route logic, creative proof, and deployment timing.\n\nThe fastest next step is reviewing the ${visualPackage}.`,
      body: `Hi,\n\nFollowing up because ${name} looks like a strong fit for a concise political mail package: map, route logic, creative proof, and deployment timing.\n\nThe fastest next step is reviewing the ${visualPackage} and deciding whether the ${optionName} deserves a short walkthrough.\n\nBest,\nHomeReach`,
    },
    {
      key: "linkedInMessage",
      label: "LinkedIn Message",
      channel: "LinkedIn",
      shortVersion: `${name} looks like a fit for a map-backed political mail proposal. Can I send the package?`,
      longVersion: `${core} ${execution} The package is built for forwarding: option summary, Ohio map, postcard mockup, and rollout timing.`,
      body: `${name} looks like a fit for a map-backed political mail proposal. I can send a concise package with an Ohio coverage map, postcard mockup, and rollout timing. Worth a quick look?`,
    },
    {
      key: "websiteForm",
      label: "Website Form",
      channel: "Website form",
      shortVersion: `${core} Please route to the campaign manager or mail consultant.`,
      longVersion: `${core}\n\n${execution}\n\nPlease route this to the campaign manager, consultant, or person handling voter contact/mail strategy.`,
      body: `${core}\n\n${execution}\n\nPlease route this to the campaign manager, consultant, or person handling voter contact/mail strategy. I can provide the map, mockups, and rollout option for review.`,
    },
    {
      key: "phoneTalkingPoints",
      label: "Phone Talking Points",
      channel: "Phone",
      shortVersion: `Lead with map, mockup, rollout timing, and a 15-minute walkthrough.`,
      longVersion: `1. Mention the ${geography} coverage map.\n2. Explain HomeReach handles route planning, print-ready creative, deployment visibility, and follow-up.\n3. Offer to send ${optionName} plus postcard mockups.\n4. Ask for a 15-minute review.`,
      body: `Lead with the ${geography} coverage map. Explain that HomeReach packages route planning, print-ready creative, deployment visibility, and follow-up. Offer ${optionName} plus postcard mockups. Ask for 15 minutes.`,
    },
    {
      key: "voicemail",
      label: "Voicemail Script",
      channel: "Voicemail",
      shortVersion: `I have a concise map and postcard package for ${name}.`,
      longVersion: `Hi, this is HomeReach. I have a concise political mail package for ${name}: a ${geography} coverage map, postcard mockup, rollout timing, and a clean proposal option. I will send the summary by email as well.`,
      body: `Hi, this is HomeReach. I have a concise political mail package for ${name}: a ${geography} coverage map, postcard mockup, rollout timing, and a clean proposal option. I will send the summary by email as well.`,
    },
    {
      key: "sms",
      label: "SMS Outreach",
      channel: "SMS",
      shortVersion: `${name}: I can send map + postcard mockup for review.`,
      longVersion: `${name}: I put together a HomeReach political mail option with coverage map, rollout timing, and a postcard mockup. Can I send it over?`,
      body: `${name}: I put together a HomeReach political mail option with coverage map, rollout timing, and a postcard mockup. Can I send it over?`,
    },
  ];
}

function buildCadence(recommendedNextAction: string): OutreachCadenceStep[] {
  return [
    { day: "Day 0", method: "Facebook DM", timing: "Late morning", tone: "Concise and curious", attachments: ["None"], cta: "Ask permission to send package", status: "pending" },
    { day: "Day 2", method: "Email", timing: "8:30 AM", tone: "Proof-oriented", attachments: ["Ohio map", "postcard concept #1"], cta: "Book 15-minute walkthrough", status: "due_today" },
    { day: "Day 5", method: "Phone call", timing: "3:30 PM", tone: "Direct and helpful", attachments: ["Call talking points"], cta: "Confirm decision maker", status: "pending" },
    { day: "Day 7", method: "Campaign option package", timing: "10:00 AM", tone: "Proposal-ready", attachments: ["Option summary", "mockups", "rollout timeline"], cta: "Review package", status: "pending" },
    { day: "Day 10", method: "LinkedIn follow-up", timing: "Noon", tone: "Professional", attachments: ["Short package note"], cta: "Forward to consultant", status: "pending" },
    { day: "Day 14", method: recommendedNextAction, timing: "9:15 AM", tone: "Final concise follow-up", attachments: ["Map", "best mockup"], cta: "Close loop or schedule", status: "pending" },
  ];
}

function buildTimeline(optionName: string, visualPackage: string): OutreachTimelineItem[] {
  return [
    { label: "Target selected", date: "Ready", detail: "Campaign target scored and assigned to outreach queue.", status: "ready" },
    { label: "Draft package prepared", date: "Ready", detail: `${optionName} and ${visualPackage} are attached to the outreach card.`, status: "draft" },
    { label: "First touch", date: "Pending", detail: "Copy, email, text, call, and platform links are ready.", status: "ready" },
    { label: "Proposal delivery", date: "Scheduled", detail: "Map, mockups, option package, and timeline move into proposal handoff.", status: "proposal" },
    { label: "Response intelligence", date: "Awaiting response", detail: "Logged response will generate next action, reply draft, and recommended package.", status: "response" },
  ];
}

function strategyToOption(
  name: string,
  strategy: CandidateCampaignStrategy | undefined,
  counties: string[],
  cities: string[],
  districts: string[],
): CampaignOptionPackage {
  const fallbackCost = 5200000;
  return {
    id: strategy?.id ?? `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-option`,
    optionName: strategy?.title ?? `${name} county launch option`,
    voterReach: formatNumber(strategy?.estimatedReach ?? 85000),
    householdReach: formatNumber(strategy?.households ?? 56000),
    postcardVolume: formatNumber(strategy?.totalPieces ?? 168000),
    drops: strategy?.drops ?? 3,
    countiesCovered: counties.slice(0, 6),
    citiesCovered: cities.slice(0, 6),
    districtsCovered: districts.slice(0, 3),
    estimatedCost: formatCurrency(strategy?.estimatedTotalCents ?? fallbackCost),
    rolloutTiming: strategy?.timingCadence ?? "Three drops across introduction, proof, and turnout windows.",
    deploymentSchedule: strategy?.phaseSequencing ?? "Intro -> issue proof -> persuasion -> turnout.",
    strategicRationale: strategy?.strategyOverview ?? "A focused mail option that gives the campaign a tangible map, mockup, and rollout path.",
    expectedImpact: strategy?.expectedOutcome ?? "Create a proposal-ready conversation anchored in operational execution.",
  };
}

function conceptToMockup(concept: PostcardConcept, party: string): PostcardMockup {
  return {
    id: concept.id,
    type: concept.category,
    title: concept.title,
    emotionalStrategy: concept.emotionalStrategy,
    targetAudience: concept.audienceFit,
    targetGeography: concept.geographicFit,
    deploymentTiming: concept.phaseKey.replaceAll("-", " "),
    campaignPhase: concept.phaseKey,
    frontHeadline: concept.headline,
    frontSubheadline: concept.subheadline,
    backBody: concept.backBody,
    cta: concept.cta,
    palette: paletteForParty(party),
    canvaStatus: "Layered export ready for Canva template mapping",
    figmaStatus: "Component spec ready for Figma handoff",
  };
}

function buildGenericMockups(id: string, name: string, party: string, geography: string): PostcardMockup[] {
  return [
    {
      id: `${id}-bio`,
      type: "Biography postcard",
      title: `${name} introduction mailer`,
      emotionalStrategy: "Make the campaign feel local, credible, and easy to understand.",
      targetAudience: "Aggregate households in selected route geography.",
      targetGeography: geography,
      deploymentTiming: "Opening wave",
      campaignPhase: "introduction",
      frontHeadline: `${name}: a campaign Ohio households can see`,
      frontSubheadline: "Local coverage, professional mail, and clear timing.",
      backBody: "Use campaign-approved biography, proof points, and a clear QR path to the official campaign site.",
      cta: "Scan to review the campaign plan.",
      palette: paletteForParty(party),
      canvaStatus: "Canva layer plan ready",
      figmaStatus: "Figma component plan ready",
    },
    {
      id: `${id}-turnout`,
      type: "Turnout postcard",
      title: `${name} ballot-window reminder`,
      emotionalStrategy: "Make the next civic action simple and deadline-aware.",
      targetAudience: "Aggregate geography only.",
      targetGeography: geography,
      deploymentTiming: "Final ballot window",
      campaignPhase: "turnout",
      frontHeadline: "The deadline is closer than it feels",
      frontSubheadline: "A clean election reminder with campaign-approved dates.",
      backBody: "Reserve space for official voting dates, QR code, return address, indicia, and disclaimer.",
      cta: "Make your voting plan.",
      palette: paletteForParty(party),
      canvaStatus: "Canva resize-ready",
      figmaStatus: "Figma approval-ready",
    },
  ];
}

function buildMapPackage(
  title: string,
  counties: string[],
  cities: string[],
  districts: string[],
  routes: string[],
): CoverageMapPackage {
  return {
    title: `${title} Ohio coverage map`,
    counties: counties.slice(0, 8),
    cities: cities.slice(0, 8),
    districts: districts.slice(0, 4),
    routes: routes.slice(0, 6),
    legend: [
      { label: "Dark fill", value: "Primary county or district focus" },
      { label: "Route lines", value: "Deployment corridors and carrier-route bundles" },
      { label: "Pins", value: "Cities and county seats for package review" },
    ],
  };
}

function tierForScore(score: number): OutreachPriorityTier {
  if (score >= 86) return "tier-1";
  if (score >= 76) return "tier-2";
  if (score >= 66) return "tier-3";
  return "tier-4";
}

function raceTypeForOffice(office: string): string {
  const lower = office.toLowerCase();
  if (lower.includes("senate") && lower.includes("u.s.")) return "congressional candidates";
  if (lower.includes("congress") || lower.includes("u.s. house")) return "congressional candidates";
  if (lower.includes("state senate")) return "state senate candidates";
  if (lower.includes("state house") || lower.includes("representative")) return "state house candidates";
  if (lower.includes("judge") || lower.includes("court")) return "judicial races";
  if (lower.includes("party")) return "county parties";
  if (lower.includes("governor") || lower.includes("secretary") || lower.includes("attorney")) return "statewide candidates";
  return "county candidates";
}

function resolveDecisionMaker(office: string) {
  if (office.toLowerCase().includes("party")) return "Executive director or county chair";
  if (office.toLowerCase().includes("consultant")) return "Principal consultant";
  return "Campaign manager or mail consultant";
}

function paletteForParty(party: string): PostcardMockup["palette"] {
  const lower = party.toLowerCase();
  if (lower.includes("republican")) return "red";
  if (lower.includes("democrat")) return "blue";
  return "neutral";
}

function sameName(a: string, b: string) {
  return a.toLowerCase().replace(/[^a-z0-9]/g, "") === b.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatNumber(value: number): string {
  return Math.max(0, Math.round(value)).toLocaleString("en-US");
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function parseMoney(value: string): number {
  const numeric = Number(value.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export { tierLabels };
