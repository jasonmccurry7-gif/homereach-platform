export type AuthorityTopicKind =
  | "shared_postcards"
  | "targeted_campaigns"
  | "political"
  | "procurement"
  | "government_contracts"
  | "local_marketing"
  | "web_chatbot";

export type AuthorityVisualKind = "coverage_map" | "postcard_mockup" | "political_mail" | "dashboard" | "proposal";

export type OhioAuthorityCity = {
  slug: string;
  name: string;
  region: string;
  county: string;
  marketPositioning: string;
  localAnchors: string[];
  neighborhoodSignals: string[];
  businessUseCases: string[];
  campaignExample: string;
};

export type SeoAuthorityTopic = {
  slug: string;
  label: string;
  shortLabel: string;
  kind: AuthorityTopicKind;
  serviceName: string;
  buyerIntent: "high" | "medium";
  primaryKeyword: string;
  supportingKeywords: string[];
  headline: string;
  summary: string;
  operatingDepth: string;
  proofAngle: string;
  ctaLabel: string;
  ctaHref: string;
  visualKind: AuthorityVisualKind;
  examples: string[];
  faqs: Array<{ question: string; answer: string }>;
};

export type SeoVisualAsset = {
  assetSlug: string;
  title: string;
  alt: string;
  caption: string;
  kind: AuthorityVisualKind;
  path: string;
  palette: "blue" | "red" | "green" | "slate" | "amber";
  primaryLabel: string;
  secondaryLabel: string;
};

export type OhioAuthorityPage = {
  path: string;
  city: OhioAuthorityCity;
  topic: SeoAuthorityTopic | null;
  pageType: "city" | "city_topic";
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  intro: string;
  strategy: string[];
  proofPoints: string[];
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ label: string; href: string }>;
  visual: SeoVisualAsset;
};

