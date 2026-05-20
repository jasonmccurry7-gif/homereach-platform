export const AMY_ACTON_PRESENTATION_ASSETS = {
  pptxHref: "/political/presentation/home-reach-amy-acton-ohio-voter-contact-strategy.pptx",
  pdfHref: "/political/presentation/home-reach-amy-acton-ohio-voter-contact-strategy.pdf",
  outlineHref: "/political/presentation/amy-acton-deck-outline.md",
} as const;

export const AMY_ACTON_PRESENTATION_SOURCES = [
  {
    label: "Dr. Amy Acton for Governor campaign site",
    url: "https://actonforgovernor.com/",
    note: "Campaign identity, public theme, and official positioning reference.",
  },
  {
    label: "USPS Every Door Direct Mail",
    url: "https://www.usps.com/business/every-door-direct-mail.htm",
    note: "EDDM route selection, ZIP/neighborhood route planning, mailing steps, and route-count verification context.",
  },
  {
    label: "Ohio Secretary of State elections",
    url: "https://www.ohiosos.gov/elections/",
    note: "Official election calendars, filings, districts, and election result source of record.",
  },
  {
    label: "U.S. Census Bureau QuickFacts: Ohio",
    url: "https://www.census.gov/quickfacts/OH",
    note: "Population and household context for Ohio market sizing and county-level planning assumptions.",
  },
] as const;

export type AmyActonTargetingArea = {
  name: string;
  geography: string;
  whyItMatters: string;
  voterContactLogic: string;
  saturationOpportunity: string;
  estimatedReach: string;
  timing: string;
  tone: string;
  routeStatus: "planning" | "needs_usps";
};

