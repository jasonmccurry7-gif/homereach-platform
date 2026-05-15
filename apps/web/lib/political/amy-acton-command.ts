import { resolvePoliticalPostcardPriceCents } from "./pricing-config";

export type ActonCreativeCategory =
  | "Emotional / Human"
  | "Policy / Issue Focused"
  | "Testimonial / Social Proof"
  | "Contrast / Urgency";

export interface ActonSource {
  label: string;
  url: string;
  sourceType: "campaign" | "election" | "news" | "population" | "home_reach";
  freshness: string;
}

export interface ActonIntelligenceSignal {
  label: string;
  value: string;
  status: "ready" | "review" | "blocked";
  note: string;
}

export interface ActonPostcardConcept {
  id: string;
  category: ActonCreativeCategory;
  frontPreview: string;
  backPreview: string;
  headline: string;
  subheadline: string;
  cta: string;
  visualDirection: string;
  audienceFit: string;
  emotionalStrategy: string;
  messageIntent: string;
  electionParticipationIntent: string;
  editableCopyAreas: string[];
}

export interface ActonPhase {
  id: string;
  name: string;
  objective: string;
  audienceContext: string;
  targetGeography: string;
  recommendedRoutesCounties: string[];
  emotionalTone: string;
  cta: string;
  mailQuantity: number;
  timingRecommendation: string;
  issueFocus: string;
  expectedOutcome: string;
  postcardConcepts: ActonPostcardConcept[];
}

export interface ActonStrategy {
  id: string;
  campaignName: string;
  theme: string;
  strategyOverview: string;
  audienceContext: string;
  targetGeographies: string[];
  emotionalPositioning: string;
  messagingHierarchy: string[];
  issueHierarchy: string[];
  timingCadence: string;
  budgetAssumptions: string;
  statewideRolloutStrategy: string;
  phases: ActonPhase[];
}

export interface ActonCommandMetrics {
  activePhases: number;
  totalRecommendedPieces: number;
  strategies: number;
  creativeConcepts: number;
  approvalsRequired: number;
  averagePricePerPieceCents: number;
  estimatedInvestmentCents: number;
}

const ESTIMATED_REACH_PER_HOUSEHOLD = 1.5;

function dollarsFromCents(cents: number) {
  return cents / 100;
}