export type AuthorityGuide = {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  audience: string;
  summary: string;
  sections: Array<{ heading: string; body: string }>;
  checklist: string[];
  faqs: Array<{ question: string; answer: string }>;
  ctaLabel: string;
  ctaHref: string;
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type OhioAuthorityCounty = {
  slug: string;
  name: string;
  region: string;
  seat: string;
  anchors: string[];
  directMailAngle: string;
  politicalAngle: string;
  businessAngle: string;
  campaignSignals: string[];
};

export type CountyAuthorityPage = {
  path: string;
  county: OhioAuthorityCounty;
  topic: SeoAuthorityTopic | null;
  pageType: "county" | "county_topic";
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  intro: string;
  strategy: string[];
  proofPoints: string[];
  faqs: Array<{ question: string; answer: string }>;
  internalLinks: Array<{ label: string; href: string }>;
  visual: SeoVisualAsset;
};

export type PoliticalAuthorityPage = {
  slug: string;
  path: string;
  pageType: "statewide" | "county" | "office" | "campaign_type" | "postcard_strategy";
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  eyebrow: string;
  audience: string;
  summary: string;
  strategy: string[];
  proofPoints: string[];
  faqs: Array<{ question: string; answer: string }>;
  ctaLabel: string;
  ctaHref: string;
  internalLinks: Array<{ label: string; href: string }>;
  visual: SeoVisualAsset;
};

export type SeoCaseStudy = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  market: string;
  category: string;
  resultSignal: string;
  summary: string;
  rollout: string[];
  strategy: string[];
  proofPoints: string[];
  ctaLabel: string;
  ctaHref: string;
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type InteractiveSeoTool = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  summary: string;
  calculatorType:
    | "postcard_roi"
    | "household_reach"
    | "political_mail"
    | "coverage"
    | "procurement_savings"
    | "saturation";
  inputs: Array<{ key: string; label: string; defaultValue: number; suffix?: string }>;
  outputLabel: string;
  guidance: string[];
  ctaLabel: string;
  ctaHref: string;
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type AuthorityInsight = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  summary: string;
  signals: string[];
  recommendations: string[];
  faqs: Array<{ question: string; answer: string }>;
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type VisualGallery = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  summary: string;
  categories: string[];
  locations: string[];
  items: Array<{
    title: string;
    category: string;
    location: string;
    description: string;
    tags: string[];
    visual: SeoVisualAsset;
  }>;
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type AuthorityDataset = {
  slug: string;
  path: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  summary: string;
  metrics: Array<{ label: string; value: string; note: string }>;
  methodology: string[];
  useCases: string[];
  visual: SeoVisualAsset;
  internalLinks: Array<{ label: string; href: string }>;
};

export type SeoKeywordTarget = {
  keyword: string;
  cluster: string;
  intent: "transactional" | "commercial" | "informational" | "local" | "political";
  priority: "critical" | "high" | "medium";
  targetPath: string;
  opportunity: string;
  nextAction: string;
};

export const ohioAuthorityCities: OhioAuthorityCity[] = [
  {
    slug: "columbus",
    name: "Columbus",
    region: "Central Ohio",
    county: "Franklin County",
    marketPositioning:
      "Columbus rewards campaigns that can move across dense neighborhoods, suburban growth corridors, campus-adjacent renters, and owner-occupied pockets without treating the whole metro the same.",
    localAnchors: ["Short North", "German Village", "Clintonville", "Dublin", "Westerville", "Grove City"],
    neighborhoodSignals: ["mixed-density routes", "fast-growth suburbs", "professional households", "campus spillover"],
    businessUseCases: ["roof replacement season", "HVAC tuneups", "real estate farming", "issue campaign turnout"],
    campaignExample:
      "A Columbus campaign can pair shared postcard visibility in one suburb with targeted route drops around higher-value homeowner corridors.",
  },
  {
    slug: "akron",
    name: "Akron",
    region: "Northeast Ohio",
    county: "Summit County",
    marketPositioning:
      "Akron is a strong fit for route-aware direct mail because neighborhoods, suburbs, and older housing stock create practical pockets for local service demand.",
    localAnchors: ["Highland Square", "Firestone Park", "Wallhaven", "Fairlawn", "Cuyahoga Falls", "Green"],
    neighborhoodSignals: ["older housing stock", "suburban service zones", "homeowner-heavy pockets", "countywide civic campaigns"],
    businessUseCases: ["roofing", "HVAC", "lawn care", "school levies"],
    campaignExample:
      "An Akron plan can focus on homeowner routes around Fairlawn and Green while using authority content to support Summit County political or levy outreach.",
  },
  {
    slug: "cincinnati",
    name: "Cincinnati",
    region: "Southwest Ohio",
    county: "Hamilton County",
    marketPositioning:
      "Cincinnati campaigns need creative and geographic control because dense city routes, river communities, and northern suburbs often require different offers.",
    localAnchors: ["Hyde Park", "Oakley", "Westwood", "Anderson Township", "Blue Ash", "Mason"],
    neighborhoodSignals: ["river-adjacent routes", "suburban family zones", "high-competition service categories", "regional campaign overlap"],
    businessUseCases: ["realtor farming", "direct mail marketing", "political mail", "home services"],
    campaignExample:
      "A Cincinnati route plan can separate persuasion mail in city neighborhoods from higher-ticket service offers in northern suburbs.",
  },
  {
    slug: "cleveland",
    name: "Cleveland",
    region: "Northeast Ohio",
    county: "Cuyahoga County",
    marketPositioning:
      "Cleveland rewards campaigns that can separate city, inner-ring suburb, and lakefront audiences while keeping creative clear and credible.",
    localAnchors: ["Lakewood", "Ohio City", "Tremont", "Shaker Heights", "Parma", "Strongsville"],
    neighborhoodSignals: ["inner-ring suburbs", "dense civic media markets", "older homes", "high local brand competition"],
    businessUseCases: ["judicial campaign mail", "home improvement postcards", "GOTV mail", "local business visibility"],
    campaignExample:
      "A Cleveland mail plan can use premium creative for trust-building in older-home neighborhoods and cleaner GOTV messaging for campaign deadlines.",
  },
  {
    slug: "dayton",
    name: "Dayton",
    region: "Western Ohio",
    county: "Montgomery County",
    marketPositioning:
      "Dayton campaigns benefit from clear radius planning across city routes, military-adjacent communities, and suburbs with strong service business demand.",
    localAnchors: ["Kettering", "Beavercreek", "Centerville", "Oakwood", "Huber Heights", "Miamisburg"],
    neighborhoodSignals: ["suburban family routes", "military-adjacent households", "older neighborhood pockets", "regional issue campaigns"],
    businessUseCases: ["HVAC postcards", "lawn care advertising", "campaign postcards", "procurement savings"],
    campaignExample:
      "A Dayton strategy can combine targeted neighborhood drops in Kettering and Centerville with a simple proposal package for recurring campaigns.",
  },
  {
    slug: "toledo",
    name: "Toledo",
    region: "Northwest Ohio",
    county: "Lucas County",
    marketPositioning:
      "Toledo is a practical market for direct mail because neighborhood identity, county routes, and suburban service areas are easy to translate into campaign plans.",
    localAnchors: ["Old West End", "Ottawa Hills", "Sylvania", "Maumee", "Perrysburg", "Point Place"],
    neighborhoodSignals: ["countywide route coverage", "suburban service demand", "lake-region communities", "labor and issue campaign audiences"],
    businessUseCases: ["shared postcards", "political direct mail", "contractor advertising", "government contract support"],
    campaignExample:
      "A Toledo plan can use shared postcard authority for local businesses and separate county-level campaign mail for political or issue outreach.",
  },
];

export const seoAuthorityTopics: SeoAuthorityTopic[] = [
  {
    slug: "shared-postcards",
    label: "Shared Postcard Advertising",
    shortLabel: "Shared postcards",
    kind: "shared_postcards",
    serviceName: "Shared postcard advertising",
    buyerIntent: "high",
    primaryKeyword: "shared postcard advertising Ohio",
    supportingKeywords: ["local postcard advertising", "shared mailer", "postcard advertising for small business"],
    headline: "Category-exclusive postcard visibility without carrying the whole mail cost.",
    summary:
      "Shared postcards work when the offer is simple, the market is defined, and each advertiser understands the audience they are buying into.",
    operatingDepth:
      "HomeReach keeps the customer-facing promise simple while the admin system tracks city/category availability, proof status, billing, print timing, and renewal opportunity.",
    proofAngle: "A premium shared mailer shows local businesses the exact neighborhood visibility they are buying before they commit.",
    ctaLabel: "Reserve My Spot",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
    examples: ["home services category exclusivity", "monthly homeowner awareness", "founding member city launches"],
    faqs: [
      {
        question: "What makes shared postcards different from a generic coupon mailer?",
        answer:
          "HomeReach frames shared postcards as local visibility with category separation, premium creative, and route-aware operations instead of a crowded discount sheet.",
      },
      {
        question: "Can a business upgrade from shared postcards later?",
        answer:
          "Yes. Shared postcard customers are natural candidates for targeted routes, proposal packages, website/chatbot services, and seasonal campaign waves.",
      },
    ],
  },
  {
    slug: "direct-mail-marketing",
    label: "Direct Mail Marketing",
    shortLabel: "Direct mail",
    kind: "local_marketing",
    serviceName: "Direct mail marketing",
    buyerIntent: "high",
    primaryKeyword: "direct mail marketing Ohio",
    supportingKeywords: ["local direct mail", "direct mail campaign strategy", "postcard marketing"],
    headline: "Direct mail that feels planned, not printed and hoped for.",
    summary:
      "A strong direct mail campaign connects geography, offer, timing, creative, and follow-up into one execution path.",
    operatingDepth:
      "HomeReach connects public proposal previews to admin-side route planning, proofing, print readiness, vendor assignment, and follow-up visibility.",
    proofAngle: "Maps, postcard mockups, and rollout timelines make direct mail easier to understand before a buyer pays.",
    ctaLabel: "Get My Campaign Plan",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
    examples: ["seasonal service launches", "neighborhood saturation", "new mover visibility"],
    faqs: [
      {
        question: "Is direct mail still useful for local businesses?",
        answer:
          "Yes, when it is tied to a clear audience, strong offer, credible creative, and a realistic follow-up path instead of a one-off postcard.",
      },
      {
        question: "How should a campaign choose where to mail?",
        answer:
          "Start with service area, household fit, route density, seasonality, and the offer. Then use maps to keep the plan understandable.",
      },
    ],
  },
  {
    slug: "targeted-neighborhood-campaigns",
    label: "Targeted Neighborhood Campaigns",
    shortLabel: "Targeted campaigns",
    kind: "targeted_campaigns",
    serviceName: "Targeted neighborhood campaigns",
    buyerIntent: "high",
    primaryKeyword: "targeted neighborhood direct mail",
    supportingKeywords: ["route based postcards", "neighborhood marketing", "USPS route targeting"],
    headline: "Reach the neighborhoods that actually match the campaign.",
    summary:
      "Targeted campaigns are best when route coverage, household count, campaign timing, and creative all support the same decision.",
    operatingDepth:
      "The HomeReach admin side preserves route operations, campaign status, proof approval, payment, print, mail scheduling, and delivery tracking.",
    proofAngle: "A route map makes the campaign feel concrete and reduces buyer uncertainty.",
    ctaLabel: "Build Targeted Campaign",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
    examples: ["homeowner route selection", "ZIP and neighborhood overlays", "multi-drop rollout plans"],
    faqs: [
      {
        question: "Is targeted mail better than mailing an entire city?",
        answer:
          "Often. Targeted mail can concentrate spend where household fit, geography, and timing are strongest.",
      },
      {
        question: "Can a targeted campaign include multiple drops?",
        answer:
          "Yes. Multi-drop campaigns are useful when the buying decision takes time or the campaign has a clear seasonal window.",
      },
    ],
  },
  {
    slug: "roofing-marketing",
    label: "Roofing Marketing",
    shortLabel: "Roofing",
    kind: "local_marketing",
    serviceName: "Roofing direct mail marketing",
    buyerIntent: "high",
    primaryKeyword: "roofing postcards Ohio",
    supportingKeywords: ["roofer advertising", "roofing direct mail", "roof replacement postcards"],
    headline: "Get remembered before the roof replacement search starts.",
    summary:
      "Roofing marketing works best when trust, timing, storm season, and high-value homeowner routes are planned together.",
    operatingDepth:
      "HomeReach can connect roofing postcard offers to route maps, proof visuals, seasonal follow-up, and upsell tracking for targeted campaigns.",
    proofAngle: "A roofing postcard should feel credible, local, and easy to act on - not like a generic flyer.",
    ctaLabel: "See Roofing Options",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
    examples: ["storm follow-up", "roof replacement season", "high-equity homeowner routes"],
    faqs: [
      {
        question: "What should a roofing postcard say?",
        answer:
          "The best roofing postcards usually combine trust signals, a simple inspection offer, local presence, and a clear phone or proposal CTA.",
      },
      {
        question: "Should roofers use shared or targeted postcards?",
        answer:
          "Shared postcards can build recurring awareness. Targeted campaigns are better for storm follow-up, high-value routes, and seasonal offers.",
      },
    ],
  },
  {
    slug: "hvac-postcards",
    label: "HVAC Postcards",
    shortLabel: "HVAC",
    kind: "local_marketing",
    serviceName: "HVAC postcard campaigns",
    buyerIntent: "high",
    primaryKeyword: "HVAC postcards Ohio",
    supportingKeywords: ["HVAC direct mail", "furnace tuneup postcards", "AC repair postcards"],
    headline: "Stay visible before the furnace or AC emergency.",
    summary:
      "HVAC postcards are strongest when seasonal timing, tuneup offers, and household geography are planned before demand spikes.",
    operatingDepth:
      "HomeReach can turn HVAC offers into shared postcard placements, targeted seasonal drops, and follow-up sequences that sales can track.",
    proofAngle: "A seasonal HVAC postcard gives buyers a simple reason to call before the emergency happens.",
    ctaLabel: "Plan HVAC Mail",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
    examples: ["spring AC tuneups", "fall furnace checks", "replacement financing awareness"],
    faqs: [
      {
        question: "When should HVAC companies mail postcards?",
        answer:
          "HVAC mail works well before seasonal peaks: spring for AC, late summer and fall for furnace checks, and anytime for replacement financing.",
      },
      {
        question: "What makes HVAC mail convert?",
        answer:
          "A clear seasonal offer, trust signals, service area clarity, and repeated visibility are more useful than a crowded design.",
      },
    ],
  },
  {
    slug: "realtor-postcards",
    label: "Realtor Postcards",
    shortLabel: "Realtors",
    kind: "local_marketing",
    serviceName: "Realtor postcard farming",
    buyerIntent: "medium",
    primaryKeyword: "realtor postcards Ohio",
    supportingKeywords: ["real estate farming postcards", "just listed postcards", "neighborhood realtor mail"],
    headline: "Own a neighborhood before the listing conversation starts.",
    summary:
      "Real estate postcards need repetition, neighborhood familiarity, and proof that the agent understands the local market.",
    operatingDepth:
      "HomeReach can package neighborhood farming, map visuals, proof cycles, and recurring drop schedules into a simple buyer-facing plan.",
    proofAngle: "A real estate mail package should look like a neighborhood strategy, not a one-off print order.",
    ctaLabel: "Map My Farm Area",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
    examples: ["just listed mail", "market update postcards", "seller lead farming"],
    faqs: [
      {
        question: "How often should realtors mail a farm area?",
        answer:
          "Most farming strategies need repetition. Monthly or seasonal waves are easier to remember than one isolated postcard.",
      },
      {
        question: "Can route maps help real estate farming?",
        answer:
          "Yes. Maps help define the exact household area and make the plan easier to evaluate before committing budget.",
      },
    ],
  },
  {
    slug: "lawn-care-advertising",
    label: "Lawn Care Advertising",
    shortLabel: "Lawn care",
    kind: "local_marketing",
    serviceName: "Lawn care postcard advertising",
    buyerIntent: "medium",
    primaryKeyword: "lawn care advertising Ohio",
    supportingKeywords: ["lawn care postcards", "landscaping direct mail", "spring lawn care marketing"],
    headline: "Win the route before spring demand fills up.",
    summary:
      "Lawn care advertising works when timing, neighborhoods, route density, and recurring service offers are tightly connected.",
    operatingDepth:
      "HomeReach can move lawn care prospects from public page interest to availability, proposal, proof, and recurring follow-up.",
    proofAngle: "A neighborhood map helps lawn care buyers see how direct mail can build route density instead of scattered jobs.",
    ctaLabel: "Check Lawn Care Availability",
    ctaHref: "/get-started",
    visualKind: "coverage_map",
    examples: ["spring cleanup", "weekly mowing routes", "landscape upgrade offers"],
    faqs: [
      {
        question: "Why use postcards for lawn care?",
        answer:
          "Lawn care is local and recurring. Postcards help concentrate attention in neighborhoods where route density matters.",
      },
      {
        question: "What should lawn care campaigns promote?",
        answer:
          "Spring cleanup, recurring mowing, landscape refreshes, and seasonal upgrades are all clear postcard angles.",
      },
    ],
  },
  {
    slug: "political-mail",
    label: "Political Direct Mail",
    shortLabel: "Political mail",
    kind: "political",
    serviceName: "Political direct mail",
    buyerIntent: "high",
    primaryKeyword: "political mail Ohio",
    supportingKeywords: ["Ohio campaign postcards", "political direct mail Ohio", "campaign mail strategy"],
    headline: "Campaign mail with strategy, geography, creative, and execution in one plan.",
    summary:
      "Political mail needs clear timing, credible creative, compliance awareness, geographic logic, and operational visibility.",
    operatingDepth:
      "The public side shows campaign capability. The admin side manages candidate records, maps, proposals, outreach, mockups, approvals, and fulfillment.",
    proofAngle: "Political postcard mockups and Ohio coverage maps make campaign execution feel real before a proposal is sent.",
    ctaLabel: "Build Campaign Plan",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
    examples: ["candidate introduction", "contrast mail", "GOTV mail"],
    faqs: [
      {
        question: "What makes political direct mail different from normal postcards?",
        answer:
          "Political mail has election timing, message discipline, compliance expectations, district geography, and rollout sequencing that ordinary postcard jobs do not.",
      },
      {
        question: "Can HomeReach support campaign proposals?",
        answer:
          "Yes. Political pages route into campaign planning while admin tools preserve maps, mockups, proposal packages, and approval workflows.",
      },
    ],
  },
  {
    slug: "campaign-postcards",
    label: "Campaign Postcards",
    shortLabel: "Campaign postcards",
    kind: "political",
    serviceName: "Campaign postcard execution",
    buyerIntent: "high",
    primaryKeyword: "campaign postcards Ohio",
    supportingKeywords: ["candidate postcards", "campaign mailers", "political postcard design"],
    headline: "Postcards that fit the campaign phase, not just the print size.",
    summary:
      "Campaign postcards should match whether the goal is introduction, persuasion, endorsement, turnout, absentee, or final reminder.",
    operatingDepth:
      "HomeReach keeps creative concepts, Ohio maps, deployment timing, proposal options, and approval status connected in the admin command layer.",
    proofAngle: "A realistic front/back mockup lets campaign teams judge message, emotion, and rollout phase quickly.",
    ctaLabel: "Preview Campaign Mail",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
    examples: ["bio postcard", "endorsement postcard", "turnout postcard"],
    faqs: [
      {
        question: "How many postcard concepts should a campaign review?",
        answer:
          "A useful review set usually includes a small number of distinct campaign phases rather than many versions of the same idea.",
      },
      {
        question: "Should campaign postcards be designed before routes are final?",
        answer:
          "Creative can start early, but final quantities and geography should align before production approval.",
      },
    ],
  },
  {
    slug: "school-levy-mail-campaigns",
    label: "School Levy Mail Campaigns",
    shortLabel: "Levies",
    kind: "political",
    serviceName: "School levy mail campaigns",
    buyerIntent: "high",
    primaryKeyword: "school levy mail campaign Ohio",
    supportingKeywords: ["levy postcards", "issue campaign mail", "Ohio school levy postcards"],
    headline: "Issue mail that explains the stakes clearly and respectfully.",
    summary:
      "Levy mail needs clarity, trust, timing, and a measured tone because voters often need practical context before they decide.",
    operatingDepth:
      "HomeReach can package issue strategy, household reach, Ohio maps, postcard concepts, and follow-up cadence without inferring individual beliefs.",
    proofAngle: "A levy mail preview should make the message understandable in seconds and show exactly where the campaign will deploy.",
    ctaLabel: "Plan Levy Mail",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
    examples: ["facts and funding mail", "endorsement mail", "early voting reminder"],
    faqs: [
      {
        question: "Can levy campaigns use geographic targeting?",
        answer:
          "Yes. Geographic planning, district coverage, and route logistics are allowed. The system should not infer individual political beliefs.",
      },
      {
        question: "What should levy postcards avoid?",
        answer:
          "They should avoid clutter, vague claims, and unsupported pressure. Clear facts and practical voter actions work better.",
      },
    ],
  },
  {
    slug: "judicial-campaign-mail",
    label: "Judicial Campaign Mail",
    shortLabel: "Judicial mail",
    kind: "political",
    serviceName: "Judicial campaign mail",
    buyerIntent: "high",
    primaryKeyword: "judicial campaign mail Ohio",
    supportingKeywords: ["judge campaign postcards", "court campaign mail", "Ohio judicial postcards"],
    headline: "Judicial mail that feels credible, calm, and professionally produced.",
    summary:
      "Judicial campaign mail usually needs restraint, qualifications, community trust, and clean visual hierarchy.",
    operatingDepth:
      "HomeReach can support judicial mail with campaign profiles, district geography, mockups, proposal packages, and approval lanes.",
    proofAngle: "Premium judicial postcard mockups help distinguish credible campaign mail from generic political flyers.",
    ctaLabel: "Draft Judicial Mail Plan",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
    examples: ["qualification mail", "endorsement mail", "voter education mail"],
    faqs: [
      {
        question: "What tone works for judicial campaign mail?",
        answer:
          "Credible, steady, and specific usually works better than loud generic political language.",
      },
      {
        question: "Can judicial mail include endorsements?",
        answer:
          "Yes, when the campaign has approved the endorsement language and compliance requirements are satisfied.",
      },
    ],
  },
  {
    slug: "gotv-postcards",
    label: "GOTV Postcards",
    shortLabel: "GOTV",
    kind: "political",
    serviceName: "GOTV postcard campaigns",
    buyerIntent: "high",
    primaryKeyword: "Ohio GOTV postcards",
    supportingKeywords: ["get out the vote postcards", "turnout mail", "early vote postcards"],
    headline: "Turnout mail that makes the next voter action obvious.",
    summary:
      "GOTV postcards should be simple, timed tightly, and focused on the voting action rather than overloaded with biography.",
    operatingDepth:
      "HomeReach can connect turnout creative, deployment timing, coverage maps, approval status, and final follow-up tasks.",
    proofAngle: "A GOTV mockup should show deadline, action, and campaign identity immediately.",
    ctaLabel: "Schedule GOTV Mail",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
    examples: ["early vote reminder", "absentee ballot reminder", "final weekend turnout"],
    faqs: [
      {
        question: "When should GOTV postcards mail?",
        answer:
          "Timing depends on election deadlines, mail delivery windows, and campaign phase. The key is to avoid mailing too late for the action requested.",
      },
      {
        question: "Should GOTV mail include complex persuasion messaging?",
        answer:
          "Usually no. GOTV mail should make the voting action clear and fast to understand.",
      },
    ],
  },
  {
    slug: "procurement-savings",
    label: "Procurement Savings Dashboard",
    shortLabel: "Procurement",
    kind: "procurement",
    serviceName: "Procurement and inventory savings dashboard",
    buyerIntent: "high",
    primaryKeyword: "inventory purchasing dashboard",
    supportingKeywords: ["supplier savings dashboard", "procurement savings", "inventory purchasing software"],
    headline: "Turn recurring purchasing into visible savings opportunities.",
    summary:
      "Procurement SEO should sell the outcome: fewer hidden supplier gaps, cleaner reorder visibility, and a faster path to savings snapshots.",
    operatingDepth:
      "HomeReach keeps supplier intelligence, price snapshots, smart buys, approvals, and savings outreach inside operations tools.",
    proofAngle: "A savings dashboard preview helps prospects understand the value before connecting real supplier data.",
    ctaLabel: "See Savings Opportunities",
    ctaHref: "/signup?redirect=%2Foperations-copilot%2Fsupplier-prices",
    visualKind: "dashboard",
    examples: ["print vendor savings", "recurring supplies", "campaign material purchasing"],
    faqs: [
      {
        question: "What should a procurement dashboard show first?",
        answer:
          "It should show recurring items, supplier variance, price snapshots, approval status, and the next buying action.",
      },
      {
        question: "Can procurement data support marketing sales?",
        answer:
          "Yes. Savings snapshots can become visual proof in outreach and proposals when handled carefully.",
      },
    ],
  },
  {
    slug: "government-contract-support",
    label: "Government Contract Support",
    shortLabel: "Gov contracts",
    kind: "government_contracts",
    serviceName: "Government contract opportunity support",
    buyerIntent: "medium",
    primaryKeyword: "government contract support Ohio",
    supportingKeywords: ["SAM.gov opportunity support", "bid no bid recommendation", "capability statement support"],
    headline: "Find, qualify, and organize public-sector opportunities before chasing the wrong bid.",
    summary:
      "Government contract support needs deadline awareness, fit scoring, compliance tracking, and clear bid/no-bid discipline.",
    operatingDepth:
      "HomeReach keeps SAM.gov search, fit scoring, bid rooms, compliance locks, and deadline tracking admin-side.",
    proofAngle: "A pipeline dashboard preview shows that the system is built for discipline, not random opportunity chasing.",
    ctaLabel: "Review Contract Fit",
    ctaHref: "/signup?redirect=%2Fadmin%2Fgov-contracts",
    visualKind: "dashboard",
    examples: ["opportunity fit scoring", "capability statements", "subcontractor outreach"],
    faqs: [
      {
        question: "Should every SAM.gov opportunity be pursued?",
        answer:
          "No. A good process filters by fit, deadline, requirements, partner needs, and realistic win probability before work begins.",
      },
      {
        question: "Why keep contract tools admin-side?",
        answer:
          "Bid rooms, compliance notes, and deadlines are operational controls. Public pages should sell capability without exposing internal workflow.",
      },
    ],
  },
  {
    slug: "website-chatbot-services",
    label: "Website and Chatbot Services",
    shortLabel: "Web/chatbot",
    kind: "web_chatbot",
    serviceName: "Website and chatbot services",
    buyerIntent: "medium",
    primaryKeyword: "local business website chatbot services",
    supportingKeywords: ["AI chatbot for local business", "website lead capture", "local marketing automation"],
    headline: "Convert campaign interest after the postcard, click, or call.",
    summary:
      "Website and chatbot services work best as conversion support for businesses already investing in visibility.",
    operatingDepth:
      "HomeReach can connect website/chatbot offers to client profiles, campaign records, outreach, proposals, and cross-sell recommendations.",
    proofAngle: "A simple lead-capture preview helps buyers see how offline visibility can turn into tracked opportunities.",
    ctaLabel: "Get My Custom Plan",
    ctaHref: "/get-started",
    visualKind: "proposal",
    examples: ["postcard landing pages", "AI lead qualification", "proposal follow-up"],
    faqs: [
      {
        question: "Why pair postcards with a website or chatbot?",
        answer:
          "Direct mail creates attention. A focused page or chatbot helps capture the next action and route the lead quickly.",
      },
      {
        question: "Should chatbot complexity be public?",
        answer:
          "No. The public page should communicate faster follow-up and better lead capture. Internal orchestration belongs admin-side.",
      },
    ],
  },
];

export const authorityGuides: AuthorityGuide[] = [
  createGuide({
    slug: "eddm-vs-targeted-mail",
    title: "EDDM vs Targeted Direct Mail",
    audience: "Local businesses comparing low-cost saturation mail with route-aware campaign planning.",
    summary:
      "EDDM can be useful for broad visibility, but targeted mail usually wins when the offer depends on household fit, neighborhood value, or campaign timing.",
    sections: [
      ["When EDDM makes sense", "Use broad saturation when the offer is simple, the service area is compact, and household differences do not change the message."],
      ["When targeted mail makes sense", "Use targeted routes when the campaign needs better geography, stronger household fit, seasonal timing, or a cleaner proposal story."],
      ["How HomeReach frames it", "The public page should make the choice simple while admin tools preserve route maps, quantities, proofs, and production controls."],
    ],
    checklist: ["Define the campaign radius.", "Confirm household count.", "Match creative to the offer.", "Attach a map before proposal send."],
    ctaLabel: "Build Targeted Campaign",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
  }),
  createGuide({
    slug: "shared-vs-solo-direct-mail",
    title: "Shared vs Solo Direct Mail",
    audience: "Businesses deciding between affordable recurring visibility and dedicated campaign control.",
    summary:
      "Shared postcards are best for recurring awareness and category exclusivity. Solo direct mail is better for custom offers, larger drops, and controlled timing.",
    sections: [
      ["Shared postcard fit", "Shared mail works when the buyer wants premium local visibility without carrying the full cost of the piece."],
      ["Solo campaign fit", "Solo mail is better when the campaign needs one offer, one brand, a specific route plan, or multiple deployment waves."],
      ["How to cross-sell", "A shared postcard customer who needs more geography or seasonality is a strong targeted campaign prospect."],
    ],
    checklist: ["Clarify budget.", "Clarify timing.", "Choose shared or dedicated creative.", "Define the next upgrade path."],
    ctaLabel: "Reserve My Spot",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
  }),
  createGuide({
    slug: "political-mail-strategy-county-campaigns",
    title: "Political Mail Strategy for County Campaigns",
    audience: "County candidates, campaign managers, consultants, and local party teams.",
    summary:
      "County campaign mail should connect office, geography, voter action, message phase, creative style, and deployment timing.",
    sections: [
      ["Start with the office and geography", "A sheriff, judicial, county commission, or levy campaign needs different proof, tone, and timing."],
      ["Match mail type to phase", "Biography, persuasion, endorsement, absentee, and GOTV mail each have a different job."],
      ["Keep targeting compliant", "Use geography and logistics. Do not build individual ideology scores or prohibited voter profiles."],
    ],
    checklist: ["Choose campaign phase.", "Attach Ohio coverage map.", "Approve front/back mockup.", "Schedule follow-up wave."],
    ctaLabel: "Build Campaign Plan",
    ctaHref: "/political/plan",
    visualKind: "political_mail",
  }),
  createGuide({
    slug: "direct-mail-roi-for-roofers",
    title: "Direct Mail ROI for Roofers",
    audience: "Roofing owners and marketers evaluating homeowner direct mail.",
    summary:
      "Roofing direct mail ROI depends on average job value, inspection conversion, storm timing, route choice, and whether follow-up happens quickly.",
    sections: [
      ["Start with job economics", "One roofing job can justify a campaign when the average project value is high enough and the route plan is realistic."],
      ["Use trust-heavy creative", "Roofing postcards need credibility, local presence, and a clear inspection offer more than loud discount language."],
      ["Track the next action", "The campaign should connect to calls, forms, proposals, and follow-up so interest does not disappear."],
    ],
    checklist: ["Pick homeowner routes.", "Use a simple inspection CTA.", "Prepare follow-up scripts.", "Review calls and proposals."],
    ctaLabel: "See Roofing Options",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
  }),
  createGuide({
    slug: "how-many-postcards-should-a-campaign-send",
    title: "How Many Postcards Should a Campaign Send?",
    audience: "Business owners and political teams planning campaign volume.",
    summary:
      "The right postcard volume depends on geography, frequency, budget, deadline, household count, and what the recipient is being asked to do.",
    sections: [
      ["Volume follows geography", "Start with the routes or districts that matter, then calculate quantity from household coverage."],
      ["Frequency follows decision cycle", "High-consideration services and political persuasion often need more than one touch."],
      ["Timing protects the investment", "A strong volume plan still fails if proof approval, print, or mail scheduling happens too late."],
    ],
    checklist: ["Confirm route count.", "Choose number of drops.", "Back into print deadline.", "Attach rollout timeline."],
    ctaLabel: "Get My Proposal",
    ctaHref: "/targeted/start",
    visualKind: "proposal",
  }),
  createGuide({
    slug: "neighborhood-saturation-marketing",
    title: "Neighborhood Saturation Marketing Explained",
    audience: "Local businesses that need concentrated awareness in specific neighborhoods.",
    summary:
      "Neighborhood saturation marketing is about being repeatedly visible in a defined geography instead of scattering budget across the entire market.",
    sections: [
      ["Why concentration matters", "A smaller route plan can outperform a larger vague campaign when the service area and offer are tighter."],
      ["What to show buyers", "Maps, mockups, and household counts make a saturation plan easy to understand."],
      ["How to scale", "Start with a focused neighborhood, prove response, then expand to adjacent routes with the same operating rhythm."],
    ],
    checklist: ["Define neighborhood.", "Estimate household reach.", "Create visual proof.", "Plan expansion route."],
    ctaLabel: "See Coverage Areas",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
  }),
  createGuide({
    slug: "procurement-savings-dashboard",
    title: "How a Procurement Savings Dashboard Finds Hidden Spend",
    audience: "Businesses with recurring supplies, print, signs, or vendor purchases.",
    summary:
      "A procurement savings dashboard is useful when it turns scattered supplier data into clear next actions and savings snapshots.",
    sections: [
      ["What to track first", "Recurring items, supplier price changes, approval status, and upcoming reorder needs should be visible immediately."],
      ["How savings becomes sales proof", "A clean snapshot can help prospects understand the value before a complex procurement conversation."],
      ["Where complexity belongs", "The public page should show savings clarity. Admin tools should handle supplier intelligence and approvals."],
    ],
    checklist: ["Import supplier list.", "Capture price snapshot.", "Flag variance.", "Approve smart buy action."],
    ctaLabel: "See Savings Opportunities",
    ctaHref: "/signup?redirect=%2Foperations-copilot%2Fsupplier-prices",
    visualKind: "dashboard",
  }),
];

export const ohioAuthorityCounties: OhioAuthorityCounty[] = [
  {
    slug: "franklin-county",
    name: "Franklin County",
    region: "Central Ohio",
    seat: "Columbus",
    anchors: ["Columbus", "Dublin", "Westerville", "Grove City", "Hilliard"],
    directMailAngle:
      "Franklin County rewards campaigns that separate dense urban routes, fast-growth suburbs, and professional homeowner pockets.",
    politicalAngle:
      "Countywide campaigns need clear turnout timing, precinct-aware geography, and direct mail creative that is useful without becoming cluttered.",
    businessAngle:
      "Local businesses can use route saturation to stay visible across high-competition suburbs without buying a full metro campaign.",
    campaignSignals: ["dense route mix", "suburban growth", "countywide civic races", "high service competition"],
  },
  {
    slug: "summit-county",
    name: "Summit County",
    region: "Northeast Ohio",
    seat: "Akron",
    anchors: ["Akron", "Cuyahoga Falls", "Hudson", "Green", "Fairlawn"],
    directMailAngle:
      "Summit County is practical for home-service and civic campaigns because older housing stock and suburb clusters create useful mail pockets.",
    politicalAngle:
      "Levy, judicial, and county campaigns can pair broad awareness with city-specific follow-up waves.",
    businessAngle:
      "Service businesses can focus offers around homeowner-heavy neighborhoods while preserving county-level brand reach.",
    campaignSignals: ["older homes", "school levy potential", "service corridors", "countywide judicial races"],
  },
  {
    slug: "stark-county",
    name: "Stark County",
    region: "Northeast Ohio",
    seat: "Canton",
    anchors: ["Canton", "Massillon", "North Canton", "Alliance", "Jackson Township"],
    directMailAngle:
      "Stark County is a strong long-tail market for postcard advertising, route density, and practical neighborhood saturation.",
    politicalAngle:
      "County races and issue campaigns benefit from clear household reach, staged mail drops, and simple visual proof.",
    businessAngle:
      "Home-service and local retail campaigns can use shared postcards or targeted route drops to reach neighborhoods without overbuying.",
    campaignSignals: ["county race visibility", "homeowner routes", "suburban service demand", "issue campaign education"],
  },
  {
    slug: "medina-county",
    name: "Medina County",
    region: "Northeast Ohio",
    seat: "Medina",
    anchors: ["Medina", "Wadsworth", "Brunswick", "Seville", "Lodi"],
    directMailAngle:
      "Medina County is useful for high-value homeowner campaigns, suburban route planning, and premium local service offers.",
    politicalAngle:
      "Local races and levy campaigns need credible creative, coverage clarity, and follow-up timing that respects smaller-market trust.",
    businessAngle:
      "Businesses can use postcards to build repeat visibility in suburbs where referral and neighborhood reputation matter.",
    campaignSignals: ["high-value homes", "suburban family routes", "local trust signals", "school district issues"],
  },
  {
    slug: "cuyahoga-county",
    name: "Cuyahoga County",
    region: "Northeast Ohio",
    seat: "Cleveland",
    anchors: ["Cleveland", "Lakewood", "Parma", "Shaker Heights", "Strongsville"],
    directMailAngle:
      "Cuyahoga County needs route-level discipline because city, inner-ring suburb, and outer-suburb audiences behave differently.",
    politicalAngle:
      "Judicial, issue, and GOTV campaigns can use mail to simplify timing, names, and voting actions across a dense media market.",
    businessAngle:
      "Local businesses can avoid broad waste by matching creative to older-home neighborhoods, lakefront routes, and suburb clusters.",
    campaignSignals: ["dense civic market", "judicial races", "older homes", "inner-ring suburbs"],
  },
  {
    slug: "hamilton-county",
    name: "Hamilton County",
    region: "Southwest Ohio",
    seat: "Cincinnati",
    anchors: ["Cincinnati", "Blue Ash", "Anderson Township", "Norwood", "Sharonville"],
    directMailAngle:
      "Hamilton County campaigns should separate city neighborhoods, river corridors, and northern suburb routes.",
    politicalAngle:
      "County and judicial campaigns need concise voter education and turnout mail that can scale across different communities.",
    businessAngle:
      "Service companies can use targeted mail to focus on higher-fit routes instead of buying broad Cincinnati impressions.",
    campaignSignals: ["competitive local services", "judicial campaigns", "suburban households", "regional issue campaigns"],
  },
  {
    slug: "montgomery-county",
    name: "Montgomery County",
    region: "Western Ohio",
    seat: "Dayton",
    anchors: ["Dayton", "Kettering", "Centerville", "Huber Heights", "Miamisburg"],
    directMailAngle:
      "Montgomery County is a practical fit for radius planning, repeat postcard visibility, and route-aware service campaigns.",
    politicalAngle:
      "County races and issue campaigns can use staged mail drops to reinforce voting deadlines and local credibility.",
    businessAngle:
      "Local service businesses can pair neighborhood saturation with proposal-ready maps and seasonal timing.",
    campaignSignals: ["military-adjacent communities", "suburban family routes", "older neighborhoods", "county issues"],
  },
  {
    slug: "lucas-county",
    name: "Lucas County",
    region: "Northwest Ohio",
    seat: "Toledo",
    anchors: ["Toledo", "Sylvania", "Maumee", "Oregon", "Ottawa Hills"],
    directMailAngle:
      "Lucas County lets campaigns connect city identity, suburban routes, and countywide reach in a plan buyers can understand quickly.",
    politicalAngle:
      "Issue, labor, and county campaigns can use mail for simple messages, turnout reminders, and geographic coverage proof.",
    businessAngle:
      "Local businesses can use shared postcards or targeted mail to stay visible in neighborhoods that match their service area.",
    campaignSignals: ["countywide routes", "labor and issue campaigns", "suburban demand", "lake-region communities"],
  },
];

const countyAuthorityTopicSlugs = new Set([
  "direct-mail-marketing",
  "targeted-neighborhood-campaigns",
  "political-mail",
  "campaign-postcards",
  "school-levy-mail-campaigns",
]);

export const politicalAuthorityPages: PoliticalAuthorityPage[] = [
  createPoliticalAuthorityPage({
    slug: "ohio",
    pageType: "statewide",
    title: "Political Mail Ohio",
    h1: "Political mail strategy for Ohio campaigns",
    audience: "Statewide, county, judicial, levy, and local campaign teams that need credible direct mail without operational guesswork.",
    summary:
      "HomeReach political SEO pages explain campaign mail strategy, voter-facing creative, geography, rollout timing, and proposal visuals without exposing internal campaign operations.",
    strategy: [
      "Position Ohio political mail around geography, office level, timing, and creative clarity instead of vague persuasion language.",
      "Use maps, postcard mockups, and rollout timelines as public proof while keeping outreach, targeting, and approvals admin-side.",
      "Build internal links into county, office, GOTV, levy, and postcard design pages so search engines see a full political mail cluster.",
    ],
    proofPoints: ["statewide coverage framing", "campaign-safe creative guidance", "county and office-specific internal links"],
  }),
  createPoliticalAuthorityPage({
    slug: "county-campaign-mail",
    pageType: "county",
    title: "County Campaign Mail",
    h1: "County campaign mail that shows reach, timing, and execution",
    audience: "County candidates, campaign managers, parties, consultants, and issue committees.",
    summary:
      "County campaign mail works best when household reach, message simplicity, mail timing, and follow-up visibility are planned together.",
    strategy: [
      "Create county-level authority pages that connect campaign goals to maps, household reach, and practical mail drops.",
      "Use campaign option packages to explain volume, counties covered, timing, and why the mail should work.",
      "Pair every county page with a recommended CTA into political outreach, proposal, or map review.",
    ],
    proofPoints: ["county coverage maps", "multi-drop schedule examples", "campaign option packaging"],
  }),
  createPoliticalAuthorityPage({
    slug: "judicial-campaign-mail",
    pageType: "office",
    title: "Judicial Campaign Mail",
    h1: "Judicial campaign mail with trust-first creative",
    audience: "Judicial candidates and consultants who need professional, restrained, trust-building direct mail.",
    summary:
      "Judicial mail should make name recognition, credibility, endorsements, and voting information easy to understand.",
    strategy: [
      "Use premium, restrained design systems that feel credible and avoid generic political flyer energy.",
      "Explain endorsement, biography, and turnout postcard types with front/back mockup support.",
      "Keep voter-facing claims factual and campaign-approved before any public visual is reused.",
    ],
    proofPoints: ["trust-first postcard mockups", "endorsement and biography concepts", "USPS-ready visual framing"],
  }),
  createPoliticalAuthorityPage({
    slug: "sheriff-campaign-mail",
    pageType: "office",
    title: "Sheriff Campaign Mail",
    h1: "Sheriff campaign mail for countywide recognition and credibility",
    audience: "Sheriff campaigns, public safety candidates, and county consultants.",
    summary:
      "Sheriff campaign mail needs clear credibility signals, countywide coverage, and direct language that can be understood quickly.",
    strategy: [
      "Frame public safety mail around service, credibility, community trust, and voting logistics.",
      "Use county route coverage visuals to show where name recognition and turnout support can build.",
      "Support biography, endorsement, and turnout concepts without inferring individual voter beliefs.",
    ],
    proofPoints: ["countywide mail planning", "biography postcard concepts", "turnout timing recommendations"],
  }),
  createPoliticalAuthorityPage({
    slug: "gotv-postcards",
    pageType: "campaign_type",
    title: "Ohio GOTV Postcards",
    h1: "GOTV postcards that make the next voting action obvious",
    audience: "Campaigns and committees preparing election-week, absentee, early vote, or final turnout mail.",
    summary:
      "GOTV mail should be concise, deadline-driven, visual, and specific about what the recipient should do next.",
    strategy: [
      "Use timing pages for absentee, early voting, election-week, and final reminder mail.",
      "Attach maps and rollout timelines so campaigns can see deployment phases before approving.",
      "Keep messaging action-oriented and compliance-safe.",
    ],
    proofPoints: ["deadline mail concepts", "early vote postcard examples", "rollout timeline visuals"],
  }),
  createPoliticalAuthorityPage({
    slug: "school-levy-campaign-mail",
    pageType: "campaign_type",
    title: "School Levy Campaign Mail",
    h1: "School levy campaign mail that explains the vote clearly",
    audience: "School levy committees, district supporters, campaign managers, and local consultants.",
    summary:
      "Levy mail needs explanation, trust, timing, and local relevance. The best pages make the plan feel understandable before the proposal.",
    strategy: [
      "Build educational pages around what the levy changes, what households need to know, and how mail waves support awareness.",
      "Use maps and postcards to show deployment geography without overloading the public page.",
      "Link levy pages into county pages and political campaign mail guides.",
    ],
    proofPoints: ["local issue education", "multi-wave mail timing", "county and district coverage visuals"],
  }),
  createPoliticalAuthorityPage({
    slug: "state-senate-campaign-mail",
    pageType: "office",
    title: "State Senate Campaign Mail",
    h1: "State senate campaign mail with district-level rollout clarity",
    audience: "State senate candidates, campaign managers, and consultants planning district mail.",
    summary:
      "State senate mail needs district geography, message sequencing, and professional creative that can scale across communities.",
    strategy: [
      "Explain district coverage, household reach, and recommended postcard waves in plain language.",
      "Use rollout visuals to connect geography, creative, and timing.",
      "Create internal links from state senate pages to county and GOTV pages.",
    ],
    proofPoints: ["district rollout maps", "message sequence examples", "proposal-ready campaign options"],
  }),
  createPoliticalAuthorityPage({
    slug: "campaign-postcard-designs",
    pageType: "postcard_strategy",
    title: "Best Campaign Postcard Designs",
    h1: "Campaign postcard designs that feel real, strategic, and print-ready",
    audience: "Campaigns that need premium political postcard mockups instead of generic AI flyers.",
    summary:
      "Political postcard design should look like real campaign mail, use restrained hierarchy, and make the strategy visible.",
    strategy: [
      "Show biography, persuasion, contrast, endorsement, turnout, absentee, rural, suburban, and issue postcard concepts.",
      "Support front/back layouts, USPS formatting, indicia placement, bleed-safe composition, and editable design workflows.",
      "Use gallery pages and proposal visuals to turn creative into a conversion asset.",
    ],
    proofPoints: ["front/back mockups", "USPS-safe formatting", "Canva and Figma handoff readiness"],
  }),
  createPoliticalAuthorityPage({
    slug: "political-direct-mail-strategy",
    pageType: "postcard_strategy",
    title: "Political Direct Mail Strategy",
    h1: "Political direct mail strategy that connects message, map, and moment",
    audience: "Campaigns that need a strategic plan before they approve mail volume and creative.",
    summary:
      "The strongest political mail plans connect the campaign's moment, geography, office level, creative type, and deployment sequence.",
    strategy: [
      "Use structured answers, FAQs, and comparison blocks so AI search systems can understand the topic clearly.",
      "Create internal links between office pages, county pages, postcard gallery pages, and campaign guides.",
      "Keep every recommendation focused on campaign logistics, geography, and public-facing messaging.",
    ],
    proofPoints: ["AI-search-ready structured answers", "strategy-to-visual proof", "internal political SEO cluster"],
  }),
];

export const seoCaseStudies: SeoCaseStudy[] = [
  createCaseStudy({
    slug: "akron-roofer-saturated-12-routes",
    title: "How an Akron Roofer Saturated 12 Postal Routes",
    market: "Akron, Ohio",
    category: "Roofing marketing",
    resultSignal: "12-route saturation plan",
    summary:
      "A route-aware roofing postcard campaign can show homeowners exactly why the business is visible in their neighborhood before storm season peaks.",
    rollout: ["Define homeowner-heavy routes", "Create front/back roofing postcard", "Mail first awareness wave", "Follow with quote-focused CTA"],
    strategy: ["Use older housing stock as local context", "Keep offer simple", "Attach route map to proposal", "Log follow-up in CRM"],
    proofPoints: ["route map visual", "storm-season timing", "proposal-ready postcard preview"],
    ctaLabel: "Build My Roofing Plan",
    ctaHref: "/ohio/akron/roofing-marketing",
    visualKind: "postcard_mockup",
  }),
  createCaseStudy({
    slug: "county-campaign-reached-42000-households",
    title: "How a County Campaign Could Reach 42,000 Households",
    market: "Ohio county campaign",
    category: "Political mail",
    resultSignal: "42,000-household rollout model",
    summary:
      "A county campaign mail plan can turn geography, postcard types, and timing into a simple proposal package for campaign leadership.",
    rollout: ["Map county coverage", "Select persuasion and GOTV waves", "Mock up campaign mail", "Schedule final follow-up"],
    strategy: ["Show household reach", "Separate persuasion and turnout mail", "Use compliance-safe copy", "Attach county coverage visual"],
    proofPoints: ["county map", "front/back political mockups", "multi-wave rollout"],
    ctaLabel: "See Political Mail Strategy",
    ctaHref: "/political-mail/county-campaign-mail",
    visualKind: "political_mail",
  }),
  createCaseStudy({
    slug: "shared-postcards-reduced-advertising-costs",
    title: "How Shared Postcards Reduce Local Advertising Costs",
    market: "Ohio service market",
    category: "Shared postcards",
    resultSignal: "category-exclusive shared cost model",
    summary:
      "Shared postcards can make premium neighborhood visibility easier to buy by spreading print and postage across category-separated advertisers.",
    rollout: ["Choose city and category", "Reserve category spot", "Approve creative proof", "Track renewal opportunity"],
    strategy: ["Reduce buyer complexity", "Show shared cost logic", "Keep category exclusivity visible", "Route leads into proposal"],
    proofPoints: ["shared mailer visual", "category exclusivity", "renewal path"],
    ctaLabel: "Reserve My Spot",
    ctaHref: "/get-started",
    visualKind: "proposal",
  }),
  createCaseStudy({
    slug: "neighborhood-saturation-increased-visibility",
    title: "How Neighborhood Saturation Marketing Increases Visibility",
    market: "Ohio local business",
    category: "Targeted campaigns",
    resultSignal: "repeat neighborhood visibility model",
    summary:
      "Neighborhood saturation works when a business sees the same route plan, the same creative logic, and the same follow-up path repeated over time.",
    rollout: ["Pick route cluster", "Define repeat mail cadence", "Attach coverage visual", "Measure leads and renewal"],
    strategy: ["Keep geography obvious", "Use visual proof", "Create repeatability", "Connect campaign to CRM"],
    proofPoints: ["coverage map", "cadence model", "conversion-focused CTA"],
    ctaLabel: "Build Targeted Campaign",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
  }),
];

export const interactiveSeoTools: InteractiveSeoTool[] = [
  createInteractiveTool({
    slug: "postcard-roi-calculator",
    title: "Postcard ROI Calculator",
    eyebrow: "Interactive SEO tool",
    summary:
      "Estimate how many customers a postcard campaign needs to break even and why route selection, offer quality, and follow-up matter.",
    calculatorType: "postcard_roi",
    inputs: [
      { key: "postcards", label: "Postcards mailed", defaultValue: 5000 },
      { key: "cost", label: "Total campaign cost", defaultValue: 3250, suffix: "$" },
      { key: "ticket", label: "Average customer value", defaultValue: 1200, suffix: "$" },
      { key: "closeRate", label: "Lead close rate", defaultValue: 35, suffix: "%" },
    ],
    outputLabel: "Estimated customers needed to break even",
    guidance: ["Use this as a planning estimate, not a guarantee.", "The proposal should still include geography, creative, and follow-up timing."],
    ctaLabel: "Get My Proposal",
    ctaHref: "/get-started",
    visualKind: "dashboard",
  }),
  createInteractiveTool({
    slug: "household-reach-calculator",
    title: "Household Reach Calculator",
    eyebrow: "Coverage planning",
    summary:
      "Estimate household reach across route counts, drops, and campaign phases before building a proposal package.",
    calculatorType: "household_reach",
    inputs: [
      { key: "routes", label: "Routes", defaultValue: 12 },
      { key: "homesPerRoute", label: "Homes per route", defaultValue: 615 },
      { key: "drops", label: "Mail drops", defaultValue: 2 },
    ],
    outputLabel: "Estimated household impressions",
    guidance: ["Useful for targeted campaigns and political mail.", "Pair the estimate with map visuals and a simple CTA."],
    ctaLabel: "See Coverage Areas",
    ctaHref: "/ohio",
    visualKind: "coverage_map",
  }),
  createInteractiveTool({
    slug: "political-mail-estimator",
    title: "Political Mail Estimator",
    eyebrow: "Political mail planning",
    summary:
      "Estimate postcard volume and phase timing for persuasion, absentee, early vote, and GOTV campaign mail.",
    calculatorType: "political_mail",
    inputs: [
      { key: "households", label: "Households", defaultValue: 42000 },
      { key: "waves", label: "Mail waves", defaultValue: 3 },
      { key: "days", label: "Campaign window days", defaultValue: 21 },
    ],
    outputLabel: "Estimated total postcard volume",
    guidance: ["Do not use this for individual voter profiling.", "Use geography, office level, and timing only."],
    ctaLabel: "Plan Political Mail",
    ctaHref: "/political-mail/ohio",
    visualKind: "political_mail",
  }),
  createInteractiveTool({
    slug: "campaign-coverage-calculator",
    title: "Campaign Coverage Calculator",
    eyebrow: "Route coverage",
    summary:
      "Turn route count, household density, and deployment waves into a simple campaign coverage estimate.",
    calculatorType: "coverage",
    inputs: [
      { key: "routes", label: "Route count", defaultValue: 18 },
      { key: "density", label: "Average households per route", defaultValue: 575 },
      { key: "coverage", label: "Coverage confidence", defaultValue: 92, suffix: "%" },
    ],
    outputLabel: "Estimated reachable households",
    guidance: ["Use this to frame a proposal conversation.", "Actual routes should be confirmed in operational maps."],
    ctaLabel: "Build Targeted Campaign",
    ctaHref: "/targeted/start",
    visualKind: "coverage_map",
  }),
  createInteractiveTool({
    slug: "procurement-savings-calculator",
    title: "Procurement Savings Calculator",
    eyebrow: "Savings snapshot",
    summary:
      "Estimate how supplier price changes, monthly order volume, and usage create a savings opportunity worth reviewing.",
    calculatorType: "procurement_savings",
    inputs: [
      { key: "monthlySpend", label: "Monthly supply spend", defaultValue: 8500, suffix: "$" },
      { key: "savingsRate", label: "Estimated savings", defaultValue: 12, suffix: "%" },
      { key: "months", label: "Months", defaultValue: 12 },
    ],
    outputLabel: "Estimated annual savings opportunity",
    guidance: ["Use this as a lead magnet for the procurement dashboard.", "Admin systems should verify supplier data before sending claims."],
    ctaLabel: "See Savings Opportunities",
    ctaHref: "/signup?redirect=%2Foperations-copilot%2Fsupplier-prices",
    visualKind: "dashboard",
  }),
  createInteractiveTool({
    slug: "saturation-calculator",
    title: "Neighborhood Saturation Calculator",
    eyebrow: "Local visibility planning",
    summary:
      "Estimate how repeat drops across a defined route cluster build neighborhood visibility over time.",
    calculatorType: "saturation",
    inputs: [
      { key: "households", label: "Households in cluster", defaultValue: 7500 },
      { key: "drops", label: "Repeat drops", defaultValue: 3 },
      { key: "months", label: "Campaign months", defaultValue: 3 },
    ],
    outputLabel: "Estimated household touches",
    guidance: ["Good for local service categories with repeat seasonal demand.", "Pair with a postcard preview and CTA."],
    ctaLabel: "Get My Custom Plan",
    ctaHref: "/get-started",
    visualKind: "postcard_mockup",
  }),
];

export const authorityInsights: AuthorityInsight[] = [
  createInsight({
    slug: "ohio-campaign-mail-trends",
    title: "What We Are Seeing in Ohio Campaign Mail",
    eyebrow: "Political mail insight",
    summary:
      "Campaign mail is strongest when it is visual, direct, geographically clear, and timed around a specific voting action.",
    signals: ["front/back mail realism", "county coverage proof", "early vote timing", "endorsement and biography clarity"],
    recommendations: ["Build office-specific pages", "Pair visuals with map context", "Keep compliance review admin-side"],
    visualKind: "political_mail",
  }),
  createInsight({
    slug: "top-counties-for-saturation-marketing",
    title: "Top Ohio Counties for Saturation Marketing",
    eyebrow: "Geographic insight",
    summary:
      "County-level SEO creates useful entry points for businesses and campaigns that think in service areas instead of single cities.",
    signals: ["route density", "homeowner concentration", "suburban service demand", "local search intent"],
    recommendations: ["Expand county hubs", "Add route visuals", "Link county pages to city and category pages"],
    visualKind: "coverage_map",
  }),
  createInsight({
    slug: "local-advertising-trends-by-industry",
    title: "Local Advertising Trends by Industry",
    eyebrow: "Industry insight",
    summary:
      "Roofing, HVAC, lawn care, real estate, and contractor categories benefit from pages that explain timing, offer clarity, and neighborhood fit.",
    signals: ["seasonal demand", "high-ticket services", "repeat visibility", "proposal-ready proof"],
    recommendations: ["Prioritize high-intent categories", "Use case studies", "Add calculators to improve dwell time"],
    visualKind: "dashboard",
  }),
  createInsight({
    slug: "ai-search-ready-direct-mail-content",
    title: "How HomeReach Content Should Show Up in AI Search",
    eyebrow: "AI search optimization",
    summary:
      "AI search systems need concise answers, structured FAQs, comparison logic, visuals, and clear source pages that avoid thin content.",
    signals: ["structured answers", "FAQ schema", "comparison tables", "image metadata", "internal topical clusters"],
    recommendations: ["Write answer-first sections", "Keep pages useful", "Connect guides, tools, and datasets"],
    visualKind: "proposal",
  }),
];

export const visualGalleries: VisualGallery[] = [
  createVisualGallery({
    slug: "political-postcard-gallery",
    title: "Political Postcard Gallery",
    eyebrow: "Visual SEO gallery",
    summary:
      "A searchable gallery for political postcard concepts, campaign mail types, and proposal-ready creative examples.",
    categories: ["biography", "endorsement", "turnout", "levy"],
    locations: ["Ohio", "Franklin County", "Stark County", "Cuyahoga County"],
    visualKind: "political_mail",
  }),
  createVisualGallery({
    slug: "shared-postcard-gallery",
    title: "Shared Postcard Gallery",
    eyebrow: "Shared mail visuals",
    summary:
      "Premium shared postcard examples for local businesses that need quick proof without operational complexity.",
    categories: ["home services", "realtor", "lawn care", "HVAC"],
    locations: ["Columbus", "Akron", "Dayton", "Toledo"],
    visualKind: "postcard_mockup",
  }),
  createVisualGallery({
    slug: "campaign-map-gallery",
    title: "Campaign Map Gallery",
    eyebrow: "Coverage visuals",
    summary:
      "Ohio coverage maps, county route visuals, deployment geography, and proposal map examples for campaign planning.",
    categories: ["coverage map", "county map", "route cluster", "rollout"],
    locations: ["Ohio", "Summit County", "Hamilton County", "Lucas County"],
    visualKind: "coverage_map",
  }),
  createVisualGallery({
    slug: "proposal-visual-gallery",
    title: "Proposal Visual Gallery",
    eyebrow: "Conversion visuals",
    summary:
      "Proposal visuals, savings snapshots, dashboard previews, and campaign package graphics that make buying easier.",
    categories: ["proposal", "dashboard", "savings", "rollout"],
    locations: ["Ohio", "National", "Local business", "Political campaign"],
    visualKind: "proposal",
  }),
];

export const authorityDatasets: AuthorityDataset[] = [
  createDataset({
    slug: "campaign-mail-benchmarks",
    title: "Campaign Mail Benchmarks",
    eyebrow: "Authority dataset",
    summary:
      "A benchmark model for political mail volume, rollout timing, postcard type, and proposal planning.",
    metrics: [
      { label: "Common mail waves", value: "2-4", note: "Planning baseline by campaign phase." },
      { label: "Core visual types", value: "8", note: "Biography, persuasion, endorsement, turnout, and issue variations." },
      { label: "Review mode", value: "Required", note: "Political creative should remain human-approved." },
    ],
    methodology: ["Use public campaign logistics and HomeReach proposal models", "Avoid individual political inference", "Refresh after completed campaigns"],
    useCases: ["campaign proposal packages", "political SEO pages", "postcard gallery metadata"],
    visualKind: "political_mail",
  }),
  createDataset({
    slug: "route-density-benchmarks",
    title: "Route Density Benchmarks",
    eyebrow: "Geographic dataset",
    summary:
      "A planning model for route density, household reach, and neighborhood saturation opportunities.",
    metrics: [
      { label: "Planning route range", value: "8-24", note: "Typical proposal scenarios for local campaigns." },
      { label: "Repeat drops", value: "2-3", note: "Useful for saturation and seasonality." },
      { label: "Map requirement", value: "Yes", note: "Every proposal should include visual geography." },
    ],
    methodology: ["Use route counts, household estimates, and campaign scope", "Confirm operational maps before publishing claims"],
    useCases: ["coverage tools", "targeted campaign pages", "case study planning"],
    visualKind: "coverage_map",
  }),
  createDataset({
    slug: "postcard-cost-benchmarks",
    title: "Postcard Cost Benchmarks",
    eyebrow: "Pricing dataset",
    summary:
      "A non-binding planning dataset for postcard volume, proposal pricing, and shared mail cost framing.",
    metrics: [
      { label: "Shared mail value", value: "Cost sharing", note: "Explains why shared postcards are easier to buy." },
      { label: "Solo campaign model", value: "Custom", note: "Depends on volume, print, postage, and creative." },
      { label: "Best next step", value: "Proposal", note: "Pricing should convert into a reviewed plan." },
    ],
    methodology: ["Use internal pricing providers and approved vendor assumptions", "Do not expose admin margin publicly"],
    useCases: ["ROI calculator", "proposal pages", "pricing education"],
    visualKind: "proposal",
  }),
  createDataset({
    slug: "local-advertising-benchmarks",
    title: "Local Advertising Benchmarks",
    eyebrow: "Industry dataset",
    summary:
      "A benchmark model for which local business categories need repeat visibility, maps, and seasonal campaign timing.",
    metrics: [
      { label: "Priority categories", value: "12", note: "Home services and local service businesses." },
      { label: "Seasonality", value: "High", note: "Roofing, HVAC, lawn care, and contractor demand can be time-sensitive." },
      { label: "Visual proof", value: "Critical", note: "Maps and mockups reduce buyer uncertainty." },
    ],
    methodology: ["Use category intent, route fit, and proposal conversion patterns", "Update with campaign outcomes"],
    useCases: ["city/category pages", "industry guides", "sales outreach"],
    visualKind: "dashboard",
  }),
  createDataset({
    slug: "procurement-savings-benchmarks",
    title: "Procurement Savings Benchmarks",
    eyebrow: "Procurement dataset",
    summary:
      "A planning model for supplier price visibility, reorder risk, and savings snapshot opportunities.",
    metrics: [
      { label: "Review mode", value: "Required", note: "Savings claims should be verified before outreach." },
      { label: "Best CTA", value: "Savings snapshot", note: "Turn SEO traffic into a low-friction review." },
      { label: "Cross-sell path", value: "Marketing", note: "Procurement clients can become postcard or website leads." },
    ],
    methodology: ["Use supplier price snapshots and approved dashboard data", "Keep internal procurement controls admin-side"],
    useCases: ["procurement SEO", "calculator pages", "operations copilot proposals"],
    visualKind: "dashboard",
  }),
];

export const seoKeywordTargets: SeoKeywordTarget[] = [
  {
    keyword: "Political Mail Ohio",
    cluster: "Political SEO",
    intent: "political",
    priority: "critical",
    targetPath: "/political-mail/ohio",
    opportunity: "Whitespace for statewide campaign mail and consulting searches.",
    nextAction: "Add county and office internal links, then attach political postcard gallery visuals.",
  },
  {
    keyword: "Direct Mail Columbus",
    cluster: "Geographic SEO",
    intent: "local",
    priority: "critical",
    targetPath: "/ohio/columbus/direct-mail-marketing",
    opportunity: "High-intent local business search with clear proposal CTA.",
    nextAction: "Add case study and ROI calculator links.",
  },
  {
    keyword: "Roofing Marketing Akron",
    cluster: "Industry SEO",
    intent: "commercial",
    priority: "high",
    targetPath: "/ohio/akron/roofing-marketing",
    opportunity: "Strong service category match with older housing stock context.",
    nextAction: "Link Akron roofing case study and route-density benchmark.",
  },
  {
    keyword: "Campaign Postcards Ohio",
    cluster: "Political SEO",
    intent: "political",
    priority: "critical",
    targetPath: "/political-mail/campaign-postcard-designs",
    opportunity: "Visual authority and gallery SEO can differentiate HomeReach from generic printers.",
    nextAction: "Publish gallery-ready political postcard concepts through review.",
  },
  {
    keyword: "Shared Postcard Advertising",
    cluster: "Shared postcards",
    intent: "transactional",
    priority: "high",
    targetPath: "/ohio/columbus/shared-postcards",
    opportunity: "Buyer education can explain cost sharing and category exclusivity.",
    nextAction: "Connect shared postcard gallery and pricing guide.",
  },
  {
    keyword: "Procurement Savings Calculator",
    cluster: "Procurement SEO",
    intent: "commercial",
    priority: "medium",
    targetPath: "/tools/procurement-savings-calculator",
    opportunity: "Interactive tool creates lead capture path for operations copilot.",
    nextAction: "Add verified supplier examples after dashboard data is approved.",
  },
];

export const authorityQualityRules = [
  "Keep the homepage premium and simple; do not move long-tail SEO content into the homepage.",
  "Every public authority page needs local context, operational depth, visual proof, internal links, FAQs, and a clear CTA.",
  "Political pages can use geography, office level, campaign logistics, and deployment planning; they must not infer individual political beliefs.",
  "AI-generated drafts stay review-first. No auto-publishing without source notes, duplicate checks, human approval, and CTA QA.",
  "Visual assets need stable filenames, descriptive alt text, sitemap inclusion, and a clear page purpose.",
];

export function listOhioAuthorityPages(): OhioAuthorityPage[] {
  return ohioAuthorityCities.flatMap((city) => [
    buildCityPage(city),
    ...seoAuthorityTopics.map((topic) => buildTopicPage(city, topic)),
  ]);
}

export function getOhioAuthorityPage(citySlug: string, topicSlug?: string | null): OhioAuthorityPage | null {
  const city = ohioAuthorityCities.find((item) => item.slug === citySlug);
  if (!city) return null;
  if (!topicSlug) return buildCityPage(city);
  const topic = seoAuthorityTopics.find((item) => item.slug === topicSlug);
  if (!topic) return null;
  return buildTopicPage(city, topic);
}

export function listAuthorityGuides(): AuthorityGuide[] {
  return authorityGuides;
}

export function getAuthorityGuide(slug: string): AuthorityGuide | null {
  return authorityGuides.find((guide) => guide.slug === slug) ?? null;
}

export function listSeoVisualAssets(): SeoVisualAsset[] {
  const assets = [
    createVisualAsset({
      assetSlug: "ohio-authority-direct-mail-map",
      title: "Ohio direct mail authority map",
      alt: "Ohio coverage map showing HomeReach direct mail and campaign execution markets",
      caption: "Ohio authority hub visual for direct mail, political mail, procurement, and campaign execution.",
      kind: "coverage_map",
      path: "/ohio",
      palette: "blue",
      primaryLabel: "Ohio authority",
      secondaryLabel: "Direct mail and campaign execution",
    }),
    ...listOhioAuthorityPages().map((page) => page.visual),
    ...listCountyAuthorityPages().map((page) => page.visual),
    ...politicalAuthorityPages.map((page) => page.visual),
    ...seoCaseStudies.map((study) => study.visual),
    ...interactiveSeoTools.map((tool) => tool.visual),
    ...authorityInsights.map((insight) => insight.visual),
    ...visualGalleries.flatMap((gallery) => [gallery.visual, ...gallery.items.map((item) => item.visual)]),
    ...authorityDatasets.map((dataset) => dataset.visual),
    ...authorityGuides.map((guide) => guide.visual),
  ];

  const unique = new Map<string, SeoVisualAsset>();
  for (const asset of assets) unique.set(asset.assetSlug, asset);
  return Array.from(unique.values());
}

export function getSeoVisualAsset(assetSlug: string): SeoVisualAsset | null {
  const normalized = assetSlug.replace(/\.svg$/i, "");
  return listSeoVisualAssets().find((asset) => asset.assetSlug === normalized) ?? null;
}

export function getAuthorityClusters() {
  const pages = listOhioAuthorityPages();
  return [
    {
      name: "Geographic authority",
      count: ohioAuthorityCities.length,
      detail: "Premium city hubs for major Ohio markets.",
      nextAction: "Use city pages as internal-link anchors for service, political, and guide pages.",
      href: "/ohio",
    },
    {
      name: "City and category pages",
      count: pages.filter((page) => page.pageType === "city_topic" && page.topic?.kind !== "political").length,
      detail: "Long-tail revenue pages for shared postcards, targeted campaigns, home services, procurement, and web/chatbot services.",
      nextAction: "Review conversion CTAs and attach local proof visuals before expanding nationally.",
      href: "/admin/traffic-engine",
    },
    {
      name: "Political mail authority",
      count: pages.filter((page) => page.topic?.kind === "political").length + politicalAuthorityPages.length,
      detail: "Ohio political, levy, judicial, campaign postcard, office, and GOTV pages with compliance-safe positioning.",
      nextAction: "Pair political pages with outreach strategy packages and true postcard mockups.",
      href: "/admin/marketing/seo-command-center",
    },
    {
      name: "County authority",
      count: listCountyAuthorityPages().length,
      detail: "County hubs and county-topic pages for political mail, campaign postcards, and direct mail markets.",
      nextAction: "Expand county examples as campaigns produce approved visual proof.",
      href: "/admin/marketing/seo-command-center",
    },
    {
      name: "Trust builders",
      count: seoCaseStudies.length + interactiveSeoTools.length + authorityDatasets.length,
      detail: "Case studies, interactive calculators, and proprietary benchmark pages that can earn backlinks and leads.",
      nextAction: "Connect analytics and search console data before labeling any result as live performance.",
      href: "/admin/marketing/seo-command-center",
    },
    {
      name: "Educational authority",
      count: authorityGuides.length,
      detail: "Guides designed to rank for informational searches and convert readers into proposal requests.",
      nextAction: "Add case studies after campaigns complete to reinforce the SEO flywheel.",
      href: "/admin/content-intel",
    },
    {
      name: "Visual SEO assets",
      count: listSeoVisualAssets().length,
      detail: "Stable image routes with descriptive alt text and image-sitemap coverage.",
      nextAction: "Replace generated previews with approved Canva/Figma campaign visuals as they become available.",
      href: "/image-sitemap.xml",
    },
  ];
}

export function listCountyAuthorityPages(): CountyAuthorityPage[] {
  const countyTopics = seoAuthorityTopics.filter((topic) => countyAuthorityTopicSlugs.has(topic.slug));
  return ohioAuthorityCounties.flatMap((county) => [
    buildCountyPage(county),
    ...countyTopics.map((topic) => buildCountyTopicPage(county, topic)),
  ]);
}

export function getCountyAuthorityPage(countySlug: string, topicSlug?: string | null): CountyAuthorityPage | null {
  const county = ohioAuthorityCounties.find((item) => item.slug === countySlug);
  if (!county) return null;
  if (!topicSlug) return buildCountyPage(county);
  const topic = seoAuthorityTopics.find((item) => item.slug === topicSlug && countyAuthorityTopicSlugs.has(item.slug));
  if (!topic) return null;
  return buildCountyTopicPage(county, topic);
}

export function listPoliticalAuthorityPages(): PoliticalAuthorityPage[] {
  return politicalAuthorityPages;
}

export function getPoliticalAuthorityPage(slug: string): PoliticalAuthorityPage | null {
  return politicalAuthorityPages.find((page) => page.slug === slug) ?? null;
}

export function listSeoCaseStudies(): SeoCaseStudy[] {
  return seoCaseStudies;
}

export function getSeoCaseStudy(slug: string): SeoCaseStudy | null {
  return seoCaseStudies.find((study) => study.slug === slug) ?? null;
}

export function listInteractiveSeoTools(): InteractiveSeoTool[] {
  return interactiveSeoTools;
}

export function getInteractiveSeoTool(slug: string): InteractiveSeoTool | null {
  return interactiveSeoTools.find((tool) => tool.slug === slug) ?? null;
}

export function listAuthorityInsights(): AuthorityInsight[] {
  return authorityInsights;
}

export function getAuthorityInsight(slug: string): AuthorityInsight | null {
  return authorityInsights.find((insight) => insight.slug === slug) ?? null;
}

export function listVisualGalleries(): VisualGallery[] {
  return visualGalleries;
}

export function getVisualGallery(slug: string): VisualGallery | null {
  return visualGalleries.find((gallery) => gallery.slug === slug) ?? null;
}

export function listAuthorityDatasets(): AuthorityDataset[] {
  return authorityDatasets;
}

export function getAuthorityDataset(slug: string): AuthorityDataset | null {
  return authorityDatasets.find((dataset) => dataset.slug === slug) ?? null;
}

export function listSeoKeywordTargets(): SeoKeywordTarget[] {
  return seoKeywordTargets;
}

export function listAllAuthorityRoutes() {
  return [
    { path: "/ohio", type: "hub", priority: 0.9 },
    { path: "/political-mail", type: "hub", priority: 0.86 },
    { path: "/case-studies", type: "hub", priority: 0.76 },
    { path: "/tools", type: "hub", priority: 0.76 },
    { path: "/insights", type: "hub", priority: 0.74 },
    { path: "/visuals", type: "hub", priority: 0.72 },
    { path: "/benchmarks", type: "hub", priority: 0.72 },
    ...listOhioAuthorityPages().map((page) => ({
      path: page.path,
      type: page.pageType,
      priority: page.pageType === "city" ? 0.85 : page.topic?.kind === "political" ? 0.82 : 0.78,
    })),
    ...listCountyAuthorityPages().map((page) => ({
      path: page.path,
      type: page.pageType,
      priority: page.topic?.kind === "political" ? 0.8 : 0.76,
    })),
    ...politicalAuthorityPages.map((page) => ({ path: page.path, type: `political_${page.pageType}`, priority: 0.82 })),
    ...authorityGuides.map((guide) => ({ path: `/learn/${guide.slug}`, type: "guide", priority: 0.72 })),
    ...seoCaseStudies.map((study) => ({ path: study.path, type: "case_study", priority: 0.74 })),
    ...interactiveSeoTools.map((tool) => ({ path: tool.path, type: "interactive_tool", priority: 0.74 })),
    ...authorityInsights.map((insight) => ({ path: insight.path, type: "insight", priority: 0.7 })),
    ...visualGalleries.map((gallery) => ({ path: gallery.path, type: "visual_gallery", priority: 0.7 })),
    ...authorityDatasets.map((dataset) => ({ path: dataset.path, type: "dataset", priority: 0.7 })),
  ];
}

export function getSeoCommandCenterSnapshot() {
  const authorityRoutes = listAllAuthorityRoutes();
  const countyPages = listCountyAuthorityPages();
  const allVisuals = listSeoVisualAssets();
  const keywordTargets = listSeoKeywordTargets();
  const criticalKeywords = keywordTargets.filter((keyword) => keyword.priority === "critical");

  return {
    mode: "review-first authority engine",
    totals: {
      publicAuthorityRoutes: authorityRoutes.length,
      ohioCityPages: listOhioAuthorityPages().length,
      countyPages: countyPages.length,
      politicalPages: politicalAuthorityPages.length + listOhioAuthorityPages().filter((page) => page.topic?.kind === "political").length,
      educationalGuides: authorityGuides.length,
      caseStudies: seoCaseStudies.length,
      interactiveTools: interactiveSeoTools.length,
      visualAssets: allVisuals.length,
      benchmarkDatasets: authorityDatasets.length,
      keywordTargets: keywordTargets.length,
    },
    analyticsReadiness: [
      { label: "Google Search Console", status: "Connector needed", nextAction: "Connect query, page, and CTR data before live ranking claims." },
      { label: "GA4 or server analytics", status: "Connector needed", nextAction: "Map organic visits, conversions, and proposals by landing page." },
      { label: "Image sitemap", status: "Active", nextAction: "Replace generated placeholders with approved Canva/Figma visuals over time." },
      { label: "Human publishing review", status: "Required", nextAction: "Keep AI content in draft and approval workflows before publish." },
    ],
    topKeywordTargets: criticalKeywords.length ? criticalKeywords : keywordTargets.slice(0, 4),
    opportunityQueue: [
      ...criticalKeywords.map((keyword) => ({
        title: keyword.keyword,
        area: keyword.cluster,
        impact: keyword.priority,
        targetPath: keyword.targetPath,
        nextAction: keyword.nextAction,
      })),
      {
        title: "County political mail cluster",
        area: "Political SEO",
        impact: "high",
        targetPath: "/ohio/counties/stark-county/political-mail",
        nextAction: "Use county pages to support political outreach packages and campaign postcards.",
      },
      {
        title: "Interactive tools as link assets",
        area: "Backlink growth",
        impact: "high",
        targetPath: "/tools/postcard-roi-calculator",
        nextAction: "Add calculators to educational guides and proposal CTAs.",
      },
    ],
  };
}

export function getTopAuthorityOpportunities(limit = 10): OhioAuthorityPage[] {
  const priorityTopicSlugs = new Set([
    "political-mail",
    "shared-postcards",
    "roofing-marketing",
    "targeted-neighborhood-campaigns",
    "procurement-savings",
    "campaign-postcards",
  ]);

  return listOhioAuthorityPages()
    .filter((page) => !page.topic || priorityTopicSlugs.has(page.topic.slug))
    .sort((a, b) => {
      const aScore = (a.topic?.buyerIntent === "high" ? 10 : 5) + (a.topic ? 2 : 0);
      const bScore = (b.topic?.buyerIntent === "high" ? 10 : 5) + (b.topic ? 2 : 0);
      return bScore - aScore || a.path.localeCompare(b.path);
    })
    .slice(0, limit);
}

function buildCityPage(city: OhioAuthorityCity): OhioAuthorityPage {
  const path = `/ohio/${city.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${city.slug}-ohio-direct-mail-coverage-map`,
    title: `${city.name} Ohio direct mail coverage map`,
    alt: `${city.name} Ohio coverage map for HomeReach direct mail, political mail, and campaign execution`,
    caption: `${city.name} coverage map showing how HomeReach frames local direct mail, political mail, and campaign execution opportunities.`,
    kind: "coverage_map",
    path,
    palette: "blue",
    primaryLabel: `${city.name} coverage`,
    secondaryLabel: city.region,
  });

  return {
    path,
    city,
    topic: null,
    pageType: "city",
    metaTitle: `${city.name} Direct Mail, Political Mail, and Campaign Execution | HomeReach`,
    metaDescription: `Premium direct mail, postcard advertising, political mail, targeted campaigns, and procurement support for ${city.name}, Ohio and ${city.county}.`,
    h1: `${city.name} direct mail and campaign execution authority`,
    eyebrow: `${city.name}, Ohio`,
    intro:
      `${city.marketPositioning} HomeReach keeps the public experience simple while preserving admin-side maps, proposals, outreach, creative, procurement, and fulfillment controls.`,
    strategy: [
      `Use ${city.name} as a geographic authority hub for shared postcards, targeted neighborhood campaigns, political mail, procurement savings, and local business marketing.`,
      `Build internal links from ${city.name} service pages into educational guides so buyers can compare options without landing on thin SEO pages.`,
      `Attach a visual coverage map, postcard preview, and proposal-ready CTA before asking the visitor to start a campaign.`,
    ],
    proofPoints: [
      city.campaignExample,
      `Local anchors include ${city.localAnchors.slice(0, 4).join(", ")}.`,
      `Useful campaign signals include ${city.neighborhoodSignals.slice(0, 3).join(", ")}.`,
    ],
    faqs: [
      {
        question: `What HomeReach services fit ${city.name}?`,
        answer:
          `${city.name} is a fit for shared postcards, targeted route campaigns, political mail, procurement savings, and local business campaign execution depending on the buyer and geography.`,
      },
      {
        question: `Does HomeReach expose advanced targeting publicly in ${city.name}?`,
        answer:
          "No. Public pages show premium previews, maps, examples, and CTAs. Advanced targeting, AI, fulfillment, and proposal controls stay admin-side.",
      },
      {
        question: `Can a ${city.name} campaign include political and business mail?`,
        answer:
          "Yes. The platform supports both, but campaign records, compliance notes, creative approvals, and outreach history stay separated in admin systems.",
      },
    ],
    internalLinks: [
      ...seoAuthorityTopics.slice(0, 8).map((topic) => ({
        label: `${topic.shortLabel} in ${city.name}`,
        href: `/ohio/${city.slug}/${topic.slug}`,
      })),
      { label: "EDDM vs Targeted Mail", href: "/learn/eddm-vs-targeted-mail" },
      { label: "Shared vs Solo Direct Mail", href: "/learn/shared-vs-solo-direct-mail" },
    ],
    visual,
  };
}

