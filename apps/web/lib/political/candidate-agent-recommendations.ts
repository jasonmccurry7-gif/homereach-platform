import { resolvePoliticalPostcardPriceCents } from "./pricing-config";

export type CandidateTargetId =
  | "vivek-ramaswamy"
  | "sherrod-brown"
  | "jon-husted"
  | "keith-faber"
  | "john-kulewicz"
  | "allison-russo"
  | "robert-sprague"
  | "ohio-democratic-party"
  | "ohio-republican-party"
  | "amy-acton";

export type CreativeCategory = "Emotional/Human" | "Policy/Issue Focused" | "Testimonial/Social Proof" | "Contrast/Urgency";
export type ReviewAction =
  | "Preview Front"
  | "Preview Back"
  | "Select Design"
  | "Compare Designs"
  | "Edit Design"
  | "Edit Copy"
  | "Edit CTA"
  | "Swap Image"
  | "Generate Variants"
  | "Leave Comment"
  | "Request AI Revision"
  | "Save Draft"
  | "Approve Design"
  | "Duplicate Design"
  | "Export Proposal"
  | "Export Creative Brief"
  | "Add to Campaign Plan"
  | "Send to Admin Review"
  | "Send to Client Review";

export interface CandidateCampaignSource {
  label: string;
  url: string;
  sourceType: "campaign" | "election" | "population" | "party" | "public_record" | "home_reach";
}

export interface GeoRecommendation {
  label: string;
  type: "county" | "city" | "zip_cluster" | "route_cluster" | "media_market";
  objective: string;
  rationale: string;
  messageFit: string;
  postcardStyle: CreativeCategory;
  phaseFit: string;
  operationalComplexity: "low" | "medium" | "high";
  estimatedMailVolume: number;
  budgetRangeCents: [number, number];
  mailEfficiencyScore: number;
  routeDensityScore: number;
  dataStatus: "sample" | "estimated" | "needs_usps";
}

export interface CandidateCampaignProfile {
  id: CandidateTargetId;
  candidateName: string;
  shortName: string;
  office: string;
  state: string;
  partyOrCommittee: string;
  runningMate?: string;
  electionDate: string;
  publicCampaignFrame: string;
  complianceMode: string;
  colorClass: string;
  accentClass: string;
  biographyBullets: string[];
  publicPriorities: string[];
  strengths: string[];
  riskOrResearchGaps: string[];
  topCounties: string[];
  topCities: string[];
  zipClusters: string[];
  routeClusters: string[];
  mediaMarkets: string[];
  messagePillars: string[];
  creativeTone: string;
  sources: CandidateCampaignSource[];
}

export interface PostcardConcept {
  id: string;
  candidateId: CandidateTargetId;
  strategyId: string;
  phaseKey: string;
  category: CreativeCategory;
  title: string;
  headline: string;
  subheadline: string;
  frontBody: string;
  backBody: string;
  cta: string;
  suggestedImagery: string;
  visualDirection: string;
  colorStyle: string;
  audienceFit: string;
  geographicFit: string;
  emotionalStrategy: string;
  persuasionIntent: string;
  turnoutIntent: string;
  complianceDisclaimer: string;
  editableCopyZones: string[];
  editableCtaZone: string;
  editableImageZone: string;
  internalStrategyNotes: string;
  staffCommentPrompt: string;
}

export interface CandidateCampaignPhase {
  phaseNumber: number;
  phaseKey: string;
  objective: string;
  targetAudience: string;
  targetGeography: string;
  recommendedRoutes: string[];
  emotionalTone: string;
  cta: string;
  mailQuantity: number;
  timing: string;
  issueFocus: string;
  expectedOutcome: string;
  postcardConcepts: PostcardConcept[];
}

export interface CandidateCampaignStrategy {
  id: string;
  candidateId: CandidateTargetId;
  title: string;
  campaignTheme: string;
  strategyOverview: string;
  aggregateAudience: string;
  targetGeographies: string[];
  emotionalPositioning: string;
  persuasionGoal: string;
  turnoutGoal: string;
  messagingHierarchy: string[];
  issueHierarchy: string[];
  timingCadence: string;
  budgetAssumptions: string;
  rolloutStrategy: string;
  phaseSequencing: string;
  recommendedCountiesRoutes: string[];
  mailQuantityAssumptions: string;
  expectedOutcome: string;
  drops: number;
  households: number;
  estimatedReach: number;
  pricePerPostcardCents: number;
  totalPieces: number;
  estimatedTotalCents: number;
  costPerReachCents: number;
  confidenceScore: number;
  phases: CandidateCampaignPhase[];
}