export const AMY_ACTON_TARGETING_AREAS: AmyActonTargetingArea[] = [
  {
    name: "Franklin County suburban ring",
    geography: "Columbus, Dublin, Hilliard, Worthington, Upper Arlington, Westerville",
    whyItMatters: "Central Ohio gives the campaign a high-density launch base with statewide media-market visibility and education-heavy suburban communities.",
    voterContactLogic: "Use route clusters around first-ring and high-growth suburbs for repeated household contact without relying on individual voter profiling.",
    saturationOpportunity: "High route density makes multi-wave saturation operationally efficient.",
    estimatedReach: "220k to 340k households per major wave after USPS route lock",
    timing: "Name ID early; affordability and health care mid-cycle; GOTV in final 21 days.",
    tone: "Competent, family-centered, optimistic, and practical.",
    routeStatus: "needs_usps",
  },
  {
    name: "Cuyahoga and Lake trust corridor",
    geography: "Cleveland, Parma, Lakewood, Shaker Heights, Mentor, Willoughby",
    whyItMatters: "Northeast Ohio is essential for Democratic turnout, healthcare credibility, and trust-building message repetition.",
    voterContactLogic: "Balance urban turnout reinforcement with suburban trust-building and community-service storytelling.",
    saturationOpportunity: "Dense carrier routes can support high-frequency waves tied to early vote and in-home windows.",
    estimatedReach: "260k to 390k households per major wave after USPS route lock",
    timing: "Trust and health-care leadership should land before contrast mail.",
    tone: "Steady, empathetic, credible, and locally grounded.",
    routeStatus: "needs_usps",
  },
  {
    name: "Hamilton County suburban persuasion arc",
    geography: "Cincinnati, Norwood, Blue Ash, Sharonville, Anderson Township, Springfield Township",
    whyItMatters: "Southwest Ohio gives the campaign a dense persuasion and turnout mix with strong media-market leverage.",
    voterContactLogic: "Cluster household routes by suburban rings and Cincinnati neighborhood corridors, then align copy to affordability and family cost pressure.",
    saturationOpportunity: "Compact geography supports repeat drops with predictable production windows.",
    estimatedReach: "170k to 275k households per major wave after USPS route lock",
    timing: "Introduction and affordability early; contrast and ballot reminders late.",
    tone: "Warm, practical, fiscally aware, and family-first.",
    routeStatus: "needs_usps",
  },
  {
    name: "Summit, Stark, and Mahoning opportunity zone",
    geography: "Akron, Cuyahoga Falls, Canton, Massillon, Youngstown, Boardman",
    whyItMatters: "Northeast and Mahoning Valley communities can connect healthcare, jobs, and public-service credibility to kitchen-table concerns.",
    voterContactLogic: "Use county-seat and working-family routes for message repetition without individual persuasion scoring.",
    saturationOpportunity: "Route clustering can reduce wasted blanket mail while preserving local presence.",
    estimatedReach: "185k to 300k households per major wave after USPS route lock",
    timing: "Trust-building first; issue mail around health care and costs; final GOTV reminder.",
    tone: "Plainspoken, respectful, worker-aware, and hopeful.",
    routeStatus: "needs_usps",
  },
  {
    name: "Lucas and northwest turnout amplifier",
    geography: "Toledo, Sylvania, Maumee, Oregon, Bowling Green corridor",
    whyItMatters: "Northwest Ohio adds a distinct media market and a practical turnout amplification lane for a statewide campaign.",
    voterContactLogic: "Layer urban and college/community routes with simple election-date and early-vote mail.",
    saturationOpportunity: "Focused waves can create local repetition without overextending statewide budget.",
    estimatedReach: "95k to 160k households per major wave after USPS route lock",
    timing: "Mid-cycle issue mail; final 30-day vote-plan and GOTV wave.",
    tone: "Local, accessible, deadline-aware, and community-centered.",
    routeStatus: "needs_usps",
  },
  {
    name: "Delaware, Union, and Warren growth corridors",
    geography: "Delaware, Powell, Marysville, Mason, Lebanon, Springboro",
    whyItMatters: "Fast-growing suburban and exurban counties are critical for credibility, margin management, and visibility beyond the base.",
    voterContactLogic: "Use high-growth route clusters for trust, affordability, and community-focused mail.",
    saturationOpportunity: "Selective saturation avoids waste while putting Acton in front of households that campaigns cannot ignore.",
    estimatedReach: "105k to 190k households per major wave after USPS route lock",
    timing: "Trust and affordability before high-intensity contrast.",
    tone: "Reassuring, responsible, family-oriented, and pragmatic.",
    routeStatus: "needs_usps",
  },
] as const;

export type AmyActonCampaignPhase = {
  name: string;
  objective: string;
  audience: string;
  geography: string;
  cadence: string;
  quantity: string;
  saturationStrategy: string;
  executionPlan: string;
  postcardThemes: string[];
};