function buildTopicPage(city: OhioAuthorityCity, topic: SeoAuthorityTopic): OhioAuthorityPage {
  const path = `/ohio/${city.slug}/${topic.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${city.slug}-${topic.slug}-home-reach-visual`,
    title: `${city.name} ${topic.label} visual`,
    alt: `${city.name} ${topic.label.toLowerCase()} visual showing HomeReach strategy, map, postcard, or dashboard preview`,
    caption: `${topic.label} visual for ${city.name}: ${topic.proofAngle}`,
    kind: topic.visualKind,
    path,
    palette: topic.kind === "political" ? "red" : topic.kind === "procurement" ? "green" : topic.kind === "government_contracts" ? "slate" : "blue",
    primaryLabel: topic.shortLabel,
    secondaryLabel: city.name,
  });

  const related = getRelatedTopics(topic.slug)
    .slice(0, 4)
    .map((relatedTopic) => ({
      label: `${relatedTopic.shortLabel} in ${city.name}`,
      href: `/ohio/${city.slug}/${relatedTopic.slug}`,
    }));

  return {
    path,
    city,
    topic,
    pageType: "city_topic",
    metaTitle: `${topic.label} in ${city.name}, Ohio | HomeReach`,
    metaDescription: `${topic.summary} See premium ${topic.label.toLowerCase()} strategy, maps, visuals, FAQs, and proposal CTAs for ${city.name}, Ohio.`,
    h1: `${topic.label} in ${city.name}, Ohio`,
    eyebrow: `${city.name} ${topic.shortLabel}`,
    intro:
      `${topic.summary} In ${city.name}, the plan should reflect ${city.neighborhoodSignals.slice(0, 2).join(" and ")} while staying simple enough for a buyer to understand quickly.`,
    strategy: [
      topic.headline,
      topic.operatingDepth,
      `${city.campaignExample} For ${topic.shortLabel.toLowerCase()}, the first proposal should show geography, creative, timing, and the next action.`,
    ],
    proofPoints: [
      topic.proofAngle,
      `Relevant ${city.name} anchors: ${city.localAnchors.slice(0, 4).join(", ")}.`,
      `Useful use cases: ${[...topic.examples.slice(0, 2), ...city.businessUseCases.slice(0, 2)].join(", ")}.`,
    ],
    faqs: [
      ...topic.faqs,
      {
        question: `Why does ${city.name} matter for ${topic.label.toLowerCase()}?`,
        answer:
          `${city.marketPositioning} That local context makes the page and proposal more useful than a generic service description.`,
      },
      {
        question: `What should happen after someone visits this ${city.name} page?`,
        answer:
          "The page should route the visitor into a proposal, campaign plan, availability check, or savings review while admin systems log the source and next action.",
      },
    ],
    internalLinks: [
      { label: `${city.name} authority hub`, href: `/ohio/${city.slug}` },
      ...related,
      { label: "How many postcards should a campaign send?", href: "/learn/how-many-postcards-should-a-campaign-send" },
      { label: "Neighborhood saturation marketing", href: "/learn/neighborhood-saturation-marketing" },
    ],
    visual,
  };
}