export interface CandidateCampaignAgent {
  profile: CandidateCampaignProfile;
  geographicRecommendations: GeoRecommendation[];
  strategies: CandidateCampaignStrategy[];
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

const ESTIMATED_REACH_PER_HOUSEHOLD = 1.5;

const COMPLIANCE_MODE =
  "Public, aggregate geography, household estimates, route logistics, timing, and cost modeling only. No individual voter scoring, ideology inference, sensitive-demographic targeting, or turnout-suppression tooling.";

const COMMON_SOURCES: CandidateCampaignSource[] = [
  {
    label: "Ohio Secretary of State election calendar",
    url: "https://www.ohiosos.gov/elections/voting-schedule-text-only/",
    sourceType: "election",
  },
  {
    label: "U.S. Census Bureau QuickFacts: Ohio",
    url: "https://www.census.gov/quickfacts/OH",
    sourceType: "population",
  },
  {
    label: "USPS Every Door Direct Mail",
    url: "https://www.usps.com/business/every-door-direct-mail.htm",
    sourceType: "public_record",
  },
  {
    label: "HomeReach political postcard pricing model",
    url: "/political/pricing",
    sourceType: "home_reach",
  },
];

export const REVIEW_ACTIONS: ReviewAction[] = [
  "Preview Front",
  "Preview Back",
  "Select Design",
  "Compare Designs",
  "Edit Design",
  "Edit Copy",
  "Edit CTA",
  "Swap Image",
  "Generate Variants",
  "Leave Comment",
  "Request AI Revision",
  "Save Draft",
  "Approve Design",
  "Duplicate Design",
  "Export Proposal",
  "Export Creative Brief",
  "Add to Campaign Plan",
  "Send to Admin Review",
  "Send to Client Review",
];

const CREATIVE_CATEGORIES: CreativeCategory[] = [
  "Emotional/Human",
  "Policy/Issue Focused",
  "Testimonial/Social Proof",
  "Contrast/Urgency",
];

const PHASE_BLUEPRINTS = [
  {
    key: "introduction",
    objective: "Introduce the candidate or organization with source-backed public identity and role.",
    timing: "Six to five months before the general election, or immediately after campaign approval.",
  },
  {
    key: "trust",
    objective: "Build credibility with public service record, campaign-provided proof points, and local relevance.",
    timing: "Four to five months before Election Day.",
  },
  {
    key: "issue-positioning",
    objective: "Connect the campaign's approved priorities to local economic, civic, or community concerns.",
    timing: "Three to four months before Election Day.",
  },
  {
    key: "persuasion",
    objective: "Reinforce the campaign's approved case in higher-attention aggregate geographies.",
    timing: "Eight to ten weeks before Election Day.",
  },
  {
    key: "contrast",
    objective: "Frame the public choice with compliant, factual, campaign-approved contrast.",
    timing: "Four to six weeks before Election Day.",
  },
  {
    key: "gotv",
    objective: "Deliver election timing, ballot-window, and final reminder mail using campaign-approved language.",
    timing: "Final three weeks, aligned to absentee, early vote, and Election Day deadlines.",
  },
] as const;

const PROFILES: CandidateCampaignProfile[] = [
  {
    id: "vivek-ramaswamy",
    candidateName: "Vivek Ramaswamy",
    shortName: "Ramaswamy",
    office: "Governor of Ohio",
    state: "Ohio",
    partyOrCommittee: "Republican",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide executive profile with business, outsider, economy, and government-reform themes. Verify official campaign copy before client-facing use.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-red-700 to-slate-950",
    accentClass: "text-red-100",
    biographyBullets: ["Ohio statewide campaign profile.", "Business and public-policy background requires source refresh before proposal.", "Public-facing message should stay tied to verified campaign materials."],
    publicPriorities: ["Economy and cost of living", "Government reform", "Statewide leadership", "Public safety and opportunity"],
    strengths: ["High name recognition", "Statewide media visibility", "Clear executive-style message frame"],
    riskOrResearchGaps: ["Confirm official committee/contact", "Verify current platform language", "Attach final county and USPS route counts"],
    topCounties: ["Delaware", "Warren", "Butler", "Medina", "Stark", "Miami", "Clermont", "Lake"],
    topCities: ["Mason", "Delaware", "Strongsville", "West Chester", "Medina", "Canton", "Troy", "Mentor"],
    zipClusters: ["43015/43065", "45040/45069", "44256/44212", "44708/44720", "45103/45150"],
    routeClusters: ["Exurban growth routes", "County-seat saturation routes", "High-household suburban carrier routes"],
    mediaMarkets: ["Cleveland-Akron", "Columbus", "Cincinnati", "Dayton"],
    messagePillars: ["Economy", "Reform", "Energy", "Ohio-first leadership"],
    creativeTone: "Direct, energetic, reform-focused, and executive.",
    sources: [{ label: "Vivek for Ohio campaign site", url: "https://vivekforohio.com/", sourceType: "campaign" }, ...COMMON_SOURCES],
  },
  {
    id: "sherrod-brown",
    candidateName: "Sherrod Brown",
    shortName: "Brown",
    office: "U.S. Senate",
    state: "Ohio",
    partyOrCommittee: "Democrat",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Federal statewide profile with working-family, labor, dignity-of-work, and Ohio manufacturing themes. Verify 2026 campaign status before proposal.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-blue-700 to-slate-950",
    accentClass: "text-blue-100",
    biographyBullets: ["Former U.S. Senator and long-running Ohio public figure.", "Known publicly for working-family and labor-oriented messaging.", "Campaign status and committee details must be verified before client-facing use."],
    publicPriorities: ["Workers and wages", "Manufacturing", "Health care affordability", "Community investment"],
    strengths: ["Recognized statewide brand", "Labor and working-class message fit", "Strong story-mail potential"],
    riskOrResearchGaps: ["Confirm active 2026 committee details", "Verify official site and contact", "Load federal-route quote model"],
    topCounties: ["Mahoning", "Trumbull", "Lorain", "Lucas", "Summit", "Cuyahoga", "Stark", "Montgomery"],
    topCities: ["Youngstown", "Warren", "Lorain", "Toledo", "Akron", "Cleveland", "Canton", "Dayton"],
    zipClusters: ["44502/44505", "44052/44055", "43604/43608", "44310/44320", "45402/45410"],
    routeClusters: ["Industrial corridor routes", "Union-region household routes", "Urban turnout logistics routes"],
    mediaMarkets: ["Cleveland-Akron", "Youngstown", "Toledo", "Dayton"],
    messagePillars: ["Dignity of work", "Labor", "Health costs", "Ohio manufacturing"],
    creativeTone: "Plainspoken, worker-centered, local, and proof-heavy.",
    sources: [{ label: "Sherrod Brown campaign site", url: "https://www.sherrodbrown.com/", sourceType: "campaign" }, ...COMMON_SOURCES],
  },
  {
    id: "jon-husted",
    candidateName: "Jon Husted",
    shortName: "Husted",
    office: "U.S. Senate",
    state: "Ohio",
    partyOrCommittee: "Republican",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide Republican federal profile with public-office, economy, and administration experience. Verify official Senate campaign materials before proposal.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-red-700 to-blue-950",
    accentClass: "text-red-100",
    biographyBullets: ["Statewide public-office profile.", "Known for state executive and administrative roles.", "Official Senate campaign materials must control final copy."],
    publicPriorities: ["Economy", "Small business", "Public administration", "Ohio competitiveness"],
    strengths: ["Statewide office experience", "Suburban and exurban message fit", "Strong logistics-ready county network potential"],
    riskOrResearchGaps: ["Confirm official Senate committee/contact", "Verify current issue hierarchy", "Attach federal quote assumptions"],
    topCounties: ["Delaware", "Warren", "Butler", "Medina", "Lake", "Greene", "Miami", "Clermont"],
    topCities: ["Delaware", "Mason", "West Chester", "Medina", "Mentor", "Beavercreek", "Troy", "Milford"],
    zipClusters: ["43015/43035", "45040/45069", "44256/44281", "44060/44077", "45324/45373"],
    routeClusters: ["Republican suburban retention routes", "Business corridor routes", "Exurban growth corridors"],
    mediaMarkets: ["Columbus", "Cincinnati", "Cleveland-Akron", "Dayton"],
    messagePillars: ["Experience", "Economy", "Competence", "Ohio results"],
    creativeTone: "Steady, executive, experienced, and economy-forward.",
    sources: [{ label: "Jon Husted for Senate campaign site", url: "https://www.jonhustedforsenate.com/", sourceType: "campaign" }, ...COMMON_SOURCES],
  },
  {
    id: "keith-faber",
    candidateName: "Keith Faber",
    shortName: "Faber",
    office: "Attorney General",
    state: "Ohio",
    partyOrCommittee: "Republican",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide legal executive profile with accountability, fiscal oversight, and rule-of-law positioning. Verify official campaign details.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-red-800 to-slate-950",
    accentClass: "text-red-100",
    biographyBullets: ["Statewide office profile.", "Public auditor/accountability experience is a likely verified-message lane.", "Attorney General campaign copy needs official source approval."],
    publicPriorities: ["Rule of law", "Accountability", "Fiscal oversight", "Public safety"],
    strengths: ["Accountability message fit", "Statewide official profile", "Clear AG-relevant issue lane"],
    riskOrResearchGaps: ["Verify official AG campaign status", "Confirm ballot/primary status", "Attach official campaign copy"],
    topCounties: ["Auglaize", "Mercer", "Darke", "Shelby", "Miami", "Allen", "Hancock", "Van Wert"],
    topCities: ["Celina", "Wapakoneta", "Sidney", "Troy", "Lima", "Findlay", "Van Wert", "Piqua"],
    zipClusters: ["45822/45895", "45365/45373", "45801/45840", "45891/45894"],
    routeClusters: ["Western Ohio county-seat routes", "Rural trust-building routes", "Fiscal accountability message routes"],
    mediaMarkets: ["Dayton", "Lima", "Toledo", "Columbus"],
    messagePillars: ["Accountability", "Law", "Fiscal stewardship", "Public safety"],
    creativeTone: "Serious, accountable, rule-of-law, and trust-forward.",
    sources: [{ label: "Keith Faber public office site", url: "https://ohioauditor.gov/", sourceType: "public_record" }, ...COMMON_SOURCES],
  },
  {
    id: "john-kulewicz",
    candidateName: "John Kulewicz",
    shortName: "Kulewicz",
    office: "Attorney General",
    state: "Ohio",
    partyOrCommittee: "Democrat",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Attorney General profile requiring source verification before biography or platform claims. Safer first pass: legal accountability, civic trust, and public-interest mail themes.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-blue-700 to-slate-950",
    accentClass: "text-blue-100",
    biographyBullets: ["Candidate profile needs official-source verification.", "AG race message should stay around lawful public-interest and accountability themes until source-locked.", "Do not invent endorsements, biography, or platform claims."],
    publicPriorities: ["Legal accountability", "Consumer protection", "Civic trust", "Public integrity"],
    strengths: ["Clear office-specific message lane", "Suburban legal/accountability story potential", "Urban coalition logistics potential"],
    riskOrResearchGaps: ["Official campaign website/contact needed", "Candidate biography needs source lock", "Verify filing and election status"],
    topCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery", "Lorain", "Mahoning"],
    topCities: ["Columbus", "Cleveland", "Cincinnati", "Akron", "Toledo", "Dayton", "Lorain", "Youngstown"],
    zipClusters: ["43215/43219", "44113/44120", "45202/45219", "44308/44320", "43604/43608"],
    routeClusters: ["Urban legal-accountability routes", "Suburban civic-trust routes", "County-seat office-awareness routes"],
    mediaMarkets: ["Columbus", "Cleveland-Akron", "Cincinnati", "Toledo", "Dayton"],
    messagePillars: ["Accountability", "Consumer protection", "Civic trust", "Legal experience"],
    creativeTone: "Credible, measured, public-interest, and proof-seeking.",
    sources: [{ label: "Ohio Secretary of State candidate records", url: "https://www.ohiosos.gov/elections/", sourceType: "election" }, ...COMMON_SOURCES],
  },
  {
    id: "allison-russo",
    candidateName: "Allison Russo",
    shortName: "Russo",
    office: "Secretary of State",
    state: "Ohio",
    partyOrCommittee: "Democrat",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide civic administration race with voting access, civic participation, public trust, and competent administration themes. Verify current campaign language.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-blue-700 to-indigo-950",
    accentClass: "text-blue-100",
    biographyBullets: ["Ohio legislative/public-service profile.", "Secretary of State messaging should stay civic, administrative, and source-backed.", "Confirm campaign site, committee, and official priorities."],
    publicPriorities: ["Civic participation", "Election administration", "Public trust", "Community representation"],
    strengths: ["Civic-trust message fit", "Suburban and urban education-heavy mail fit", "Secretary-of-State-specific explainer potential"],
    riskOrResearchGaps: ["Verify official statewide campaign site", "Confirm exact ballot status", "Attach source-backed biography"],
    topCounties: ["Franklin", "Cuyahoga", "Hamilton", "Delaware", "Summit", "Lucas", "Montgomery", "Athens"],
    topCities: ["Columbus", "Cleveland", "Cincinnati", "Delaware", "Akron", "Toledo", "Dayton", "Athens"],
    zipClusters: ["43210/43214", "44106/44118", "45208/45220", "43015/43065", "45701/45780"],
    routeClusters: ["Civic participation routes", "College-community routes", "Suburban trust-building routes"],
    mediaMarkets: ["Columbus", "Cleveland-Akron", "Cincinnati", "Toledo", "Dayton"],
    messagePillars: ["Civic trust", "Voting access", "Competent administration", "Community voice"],
    creativeTone: "Clear, civic, trustworthy, and participation-focused.",
    sources: [{ label: "Allison Russo public/campaign site", url: "https://www.allisonrusso.com/", sourceType: "campaign" }, ...COMMON_SOURCES],
  },
  {
    id: "robert-sprague",
    candidateName: "Robert Sprague",
    shortName: "Sprague",
    office: "Secretary of State",
    state: "Ohio",
    partyOrCommittee: "Republican",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide administrative profile with fiscal stewardship, election administration trust, and conservative statewide continuity themes. Verify campaign copy before use.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-red-700 to-slate-950",
    accentClass: "text-red-100",
    biographyBullets: ["Statewide public-office profile.", "Treasury/fiscal stewardship background is a likely source-backed lane.", "Secretary of State copy must be campaign-approved."],
    publicPriorities: ["Election administration trust", "Fiscal stewardship", "Security", "Responsible government"],
    strengths: ["Statewide officeholder familiarity", "Administrative trust message fit", "Rural and suburban route efficiency"],
    riskOrResearchGaps: ["Confirm current Secretary of State campaign status", "Verify official site and issue wording", "Attach final USPS route counts"],
    topCounties: ["Hancock", "Allen", "Warren", "Delaware", "Butler", "Clermont", "Medina", "Lake"],
    topCities: ["Findlay", "Lima", "Mason", "Delaware", "West Chester", "Batavia", "Medina", "Mentor"],
    zipClusters: ["45840/45801", "45040/45069", "43015/43065", "45103/45150", "44060/44256"],
    routeClusters: ["Rural administration-trust routes", "Suburban conservative-retention routes", "County-seat civic routes"],
    mediaMarkets: ["Toledo", "Columbus", "Cincinnati", "Cleveland-Akron", "Dayton"],
    messagePillars: ["Trust", "Security", "Fiscal stewardship", "Election administration"],
    creativeTone: "Competent, secure, steady, and administrative.",
    sources: [{ label: "Robert Sprague public/campaign site", url: "https://www.spragueforohio.com/", sourceType: "campaign" }, ...COMMON_SOURCES],
  },
  {
    id: "ohio-democratic-party",
    candidateName: "Ohio Democratic Party",
    shortName: "Ohio Dems",
    office: "Coordinated Campaign / Party Mail Programs",
    state: "Ohio",
    partyOrCommittee: "Democratic Party",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide coordinated mail program profile for candidate slate reinforcement, ballot-window education, and campaign-provided coalition messaging.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-blue-800 to-slate-950",
    accentClass: "text-blue-100",
    biographyBullets: ["Party organization profile, not a candidate biography.", "Mail should separate slate, issue, and turnout logistics by approved program.", "All claims and candidate references require campaign/party approval."],
    publicPriorities: ["Coordinated slate visibility", "Urban turnout logistics", "Suburban persuasion mail", "Ballot-window education"],
    strengths: ["Can coordinate multiple races", "High-volume route efficiency", "Strong county and media-market planning fit"],
    riskOrResearchGaps: ["Confirm party-approved slate", "Load candidate disclaimers", "Attach coordinated expenditure/legal review"],
    topCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery", "Lorain", "Mahoning"],
    topCities: ["Columbus", "Cleveland", "Cincinnati", "Akron", "Toledo", "Dayton", "Lorain", "Youngstown"],
    zipClusters: ["43215/43219", "44113/44120", "45202/45219", "44308/44320", "43604/43608"],
    routeClusters: ["Urban turnout logistics routes", "Suburban slate-reinforcement routes", "High-density media-market corridors"],
    mediaMarkets: ["Columbus", "Cleveland-Akron", "Cincinnati", "Toledo", "Dayton", "Youngstown"],
    messagePillars: ["Coordinated slate", "Affordability", "Rights and civic participation", "Ballot-window clarity"],
    creativeTone: "Coordinated, clear, coalition-aware, and deadline-focused.",
    sources: [{ label: "Ohio Democratic Party", url: "https://ohiodems.org/", sourceType: "party" }, ...COMMON_SOURCES],
  },
  {
    id: "ohio-republican-party",
    candidateName: "Ohio Republican Party",
    shortName: "Ohio GOP",
    office: "Coordinated Campaign / Party Mail Programs",
    state: "Ohio",
    partyOrCommittee: "Republican Party",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide coordinated mail program profile for Republican slate visibility, rural/exurban route density, and ballot-window execution.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-red-800 to-slate-950",
    accentClass: "text-red-100",
    biographyBullets: ["Party organization profile, not a candidate biography.", "Mail should organize slate, county, and ballot-window programs separately.", "Claims and candidate references require party/campaign approval."],
    publicPriorities: ["Coordinated slate visibility", "Rural route efficiency", "Exurban growth corridors", "Election reminder logistics"],
    strengths: ["Route density in rural/exurban counties", "Strong slate program fit", "Efficient county-seat coverage"],
    riskOrResearchGaps: ["Confirm party-approved slate", "Load disclaimers and legal review", "Attach USPS route counts"],
    topCounties: ["Warren", "Butler", "Delaware", "Clermont", "Medina", "Hancock", "Allen", "Miami"],
    topCities: ["Mason", "West Chester", "Delaware", "Batavia", "Medina", "Findlay", "Lima", "Troy"],
    zipClusters: ["45040/45069", "43015/43065", "45103/45150", "44256/45840", "45373/45801"],
    routeClusters: ["Rural route-density corridors", "Exurban growth routes", "County-seat slate routes"],
    mediaMarkets: ["Cincinnati", "Columbus", "Cleveland-Akron", "Toledo", "Dayton"],
    messagePillars: ["Coordinated slate", "Economy", "Public safety", "Election reminder clarity"],
    creativeTone: "Strong, direct, slate-focused, and logistics-ready.",
    sources: [{ label: "Ohio Republican Party", url: "https://ohiogop.org/", sourceType: "party" }, ...COMMON_SOURCES],
  },
  {
    id: "amy-acton",
    candidateName: "Dr. Amy Acton",
    shortName: "Acton",
    office: "Governor of Ohio",
    state: "Ohio",
    partyOrCommittee: "Democrat",
    runningMate: "David Pepper",
    electionDate: "2026-11-03",
    publicCampaignFrame: "Statewide executive campaign with public-service, doctor, affordability, health care, and Ohio-family themes visible on the campaign site.",
    complianceMode: COMPLIANCE_MODE,
    colorClass: "from-blue-800 to-red-950",
    accentClass: "text-blue-100",
    biographyBullets: ["Doctor and public-health leader.", "Official site frames the campaign around giving power back to Ohioans.", "Affordability and families are source-backed campaign themes."],
    publicPriorities: ["Affordability", "Health care", "Public service", "Community-centered leadership"],
    strengths: ["Human story mail fit", "Health care credibility", "Suburban trust-building opportunity"],
    riskOrResearchGaps: ["Verify current endorsements", "Attach official contact", "Replace estimated route counts with USPS data"],
    topCounties: ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Lucas", "Montgomery", "Delaware", "Lorain"],
    topCities: ["Columbus", "Cleveland", "Cincinnati", "Akron", "Toledo", "Dayton", "Delaware", "Lorain"],
    zipClusters: ["43210/43214", "44106/44118", "45208/45220", "44308/44320", "43604/43608"],
    routeClusters: ["Suburban trust-building routes", "Urban turnout logistics routes", "Health-care message corridors"],
    mediaMarkets: ["Columbus", "Cleveland-Akron", "Cincinnati", "Toledo", "Dayton"],
    messagePillars: ["Health care", "Affordability", "Public service", "Ohio families"],
    creativeTone: "Empathetic, human, steady, and family-centered.",
    sources: [
      { label: "Dr. Amy Acton for Governor campaign site", url: "https://actonforgovernor.com/", sourceType: "campaign" },
      { label: "Acton affordability agenda", url: "https://actonforgovernor.com/issue/acton-lowering-costs-affordability-agenda/", sourceType: "campaign" },
      ...COMMON_SOURCES,
    ],
  },
];

const STRATEGY_SEEDS = [
  {
    id: "statewide-foundation",
    title: "Statewide Name-ID Foundation",
    theme: "Introduce, repeat, and make the campaign easy to understand.",
    overview: "A broad multi-wave program built around statewide identity, campaign-approved priorities, and repeated in-home visibility across major Ohio media markets.",
    audience: "Aggregate households in major counties, county seats, and high-density delivery routes.",
    drops: 5,
    householdsFactor: 1,
    confidence: 84,
  },
  {
    id: "metro-corridor",
    title: "Metro and County-Seat Corridor",
    theme: "Concentrate mail where delivery density and media-market overlap are strongest.",
    overview: "A route-efficient plan that starts in Ohio's largest metros, then expands through county seats and nearby suburban clusters.",
    audience: "Aggregate households in dense metro, county-seat, and first-ring route clusters.",
    drops: 4,
    householdsFactor: 0.64,
    confidence: 82,
  },
  {
    id: "suburban-rural-balance",
    title: "Suburban/Rural Balance",
    theme: "Use separate creative lanes for suburban, exurban, and rural trust-building routes.",
    overview: "A balanced plan that prevents the campaign from looking city-only or rural-only while preserving route efficiency.",
    audience: "Aggregate households across suburban belts, exurban growth corridors, and practical rural carrier routes.",
    drops: 4,
    householdsFactor: 0.48,
    confidence: 78,
  },
  {
    id: "ballot-window-accelerator",
    title: "Ballot-Window Accelerator",
    theme: "Compress the mail arc around absentee, early vote, and final election reminder windows.",
    overview: "A late-cycle plan for campaigns that need speed, clean deadlines, and a shorter proof-to-mail path.",
    audience: "Aggregate households in deadline-sensitive route clusters with high production feasibility.",
    drops: 3,
    householdsFactor: 0.38,
    confidence: 80,
  },
] as const;

function districtTypeForOffice(office: string): "local" | "state" | "federal" {
  return office.includes("U.S. Senate") ? "federal" : "state";
}

function baseHouseholdsFor(profile: CandidateCampaignProfile): number {
  if (profile.office.includes("Party")) return 1_500_000;
  if (profile.office.includes("U.S. Senate")) return 1_100_000;
  if (profile.office.includes("Governor")) return 1_250_000;
  return 740_000;
}

function moneyRange(volume: number, drops = 1): [number, number] {
  const pieces = Math.max(2_500, volume * drops);
  const low = pieces * resolvePoliticalPostcardPriceCents("state", pieces);
  return [low, Math.round(low * 1.18)];
}

function buildPostcardConcept(
  profile: CandidateCampaignProfile,
  strategyId: string,
  phaseKey: string,
  phaseObjective: string,
  category: CreativeCategory,
): PostcardConcept {
  const pillar = profile.messagePillars[Math.abs(phaseKey.length + category.length) % profile.messagePillars.length] ?? "Ohio communities";
  const geography = profile.topCounties.slice(0, 3).join(", ");
  const officeLabel = profile.office.includes("Party") ? "Ohio campaign program" : profile.office;
  const title = `${profile.shortName} ${phaseKey.replaceAll("-", " ")} - ${category}`;

  const copyByCategory: Record<CreativeCategory, { headline: string; subheadline: string; body: string; back: string; cta: string; imagery: string }> = {
    "Emotional/Human": {
      headline: `${profile.shortName}: ${pillar} for Ohio families`,
      subheadline: "A mail piece built around trust, public identity, and local Ohio context.",
      body: `${profile.candidateName} needs a human, locally grounded introduction that voters can understand quickly at the mailbox.`,
      back: `This concept uses a warm story arc, one clear proof point, and a simple next step. Final biography and quotes must come from campaign-approved source material.`,
      cta: "Learn the story and make your plan to vote.",
      imagery: "Candidate portrait or community scene with Ohio neighborhood context.",
    },
    "Policy/Issue Focused": {
      headline: `${pillar} deserves a serious Ohio plan`,
      subheadline: `A focused ${officeLabel} issue postcard with clean proof points.`,
      body: `Lead with the campaign-approved ${pillar.toLowerCase()} message, then connect it to household-level concerns without making individual voter predictions.`,
      back: `Use three concise bullets, a QR code to the approved issue page, and a county-specific line for ${geography}.`,
      cta: "Read the plan before Election Day.",
      imagery: "Ohio workers, small business corridor, classroom, clinic, courthouse, or main-street scene depending on approved issue.",
    },
    "Testimonial/Social Proof": {
      headline: `Ohioans are looking for leadership they can trust`,
      subheadline: "Social proof space reserved for campaign-approved validators only.",
      body: `This version gives staff a clean quote slot, county validator slot, and endorsement/legal review path. No testimonial is invented here.`,
      back: `Add approved quote, validator attribution, and source date. Keep the rest of the card centered on public record, geography, and timing.`,
      cta: "See why Ohio leaders are paying attention.",
      imagery: "Validator photo, community event, union hall, local business, or campaign-approved coalition image.",
    },
    "Contrast/Urgency": {
      headline: `Ohio has a clear choice this year`,
      subheadline: "A factual contrast card designed for legal review before release.",
      body: `Frame the stakes around ${pillar.toLowerCase()}, timing, and public record. Avoid unsourced attacks, personal claims, or deceptive content.`,
      back: `Use a side-by-side issue contrast only after staff supplies source citations. Add ballot-window dates and QR to campaign-approved facts.`,
      cta: "Compare the choice and vote by the deadline.",
      imagery: "Split-color Ohio map, mailbox deadline visual, or campaign-approved contrast photography.",
    },
  };

  const copy = copyByCategory[category];
  return {
    id: `${profile.id}-${strategyId}-${phaseKey}-${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    candidateId: profile.id,
    strategyId,
    phaseKey,
    category,
    title,
    headline: copy.headline,
    subheadline: copy.subheadline,
    frontBody: copy.body,
    backBody: copy.back,
    cta: copy.cta,
    suggestedImagery: copy.imagery,
    visualDirection: `${profile.creativeTone} Full-bleed Ohio visual, bold headline, restrained patriotic palette, and clear hierarchy.`,
    colorStyle: `Campaign-safe palette using ${profile.partyOrCommittee.includes("Republican") ? "red, navy, white, and slate" : profile.partyOrCommittee.includes("Democrat") ? "blue, navy, white, and soft red" : "navy, white, red, and neutral gray"}.`,
    audienceFit: `Aggregate ${profile.office} mail audience; campaign-provided audience notes may be layered after legal review.`,
    geographicFit: `${geography}; route clusters: ${profile.routeClusters.slice(0, 2).join(", ")}.`,
    emotionalStrategy: category === "Emotional/Human" ? "Humanize the public profile and reduce friction." : `Support the ${pillar} message with a simple mailbox story.`,
    persuasionIntent: "Campaign-approved message reinforcement at aggregate geography level only; no individual persuasion scoring.",
    turnoutIntent: "Election timing and voting-plan reminder at aggregate geography level only; no turnout suppression or individual behavior prediction.",
    complianceDisclaimer: "Paid for by [COMMITTEE NAME]. Not authorized by any candidate or candidate committee unless applicable. Final disclaimer required before print.",
    editableCopyZones: ["Headline", "Subheadline", "Front body", "Back body", "Proof bullets", "Disclaimer"],
    editableCtaZone: "CTA and QR/landing page label",
    editableImageZone: "Hero image, validator image, Ohio/map image, and iconography",
    internalStrategyNotes: `${phaseObjective} Keep all facts source-backed and mark route counts as estimates until USPS data is loaded.`,
    staffCommentPrompt: "Leave a revision note such as: make this more local, more urgent, more positive, or more focused on working families.",
  };
}

function buildPhases(profile: CandidateCampaignProfile, strategyId: string, households: number): CandidateCampaignPhase[] {
  return PHASE_BLUEPRINTS.map((blueprint, index) => {
    const phaseHouseholds = Math.max(2_500, Math.round(households * (index < 3 ? 0.22 : 0.16)));
    const routeStart = index % Math.max(1, profile.routeClusters.length);
    const recommendedRoutes = [
      profile.routeClusters[routeStart] ?? "Route cluster pending USPS data",
      profile.zipClusters[index % profile.zipClusters.length] ?? "ZIP cluster pending",
      profile.mediaMarkets[index % profile.mediaMarkets.length] ?? "Media market pending",
    ];

    return {
      phaseNumber: index + 1,
      phaseKey: blueprint.key,
      objective: blueprint.objective,
      targetAudience: "Aggregate household/mail-route audience, with campaign-provided segments only after legal review.",
      targetGeography: `${profile.topCounties.slice(index % 3, index % 3 + 3).join(", ")} plus ${profile.topCities[index % profile.topCities.length] ?? profile.state} route clusters`,
      recommendedRoutes,
      emotionalTone: index < 2 ? profile.creativeTone : index === 4 ? "Clear, factual, source-backed, and urgent." : "Direct, deadline-aware, and easy to act on.",
      cta: index === 5 ? "Make your voting plan before Election Day." : "Scan to learn more from the campaign.",
      mailQuantity: phaseHouseholds,
      timing: blueprint.timing,
      issueFocus: profile.messagePillars[index % profile.messagePillars.length] ?? "Campaign-approved priority",
      expectedOutcome: "Increase campaign message repetition and operational visibility in selected aggregate geographies.",
      postcardConcepts: CREATIVE_CATEGORIES.map((category) =>
        buildPostcardConcept(profile, strategyId, blueprint.key, blueprint.objective, category),
      ),
    };
  });
}

function buildStrategies(profile: CandidateCampaignProfile): CandidateCampaignStrategy[] {
  const baseHouseholds = baseHouseholdsFor(profile);

  return STRATEGY_SEEDS.map((seed) => {
    const households = Math.max(2_500, Math.round(baseHouseholds * seed.householdsFactor));
    const totalPieces = households * seed.drops;
    const pricePerPostcardCents = resolvePoliticalPostcardPriceCents(districtTypeForOffice(profile.office), totalPieces);
    const estimatedTotalCents = totalPieces * pricePerPostcardCents;
    const estimatedReach = Math.round(households * ESTIMATED_REACH_PER_HOUSEHOLD);

    return {
      id: seed.id,
      candidateId: profile.id,
      title: seed.title,
      campaignTheme: seed.theme,
      strategyOverview: `${seed.overview} Tailored to ${profile.candidateName} with ${profile.messagePillars.slice(0, 3).join(", ")} creative lanes.`,
      aggregateAudience: seed.audience,
      targetGeographies: [...profile.topCounties.slice(0, 6), ...profile.mediaMarkets.slice(0, 2)],
      emotionalPositioning: profile.creativeTone,
      persuasionGoal: "Reinforce campaign-approved messages in aggregate geographies; no individual voter persuasion scores are created.",
      turnoutGoal: "Provide election deadline and voting-plan reminders at aggregate geography level only.",
      messagingHierarchy: profile.messagePillars,
      issueHierarchy: profile.publicPriorities,
      timingCadence: `${seed.drops} drops across the campaign calendar with USPS and artwork approvals verified before quote lock.`,
      budgetAssumptions: `${households.toLocaleString()} households per major wave, ${seed.drops} drops, price capped at $0.70 per postcard by HomeReach pricing guardrail.`,
      rolloutStrategy: `Start with ${profile.topCounties.slice(0, 4).join(", ")}, then expand into ${profile.mediaMarkets.slice(0, 3).join(", ")} media-market route clusters.`,
      phaseSequencing: PHASE_BLUEPRINTS.map((phase) => phase.key).join(" -> "),
      recommendedCountiesRoutes: [...profile.topCounties.slice(0, 5), ...profile.routeClusters.slice(0, 3)],
      mailQuantityAssumptions: "Mail quantities are planning estimates until USPS EDDM/carrier-route counts are imported and timestamped.",
      expectedOutcome: "Campaign staff can compare message lanes, route clusters, estimated pieces, budget range, and creative direction before human approval.",
      drops: seed.drops,
      households,
      estimatedReach,
      pricePerPostcardCents,
      totalPieces,
      estimatedTotalCents,
      costPerReachCents: Math.round(estimatedTotalCents / Math.max(1, estimatedReach)),
      confidenceScore: seed.confidence,
      phases: buildPhases(profile, seed.id, households),
    };
  });
}

function buildGeoRecommendations(profile: CandidateCampaignProfile): GeoRecommendation[] {
  const raw = [
    ...profile.topCounties.slice(0, 4).map((label) => ({ label, type: "county" as const })),
    ...profile.topCities.slice(0, 3).map((label) => ({ label, type: "city" as const })),
    ...profile.zipClusters.slice(0, 2).map((label) => ({ label, type: "zip_cluster" as const })),
    ...profile.routeClusters.slice(0, 3).map((label) => ({ label, type: "route_cluster" as const })),
    ...profile.mediaMarkets.slice(0, 2).map((label) => ({ label, type: "media_market" as const })),
  ];

  return raw.map((item, index) => {
    const estimatedMailVolume = 18_000 + index * 7_500;
    return {
      label: item.label,
      type: item.type,
      objective: index % 3 === 0 ? "Message foundation" : index % 3 === 1 ? "Route-efficient repetition" : "Ballot-window reinforcement",
      rationale: `${item.label} fits ${profile.shortName}'s ${profile.messagePillars[index % profile.messagePillars.length] ?? "campaign"} lane and gives operators a concrete aggregate geography to verify against USPS counts.`,
      messageFit: profile.messagePillars[index % profile.messagePillars.length] ?? "Campaign-approved issue",
      postcardStyle: CREATIVE_CATEGORIES[index % CREATIVE_CATEGORIES.length]!,
      phaseFit: PHASE_BLUEPRINTS[index % PHASE_BLUEPRINTS.length]!.key,
      operationalComplexity: index % 4 === 0 ? "medium" : "low",
      estimatedMailVolume,
      budgetRangeCents: moneyRange(estimatedMailVolume),
      mailEfficiencyScore: Math.min(96, 72 + index * 2),
      routeDensityScore: Math.min(94, 68 + index * 3),
      dataStatus: "needs_usps",
    };
  });
}