function buildConcepts(phaseId: string, theme: string, issueFocus: string): ActonPostcardConcept[] {
  return [
    {
      id: `${phaseId}-human`,
      category: "Emotional / Human",
      frontPreview: "Warm portrait-led front with an Ohio main-street or kitchen-table setting.",
      backPreview: "Short biography, local service proof, election date, QR code, and disclaimer block.",
      headline: `A doctor, a mom, and a public servant for Ohio.`,
      subheadline: `${theme} starts with trust people can understand at the mailbox.`,
      cta: "Learn Amy's plan for Ohio",
      visualDirection:
        "Bright natural light, real Ohio places, restrained campaign colors, and a confident portrait crop.",
      audienceFit: "Broad statewide name-ID and trust-building households selected by public geography.",
      emotionalStrategy: "Make the candidate feel credible, steady, and human before policy detail.",
      messageIntent: `Introduce ${issueFocus} through Amy Acton's public-service story.`,
      electionParticipationIntent: "Give recipients a simple election-date reminder without pressure language.",
      editableCopyAreas: ["headline", "bio paragraph", "CTA", "QR caption", "disclaimer"],
    },
    {
      id: `${phaseId}-policy`,
      category: "Policy / Issue Focused",
      frontPreview: "Clean issue-forward front with three benefit pillars and a large headline.",
      backPreview: "Problem, plan, proof, QR for details, election date, and disclaimer block.",
      headline: `Ohio families deserve practical leadership.`,
      subheadline: `A focused plan for ${issueFocus.toLowerCase()} and stronger communities.`,
      cta: "See the plan",
      visualDirection:
        "Editorial infographic style, simple icons, high-contrast blocks, and no cluttered claim density.",
      audienceFit: "Households in selected counties and routes where campaign wants issue education.",
      emotionalStrategy: "Shift from biography to competence by explaining a practical plan clearly.",
      messageIntent: `Explain the campaign's public ${issueFocus.toLowerCase()} message in plain language.`,
      electionParticipationIntent: "Connect the issue to the public election calendar and voting information.",
      editableCopyAreas: ["issue pillars", "proof points", "CTA", "QR caption", "source footnote"],
    },
    {
      id: `${phaseId}-proof`,
      category: "Testimonial / Social Proof",
      frontPreview: "Quote-led front with a community validator, organization logo placeholder, or press proof.",
      backPreview: "Validator context, candidate values, mail-drop objective, QR, and disclaimer block.",
      headline: `Trusted when Ohio needed steady leadership.`,
      subheadline: "A campaign message built around public service, credibility, and community voices.",
      cta: "Read more about Amy",
      visualDirection:
        "Press-card layout, understated testimonial treatment, and clear source labels for every claim.",
      audienceFit: "County, city, and media-market mail layers where campaign-approved validators exist.",
      emotionalStrategy: "Borrow credibility from public validators without overstating endorsement impact.",
      messageIntent: "Use sourced proof to reinforce candidate trust and public-service credibility.",
      electionParticipationIntent: "Remind recipients where to find official voting information.",
      editableCopyAreas: ["quote", "validator line", "body copy", "CTA", "source label"],
    },
    {
      id: `${phaseId}-contrast`,
      category: "Contrast / Urgency",
      frontPreview: "High-clarity contrast front comparing two public choices in tone, priorities, and readiness.",
      backPreview: "Campaign-provided contrast copy, voting window, QR, and compliance review block.",
      headline: `The choice for Ohio's next chapter matters.`,
      subheadline: "A clear, factual contrast focused on leadership, priorities, and public record.",
      cta: "Compare the records",
      visualDirection:
        "Premium contrast layout with strong typography, limited red accents, and source-tagged claims.",
      audienceFit: "Late-window mail waves after human review of every contrast claim and source.",
      emotionalStrategy: "Create urgency while staying factual, sourced, and compliance-reviewed.",
      messageIntent: "Present campaign-approved contrast without personal attacks or deceptive framing.",
      electionParticipationIntent: "Make the election deadline visible and easy to verify.",
      editableCopyAreas: ["contrast claim", "source note", "CTA", "deadline line", "disclaimer"],
    },
  ];
}

function buildPhase(input: Omit<ActonPhase, "postcardConcepts">): ActonPhase {
  return {
    ...input,
    postcardConcepts: buildConcepts(input.id, input.name, input.issueFocus),
  };
}

export const AMY_ACTON_INTELLIGENCE_SOURCES: ActonSource[] = [
  {
    label: "Amy Acton for Governor official campaign site",
    url: "https://actonforgovernor.com/",
    sourceType: "campaign",
    freshness: "Official campaign source",
  },
  {
    label: "Ohio Secretary of State 2026 voting schedule",
    url: "https://www.ohiosos.gov/elections/voting-schedule-text-only",
    sourceType: "election",
    freshness: "Election calendar source",
  },
  {
    label: "Ohio Secretary of State candidate qualification release",
    url: "https://www.ohiosos.gov/office/media-center/categories/press-releases/2026-02-19",
    sourceType: "election",
    freshness: "Candidate qualification source",
  },
  {
    label: "Signal Ohio running mate report",
    url: "https://signalohio.org/ohio-governor-candidate-amy-acton-selects-former-democratic-party-chair-as-running-mate-election-2026/",
    sourceType: "news",
    freshness: "Public reporting source",
  },
  {
    label: "U.S. Census QuickFacts: Ohio",
    url: "https://www.census.gov/quickfacts/OH",
    sourceType: "population",
    freshness: "Population and household reference",
  },
  {
    label: "HomeReach political pricing model",
    url: "/political/pricing",
    sourceType: "home_reach",
    freshness: "Internal pricing source",
  },
];