function buildCountyPage(county: OhioAuthorityCounty): CountyAuthorityPage {
  const path = `/ohio/counties/${county.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${county.slug}-direct-mail-campaign-map`,
    title: `${county.name} direct mail and campaign map`,
    alt: `${county.name} Ohio coverage map for direct mail, political mail, and campaign execution`,
    caption: `${county.name} authority visual for direct mail, political mail, campaign postcards, and route coverage.`,
    kind: "coverage_map",
    path,
    palette: "blue",
    primaryLabel: county.name,
    secondaryLabel: "County authority",
  });

  return {
    path,
    county,
    topic: null,
    pageType: "county",
    metaTitle: `${county.name} Direct Mail, Political Mail, and Campaign Advertising | HomeReach`,
    metaDescription: `Premium county-level direct mail, political mail, campaign postcards, coverage maps, and proposal visuals for ${county.name}, Ohio.`,
    h1: `${county.name} direct mail and campaign advertising authority`,
    eyebrow: `${county.name}, Ohio`,
    intro:
      `${county.directMailAngle} HomeReach keeps the public page simple while maps, outreach, proposals, creative review, and fulfillment stay inside the admin command center.`,
    strategy: [
      county.directMailAngle,
      county.politicalAngle,
      `Use ${county.name} as a county hub that links city pages, political mail pages, tools, case studies, and benchmark datasets together.`,
    ],
    proofPoints: [
      `Local anchors include ${county.anchors.slice(0, 4).join(", ")}.`,
      `Campaign signals include ${county.campaignSignals.slice(0, 4).join(", ")}.`,
      county.businessAngle,
    ],
    faqs: [
      {
        question: `What HomeReach pages support ${county.name}?`,
        answer:
          `${county.name} pages support direct mail, targeted campaigns, political mail, campaign postcards, levy mail, and local advertising authority.`,
      },
      {
        question: "Does this page expose campaign targeting controls?",
        answer:
          "No. Public pages show useful maps, examples, FAQs, and CTAs. Operational controls, outreach, and approvals stay admin-side.",
      },
    ],
    internalLinks: [
      { label: "Political mail", href: `${path}/political-mail` },
      { label: "Campaign postcards", href: `${path}/campaign-postcards` },
      { label: "Direct mail marketing", href: `${path}/direct-mail-marketing` },
      { label: "Campaign coverage calculator", href: "/tools/campaign-coverage-calculator" },
      { label: "Political mail Ohio", href: "/political-mail/ohio" },
      { label: "Ohio authority hub", href: "/ohio" },
    ],
    visual,
  };
}