export const MULTI_CANDIDATE_CAMPAIGN_AGENTS: CandidateCampaignAgent[] = PROFILES.map((profile) => ({
  profile,
  geographicRecommendations: buildGeoRecommendations(profile),
  strategies: buildStrategies(profile),
}));

export const AMY_ACTON_CAMPAIGN_PROFILE = MULTI_CANDIDATE_CAMPAIGN_AGENTS.find(
  (agent) => agent.profile.id === "amy-acton",
)!.profile;

export const AMY_ACTON_CAMPAIGN_RECOMMENDATIONS: CandidateCampaignRecommendation[] =
  MULTI_CANDIDATE_CAMPAIGN_AGENTS.find((agent) => agent.profile.id === "amy-acton")!.strategies.map((strategy) => ({
    id: strategy.id,
    title: strategy.title,
    planType: strategy.campaignTheme,
    summary: strategy.strategyOverview,
    candidateFit: strategy.emotionalPositioning,
    cities: AMY_ACTON_CAMPAIGN_PROFILE.topCities.slice(0, 10),
    geographyRationale: strategy.rolloutStrategy,
    drops: strategy.drops,
    households: strategy.households,
    estimatedVoterReach: strategy.estimatedReach,
    pricePerPostcardCents: strategy.pricePerPostcardCents,
    totalPieces: strategy.totalPieces,
    estimatedTotalCents: strategy.estimatedTotalCents,
    costPerVoterCents: strategy.costPerReachCents,
    phaseCadence: strategy.phases.map((phase) => `${phase.timing}: ${phase.objective}`),
    nextAction: "Validate USPS route counts and move selected draft to admin review.",
    confidenceScore: strategy.confidenceScore,
  }));

export function summarizeAmyActonRecommendations() {
  return summarizeCandidateAgent("amy-acton");
}

export function summarizeCandidateAgent(candidateId: CandidateTargetId) {
  const agent = getCandidateCampaignAgent(candidateId);
  const households = agent.strategies.reduce((sum, plan) => sum + plan.households, 0);
  const estimatedReach = agent.strategies.reduce((sum, plan) => sum + plan.estimatedReach, 0);
  const investmentCents = agent.strategies.reduce((sum, plan) => sum + plan.estimatedTotalCents, 0);

  return {
    plans: agent.strategies.length,
    households,
    estimatedReach,
    estimatedVoterReach: estimatedReach,
    investmentCents,
  };
}

export function getCandidateCampaignAgent(candidateId: CandidateTargetId): CandidateCampaignAgent {
  return MULTI_CANDIDATE_CAMPAIGN_AGENTS.find((agent) => agent.profile.id === candidateId) ?? MULTI_CANDIDATE_CAMPAIGN_AGENTS[0]!;
}

export function getDefaultCandidateId(): CandidateTargetId {
  return "vivek-ramaswamy";
}