export const AMY_ACTON_INTELLIGENCE_SIGNALS: ActonIntelligenceSignal[] = [
  {
    label: "Candidate identity",
    value: "Dr. Amy Acton",
    status: "ready",
    note: "Public candidate record loaded for Ohio governor planning.",
  },
  {
    label: "Office",
    value: "Governor of Ohio",
    status: "ready",
    note: "Statewide office, so the planning geography starts at Ohio statewide and then narrows to counties, cities, ZIPs, and routes.",
  },
  {
    label: "Public story",
    value: "Physician and former Ohio public health leader",
    status: "review",
    note: "Use only sourced public biography and campaign-approved copy before client-facing creative.",
  },
  {
    label: "Running mate",
    value: "David Pepper",
    status: "review",
    note: "Displayed from public reporting and should be reconfirmed with the campaign before proposal.",
  },
  {
    label: "Election timing",
    value: "General election: November 3, 2026",
    status: "ready",
    note: "Timeline recommendations anchor around the statewide general election calendar.",
  },
  {
    label: "USPS quote state",
    value: "Not quote-locked",
    status: "blocked",
    note: "Route counts must be loaded from USPS EDDM/BMEU or licensed carrier-route data before checkout.",
  },
];

export const AMY_ACTON_CAMPAIGN_STRATEGIES: ActonStrategy[] = [
  {
    id: "ohio-service-trust-tour",
    campaignName: "Ohio Service Trust Tour",
    theme: "Biography-first statewide trust",
    strategyOverview:
      "A governor-scale introduction system that makes Acton's public-service story visible across Ohio before the fall ballot window, then repeats trust and election-deadline messages in high-volume mail waves.",
    audienceContext:
      "Broad Ohio households selected by public geography, route capacity, media market, county coverage, and mail-delivery feasibility. No individual voter behavior prediction is used.",
    targetGeographies: [
      "Franklin County",
      "Cuyahoga County",
      "Hamilton County",
      "Summit County",
      "Lucas County",
      "Montgomery County",
      "Mahoning Valley",
      "county-seat route clusters",
    ],
    emotionalPositioning: "Steady doctor, public servant, neighbor, and practical Ohio problem-solver.",
    messagingHierarchy: [
      "Amy Acton's public-service biography",
      "Trust and steadiness under pressure",
      "Ohio family affordability and health care access",
      "Election deadline and official voting information",
    ],
    issueHierarchy: ["health care access", "family costs", "public service", "education and communities"],
    timingCadence: "Five mail waves from late May through final election week.",
    budgetAssumptions:
      "Modeled at statewide volume using HomeReach political per-piece pricing. Final quote remains locked until USPS route counts and print/postage costs are verified.",
    statewideRolloutStrategy:
      "Start with high-density metro and county-seat coverage, then add surrounding Ohio route clusters as capacity and budget allow.",
    phases: [
      buildPhase({
        id: "service-intro",
        name: "Introduction",
        objective: "Build statewide name recognition and introduce Acton's public-service biography.",
        audienceContext: "Broad public-geometry mail coverage in Ohio's largest metro and county-seat clusters.",
        targetGeography: "Franklin, Cuyahoga, Hamilton, Summit, Lucas, Montgomery, Mahoning, Stark, Lorain.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"],
        emotionalTone: "Warm, credible, calm, service-led.",
        cta: "Meet Amy Acton",
        mailQuantity: 450_000,
        timingRecommendation: "Late May to early June 2026.",
        issueFocus: "public-service biography",
        expectedOutcome: "Give the campaign a clear first mailbox impression before higher-volume fall messaging.",
      }),
      buildPhase({
        id: "service-trust",
        name: "Trust Building",
        objective: "Reinforce competence, steadiness, and personal credibility.",
        audienceContext: "Repeat households from phase one plus adjacent county-seat routes.",
        targetGeography: "Major metros, first-ring communities, and regional route clusters.",
        recommendedRoutesCounties: ["Cuyahoga", "Franklin", "Hamilton", "Lucas", "Stark", "Lorain"],
        emotionalTone: "Confident, reassuring, grounded.",
        cta: "Read Amy's story",
        mailQuantity: 520_000,
        timingRecommendation: "Late June to mid July 2026.",
        issueFocus: "trusted leadership",
        expectedOutcome: "Turn biography into a repeat trust signal across the statewide map.",
      }),
      buildPhase({
        id: "service-issues",
        name: "Issue Positioning",
        objective: "Connect the candidate story to family costs, health care access, and community priorities.",
        audienceContext: "Aggregate household routes selected by county coverage and mail density.",
        targetGeography: "Metro counties plus county-seat expansion in northwest, northeast, central, and southwest Ohio.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Mahoning", "Athens"],
        emotionalTone: "Practical, empathetic, solutions-focused.",
        cta: "See the plan for Ohio families",
        mailQuantity: 600_000,
        timingRecommendation: "Mid August 2026.",
        issueFocus: "health care access and family affordability",
        expectedOutcome: "Give households a simple issue ladder before late-cycle contrast and voting information.",
      }),
      buildPhase({
        id: "service-contrast",
        name: "Contrast",
        objective: "Present a factual, sourced contrast about leadership, priorities, and readiness.",
        audienceContext: "Campaign-selected public geographies with all contrast claims human-reviewed.",
        targetGeography: "High-volume route clusters where the campaign wants late-cycle clarity.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Montgomery", "Summit", "Lucas"],
        emotionalTone: "Clear, urgent, factual.",
        cta: "Compare the choice for Ohio",
        mailQuantity: 700_000,
        timingRecommendation: "Late September to early October 2026.",
        issueFocus: "leadership contrast",
        expectedOutcome: "Create a clean contrast before final voting-window reminders.",
      }),
      buildPhase({
        id: "service-gotv",
        name: "Turnout / GOTV",
        objective: "Provide election date, early-vote, absentee, and final reminder information.",
        audienceContext: "Public geography only, using election-calendar timing and verified route counts.",
        targetGeography: "Statewide final wave prioritized by route readiness and delivery confidence.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"],
        emotionalTone: "Helpful, direct, deadline-aware.",
        cta: "Make your plan to vote",
        mailQuantity: 850_000,
        timingRecommendation: "October ballot window and final week before November 3, 2026.",
        issueFocus: "official voting information",
        expectedOutcome: "Make final election logistics visible in the mailbox with no voter-level targeting.",
      }),
    ],
  },
  {
    id: "kitchen-table-ohio",
    campaignName: "Kitchen Table Ohio",
    theme: "Affordability and health care access",
    strategyOverview:
      "A practical household-cost message arc that uses Acton's medical and public-service credibility to explain family affordability, health care, and community stability.",
    audienceContext:
      "Campaign-provided issue message distributed by aggregate county, ZIP, and route coverage. Route selection is operational and geographic only.",
    targetGeographies: [
      "Columbus metro",
      "Cleveland metro",
      "Cincinnati metro",
      "Dayton",
      "Akron-Canton",
      "Toledo",
      "Youngstown-Warren",
      "regional county seats",
    ],
    emotionalPositioning: "Plainspoken leadership for people worried about costs, care, and community stability.",
    messagingHierarchy: [
      "Families are stretched",
      "Health care and household costs are connected",
      "Acton brings practical leadership",
      "Ohio deserves a governor focused on everyday problems",
    ],
    issueHierarchy: ["family affordability", "health care access", "schools and kids", "local community strength"],
    timingCadence: "Four issue waves from June through late October.",
    budgetAssumptions:
      "Modeled with 0.54 to 0.70 dollar political postcard range depending on final quantity, print specs, postage, and route counts.",
    statewideRolloutStrategy:
      "Use repeated, simple issue mail across dense household routes, then reinforce the same message in adjacent county-seat markets.",
    phases: [
      buildPhase({
        id: "kitchen-intro",
        name: "Introduction",
        objective: "Connect Acton's biography to family economics and practical care.",
        audienceContext: "Large metro and regional household routes selected by mail density.",
        targetGeography: "Columbus, Cleveland, Cincinnati, Dayton, Akron, Toledo.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Montgomery", "Summit", "Lucas"],
        emotionalTone: "Personal, empathetic, steady.",
        cta: "Meet the doctor running for Ohio families",
        mailQuantity: 380_000,
        timingRecommendation: "June 2026.",
        issueFocus: "family affordability",
        expectedOutcome: "Make the campaign relevant to everyday household concerns.",
      }),
      buildPhase({
        id: "kitchen-policy",
        name: "Issue Positioning",
        objective: "Turn affordability into a simple three-part plan.",
        audienceContext: "County and route clusters where the campaign wants repeated issue education.",
        targetGeography: "Metro counties and county seats with high delivery efficiency.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Stark", "Mahoning", "Butler"],
        emotionalTone: "Practical and concrete.",
        cta: "See Amy's plan",
        mailQuantity: 460_000,
        timingRecommendation: "August 2026.",
        issueFocus: "cost of living and health care access",
        expectedOutcome: "Give households one memorable issue frame before fall voting begins.",
      }),
      buildPhase({
        id: "kitchen-proof",
        name: "Trust Building",
        objective: "Add community validators, sourced claims, and candidate credibility.",
        audienceContext: "Campaign-approved validator geography only; no inferred household traits.",
        targetGeography: "Validator-aligned county and media-market route clusters.",
        recommendedRoutesCounties: ["Cuyahoga", "Franklin", "Summit", "Lucas", "Montgomery", "Athens"],
        emotionalTone: "Credible and community-backed.",
        cta: "Read why Ohioans trust Amy",
        mailQuantity: 520_000,
        timingRecommendation: "Late September 2026.",
        issueFocus: "trusted leadership",
        expectedOutcome: "Strengthen trust with source-labeled proof before the final ballot window.",
      }),
      buildPhase({
        id: "kitchen-gotv",
        name: "Turnout / GOTV",
        objective: "Convert the kitchen-table message into election-deadline awareness.",
        audienceContext: "Election-calendar wave across verified route counts.",
        targetGeography: "High-confidence route inventory with verified household counts.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Lucas", "Montgomery", "Summit"],
        emotionalTone: "Helpful and deadline-focused.",
        cta: "Make your voting plan",
        mailQuantity: 650_000,
        timingRecommendation: "October 2026.",
        issueFocus: "official voting information",
        expectedOutcome: "Keep the campaign visible through absentee, early-vote, and final-week timing.",
      }),
    ],
  },
  {
    id: "county-seat-command",
    campaignName: "County Seat Command",
    theme: "Statewide coverage beyond the largest metros",
    strategyOverview:
      "A statewide credibility plan built around county seats, regional centers, and balanced Ohio map coverage so the campaign does not look like a metro-only operation.",
    audienceContext:
      "Aggregate public geography based on county/city/route coverage, logistics, and print-drop feasibility.",
    targetGeographies: [
      "Canton",
      "Mansfield",
      "Lima",
      "Springfield",
      "Marion",
      "Newark",
      "Lancaster",
      "Warren",
      "Elyria",
      "Athens",
      "Steubenville",
      "Portsmouth",
    ],
    emotionalPositioning: "A statewide governor campaign that shows up for every kind of Ohio community.",
    messagingHierarchy: [
      "Ohio communities want to be seen",
      "Acton's leadership is statewide, not just metro",
      "Local priorities and practical service",
      "Election participation information",
    ],
    issueHierarchy: ["local communities", "public service", "health care access", "economic pressure"],
    timingCadence: "Four waves balanced between county seats and major metro reinforcement.",
    budgetAssumptions:
      "Built as an expansion layer after core route counts are verified; final price depends on county-seat route availability.",
    statewideRolloutStrategy:
      "Pair each major metro wave with surrounding county-seat route clusters to create visible statewide breadth.",
    phases: [
      buildPhase({
        id: "county-intro",
        name: "Introduction",
        objective: "Show Acton as a statewide candidate with attention to communities outside the largest cities.",
        audienceContext: "County-seat households selected by public geography and delivery capacity.",
        targetGeography: "Regional centers across northeast, northwest, central, southeast, and southwest Ohio.",
        recommendedRoutesCounties: ["Stark", "Richland", "Allen", "Clark", "Licking", "Fairfield"],
        emotionalTone: "Respectful, local, service-driven.",
        cta: "See Amy's Ohio story",
        mailQuantity: 300_000,
        timingRecommendation: "Late June 2026.",
        issueFocus: "statewide community visibility",
        expectedOutcome: "Broaden campaign presence outside the biggest metro footprint.",
      }),
      buildPhase({
        id: "county-issues",
        name: "Issue Positioning",
        objective: "Localize affordability and health care access without changing the statewide message.",
        audienceContext: "County/city route clusters and campaign-approved local copy blocks.",
        targetGeography: "County-seat route clusters plus adjacent city routes where delivery counts are verified.",
        recommendedRoutesCounties: ["Mahoning", "Trumbull", "Lorain", "Athens", "Scioto", "Jefferson"],
        emotionalTone: "Grounded and locally aware.",
        cta: "Read the plan for Ohio communities",
        mailQuantity: 360_000,
        timingRecommendation: "August 2026.",
        issueFocus: "community affordability and care",
        expectedOutcome: "Keep the statewide message from feeling generic by referencing local community priorities.",
      }),
      buildPhase({
        id: "county-proof",
        name: "Trust Building",
        objective: "Add source-labeled proof points and public-service credibility.",
        audienceContext: "Public-geometry route coverage where the campaign can support sourced local proof.",
        targetGeography: "County-seat markets with strong route readiness.",
        recommendedRoutesCounties: ["Stark", "Lorain", "Mahoning", "Trumbull", "Clark", "Richland"],
        emotionalTone: "Credible and practical.",
        cta: "Learn more about Amy",
        mailQuantity: 380_000,
        timingRecommendation: "Late September 2026.",
        issueFocus: "credible public service",
        expectedOutcome: "Reinforce that the candidate's story travels across the whole Ohio map.",
      }),
      buildPhase({
        id: "county-final",
        name: "Final Reminder",
        objective: "Deliver a final election information wave to verified route clusters.",
        audienceContext: "Mail routes with confirmed household counts and delivery confidence.",
        targetGeography: "County-seat expansion layer plus selected metro reinforcements.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Stark", "Mahoning", "Lorain"],
        emotionalTone: "Clear and direct.",
        cta: "Vote by November 3",
        mailQuantity: 440_000,
        timingRecommendation: "Late October 2026.",
        issueFocus: "official voting information",
        expectedOutcome: "Close the coverage gap with a practical final reminder.",
      }),
    ],
  },
  {
    id: "ballot-window-surge",
    campaignName: "Ballot Window Surge",
    theme: "Absentee, early vote, and final-week execution",
    strategyOverview:
      "A compressed high-volume plan built for campaigns that need a late, disciplined mail schedule around absentee, early-vote, and final Election Day reminder windows.",
    audienceContext:
      "Election-timing mail operations across verified public geographies and USPS route inventory. No individual voter turnout scoring is used.",
    targetGeographies: [
      "Franklin County",
      "Cuyahoga County",
      "Hamilton County",
      "Lucas County",
      "Montgomery County",
      "Summit County",
      "college-town route clusters",
      "high-density city route clusters",
    ],
    emotionalPositioning: "Urgent, organized, clear, and helpful.",
    messagingHierarchy: [
      "Election date and voting window",
      "Why Acton's leadership matters now",
      "Simple action steps",
      "Final reminder before Election Day",
    ],
    issueHierarchy: ["official voting information", "trust", "affordability", "leadership contrast"],
    timingCadence: "Three to four waves concentrated from early October through final week.",
    budgetAssumptions:
      "Best used once creative is approved early and USPS counts are already loaded. Late print changes increase delivery risk.",
    statewideRolloutStrategy:
      "Protect delivery confidence first, then increase quantity where route counts and print windows can support it.",
    phases: [
      buildPhase({
        id: "ballot-absentee",
        name: "Absentee Window",
        objective: "Explain the voting window and keep Acton's campaign visible as ballots begin moving.",
        audienceContext: "Verified route inventory aligned to public election-calendar timing.",
        targetGeography: "High-density verified route inventory in Ohio's largest counties.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery"],
        emotionalTone: "Helpful, prepared, confident.",
        cta: "Check official voting dates",
        mailQuantity: 500_000,
        timingRecommendation: "Early October 2026.",
        issueFocus: "official voting information",
        expectedOutcome: "Create a clear ballot-window reminder with campaign identity attached.",
      }),
      buildPhase({
        id: "ballot-contrast",
        name: "Contrast",
        objective: "Make a final sourced contrast before the last voting reminder.",
        audienceContext: "Campaign-approved public geographies and human-reviewed contrast copy.",
        targetGeography: "Major county route clusters with complete counts and delivery confidence.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Stark", "Summit", "Lorain"],
        emotionalTone: "Urgent but factual.",
        cta: "Compare the choice",
        mailQuantity: 600_000,
        timingRecommendation: "Mid October 2026.",
        issueFocus: "leadership contrast",
        expectedOutcome: "Frame the closing choice while keeping claims sourced and reviewable.",
      }),
      buildPhase({
        id: "ballot-turnout",
        name: "Turnout / GOTV",
        objective: "Deliver one clear final reminder before Election Day.",
        audienceContext: "Verified route counts, official election date, and delivery confidence only.",
        targetGeography: "Largest verified route universe that can still hit the in-home window.",
        recommendedRoutesCounties: ["Franklin", "Cuyahoga", "Hamilton", "Lucas", "Montgomery", "Summit"],
        emotionalTone: "Simple, confident, deadline-aware.",
        cta: "Vote by November 3",
        mailQuantity: 800_000,
        timingRecommendation: "Final week before November 3, 2026.",
        issueFocus: "final election reminder",
        expectedOutcome: "Maximize final mailbox visibility without overpromising vote impact.",
      }),
    ],
  },
];