function buildCountyTopicPage(county: OhioAuthorityCounty, topic: SeoAuthorityTopic): CountyAuthorityPage {
  const path = `/ohio/counties/${county.slug}/${topic.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${county.slug}-${topic.slug}-authority-visual`,
    title: `${county.name} ${topic.label} authority visual`,
    alt: `${county.name} ${topic.label.toLowerCase()} visual showing campaign map, postcard, or proposal proof`,
    caption: `${topic.label} in ${county.name}: ${topic.proofAngle}`,
    kind: topic.visualKind,
    path,
    palette: topic.kind === "political" ? "red" : "blue",
    primaryLabel: topic.shortLabel,
    secondaryLabel: county.name,
  });

  return {
    path,
    county,
    topic,
    pageType: "county_topic",
    metaTitle: `${topic.label} in ${county.name}, Ohio | HomeReach`,
    metaDescription: `${topic.summary} See ${county.name} maps, postcard visuals, campaign strategy, FAQs, and proposal CTAs.`,
    h1: `${topic.label} in ${county.name}, Ohio`,
    eyebrow: `${county.name} ${topic.shortLabel}`,
    intro:
      `${topic.summary} In ${county.name}, the plan should reflect ${county.campaignSignals.slice(0, 2).join(" and ")} while staying simple enough for a campaign or business buyer to act.`,
    strategy: [
      topic.headline,
      topic.operatingDepth,
      topic.kind === "political" ? county.politicalAngle : county.businessAngle,
    ],
    proofPoints: [
      topic.proofAngle,
      `Relevant anchors: ${county.anchors.slice(0, 4).join(", ")}.`,
      `Useful campaign signals: ${county.campaignSignals.slice(0, 3).join(", ")}.`,
    ],
    faqs: [
      ...topic.faqs,
      {
        question: `Why does ${county.name} matter for ${topic.label.toLowerCase()}?`,
        answer:
          `${county.directMailAngle} That makes the page stronger than a generic service description and gives the proposal a real geographic basis.`,
      },
    ],
    internalLinks: [
      { label: `${county.name} authority hub`, href: `/ohio/counties/${county.slug}` },
      { label: "Political mail strategy", href: "/political-mail/political-direct-mail-strategy" },
      { label: "Campaign postcard designs", href: "/political-mail/campaign-postcard-designs" },
      { label: "Postcard ROI calculator", href: "/tools/postcard-roi-calculator" },
      { label: "Campaign map gallery", href: "/visuals/campaign-map-gallery" },
    ],
    visual,
  };
}

