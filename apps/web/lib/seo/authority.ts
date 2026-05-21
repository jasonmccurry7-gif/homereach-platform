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
      count: pages.filter((page) => page.topic?.kind === "political").length,
      detail: "Ohio political, levy, judicial, campaign postcard, and GOTV pages with compliance-safe positioning.",
      nextAction: "Pair political pages with outreach strategy packages and true postcard mockups.",
      href: "/admin/political/outreach-strategy",
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