export const AMY_ACTON_ADVANCED_WORKFLOWS = [
  {
    label: "Debate response mode",
    description:
      "Drafts a sourced response postcard after a public debate or major interview. Human approval is required before creative or sending.",
  },
  {
    label: "Rapid response postcard generation",
    description:
      "Creates a same-week concept pack for a campaign-approved public event, endorsement, contrast moment, or news cycle.",
  },
  {
    label: "Momentum trigger recommendations",
    description:
      "Flags when a public source, endorsement, fundraising release, or earned-media moment may justify an additional mail wave.",
  },
  {
    label: "Campaign-provided messaging tracks",
    description:
      "Organizes healthcare, working-family, educator, veteran, student, and affordability copy packages without using inferred household traits for targeting.",
  },
  {
    label: "Production readiness monitor",
    description:
      "Checks approval status, source freshness, USPS counts, price lock, print deadline, postage estimate, and route confidence.",
  },
];

export const AMY_ACTON_COMPLIANCE_GUARDRAILS = [
  "Use public candidate, campaign, geography, election, and logistics sources only.",
  "Do not infer individual political beliefs, ideology, health status, religion, race, ethnicity, or other sensitive traits.",
  "Do not score or rank individual voters.",
  "Do not claim vote impact, persuasion lift, or turnout lift.",
  "Route and geography recommendations are aggregate operational recommendations, not voter-level predictions.",
  "Every client-facing proposal, postcard copy, contrast claim, and checkout requires human approval.",
];