function createPoliticalAuthorityPage(input: {
  slug: string;
  pageType: PoliticalAuthorityPage["pageType"];
  title: string;
  h1: string;
  audience: string;
  summary: string;
  strategy: string[];
  proofPoints: string[];
}): PoliticalAuthorityPage {
  const path = `/political-mail/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `political-mail-${input.slug}-home-reach-visual`,
    title: `${input.title} visual`,
    alt: `${input.title} visual with political postcard mockup, campaign map, or rollout proof`,
    caption: `${input.title}: realistic political mail, rollout strategy, and proposal-ready visual proof.`,
    kind: "political_mail",
    path,
    palette: "red",
    primaryLabel: input.title,
    secondaryLabel: "Political mail",
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Political Mail`,
    metaDescription: input.summary,
    eyebrow: "Political SEO authority",
    ctaLabel: "Plan Political Mail",
    ctaHref: "/political",
    faqs: [
      {
        question: `Who should use ${input.title}?`,
        answer: input.audience,
      },
      {
        question: "Does HomeReach create individual voter persuasion profiles?",
        answer:
          "No. HomeReach public SEO pages focus on geography, logistics, creative concepts, mail timing, and campaign execution. Individual political belief inference is not part of this system.",
      },
    ],
    internalLinks: [
      { label: "Political postcard gallery", href: "/visuals/political-postcard-gallery" },
      { label: "Political mail estimator", href: "/tools/political-mail-estimator" },
      { label: "Campaign mail benchmarks", href: "/benchmarks/campaign-mail-benchmarks" },
      { label: "County campaign mail", href: "/political-mail/county-campaign-mail" },
      { label: "Ohio authority hub", href: "/ohio" },
    ],
    visual,
  };
}