export const AMY_ACTON_CAMPAIGN_PHASES: AmyActonCampaignPhase[] = [
  {
    name: "Name ID + Introduction",
    objective: "Make Acton's public-service story simple, memorable, and repeatable.",
    audience: "Aggregate households across major Ohio metros and first-ring suburban routes.",
    geography: "Franklin, Cuyahoga, Hamilton, Summit, Lucas, Montgomery, Delaware, Lorain.",
    cadence: "First major wave 5 to 6 months before November, with a second reinforcing drop if budget allows.",
    quantity: "850k to 1.25M pieces per statewide wave after USPS route lock.",
    saturationStrategy: "Lead with high-density media-market corridors and repeat the story in priority suburban rings.",
    executionPlan: "Confirm route counts, approve biography/legal language, then print and stage by market.",
    postcardThemes: ["Doctor who served Ohio", "Public service over politics", "Power back to Ohioans", "Family-centered leadership"],
  },
  {
    name: "Trust + Healthcare Leadership",
    objective: "Convert biography into credibility around health care, costs, and responsible leadership.",
    audience: "Suburban families, healthcare-sensitive communities, education-heavy suburbs, and urban turnout corridors at aggregate geography level.",
    geography: "Central Ohio suburbs, Northeast Ohio trust corridor, Cincinnati suburban arc, Akron/Canton corridor.",
    cadence: "3.5 to 4.5 months before November, after introduction has landed.",
    quantity: "700k to 1.05M pieces per major wave after USPS route lock.",
    saturationStrategy: "Use tighter route clusters so health-care credibility lands with repetition.",
    executionPlan: "Match creative to approved campaign issue copy and route clusters; lock QR/landing page before print.",
    postcardThemes: ["Healthcare that feels personal", "Lower costs for families", "Tested leadership", "Communities that work again"],
  },
  {
    name: "Contrast + Momentum",
    objective: "Frame the public choice with factual, compliant contrast and visible campaign momentum.",
    audience: "Competitive suburban, exurban, and county-seat household routes selected from aggregate public geography.",
    geography: "Hamilton suburban rings, Delaware/Union/Warren growth corridors, Lake/Lorain persuasion zones, Stark/Summit pockets.",
    cadence: "6 to 8 weeks before November, after vote-by-mail and early-vote plans are clear.",
    quantity: "500k to 850k pieces per contrast wave after legal approval.",
    saturationStrategy: "Avoid blanket mail; concentrate on route groups where message repetition can be seen.",
    executionPlan: "Source every contrast claim, legal-review copy, then lock print window and mail-entry schedule.",
    postcardThemes: ["A clear choice for Ohio", "Costs and care on the ballot", "Momentum in every county", "Ohio families deserve better"],
  },
  {
    name: "GOTV + Turnout Push",
    objective: "Turn attention into action with voting-plan, deadline, and final reminder mail.",
    audience: "Aggregate household routes in turnout-sensitive metros, college/community areas, and high-density early-vote corridors.",
    geography: "Cuyahoga, Franklin, Hamilton, Lucas, Montgomery, Summit, Athens-adjacent college/community clusters.",
    cadence: "Final 21 days, coordinated to early vote, absentee return, and Election Day deadlines.",
    quantity: "600k to 1.1M pieces across one to two final waves after route lock.",
    saturationStrategy: "Use deadline-specific mail with disciplined in-home windows.",
    executionPlan: "Finalize official election dates, use verified QR destination, and stage drops by USPS entry timing.",
    postcardThemes: ["Make your voting plan", "Bring power back to Ohioans", "Your community has a voice", "Final reminder"],
  },
] as const;

export type AmyActonPostcardConcept = {
  category: string;
  frontHeadline: string;
  frontCopy: string;
  backHeadline: string;
  backCopy: string;
  cta: string;
  visualDirection: string;
};

export const AMY_ACTON_POSTCARD_CONCEPTS: AmyActonPostcardConcept[] = [
  {
    category: "Emotional / Human",
    frontHeadline: "A doctor. A public servant. A governor for Ohio families.",
    frontCopy: "Amy Acton has spent her career showing up when Ohioans needed steady leadership.",
    backHeadline: "Power belongs with the people of Ohio.",
    backCopy: "A warm introduction mailer centered on service, trust, and the campaign's official people-first message.",
    cta: "Learn Amy's story and make your voting plan.",
    visualDirection: "Candidate portrait with neighborhood light, soft navy field, restrained red CTA, and Ohio outline watermark.",
  },
  {
    category: "Policy / Issue",
    frontHeadline: "Lower costs. Stronger care. Leadership that listens.",
    frontCopy: "A healthcare and affordability mailer that connects Acton's public-service credibility to kitchen-table pressure.",
    backHeadline: "What Ohio families need now",
    backCopy: "Three campaign-approved proof points, QR to official plan, and local county line customized by geography.",
    cta: "Read the affordability plan.",
    visualDirection: "Clean issue-first design with family table, clinic/main-street imagery, and clear evidence hierarchy.",
  },
  {
    category: "Trust / Social Proof",
    frontHeadline: "Ohioans know what steady leadership looks like.",
    frontCopy: "A testimonial-ready design with quote slots reserved for campaign-approved validators.",
    backHeadline: "Trusted voices. Local stakes.",
    backCopy: "Validator quote, campaign-approved attribution, source date, and concise issue summary.",
    cta: "See why Ohio leaders are paying attention.",
    visualDirection: "Editorial quote treatment, validator photo zone, and county-specific message strip.",
  },
  {
    category: "Contrast / Urgency",
    frontHeadline: "Ohio has a choice: more struggle, or leadership that refuses to look away.",
    frontCopy: "A factual contrast piece that keeps the stakes clear and legally reviewable.",
    backHeadline: "Do not wait until the final week.",
    backCopy: "Campaign-approved contrast, official voting deadlines, QR destination, and disclaimer space.",
    cta: "Compare the choice. Vote on time.",
    visualDirection: "Split-map Ohio visual, urgent but restrained red accent, and strong deadline panel.",
  },
] as const;