export const AMY_ACTON_ADMIN_COMMAND_ITEMS = [
  {
    label: "Route counts",
    status: "Blocked",
    detail: "USPS EDDM/BMEU or licensed carrier-route counts are required before quote lock.",
  },
  {
    label: "Creative approvals",
    status: "In review",
    detail: "Concepts can be drafted now. Final copy and images require campaign and HomeReach approval.",
  },
  {
    label: "Proposal state",
    status: "Draft only",
    detail: "Proposal export is safe after source, contact, boundary, route, price, and approval gates pass.",
  },
  {
    label: "AI activity",
    status: "Queued",
    detail: "Agent can answer campaign-planning questions and draft revision suggestions from comments.",
  },
];

export function getActonCommandMetrics(): ActonCommandMetrics {
  const phases = AMY_ACTON_CAMPAIGN_STRATEGIES.flatMap((strategy) => strategy.phases);
  const totalRecommendedPieces = phases.reduce((sum, phase) => sum + phase.mailQuantity, 0);
  const averagePricePerPieceCents = resolvePoliticalPostcardPriceCents("state", totalRecommendedPieces);
  const creativeConcepts = phases.reduce((sum, phase) => sum + phase.postcardConcepts.length, 0);

  return {
    activePhases: phases.length,
    totalRecommendedPieces,
    strategies: AMY_ACTON_CAMPAIGN_STRATEGIES.length,
    creativeConcepts,
    approvalsRequired: creativeConcepts,
    averagePricePerPieceCents,
    estimatedInvestmentCents: Math.round(totalRecommendedPieces * dollarsFromCents(averagePricePerPieceCents) * 100),
  };
}

export function getActonEstimatedReach(households: number) {
  return Math.round(households * ESTIMATED_REACH_PER_HOUSEHOLD);
}