function createCaseStudy(input: {
  slug: string;
  title: string;
  market: string;
  category: string;
  resultSignal: string;
  summary: string;
  rollout: string[];
  strategy: string[];
  proofPoints: string[];
  ctaLabel: string;
  ctaHref: string;
  visualKind: AuthorityVisualKind;
}): SeoCaseStudy {
  const path = `/case-studies/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-case-study-visual`,
    title: `${input.title} visual case study`,
    alt: `${input.title} visual case study with map, postcard, rollout, or proposal proof`,
    caption: `Case study visual for ${input.title}.`,
    kind: input.visualKind,
    path,
    palette: input.visualKind === "political_mail" ? "red" : input.visualKind === "coverage_map" ? "blue" : "green",
    primaryLabel: input.category,
    secondaryLabel: input.market,
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Case Study`,
    metaDescription: input.summary,
    visual,
    internalLinks: [
      { label: "Case studies", href: "/case-studies" },
      { label: "Postcard ROI calculator", href: "/tools/postcard-roi-calculator" },
      { label: "Ohio authority hub", href: "/ohio" },
    ],
  };
}

function createInteractiveTool(input: Omit<InteractiveSeoTool, "path" | "metaTitle" | "metaDescription" | "visual" | "internalLinks"> & { visualKind: AuthorityVisualKind }): InteractiveSeoTool {
  const path = `/tools/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-interactive-seo-tool`,
    title: `${input.title} visual`,
    alt: `${input.title} visual showing calculator, dashboard, or campaign planning output`,
    caption: `${input.title}: interactive SEO tool for lead generation and buyer education.`,
    kind: input.visualKind,
    path,
    palette: input.calculatorType === "political_mail" ? "red" : input.calculatorType === "procurement_savings" ? "green" : "blue",
    primaryLabel: "Interactive tool",
    secondaryLabel: input.title,
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Interactive Tool`,
    metaDescription: input.summary,
    visual,
    internalLinks: [
      { label: "All interactive tools", href: "/tools" },
      { label: "EDDM vs targeted mail", href: "/learn/eddm-vs-targeted-mail" },
      { label: "Case studies", href: "/case-studies" },
    ],
  };
}