export type AmyActonPresentationSlide = {
  number: number;
  kicker: string;
  title: string;
  summary: string;
  proofObject: string;
  bullets: string[];
  speakerNotes: string;
};

export const AMY_ACTON_PRESENTATION_SLIDES: AmyActonPresentationSlide[] = [
  {
    number: 1,
    kicker: "Prepared For",
    title: "Ohio Voter Contact & Geographic Saturation Strategy",
    summary: "A proposal for Dr. Amy Acton for Governor showing how HomeReach can plan, creative, price, and execute statewide postcard programs.",
    proofObject: "Premium Ohio command-map visualization with route overlays and campaign wave markers.",
    bullets: ["Statewide mail strategy", "Route-level execution planning", "Multi-phase postcard system"],
    speakerNotes: "Open by positioning HomeReach as an operational execution partner, not a printer. Make clear this is a proposal and does not imply campaign approval.",
  },
  {
    number: 2,
    kicker: "Platform Role",
    title: "HomeReach turns mail into an operating system for statewide voter contact.",
    summary: "Built from logistics and operational discipline: route planning, timing, approvals, pricing, and production visibility in one workflow.",
    proofObject: "Operational stack diagram: intelligence, geography, creative, pricing, production, tracking.",
    bullets: ["Route-level strategy", "Saturation methodology", "Timing coordination", "Operational visibility"],
    speakerNotes: "Separate HomeReach from traditional print vendors. The campaign buys visibility, speed, and controlled execution, not just postcards.",
  },
  {
    number: 3,
    kicker: "Campaign Problem",
    title: "Statewide campaigns lose time when mail strategy, creative, and execution live in separate rooms.",
    summary: "Rising costs and fragmented attention make unmanaged blanket mail expensive and hard to evaluate.",
    proofObject: "Problem pressure chart: cost, speed, visibility, timing, and geographic precision.",
    bullets: ["Rising mail costs", "Fragmented voter attention", "Disconnected proofs and approvals", "Limited delivery confidence"],
    speakerNotes: "Frame the operational pain before presenting the solution. The problem is not that campaigns need a postcard vendor; they need a command center for mail decisions.",
  },
  {
    number: 4,
    kicker: "Difference",
    title: "HomeReach compresses quote, map, creative, approval, and mail execution into one visible workflow.",
    summary: "The platform replaces slow static quoting with coordinated scenario planning and route-aware campaign execution.",
    proofObject: "Traditional vendor vs HomeReach operating model comparison.",
    bullets: ["Route-level precision", "Geographic clustering", "Predictable cost modeling", "Dashboard accountability"],
    speakerNotes: "Use this slide to make the buying choice obvious. HomeReach is designed to help staff move faster with fewer handoffs.",
  },
  {
    number: 5,
    kicker: "Ohio Intelligence",
    title: "Acton's strongest mail path starts with trust-building suburbs plus turnout-critical metro corridors.",
    summary: "Targeting uses public aggregate geography, election context, household density, media-market logic, and USPS route feasibility.",
    proofObject: "Ohio targeting board with counties, city clusters, ZIP/corridor examples, estimated reach, timing, and message tone.",
    bullets: ["Franklin/Cuyahoga/Hamilton metro power", "Summit/Stark/Mahoning trust corridor", "Delaware/Union/Warren growth corridors", "Lucas northwest turnout amplifier"],
    speakerNotes: "Be explicit that this is aggregate geographic planning. Final carrier-route IDs and counts require USPS EDDM or carrier-route data import before quoting.",
  },
  {
    number: 6,
    kicker: "Campaign Sequence",
    title: "A four-wave program lets Acton build name ID, credibility, contrast, and turnout on schedule.",
    summary: "Each phase has a distinct job, geography, cadence, quantity range, and creative lane.",
    proofObject: "Horizontal campaign timeline from introduction to GOTV with quantities and approval gates.",
    bullets: ["Introduction", "Trust + health care", "Contrast + momentum", "GOTV + final reminder"],
    speakerNotes: "Walk the team through the cadence. The key idea is control: the campaign knows what each wave is supposed to do and when it must be approved.",
  },
  {
    number: 7,
    kicker: "Creative Engine",
    title: "The AI creative layer produces complete front/back postcard concepts, not generic placeholder proofs.",
    summary: "Every phase can generate emotional, issue, trust/social-proof, and contrast/urgency options for staff review.",
    proofObject: "Four realistic postcard mockups with front/back message systems and CTA/disclaimer structure.",
    bullets: ["Front and back previews", "Comment/revision workflow", "Approval tracking", "Production handoff"],
    speakerNotes: "Stress human approval and legal review. AI accelerates draft options, but the campaign controls final copy, sourcing, and disclaimers.",
  },
  {
    number: 8,
    kicker: "Visibility",
    title: "Campaign staff can see coverage, route readiness, creative status, and mail timing in one command view.",
    summary: "The dashboard exposes campaign readiness before money is committed or mail enters production.",
    proofObject: "Dashboard mock: map layer, readiness gates, mail waves, production status, and agent recommendations.",
    bullets: ["Route visibility", "Coverage visibility", "Timing visibility", "Production tracking"],
    speakerNotes: "This is where the deck should feel like a real operations platform. Emphasize decision clarity and fewer dropped balls.",
  },
  {
    number: 9,
    kicker: "Cost Control",
    title: "Route-aware planning makes statewide mail budgets easier to forecast before final quote lock.",
    summary: "HomeReach separates planning estimates from verified USPS counts and final production pricing.",
    proofObject: "Mail wave cost model showing pieces, cost-per-piece range, estimated totals, and quote-lock gates.",
    bullets: ["Predictable budgeting", "Scalable drops", "Route optimization", "Cost-per-contact visibility"],
    speakerNotes: "Keep pricing conservative. Explain that production checkout remains locked until route counts, print cost, postage, and approval are verified.",
  },
  {
    number: 10,
    kicker: "Why It Matters",
    title: "The campaign gets more than mail: it gets disciplined message repetition across the state.",
    summary: "The outcome is a faster, clearer, more coordinated voter-contact program with operational confidence.",
    proofObject: "Momentum loop: message, route, approve, mail, track, adjust.",
    bullets: ["Voter contact efficiency", "Message consistency", "Statewide coordination", "Campaign momentum"],
    speakerNotes: "Tie operational capability back to campaign emotion: Ohioans hear a consistent story at the right time in the right places.",
  },
  {
    number: 11,
    kicker: "Next Steps",
    title: "Start with a focused strategy session, then convert the best route clusters into a pilot wave.",
    summary: "The first session should align geography, message lanes, budget range, and a sample proof-to-mail workflow.",
    proofObject: "Three-step next action board: targeting review, sample route analysis, creative direction review.",
    bullets: ["Campaign targeting review", "Route analysis", "Creative direction review", "Pilot wave discussion"],
    speakerNotes: "Close simply. The ask is not to buy every wave today; it is to schedule a serious strategy review and build a verified pilot.",
  },
] as const;