function createInsight(input: {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  signals: string[];
  recommendations: string[];
  visualKind: AuthorityVisualKind;
}): AuthorityInsight {
  const path = `/insights/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-authority-insight-visual`,
    title: `${input.title} visual insight`,
    alt: `${input.title} visual showing HomeReach authority insight, map, dashboard, or postcard proof`,
    caption: `Authority insight visual for ${input.title}.`,
    kind: input.visualKind,
    path,
    palette: input.visualKind === "political_mail" ? "red" : input.visualKind === "dashboard" ? "green" : "blue",
    primaryLabel: "Insight",
    secondaryLabel: input.title,
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Insights`,
    metaDescription: input.summary,
    faqs: [
      {
        question: "Why publish this as an insight instead of a generic blog post?",
        answer:
          "HomeReach insights are built around operational signals, maps, campaign examples, calculators, datasets, and proposal next steps rather than generic content.",
      },
      {
        question: "How does this support AI search?",
        answer:
          "The page uses concise answers, structured sections, FAQs, visuals, and internal links so AI systems can understand and cite the topic more easily.",
      },
    ],
    visual,
    internalLinks: [
      { label: "Insights center", href: "/insights" },
      { label: "Benchmarks", href: "/benchmarks" },
      { label: "Visual galleries", href: "/visuals" },
    ],
  };
}

function createVisualGallery(input: {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  categories: string[];
  locations: string[];
  visualKind: AuthorityVisualKind;
}): VisualGallery {
  const path = `/visuals/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-gallery-cover`,
    title: `${input.title} cover visual`,
    alt: `${input.title} cover visual for HomeReach SEO gallery`,
    caption: `${input.title}: searchable visual SEO gallery with category and location metadata.`,
    kind: input.visualKind,
    path,
    palette: input.visualKind === "political_mail" ? "red" : input.visualKind === "proposal" ? "green" : "blue",
    primaryLabel: "Visual gallery",
    secondaryLabel: input.title,
  });

  const items = input.categories.map((category, index) => {
    const location = input.locations[index % input.locations.length] ?? "Ohio";
    const locationSlug = location.toLowerCase().replaceAll(" ", "-");
    return {
      title: `${input.title} - ${category}`,
      category,
      location,
      description: `${category} visual concept for ${location}, designed to support SEO, proposal proof, outreach, or campaign planning.`,
      tags: [category, location, "HomeReach", "SEO visual"],
      visual: createVisualAsset({
        assetSlug: `${input.slug}-${category.replaceAll(" ", "-")}-${locationSlug}`,
        title: `${input.title} ${category} ${location}`,
        alt: `${input.title} ${category} visual for ${location}`,
        caption: `${category} gallery visual for ${location}.`,
        kind: input.visualKind,
        path,
        palette: input.visualKind === "political_mail" ? "red" : "blue",
        primaryLabel: category,
        secondaryLabel: location,
      }),
    };
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Visual SEO Gallery`,
    metaDescription: input.summary,
    items,
    visual,
    internalLinks: [
      { label: "All visual galleries", href: "/visuals" },
      { label: "Political mail designs", href: "/political-mail/campaign-postcard-designs" },
      { label: "Campaign map gallery", href: "/visuals/campaign-map-gallery" },
    ],
  };
}

function createDataset(input: {
  slug: string;
  title: string;
  eyebrow: string;
  summary: string;
  metrics: AuthorityDataset["metrics"];
  methodology: string[];
  useCases: string[];
  visualKind: AuthorityVisualKind;
}): AuthorityDataset {
  const path = `/benchmarks/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-authority-dataset-visual`,
    title: `${input.title} dataset visual`,
    alt: `${input.title} dataset visual with benchmarks, metrics, or dashboard preview`,
    caption: `${input.title}: proprietary HomeReach benchmark dataset for SEO authority and proposal planning.`,
    kind: input.visualKind,
    path,
    palette: input.visualKind === "political_mail" ? "red" : input.visualKind === "dashboard" ? "green" : "slate",
    primaryLabel: "Benchmark",
    secondaryLabel: input.title,
  });

  return {
    ...input,
    path,
    metaTitle: `${input.title} | HomeReach Benchmarks`,
    metaDescription: input.summary,
    visual,
    internalLinks: [
      { label: "All benchmarks", href: "/benchmarks" },
      { label: "Interactive tools", href: "/tools" },
      { label: "Insights", href: "/insights" },
    ],
  };
}

function getRelatedTopics(topicSlug: string): SeoAuthorityTopic[] {
  const topic = seoAuthorityTopics.find((item) => item.slug === topicSlug);
  if (!topic) return seoAuthorityTopics.slice(0, 4);
  return seoAuthorityTopics.filter((item) => item.slug !== topicSlug && (item.kind === topic.kind || item.buyerIntent === "high"));
}

function createGuide(input: {
  slug: string;
  title: string;
  audience: string;
  summary: string;
  sections: Array<[string, string]>;
  checklist: string[];
  ctaLabel: string;
  ctaHref: string;
  visualKind: AuthorityVisualKind;
}): AuthorityGuide {
  const path = `/learn/${input.slug}`;
  const visual = createVisualAsset({
    assetSlug: `${input.slug}-home-reach-guide-visual`,
    title: `${input.title} visual guide`,
    alt: `${input.title} visual guide for HomeReach direct mail and campaign strategy`,
    caption: `Educational visual for ${input.title}.`,
    kind: input.visualKind,
    path,
    palette: input.visualKind === "political_mail" ? "red" : input.visualKind === "dashboard" ? "green" : "blue",
    primaryLabel: "Strategy guide",
    secondaryLabel: input.title,
  });

  return {
    slug: input.slug,
    title: input.title,
    metaTitle: `${input.title} | HomeReach Guide`,
    metaDescription: input.summary,
    eyebrow: "HomeReach guide",
    audience: input.audience,
    summary: input.summary,
    sections: input.sections.map(([heading, body]) => ({ heading, body })),
    checklist: input.checklist,
    faqs: [
      {
        question: `Who should read ${input.title}?`,
        answer: input.audience,
      },
      {
        question: "How does this guide connect to HomeReach?",
        answer:
          "It explains the buyer-facing strategy while HomeReach admin systems handle proposals, maps, proofs, follow-up, payment, and fulfillment.",
      },
    ],
    ctaLabel: input.ctaLabel,
    ctaHref: input.ctaHref,
    visual,
    internalLinks: [
      { label: "Ohio authority hub", href: "/ohio" },
      { label: "Columbus direct mail", href: "/ohio/columbus/direct-mail-marketing" },
      { label: "Political mail Ohio", href: "/ohio/cleveland/political-mail" },
    ],
  };
}

function createVisualAsset(input: SeoVisualAsset): SeoVisualAsset {
  return input;
}
