import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@homereach/services/outreach";
import { DAILY_OUTREACH_SENDER_PROFILES } from "./drafts";
import { logOutreachActivity, todayKey } from "./server";
import type { DailyOutreachSenderKey, DailyOutreachTask } from "./types";

export const TARGETED_PLAN_TYPE = "daily_targeted_outreach";

export type TargetedOutcomeStatus =
  | "New"
  | "Contacted"
  | "Follow-Up Due"
  | "Interested"
  | "Needs Quote"
  | "Proposal Sent"
  | "Won"
  | "Lost"
  | "Not a Fit";

export type TargetedPlanPayload = {
  date: string;
  stats: {
    newProspects: number;
    followUpsDue: number;
    emailsCompleted: number;
    textsCompleted: number;
    dmsCompleted: number;
    callsCompleted: number;
    interestedReplies: number;
    quotesNeeded: number;
    dailyGoal: number;
    followUpGoal: number;
    completionPercent: number;
  };
  tasks: DailyOutreachTask[];
  socialPosts: Array<{
    id: string;
    post_type: string;
    category: string;
    audience?: string | null;
    content: string;
    short_content?: string | null;
    status: string;
    posted: boolean;
  }>;
  activity: Array<{
    id: string;
    task_id?: string | null;
    activity_type: string;
    channel?: string | null;
    status: string;
    summary?: string | null;
    created_at: string;
    metadata?: Record<string, unknown> | null;
  }>;
  sourceWarning?: string | null;
};

type SourceProspect = {
  source_table: string;
  source_id: string | null;
  prospect_id?: string | null;
  business_name: string;
  contact_name?: string | null;
  industry?: string | null;
  vertical: string;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  facebook_url?: string | null;
  messenger_url?: string | null;
  city?: string | null;
  state?: string | null;
  notes?: string | null;
  last_contacted_at?: string | null;
  follow_up_date?: string | null;
  status?: string | null;
  score?: number | null;
  metadata?: Record<string, unknown> | null;
};

const DAILY_TARGETED_NEW_GOAL = 32;
const DAILY_TARGETED_FOLLOW_UP_GOAL = 8;

const AUTO_VERTICALS = [
  "Dealership",
  "Used car lot",
  "Auto service center",
  "Collision center",
  "Tire shop",
] as const;

const MEDICAL_VERTICALS = [
  "Dentist",
  "Orthodontist",
  "Doctor",
  "Urgent care clinic",
  "Chiropractor",
  "Med spa",
  "Eye care",
  "Physical therapy",
  "Veterinarian",
  "Senior care",
  "Pediatric dentist",
  "Cosmetic dentist",
] as const;

const LOCAL_SERVICE_VERTICALS = [
  "Contractor",
  "Realtor",
  "Insurance agency",
  "Fitness studio",
  "Salon",
  "Restaurant",
  "Pizza shop",
  "Bakery",
  "Local retail",
  "Church",
] as const;

type SerpApiLocalResult = {
  title?: string;
  phone?: string;
  website?: string;
  address?: string;
  rating?: number;
  reviews?: number;
  place_id?: string;
  gps_coordinates?: {
    latitude?: number;
    longitude?: number;
  };
  [key: string]: unknown;
};

type SerpApiLocalResponse = {
  local_results?: SerpApiLocalResult[];
  error?: string;
  search_metadata?: Record<string, unknown>;
};

type HunterDomainSearchResponse = {
  data?: {
    emails?: Array<{
      value?: string;
      type?: string;
      confidence?: number;
      first_name?: string | null;
      last_name?: string | null;
      position?: string | null;
      sources?: Array<{ uri?: string; extracted_on?: string }>;
    }>;
  };
  errors?: Array<{ details?: string; id?: string }>;
};

type WebsiteResearch = {
  status: "researched" | "missing_website" | "failed";
  url: string | null;
  title?: string | null;
  description?: string | null;
  serviceSignals: string[];
  offerSignals: string[];
  trustSignals: string[];
  recommendedPostcardAngle: string;
  confidence: number;
  retrievedAt: string;
  error?: string | null;
};

type WebsiteContactDiscovery = {
  status: "found" | "not_found" | "failed" | "missing_website";
  sourceUrl: string | null;
  email: string | null;
  facebookUrl: string | null;
  messengerUrl: string | null;
  emailProvider: "website" | "hunter" | null;
  hunterConfidence: number | null;
  confidence: number;
  notes: string[];
  retrievedAt: string;
  error?: string | null;
};

type PostcardDesignBrief = {
  format: "6x9_postcard";
  businessName: string;
  vertical: string;
  frontHeadline: string;
  frontSubheadline: string;
  offer: string;
  cta: string;
  qrDestination: string;
  backBody: string;
  imageDirection: string;
  brandNotes: string[];
  recommendedAudience: string;
  recommendedQuantity: number;
  complianceNotes: string[];
  generatedAt: string;
  sourceUrl: string | null;
  sourceConfidence: number;
};

type DailyProspectRefreshResult = {
  ok: boolean;
  inserted: number;
  enriched: number;
  skipped: number;
  searched: number;
  warnings: string[];
  providerConfigured: boolean;
  markets: string[];
  categories: string[];
};

type TargetedVerticalGroup = "auto" | "medical" | "local_service";

type TargetedCampaignIntelligence = {
  group: TargetedVerticalGroup;
  senderKey: Extract<DailyOutreachSenderKey, "chelsi" | "heather">;
  offer: string;
  subjectAngle: string;
  strategicPurpose: string;
  trustNote: string;
  cta: string;
  dmCta: string;
  urgencySignal: string;
};

const VERTICAL_CAMPAIGN_INTELLIGENCE: Record<string, TargetedCampaignIntelligence> = {
  Dealership: {
    group: "auto",
    senderKey: "heather",
    offer: "service-lane and trade-in neighborhood campaign",
    subjectAngle: "local market visibility map",
    strategicPurpose: "It keeps the dealership visible near households that may need service, replacement vehicles, or a reason to compare local inventory.",
    trustNote: "This is controlled route-based visibility, not a generic coupon drop.",
    cta: "Would you like me to send the first route map I would test around your dealership?",
    dmCta: "map nearby routes for service and trade-in visibility",
    urgencySignal: "Competing dealers are already fighting for service-lane and trade-in attention in the same neighborhoods.",
  },
  "Used car lot": {
    group: "auto",
    senderKey: "heather",
    offer: "pre-owned inventory visibility campaign",
    subjectAngle: "nearby buyer route idea",
    strategicPurpose: "It gives nearby households a simple reason to remember the lot before they start shopping online or visiting larger stores.",
    trustNote: "The first step is a small route map and proof, so the campaign can be reviewed before spend is committed.",
    cta: "Should I map the first nearby streets I would test for local buyer visibility?",
    dmCta: "show the nearby routes I would use to make your inventory more visible",
    urgencySignal: "Pre-owned buyers usually compare options quickly, so local visibility before the search starts matters.",
  },
  "Auto service center": {
    group: "auto",
    senderKey: "chelsi",
    offer: "maintenance reminder neighborhood campaign",
    subjectAngle: "service reminder route idea",
    strategicPurpose: "It puts oil change, brake, tire, and maintenance reminders in front of households close enough to use the shop.",
    trustNote: "The campaign can stay practical: clear offer, nearby routes, and proof review before anything mails.",
    cta: "Would a quick map of the first service routes be useful?",
    dmCta: "map nearby service reminder routes around your shop",
    urgencySignal: "Service visits are local and timing-driven; nearby repetition helps keep the shop top of mind.",
  },
  "Collision center": {
    group: "auto",
    senderKey: "chelsi",
    offer: "insurance-approved repair visibility campaign",
    subjectAngle: "local repair visibility map",
    strategicPurpose: "It keeps the shop visible before drivers need collision, paint, dent, or insurance repair help.",
    trustNote: "The campaign is built around route clarity and proof review, not broad mail waste.",
    cta: "Should I map a first route cluster around the shop for review?",
    dmCta: "show the first neighborhood cluster for repair visibility",
    urgencySignal: "Collision decisions are stressful and local; recognition before the need appears can matter.",
  },
  "Tire shop": {
    group: "auto",
    senderKey: "chelsi",
    offer: "seasonal tire and maintenance route campaign",
    subjectAngle: "seasonal tire route idea",
    strategicPurpose: "It creates repeated local visibility around tire replacement, rotations, alignment, and seasonal maintenance.",
    trustNote: "HomeReach can keep the first campaign small, mapped, and easy to approve.",
    cta: "Want me to map the first seasonal tire routes I would test?",
    dmCta: "map nearby seasonal tire routes around your shop",
    urgencySignal: "Tire demand is seasonal and local, so timing and neighborhood repetition matter.",
  },
  Dentist: {
    group: "medical",
    senderKey: "chelsi",
    offer: "new-patient family neighborhood campaign",
    subjectAngle: "new-patient route map",
    strategicPurpose: "It builds familiar local visibility for families close enough to book cleanings, emergency visits, or second opinions.",
    trustNote: "No patient data is needed. This is neighborhood visibility with a clear proof approval step.",
    cta: "Would you like me to map the first family neighborhoods I would test?",
    dmCta: "map nearby family neighborhoods for a new-patient campaign",
    urgencySignal: "Dental decisions are trust-based and local; repeated neighborhood visibility helps before the next appointment need.",
  },
  Orthodontist: {
    group: "medical",
    senderKey: "heather",
    offer: "Invisalign and consult route campaign",
    subjectAngle: "consult route visibility map",
    strategicPurpose: "It puts a clear consult message in front of nearby households likely to compare orthodontic options over time.",
    trustNote: "The campaign can stay premium, simple, and proof-led before anything is mailed.",
    cta: "Should I map a first consult-focused route cluster for review?",
    dmCta: "map a consult-focused route cluster near the practice",
    urgencySignal: "Consult decisions build over time, so early local familiarity has value.",
  },
  "Pediatric dentist": {
    group: "medical",
    senderKey: "chelsi",
    offer: "family and school-area awareness campaign",
    subjectAngle: "family route campaign idea",
    strategicPurpose: "It builds recognition with nearby families before checkups, dental anxiety, emergencies, or insurance timing creates demand.",
    trustNote: "The campaign starts with geography and proof review, not complicated setup.",
    cta: "Would a first-route family map be useful?",
    dmCta: "map nearby family routes for new-patient visibility",
    urgencySignal: "Parents usually choose convenient, trusted local providers when the need appears.",
  },
  "Cosmetic dentist": {
    group: "medical",
    senderKey: "heather",
    offer: "cosmetic and implant authority campaign",
    subjectAngle: "premium treatment route map",
    strategicPurpose: "It positions high-value treatments in selected neighborhoods where visibility and trust need to build before inquiry.",
    trustNote: "The first deliverable is a mapped campaign preview, so claims and creative stay review-ready.",
    cta: "Should I map the first premium neighborhoods I would test?",
    dmCta: "map premium local routes for cosmetic and implant visibility",
    urgencySignal: "High-value treatment decisions often require repetition before the patient is ready to ask.",
  },
  Doctor: {
    group: "medical",
    senderKey: "heather",
    offer: "new-patient appointment route campaign",
    subjectAngle: "patient growth route map",
    strategicPurpose: "It creates controlled local visibility for appointment availability, primary care access, or specialty awareness.",
    trustNote: "No protected patient information is used. The campaign is geography-first and approval-gated.",
    cta: "Would you like me to map the first neighborhoods I would test around the office?",
    dmCta: "map nearby appointment routes around the office",
    urgencySignal: "Patients often choose the provider they recognize when access, convenience, or insurance timing matters.",
  },
  "Urgent care clinic": {
    group: "medical",
    senderKey: "heather",
    offer: "local access and availability route campaign",
    subjectAngle: "urgent care visibility map",
    strategicPurpose: "It helps nearby households remember the clinic before the next time they need fast local care.",
    trustNote: "The message stays factual, access-oriented, and proof-reviewed.",
    cta: "Should I map the first access-focused route cluster for review?",
    dmCta: "map nearby urgent care awareness routes",
    urgencySignal: "Urgent care decisions happen fast, so local recognition before the need appears matters.",
  },
  Chiropractor: {
    group: "medical",
    senderKey: "chelsi",
    offer: "back pain and wellness neighborhood campaign",
    subjectAngle: "wellness route campaign idea",
    strategicPurpose: "It gives nearby households a simple local reminder before pain, recovery, or wellness needs push them to search.",
    trustNote: "The campaign can stay compliant, simple, and mapped before anything mails.",
    cta: "Want me to map a first route cluster around the practice?",
    dmCta: "map nearby wellness routes around your practice",
    urgencySignal: "Wellness and pain-relief decisions are local, recurring, and trust-driven.",
  },
  "Med spa": {
    group: "medical",
    senderKey: "heather",
    offer: "premium aesthetics appointment campaign",
    subjectAngle: "premium local route campaign",
    strategicPurpose: "It builds premium neighborhood awareness for consults, seasonal treatments, and repeat appointment momentum.",
    trustNote: "The campaign starts with a clean proof and mapped households, so brand quality stays protected.",
    cta: "Should I map the first premium route cluster I would test?",
    dmCta: "map premium nearby routes for aesthetics appointment visibility",
    urgencySignal: "Aesthetic appointments are driven by timing, trust, and local familiarity.",
  },
  "Eye care": {
    group: "medical",
    senderKey: "chelsi",
    offer: "annual exam and eyewear neighborhood campaign",
    subjectAngle: "eye care route idea",
    strategicPurpose: "It creates timely local visibility for annual exams, eyewear, contacts, and family eye care.",
    trustNote: "The first step is a reviewable route map and simple appointment message.",
    cta: "Would a first-route eye care map be useful?",
    dmCta: "map nearby routes for annual exam and eyewear visibility",
    urgencySignal: "Annual exams and eyewear needs are recurring, so local reminder timing has value.",
  },
  "Physical therapy": {
    group: "medical",
    senderKey: "chelsi",
    offer: "recovery and referral-area neighborhood campaign",
    subjectAngle: "local recovery route map",
    strategicPurpose: "It builds awareness before injury recovery, post-surgery rehab, or chronic pain searches begin.",
    trustNote: "The message can stay helpful and factual while HomeReach handles the route and proof process.",
    cta: "Should I map the first neighborhood cluster around the clinic?",
    dmCta: "map nearby recovery-focused routes around the clinic",
    urgencySignal: "PT decisions are local and often time-sensitive after referral or injury.",
  },
  Veterinarian: {
    group: "medical",
    senderKey: "chelsi",
    offer: "pet-owner neighborhood awareness campaign",
    subjectAngle: "pet owner route idea",
    strategicPurpose: "It keeps the practice visible before routine visits, new pets, urgent needs, or vaccination timing.",
    trustNote: "The campaign starts with route selection and proof approval so the practice stays in control.",
    cta: "Want me to map the first pet-owner routes I would test?",
    dmCta: "map nearby pet-owner routes around the practice",
    urgencySignal: "Pet owners often choose nearby providers they already recognize and trust.",
  },
  "Senior care": {
    group: "medical",
    senderKey: "heather",
    offer: "family decision-maker awareness campaign",
    subjectAngle: "local care visibility map",
    strategicPurpose: "It builds respectful local awareness before families need care, support, or next-step guidance.",
    trustNote: "The campaign can stay factual, sensitive, and approval-led before public use.",
    cta: "Should I map the first neighborhoods I would review for this?",
    dmCta: "map nearby routes for family awareness and local trust",
    urgencySignal: "Care decisions are high-trust and often urgent when families start looking.",
  },
  Contractor: {
    group: "local_service",
    senderKey: "heather",
    offer: "high-value homeowner route campaign",
    subjectAngle: "homeowner route campaign idea",
    strategicPurpose: "It concentrates visibility near homeowners who can drive project calls, service work, estimates, or seasonal demand.",
    trustNote: "The first campaign can be mapped, proofed, and launched without asking the owner to manage direct-mail logistics.",
    cta: "Would you like me to map the first homeowner routes I would target?",
    dmCta: "map the first homeowner routes around your best service area",
    urgencySignal: "Home-service demand is seasonal and neighborhood-driven, so route ownership matters.",
  },
  Realtor: {
    group: "local_service",
    senderKey: "heather",
    offer: "listing and neighborhood authority campaign",
    subjectAngle: "farm area visibility map",
    strategicPurpose: "It builds consistent local familiarity in a farm area before homeowners think about selling or asking for value advice.",
    trustNote: "The map comes first, so territory and repetition can be reviewed before spend.",
    cta: "Should I map a first farm-area route cluster for review?",
    dmCta: "map a first farm-area route cluster for local authority",
    urgencySignal: "Territory consistency matters because other agents can own the same neighborhood conversation.",
  },
  "Insurance agency": {
    group: "local_service",
    senderKey: "heather",
    offer: "policy review neighborhood campaign",
    subjectAngle: "local policy review route idea",
    strategicPurpose: "It gives nearby households a clear reason to compare coverage, ask questions, or remember a local advisor.",
    trustNote: "Messaging can stay review-first and factual without unsupported savings promises.",
    cta: "Would a first-route policy review map be useful?",
    dmCta: "map nearby routes for a policy review awareness campaign",
    urgencySignal: "Policy decisions are trust-based and often triggered by renewal timing.",
  },
  "Fitness studio": {
    group: "local_service",
    senderKey: "chelsi",
    offer: "trial and membership neighborhood campaign",
    subjectAngle: "membership route idea",
    strategicPurpose: "It creates local visibility around trial offers, seasonal goals, and community familiarity.",
    trustNote: "The first campaign can stay simple: route, offer, proof, and launch timing.",
    cta: "Want me to map the first neighborhood routes I would test?",
    dmCta: "map nearby routes for trial and membership visibility",
    urgencySignal: "Fitness demand moves in seasonal waves, so timing and repetition matter.",
  },
  Salon: {
    group: "local_service",
    senderKey: "chelsi",
    offer: "appointment and seasonal service campaign",
    subjectAngle: "appointment route idea",
    strategicPurpose: "It keeps the salon visible near households likely to book recurring appointments or seasonal services.",
    trustNote: "The message can be premium, local, and proofed before anything is public.",
    cta: "Should I map the first appointment routes I would test?",
    dmCta: "map nearby appointment routes for local salon visibility",
    urgencySignal: "Beauty and personal-care decisions are local, repeatable, and timing-driven.",
  },
  Restaurant: {
    group: "local_service",
    senderKey: "chelsi",
    offer: "neighborhood traffic and repeat visit campaign",
    subjectAngle: "nearby household route idea",
    strategicPurpose: "It puts a simple dining reason in front of households close enough to become repeat customers.",
    trustNote: "The first step is a clean map and offer review before print or mailing.",
    cta: "Want me to map the closest routes I would test first?",
    dmCta: "map nearby household routes for repeat local traffic",
    urgencySignal: "Restaurant traffic is local and habit-driven; repetition close to the store matters.",
  },
  "Pizza shop": {
    group: "local_service",
    senderKey: "chelsi",
    offer: "delivery-zone repeat order campaign",
    subjectAngle: "delivery-zone postcard idea",
    strategicPurpose: "It reinforces the shop inside the streets most likely to order again, especially around weekends, schools, and local events.",
    trustNote: "The route and offer can be reviewed before anything is printed.",
    cta: "Should I map the first delivery-zone routes I would test?",
    dmCta: "map nearby delivery-zone routes for repeat orders",
    urgencySignal: "Pizza demand is highly local and repeatable, so route repetition can matter.",
  },
  Bakery: {
    group: "local_service",
    senderKey: "chelsi",
    offer: "seasonal and special-order neighborhood campaign",
    subjectAngle: "seasonal order route idea",
    strategicPurpose: "It builds recognition around holidays, catering, birthdays, weekends, and local special orders.",
    trustNote: "The first campaign can stay small, visual, and proof-led.",
    cta: "Want me to map the first seasonal routes I would test?",
    dmCta: "map nearby seasonal routes for bakery orders",
    urgencySignal: "Bakery demand is calendar-driven, so early local reminders can help.",
  },
  "Local retail": {
    group: "local_service",
    senderKey: "chelsi",
    offer: "local awareness and event route campaign",
    subjectAngle: "nearby shopper route idea",
    strategicPurpose: "It gives nearby households a reason to remember the store, event, sale, or local service before they default to larger competitors.",
    trustNote: "The route map and proof keep the first campaign controlled and reviewable.",
    cta: "Would you like me to map the first local shopper routes I would test?",
    dmCta: "map nearby shopper routes for local awareness",
    urgencySignal: "Local retailers have to stay visible before customers default to big-box or online options.",
  },
  Church: {
    group: "local_service",
    senderKey: "chelsi",
    offer: "new-mover and neighborhood invitation postcard campaign",
    subjectAngle: "community invitation route idea",
    strategicPurpose: "It helps the church stay visible to nearby households, new movers, families, and neighbors who may be looking for a welcoming local community.",
    trustNote: "The campaign can stay warm, respectful, and proof-reviewed before anything is mailed.",
    cta: "Would you like me to map the first nearby routes I would test for a community invitation campaign?",
    dmCta: "map nearby routes for a simple community invitation postcard",
    urgencySignal: "Church outreach works best when it feels consistent, local, and easy for households to understand.",
  },
};

const OUTCOME_STATUSES: TargetedOutcomeStatus[] = [
  "New",
  "Contacted",
  "Follow-Up Due",
  "Interested",
  "Needs Quote",
  "Proposal Sent",
  "Won",
  "Lost",
  "Not a Fit",
];

function clean(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const parsed = clean(value);
    if (parsed) return parsed;
  }
  return null;
}

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

function dateAdd(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function stableScore(seed: string) {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pickStable<T>(items: T[], seed: string) {
  return items[stableScore(seed) % items.length] as T;
}

export function inferTargetedVertical(input: { businessName?: string | null; industry?: string | null }) {
  const text = `${input.businessName ?? ""} ${input.industry ?? ""}`.toLowerCase();
  if (/orthodont|invisalign/.test(text)) return "Orthodontist";
  if (/pediatric.*dent|kids.*dent|children.*dent/.test(text)) return "Pediatric dentist";
  if (/cosmetic.*dent|implant|veneers/.test(text)) return "Cosmetic dentist";
  if (/dentist|dental/.test(text)) return "Dentist";
  if (/med\s*spa|aesthetic|botox|filler|laser/.test(text)) return "Med spa";
  if (/urgent care|walk[-\s]?in clinic/.test(text)) return "Urgent care clinic";
  if (/optomet|eye care|vision|eyewear|glasses|contacts/.test(text)) return "Eye care";
  if (/physical therapy|physio|rehab|sports medicine/.test(text)) return "Physical therapy";
  if (/veterinar|animal hospital|pet clinic/.test(text)) return "Veterinarian";
  if (/senior care|assisted living|home care|memory care/.test(text)) return "Senior care";
  if (/chiro|spine|wellness/.test(text)) return "Chiropractor";
  if (/doctor|physician|medical|clinic|family practice|urgent care/.test(text)) return "Doctor";
  if (/used.*car|pre[-\s]?owned|auto sales/.test(text)) return "Used car lot";
  if (/collision|body shop|paintless dent|auto body/.test(text)) return "Collision center";
  if (/tire|alignment|wheel/.test(text)) return "Tire shop";
  if (/service center|auto repair|brake|oil change|mechanic/.test(text)) return "Auto service center";
  if (/dealer|dealership|ford|chevrolet|chevy|toyota|honda|nissan|kia|hyundai|subaru|mazda|jeep|ram|dodge|buick|gmc|cadillac|volkswagen|mercedes|bmw|audi/.test(text)) {
    return "Dealership";
  }
  if (/realtor|real estate|brokerage|homes for sale/.test(text)) return "Realtor";
  if (/insurance|agency|allstate|state farm|farmers|nationwide/.test(text)) return "Insurance agency";
  if (/gym|fitness|yoga|pilates|crossfit/.test(text)) return "Fitness studio";
  if (/salon|hair|nail|barber|spa/.test(text)) return "Salon";
  if (/pizza|pizzeria/.test(text)) return "Pizza shop";
  if (/bakery|baker|cakes|pastry/.test(text)) return "Bakery";
  if (/restaurant|cafe|diner|grill|barbecue|bbq|taco|burger/.test(text)) return "Restaurant";
  if (/church|ministry|chapel|worship|parish|christian|baptist|methodist|lutheran|catholic|presbyterian|assembly of god/.test(text)) {
    return "Church";
  }
  if (/roof|hvac|plumb|landscap|pest|remodel|concrete|floor|solar|window|garage|fence|contractor|home service/.test(text)) {
    return "Contractor";
  }
  if (/retail|boutique|store|shop/.test(text)) return "Local retail";
  return null;
}

function isAutoVertical(vertical: string) {
  return AUTO_VERTICALS.includes(vertical as (typeof AUTO_VERTICALS)[number]);
}

function isMedicalVertical(vertical: string) {
  return MEDICAL_VERTICALS.includes(vertical as (typeof MEDICAL_VERTICALS)[number]);
}

function isLocalServiceVertical(vertical: string) {
  return LOCAL_SERVICE_VERTICALS.includes(vertical as (typeof LOCAL_SERVICE_VERTICALS)[number]);
}

function isTargetedVertical(vertical: string) {
  return isAutoVertical(vertical) || isMedicalVertical(vertical) || isLocalServiceVertical(vertical);
}

function verticalGroup(vertical: string): TargetedVerticalGroup {
  if (isAutoVertical(vertical)) return "auto";
  if (isMedicalVertical(vertical)) return "medical";
  return "local_service";
}

function intelligenceForVertical(vertical: string): TargetedCampaignIntelligence {
  const known = VERTICAL_CAMPAIGN_INTELLIGENCE[vertical];
  if (known) return known;
  const group = verticalGroup(vertical);
  if (group === "auto") return VERTICAL_CAMPAIGN_INTELLIGENCE.Dealership!;
  if (group === "medical") return VERTICAL_CAMPAIGN_INTELLIGENCE.Doctor!;
  return VERTICAL_CAMPAIGN_INTELLIGENCE.Contractor!;
}

function scoreProspect(prospect: SourceProspect) {
  let score = 48;
  const reasons: string[] = [];
  const text = `${prospect.business_name} ${prospect.industry ?? ""} ${prospect.notes ?? ""}`.toLowerCase();
  const intelligence = intelligenceForVertical(prospect.vertical);

  if (prospect.contact_name) {
    score += 10;
    reasons.push("owner/contact available");
  }
  if (prospect.facebook_url) {
    score += 8;
    reasons.push("Facebook page visible");
  }
  if (prospect.website) score += 5;
  if (isAutoVertical(prospect.vertical)) {
    score += 10;
    reasons.push("high-value auto radius business");
  }
  if (isMedicalVertical(prospect.vertical)) {
    score += 12;
    reasons.push("high-value appointment business");
  }
  if (isLocalServiceVertical(prospect.vertical)) {
    score += 8;
    reasons.push("neighborhood-driven local demand");
  }
  if (/service|lane|brake|tire|oil|repair/.test(text)) {
    score += 8;
    reasons.push("service department angle");
  }
  if (/cosmetic|implant|invisalign|orthodont|med\s*spa|botox|filler/.test(text)) {
    score += 10;
    reasons.push("premium treatment offer");
  }
  if (/independent|family|local|owned/.test(text)) {
    score += 6;
    reasons.push("local operator signal");
  }
  if (intelligence.senderKey === "heather") {
    score += 4;
    reasons.push("premium decision-maker angle");
  }
  if (!prospect.website || !prospect.facebook_url) {
    score += 5;
    reasons.push("marketing presence needs review");
  }
  if (prospect.score) score += Math.min(8, Math.max(0, Math.round(prospect.score / 14)));

  const jitter = stableScore(`${prospect.business_name}:${prospect.city}:${prospect.vertical}`) % 7;
  const finalScore = Math.max(1, Math.min(100, score + jitter));
  return {
    score: finalScore,
    label: reasons.length ? reasons.slice(0, 3).join(", ") : "Needs Review",
  };
}

function recommendedOffer(vertical: string, text: string) {
  const intelligence = intelligenceForVertical(vertical);
  const lower = `${vertical} ${text}`.toLowerCase();
  if (isAutoVertical(vertical)) {
    if (/service|repair|brake|tire|oil/.test(lower)) return "service lane postcard campaign";
    if (/used|pre[-\s]?owned/.test(lower)) return "competitor conquest neighborhood campaign";
    return intelligence.offer;
  }
  if (/orthodont|invisalign/.test(lower)) return "Invisalign/cosmetic/implant campaign";
  if (/cosmetic|implant|med\s*spa|botox|filler/.test(lower)) return "cosmetic/local authority campaign";
  if (/pediatric|family/.test(lower)) return "family neighborhood awareness campaign";
  if (/doctor|clinic|chiro/.test(lower)) return "new patient campaign";
  return intelligence.offer;
}

function suggestedAction(prospect: SourceProspect, isFollowUp = false, messengerUrl?: string | null) {
  if (isFollowUp && prospect.email && messengerUrl) return "Open follow-up email draft, then copy DM and open Messenger";
  if (isFollowUp) return "Follow up with route-density angle";
  if (prospect.email && messengerUrl) return "Open email draft, then copy Facebook DM and open Messenger";
  if (prospect.email) return "Open reviewed email draft";
  if (messengerUrl) return "Copy Facebook DM and open Messenger";
  if (prospect.phone) return "Call or send reviewed SMS draft";
  if (prospect.facebook_url) return "Copy Facebook DM and open Facebook page";
  return "Research contact before outreach";
}

function firstName(value?: string | null) {
  return clean(value)?.split(/\s+/)[0] ?? null;
}

function senderFirstName(senderKey: DailyOutreachSenderKey) {
  return DAILY_OUTREACH_SENDER_PROFILES[senderKey].senderName.split(/\s+/)[0] ?? "HomeReach";
}

function signatureForSender(senderKey: DailyOutreachSenderKey) {
  const sender = DAILY_OUTREACH_SENDER_PROFILES[senderKey];
  return `${sender.senderName}\nHomeReach\n${sender.senderEmail}`;
}

function normalizeHttpUrl(value?: string | null) {
  const raw = clean(value);
  if (!raw) return null;
  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function messengerUrlForFacebook(value?: string | null) {
  const facebookUrl = normalizeHttpUrl(value);
  if (!facebookUrl) return null;
  try {
    const parsed = new URL(facebookUrl);
    const host = parsed.hostname.toLowerCase();
    if (!host.includes("facebook.com") && !host.includes("fb.com")) return null;
    const profileId = parsed.searchParams.get("id");
    if (profileId) return `https://www.facebook.com/messages/t/${profileId}`;
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments[0] === "pages" && segments[2]) return `https://www.facebook.com/messages/t/${segments[2]}`;
    const blocked = new Set(["groups", "events", "marketplace", "share", "sharer.php", "story.php", "permalink.php", "profile.php"]);
    const slug = segments[0];
    if (!slug || blocked.has(slug)) return null;
    return `https://m.me/${slug}`;
  } catch {
    return null;
  }
}

function buildMessages(
  prospect: SourceProspect,
  offer: string,
  intelligence: TargetedCampaignIntelligence,
  isFollowUp = false
) {
  const contact = firstName(prospect.contact_name);
  const greeting = contact ? `Hi ${contact},` : "Hi,";
  const business = prospect.business_name;
  const city = prospect.city || "your area";
  const vertical = prospect.vertical.toLowerCase();
  const routeVisual = "[Insert route-density visual here]";
  const seed = `${business}:${city}:${prospect.vertical}:${isFollowUp ? "follow-up" : "first-touch"}`;
  const senderKey = intelligence.senderKey;
  const senderName = senderFirstName(senderKey);
  const opening = isFollowUp
    ? pickStable([
        `Quick follow-up on the route-based campaign idea for ${business}.`,
        `I wanted to bring the ${business} neighborhood map idea back to the top.`,
        `Following up with a more specific angle for ${business} in ${city}.`,
      ], `${seed}:follow-up-opening`)
    : pickStable([
        `I had a specific local growth idea for ${business}.`,
        `${business} looks like the kind of ${vertical} business where neighborhood visibility can be made much more intentional.`,
        `I was reviewing ${city} businesses that could benefit from tighter route-based visibility, and ${business} stood out.`,
      ], `${seed}:opening`);
  const cta = pickStable([
    intelligence.cta,
    `Would you like me to send a simple map of the first neighborhoods I would test for ${business}?`,
    `Should I build a quick first-route snapshot so you can see exactly where I would start?`,
  ], `${seed}:cta`);

  const emailSubject = isFollowUp
    ? `Re: ${business} ${intelligence.subjectAngle}`
    : `${business}: ${intelligence.subjectAngle}`;

  return {
    emailSubject,
    emailBody: `${greeting}

${opening}

The campaign I would test first is a ${offer}. ${intelligence.strategicPurpose}

HomeReach handles the map, postcard direction, proof flow, print coordination, and mailing. You would see the route logic before anything is mailed, so this stays simple and controlled.

${intelligence.trustNote}

${routeVisual}

${cta}

${signatureForSender(senderKey)}`,
    smsBody: `${contact ? `Hi ${contact}` : "Hi"}, ${senderName} with HomeReach. I have a ${offer} idea for ${business} in ${city}. Want me to map the first streets I would target? Reply STOP to opt out.`,
    dmBody: `${contact ? `Hi ${contact}` : "Hi"} - ${senderName} with HomeReach. Quick idea for ${business}: ${intelligence.dmCta}. I can map the first routes and send a preview before anything is mailed. Worth a quick look?`,
    callScript: `Hi${contact ? ` ${contact}` : ""}, this is ${senderName} with HomeReach. I am calling because I had a specific local visibility idea for ${business}. For a ${vertical} business in ${city}, I would start with ${offer}, then show the route map and proof before anything is mailed. Would it be useful if I mapped the first streets I would target?`,
    senderKey,
  };
}

function taskRow(prospect: SourceProspect, date: string, isFollowUp = false) {
  const offer = recommendedOffer(prospect.vertical, `${prospect.industry ?? ""} ${prospect.notes ?? ""}`);
  const score = scoreProspect(prospect);
  const intelligence = intelligenceForVertical(prospect.vertical);
  const messages = buildMessages(prospect, offer, intelligence, isFollowUp);
  const sender = DAILY_OUTREACH_SENDER_PROFILES[messages.senderKey];
  const messengerUrl = normalizeHttpUrl(prospect.messenger_url) ?? messengerUrlForFacebook(prospect.facebook_url);
  return {
    outreach_date: date,
    prospect_id: prospect.prospect_id ?? null,
    source_table: prospect.source_table,
    source_id: prospect.source_id,
    category: "Targeted Campaign",
    campaign_type: "targeted_mailing",
    business_name: prospect.business_name,
    contact_name: prospect.contact_name ?? null,
    industry: prospect.industry ?? prospect.vertical,
    vertical: prospect.vertical,
    phone: prospect.phone ?? null,
    email: prospect.email ?? null,
    website: prospect.website ?? null,
    facebook_url: prospect.facebook_url ?? null,
    messenger_url: messengerUrl,
    city: prospect.city ?? null,
    state: prospect.state ?? null,
    action_type: isFollowUp ? "follow_up" : "targeted_outreach",
    priority: score.score >= 82 ? "urgent" : score.score >= 70 ? "high" : score.score >= 55 ? "medium" : "low",
    status: isFollowUp ? "follow_up" : "pending",
    outcome_status: isFollowUp ? "Follow-Up Due" : "New",
    email_subject: messages.emailSubject,
    email_body: messages.emailBody,
    sms_body: messages.smsBody,
    dm_body: messages.dmBody,
    sender_key: messages.senderKey,
    sender_name: sender.senderName,
    sender_email: sender.senderEmail,
    send_status: "draft",
    approval_status: "needs_review",
    call_script: messages.callScript,
    recommended_offer: offer,
    outreach_priority_score: score.score,
    score_label: score.label,
    today_suggested_action: suggestedAction(prospect, isFollowUp, messengerUrl),
    follow_up_date: isFollowUp ? dateAdd(date, 2) : null,
    completed: false,
    response_received: false,
    lead_source: prospect.source_table,
    manual_approval_required: true,
    metadata: {
      ...(prospect.metadata ?? {}),
      plan_type: TARGETED_PLAN_TYPE,
      vertical_group: intelligence.group,
      outreach_agent_mode: "high_throughput_draft_queue",
      channels_prepared: ["email", "facebook_dm", "sms", "call"],
      human_review_required: true,
      no_auto_send: true,
      messenger_handoff_required: Boolean(messengerUrl),
      sender_persona: sender.personality,
      approval_gate: "Human approval required before outbound use.",
      urgency_signal: intelligence.urgencySignal,
      route_density_visual_placeholder: "Insert route-density visual here.",
      follow_up_stage: isFollowUp ? followUpStage(prospect.last_contacted_at) : null,
    },
  };
}

function sourceKey(prospect: SourceProspect) {
  const contactKeys = prospectDedupeKeys({
    businessName: prospect.business_name,
    phone: prospect.phone,
    website: prospect.website,
    city: prospect.city,
    state: prospect.state,
  });
  if (contactKeys[0]) return contactKeys[0];
  return [
    prospect.source_table,
    prospect.source_id,
    prospect.email?.toLowerCase(),
    prospect.phone?.replace(/\D/g, ""),
    prospect.business_name.toLowerCase(),
  ].filter(Boolean).join("|");
}

function rotate(items: SourceProspect[], limit: number) {
  return items
    .slice()
    .sort((a, b) => {
      const aFollow = a.follow_up_date ? 0 : 1;
      const bFollow = b.follow_up_date ? 0 : 1;
      if (aFollow !== bFollow) return aFollow - bFollow;
      const aContact = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
      const bContact = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
      if (aContact !== bContact) return aContact - bContact;
      return scoreProspect(b).score - scoreProspect(a).score;
    })
    .slice(0, limit);
}

function unique(items: SourceProspect[], limit: number, used = new Set<string>()) {
  const selected: SourceProspect[] = [];
  for (const item of items) {
    const key = sourceKey(item);
    if (used.has(key)) continue;
    used.add(key);
    selected.push(item);
    if (selected.length >= limit) break;
  }
  return selected;
}

function followUpStage(lastContacted?: string | null) {
  if (!lastContacted) return "Day 2: quick bump";
  const days = Math.floor((Date.now() - new Date(lastContacted).getTime()) / 86400000);
  if (days >= 14) return "Day 14: final soft close";
  if (days >= 7) return "Day 7: offer to map neighborhoods";
  if (days >= 4) return "Day 4: send route-density angle";
  return "Day 2: quick bump";
}

async function loadConfiguredProspects(limit: number) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("outreach_prospects")
    .select("*")
    .eq("category", "Targeted Campaign")
    .neq("status", "do_not_contact")
    .order("follow_up_date", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .limit(limit * 4);
  if (error) return [];

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const vertical = firstString(row.vertical, inferTargetedVertical({
        businessName: firstString(row.business_name),
        industry: firstString(row.industry, row.business_type),
      }));
      if (!vertical || !isTargetedVertical(vertical)) return null;
      return {
        source_table: "outreach_prospects",
        source_id: firstString(row.id),
        prospect_id: firstString(row.id),
        business_name: firstString(row.business_name) ?? "Local business",
        contact_name: firstString(row.contact_name, row.owner_contact_name),
        industry: firstString(row.industry, row.business_type),
        vertical,
        phone: firstString(row.phone),
        email: firstString(row.email),
        website: firstString(row.website),
        facebook_url: firstString(row.facebook_url),
        messenger_url: firstString(row.messenger_url),
        city: firstString(row.city),
        state: firstString(row.state),
        notes: firstString(row.notes),
        last_contacted_at: firstString(row.last_contacted_at),
        follow_up_date: firstString(row.follow_up_date),
        score: firstNumber(row.outreach_priority_score),
        metadata: typeof row.metadata === "object" && row.metadata ? row.metadata as Record<string, unknown> : {},
      };
    })
    .filter(Boolean) as SourceProspect[];
}

async function loadSalesLeadProspects(limit: number) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("sales_leads")
    .select("id,business_name,contact_name,email,phone,city,state,category,status,source,score,priority,buying_signal,do_not_contact,sms_opt_out,last_contacted_at,next_follow_up_at,website,facebook_url,notes")
    .eq("do_not_contact", false)
    .eq("sms_opt_out", false)
    .not("status", "in", "(closed,dead,won,lost)")
    .order("next_follow_up_at", { ascending: true, nullsFirst: true })
    .order("last_contacted_at", { ascending: true, nullsFirst: true })
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit * 8);
  if (error) return [];

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => {
      const vertical = inferTargetedVertical({
        businessName: firstString(row.business_name),
        industry: firstString(row.category),
      });
      if (!vertical) return null;
      return {
        source_table: "sales_leads",
        source_id: firstString(row.id),
        business_name: firstString(row.business_name) ?? "Local business",
        contact_name: firstString(row.contact_name),
        industry: firstString(row.category),
        vertical,
        phone: firstString(row.phone),
        email: firstString(row.email),
        website: firstString(row.website),
        facebook_url: firstString(row.facebook_url),
        messenger_url: firstString(row.messenger_url),
        city: firstString(row.city),
        state: firstString(row.state),
        notes: firstString(row.notes),
        last_contacted_at: firstString(row.last_contacted_at),
        follow_up_date: firstString(row.next_follow_up_at)?.slice(0, 10) ?? null,
        score: firstNumber(row.score),
        metadata: { source: firstString(row.source), priority: firstString(row.priority), buying_signal: row.buying_signal === true },
      };
    })
    .filter(Boolean) as SourceProspect[];
}

async function loadDueFollowUps(date: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("category", "Targeted Campaign")
    .lte("follow_up_date", date)
    .not("outcome_status", "in", '("Won","Lost","Not a Fit")')
    .order("follow_up_date", { ascending: true, nullsFirst: false })
    .limit(10);
  if (error) return [];

  return ((data ?? []) as DailyOutreachTask[])
    .filter((task) => task.metadata?.plan_type === TARGETED_PLAN_TYPE)
    .map((task) => ({
      source_table: task.source_table ?? "daily_outreach_tasks",
      source_id: task.source_id ?? task.id,
      prospect_id: task.prospect_id,
      business_name: task.business_name ?? "Local business",
      contact_name: task.contact_name,
      industry: task.industry,
      vertical: task.vertical ?? inferTargetedVertical({ businessName: task.business_name, industry: task.industry }) ?? "Dentist",
      phone: task.phone,
      email: task.email,
      website: task.website,
      facebook_url: task.facebook_url,
      messenger_url: task.messenger_url,
      city: task.city,
      state: task.state,
      notes: task.notes,
      last_contacted_at: task.last_action_at ?? task.completed_at ?? task.created_at,
      follow_up_date: task.follow_up_date,
      score: task.outreach_priority_score,
      metadata: task.metadata ?? {},
    }));
}

function buildSocialPosts(date: string) {
  return [
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Facebook group post suggestion",
      audience: "Local business owners",
      content: "Local business owners: if you could put one simple offer in front of the neighborhoods closest to your best customers, what would it be? I am mapping a few local postcard examples this week for service businesses that want visibility without wasting budget.",
      short_content: "What offer would you put in front of the neighborhoods closest to your best customers?",
      status: "draft",
      posted: false,
    },
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Local vertical-specific post suggestion",
      audience: "Dealerships and auto service operators",
      content: "Dealerships, used car lots, and service centers do not need generic coupon mail. A better first move is a mapped route campaign around nearby households: service reminders, trade-in visibility, seasonal maintenance, or a clean inventory message with proof review before anything goes out.",
      short_content: "Dealerships and service centers: start with mapped nearby routes, not generic coupon mail.",
      status: "draft",
      posted: false,
    },
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Local vertical-specific post suggestion",
      audience: "Dentists, doctors, med spas, and appointment businesses",
      content: "For dentists, doctors, med spas, chiropractors, and other appointment-based businesses, the first campaign should be simple: choose the right neighborhoods, use a clear appointment message, approve the proof, and stay visible locally without asking the office to manage the mailing process.",
      short_content: "Appointment businesses: map the right neighborhoods, approve the proof, and stay visible locally.",
      status: "draft",
      posted: false,
    },
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Facebook group post suggestion",
      audience: "Contractors, realtors, insurance agents, restaurants, salons, and retailers",
      content: "The strongest local campaigns usually come from a narrow map, not a huge blast. Contractors, realtors, insurance agencies, restaurants, salons, gyms, and shops can use route-based postcards to stay visible in the streets that matter most while keeping the offer and timing easy to review.",
      short_content: "A narrow route map often beats a huge local blast.",
      status: "draft",
      posted: false,
    },
    {
      outreach_date: date,
      category: "Targeted Campaign",
      post_type: "Facebook group post suggestion",
      audience: "Local owner education",
      content: "If you already know which neighborhoods produce your best customers, that is the place to start. HomeReach can turn that into a simple route map, postcard proof, and mail plan so the owner is not stuck figuring out targeting, print, or logistics alone.",
      short_content: "Start with the neighborhoods that already produce your best customers.",
      status: "draft",
      posted: false,
    },
  ];
}

const TARGETED_DAILY_MARKETS = (process.env.TARGETED_CAMPAIGNS_DAILY_MARKETS || "Medina, OH")
  .split(";")
  .map((market) => market.trim())
  .filter(Boolean);

const TARGETED_SERPAPI_SEARCHES: Array<{ vertical: string; query: string }> = [
  { vertical: "Dealership", query: "car dealerships" },
  { vertical: "Doctor", query: "family doctors medical offices" },
  { vertical: "Dentist", query: "dentists dental offices" },
  { vertical: "Church", query: "churches" },
];

function targetedSerpApiEnabled() {
  const targetedFlag = process.env.TARGETED_CAMPAIGNS_ENABLE_SERPAPI?.trim().toLowerCase();
  const stormreachFlag = process.env.STORMREACH_ENABLE_SERPAPI?.trim().toLowerCase();
  const globalPause = process.env.SERPAPI_PAUSED?.trim().toLowerCase();
  if (targetedFlag === "false" || targetedFlag === "0" || targetedFlag === "off") return false;
  if (globalPause === "true" || globalPause === "1" || globalPause === "on") return false;
  return (
    targetedFlag === "true" ||
    stormreachFlag === "true" ||
    Boolean(targetedSerpApiKey())
  );
}

function targetedSerpApiKey() {
  return firstEnvValue(
    "TARGETED_CAMPAIGNS_SERPAPI_KEY",
    "STORMREACH_SERPAPI_KEY",
    "SERPAPI_KEY",
    "SERP_API",
    "SERPAPI_API_KEY",
  );
}

function firstEnvValue(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return "";
}

function normalizeKeyPart(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/^www\./, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function prospectDedupeKeys(input: {
  businessName?: string | null;
  phone?: string | null;
  website?: string | null;
  city?: string | null;
  state?: string | null;
}) {
  const digits = input.phone?.replace(/\D/g, "") ?? "";
  const website = normalizeKeyPart(input.website);
  const nameCity = [normalizeKeyPart(input.businessName), normalizeKeyPart(input.city), normalizeKeyPart(input.state)]
    .filter(Boolean)
    .join("|");
  return [digits ? `phone:${digits}` : null, website ? `site:${website}` : null, nameCity ? `name:${nameCity}` : null]
    .filter((value): value is string => Boolean(value));
}

function taskDedupeKeys(task: Pick<DailyOutreachTask, "business_name" | "phone" | "website" | "city" | "state">) {
  return prospectDedupeKeys({
    businessName: task.business_name,
    phone: task.phone,
    website: task.website,
    city: task.city,
    state: task.state,
  });
}

function parseSerpAddress(address: string | null | undefined, fallbackMarket: string) {
  const fallbackState = fallbackMarket.match(/\b([A-Z]{2})\b/)?.[1] ?? null;
  const fallbackCity = fallbackMarket.split(",")[0]?.trim() || null;
  const parts = String(address ?? "").split(",").map((part) => part.trim()).filter(Boolean);
  const stateMatch = parts.find((part) => /\b[A-Z]{2}\b/.test(part))?.match(/\b([A-Z]{2})\b/);
  const state = stateMatch?.[1] ?? fallbackState;
  const stateIndex = stateMatch ? parts.findIndex((part) => part.includes(stateMatch[0])) : -1;
  const city = stateIndex > 0 ? parts[stateIndex - 1] : fallbackCity;
  return { city, state };
}

function targetedContactResearchLimit() {
  const value = Number(process.env.TARGETED_CAMPAIGNS_CONTACT_RESEARCH_LIMIT ?? 36);
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 60)) : 36;
}

function targetedHunterLimit() {
  const value = Number(process.env.TARGETED_CAMPAIGNS_HUNTER_LIMIT ?? 36);
  return Number.isFinite(value) ? Math.max(0, Math.min(value, 80)) : 36;
}

function targetedHunterApiKey() {
  return firstEnvValue("HUNTER_API_KEY", "HUNTER");
}

function extractWebsiteDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function cleanPublicEmail(value: string | null | undefined) {
  const email = String(value ?? "").trim().replace(/^mailto:/i, "").split("?")[0]?.toLowerCase();
  if (!email || !/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)) return null;
  if (/(example|domain|yourname|emailaddress|sentry|wixpress|schema\.org)/i.test(email)) return null;
  if (/\.(png|jpg|jpeg|gif|webp|svg|css|js)$/i.test(email)) return null;
  return email;
}

function extractPublicEmails(html: string) {
  const emails = new Set<string>();
  const mailtoMatches = html.matchAll(/mailto:([^"'<>\s?]+)/gi);
  for (const match of mailtoMatches) {
    const email = cleanPublicEmail(match[1]);
    if (email) emails.add(email);
  }
  const plainMatches = html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
  for (const match of plainMatches) {
    const email = cleanPublicEmail(match[0]);
    if (email) emails.add(email);
  }
  return Array.from(emails);
}

async function findHunterTargetedEmail(input: {
  businessName: string | null | undefined;
  website: string | null | undefined;
}) {
  const apiKey = targetedHunterApiKey();
  const domain = extractWebsiteDomain(input.website);
  if (!apiKey || !domain) return null;

  try {
    const params = new URLSearchParams({
      domain,
      company: String(input.businessName ?? ""),
      api_key: apiKey,
      limit: "10",
    });
    const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`, {
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return null;
    const json = await response.json().catch(() => ({})) as HunterDomainSearchResponse;
    const emails = (json.data?.emails ?? [])
      .map((item) => ({
        value: cleanPublicEmail(item.value),
        type: item.type ?? null,
        confidence: Number(item.confidence ?? 0),
        firstName: item.first_name ?? null,
        lastName: item.last_name ?? null,
        position: item.position ?? null,
      }))
      .filter((item): item is {
        value: string;
        type: string | null;
        confidence: number;
        firstName: string | null;
        lastName: string | null;
        position: string | null;
      } => Boolean(item.value));
    const role = emails.find((item) => /^(info|contact|hello|sales|office|service|admin|appointments|marketing)@/.test(item.value));
    const chosen = role ?? emails.sort((a, b) => b.confidence - a.confidence)[0] ?? null;
    if (!chosen) return null;

    return {
      email: chosen.value,
      confidence: chosen.confidence,
      type: chosen.type,
      contactName: [chosen.firstName, chosen.lastName].filter(Boolean).join(" ") || null,
      position: chosen.position,
      domain,
    };
  } catch {
    return null;
  }
}

function normalizeDiscoveredUrl(raw: string | null | undefined, baseUrl: string) {
  const value = String(raw ?? "").trim();
  if (!value || value.startsWith("#") || /^javascript:/i.test(value) || /^tel:/i.test(value) || /^mailto:/i.test(value)) return null;
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractHrefUrls(html: string, baseUrl: string) {
  return Array.from(html.matchAll(/href=["']([^"']+)["']/gi))
    .map((match) => normalizeDiscoveredUrl(match[1], baseUrl))
    .filter((value): value is string => Boolean(value));
}

function extractFacebookUrl(html: string, baseUrl: string) {
  const urls = extractHrefUrls(html, baseUrl);
  return urls.find((url) => /https?:\/\/(?:www\.)?(facebook|fb)\.com\//i.test(url) && !/share|sharer|plugins/i.test(url)) ?? null;
}

function extractMessengerUrl(html: string, baseUrl: string, facebookUrl: string | null) {
  const urls = extractHrefUrls(html, baseUrl);
  const direct = urls.find((url) => /https?:\/\/(?:www\.)?(m\.me|messenger\.com)\//i.test(url)) ?? null;
  return direct ?? messengerUrlForFacebook(facebookUrl);
}

function firstContactPageUrl(html: string, baseUrl: string) {
  const origin = new URL(baseUrl).origin;
  return extractHrefUrls(html, baseUrl)
    .filter((url) => {
      try {
        const parsed = new URL(url);
        return parsed.origin === origin && /(contact|about|locations|appointment|schedule|visit)/i.test(parsed.pathname);
      } catch {
        return false;
      }
    })[0] ?? null;
}

async function discoverWebsiteContacts(input: {
  website: string | null | undefined;
  businessName?: string | null;
  allowHunter?: boolean;
}): Promise<WebsiteContactDiscovery> {
  const rawWebsite = input.website;
  const url = normalizeHttpUrl(rawWebsite);
  const retrievedAt = new Date().toISOString();
  if (!url) {
    return {
      status: "missing_website",
      sourceUrl: null,
      email: null,
      facebookUrl: null,
      messengerUrl: null,
      emailProvider: null,
      hunterConfidence: null,
      confidence: 0,
      notes: ["No public website was available for contact discovery."],
      retrievedAt,
    };
  }

  try {
    const homepage = await fetchHomepage(url, 4500);
    let sourceUrl = url;
    let combinedHtml = homepage;
    const contactUrl = firstContactPageUrl(homepage, url);
    if (contactUrl) {
      try {
        combinedHtml += ` ${await fetchHomepage(contactUrl, 4500)}`;
        sourceUrl = contactUrl;
      } catch {
        // Homepage data is still useful. Keep discovery quiet unless all fetches fail.
      }
    }

    const websiteEmail = extractPublicEmails(combinedHtml)[0] ?? null;
    const hunter = !websiteEmail && input.allowHunter !== false
      ? await findHunterTargetedEmail({ businessName: input.businessName, website: url })
      : null;
    const email = websiteEmail ?? hunter?.email ?? null;
    const facebookUrl = extractFacebookUrl(combinedHtml, url);
    const messengerUrl = extractMessengerUrl(combinedHtml, url, facebookUrl);
    const foundCount = [email, facebookUrl, messengerUrl].filter(Boolean).length;

    return {
      status: foundCount ? "found" : "not_found",
      sourceUrl,
      email,
      facebookUrl,
      messengerUrl,
      emailProvider: websiteEmail ? "website" : hunter?.email ? "hunter" : null,
      hunterConfidence: hunter?.confidence ?? null,
      confidence: foundCount ? Math.min(92, 48 + foundCount * 14 + (hunter?.confidence ? Math.min(12, Math.round(hunter.confidence / 8)) : 0)) : 28,
      notes: [
        websiteEmail
          ? "Public email found on business website."
          : hunter?.email
            ? "Hunter found a public/professional business email for this website domain."
            : "No public email found on reviewed website pages or Hunter domain search.",
        facebookUrl ? "Public Facebook link found on business website." : "No public Facebook link found on reviewed website pages.",
      ],
      retrievedAt,
    };
  } catch (error) {
    return {
      status: "failed",
      sourceUrl: url,
      email: null,
      facebookUrl: null,
      messengerUrl: null,
      emailProvider: null,
      hunterConfidence: null,
      confidence: 10,
      notes: ["Website contact discovery failed."],
      retrievedAt,
      error: error instanceof Error ? error.message : "Website contact discovery failed.",
    };
  }
}

async function fetchSerpApiTargetedProspects(input: {
  apiKey: string;
  market: string;
  vertical: string;
  query: string;
  limit: number;
}) {
  const params = new URLSearchParams({
    engine: "google_maps",
    type: "search",
    q: `${input.query} near ${input.market}`,
    api_key: input.apiKey,
    num: String(Math.min(Math.max(input.limit, 10), 40)),
  });
  const response = await fetch(`https://serpapi.com/search?${params}`);
  const json = await response.json().catch(() => ({})) as SerpApiLocalResponse;
  if (!response.ok || json.error) {
    throw new Error(json.error || `SerpAPI targeted prospect search failed with ${response.status}.`);
  }
  return json.local_results ?? [];
}

async function enrichExistingTargetedProspectContacts(
  db: ReturnType<typeof createServiceClient>,
  prospects: Array<Record<string, unknown>>,
  limit: number,
  hunterLimit: number,
) {
  let enriched = 0;
  let reviewed = 0;
  let hunterReviewed = 0;

  for (const row of prospects) {
    if (reviewed >= limit) break;
    const website = firstString(row.website);
    if (!website) continue;
    const needsEmail = !firstString(row.email);
    const needsFacebook = !firstString(row.facebook_url);
    const needsMessenger = !firstString(row.messenger_url);
    if (!needsEmail && !needsFacebook && !needsMessenger) continue;

    reviewed += 1;
    const allowHunter = needsEmail && hunterReviewed < hunterLimit;
    const discovery = await discoverWebsiteContacts({
      website,
      businessName: firstString(row.business_name),
      allowHunter,
    });
    if (allowHunter) hunterReviewed += 1;
    const update: Record<string, unknown> = {
      metadata: {
        ...metadataObject(row.metadata),
        website_contact_discovery: discovery,
        contact_discovery_reviewed_at: discovery.retrievedAt,
        contact_discovery_status: discovery.status,
        human_review_required: true,
        no_auto_send: true,
      },
    };

    if (needsEmail && discovery.email) update.email = discovery.email;
    if (needsFacebook && discovery.facebookUrl) update.facebook_url = discovery.facebookUrl;
    if (needsMessenger && discovery.messengerUrl) update.messenger_url = discovery.messengerUrl;

    if ("email" in update || "facebook_url" in update || "messenger_url" in update) {
      const id = firstString(row.id);
      if (!id) continue;
      const { error } = await db.from("outreach_prospects").update(update).eq("id", id);
      if (!error) enriched += 1;
    }
  }

  return { enriched, reviewed, hunterReviewed };
}

async function syncTargetedTaskContactsFromProspects(db: ReturnType<typeof createServiceClient>, date: string) {
  const { data: tasks } = await db
    .from("daily_outreach_tasks")
    .select("id,source_id,prospect_id,email,phone,website,facebook_url,messenger_url,metadata")
    .eq("outreach_date", date)
    .eq("category", "Targeted Campaign")
    .eq("source_table", "outreach_prospects")
    .limit(120);

  const taskRows = (tasks ?? []) as Array<Record<string, unknown>>;
  const prospectIds = Array.from(new Set(taskRows
    .map((task) => firstString(task.source_id, task.prospect_id))
    .filter((value): value is string => Boolean(value))));
  if (prospectIds.length === 0) return 0;

  const { data: prospects } = await db
    .from("outreach_prospects")
    .select("id,email,phone,website,facebook_url,messenger_url,metadata")
    .in("id", prospectIds);
  const byId = new Map((prospects ?? []).map((row: Record<string, unknown>) => [firstString(row.id), row]));

  let synced = 0;
  for (const task of taskRows) {
    const prospect = byId.get(firstString(task.source_id, task.prospect_id));
    if (!prospect) continue;

    const update: Record<string, unknown> = {};
    for (const field of ["email", "phone", "website", "facebook_url", "messenger_url"] as const) {
      if (!firstString(task[field]) && firstString(prospect[field])) {
        update[field] = firstString(prospect[field]);
      }
    }
    if (Object.keys(update).length === 0) continue;

    update.metadata = {
      ...metadataObject(task.metadata),
      contact_synced_from_prospect_at: new Date().toISOString(),
      prospect_contact_metadata: metadataObject(prospect.metadata).website_contact_discovery ?? null,
      human_review_required: true,
      no_auto_send: true,
    };
    const { error } = await db.from("daily_outreach_tasks").update(update).eq("id", firstString(task.id));
    if (!error) synced += 1;
  }

  return synced;
}

export async function generateDailyTargetedProspects(args: {
  actorId?: string | null;
  date?: string;
  markets?: string[];
  limitPerSearch?: number;
} = {}): Promise<DailyProspectRefreshResult> {
  const apiKey = targetedSerpApiKey();
  const enabled = targetedSerpApiEnabled();
  const markets = (args.markets?.length ? args.markets : TARGETED_DAILY_MARKETS).slice(0, 6);
  const warnings: string[] = [];

  if (!apiKey || !enabled) {
    return {
      ok: false,
      inserted: 0,
      enriched: 0,
      skipped: 0,
      searched: 0,
      warnings: [
        !apiKey
          ? "Targeted Campaign prospect search needs TARGETED_CAMPAIGNS_SERPAPI_KEY, STORMREACH_SERPAPI_KEY, SERPAPI_KEY, SERP_API, or SERPAPI_API_KEY."
          : "Targeted Campaign SerpAPI search is disabled. Set TARGETED_CAMPAIGNS_ENABLE_SERPAPI=true to run daily prospect generation.",
      ],
      providerConfigured: Boolean(apiKey) && enabled,
      markets,
      categories: TARGETED_SERPAPI_SEARCHES.map((search) => search.vertical),
    };
  }

  const db = createServiceClient();
  const { data: existing } = await db
    .from("outreach_prospects")
    .select("id,business_name,phone,website,city,state,email,facebook_url,messenger_url,metadata")
    .eq("category", "Targeted Campaign")
    .limit(2500);
  const contactResearchLimit = targetedContactResearchLimit();
  const hunterLimit = targetedHunterLimit();
  const existingEnrichment = await enrichExistingTargetedProspectContacts(
    db,
    (existing ?? []) as Array<Record<string, unknown>>,
    contactResearchLimit,
    hunterLimit,
  );
  const used = new Set<string>();
  for (const row of (existing ?? []) as Array<Record<string, unknown>>) {
    for (const key of prospectDedupeKeys({
      businessName: firstString(row.business_name),
      phone: firstString(row.phone),
      website: firstString(row.website),
      city: firstString(row.city),
      state: firstString(row.state),
    })) {
      used.add(key);
    }
  }

  let searched = 0;
  let inserted = 0;
  const enriched = existingEnrichment.enriched;
  let newContactPagesReviewed = 0;
  let newHunterReviewed = 0;
  let skipped = 0;
  const rows: Array<Record<string, unknown>> = [];
  const limitPerSearch = Math.max(5, Math.min(args.limitPerSearch ?? 12, 25));

  for (const market of markets) {
    for (const search of TARGETED_SERPAPI_SEARCHES) {
      try {
        const results = await fetchSerpApiTargetedProspects({
          apiKey,
          market,
          vertical: search.vertical,
          query: search.query,
          limit: limitPerSearch,
        });
        searched += results.length;
        for (const result of results) {
          const businessName = firstString(result.title);
          if (!businessName) {
            skipped += 1;
            continue;
          }
          const address = parseSerpAddress(result.address, market);
          const keys = prospectDedupeKeys({
            businessName,
            phone: firstString(result.phone),
            website: firstString(result.website),
            city: address.city,
            state: address.state,
          });
          if (keys.some((key) => used.has(key))) {
            skipped += 1;
            continue;
          }
          keys.forEach((key) => used.add(key));
          const score = Math.min(
            100,
            62 +
              (result.website ? 8 : 0) +
              (result.phone ? 5 : 0) +
              (typeof result.rating === "number" && result.rating >= 4 ? 6 : 0) +
              (typeof result.reviews === "number" && result.reviews >= 25 ? 5 : 0),
          );
          const website = firstString(result.website);
          const allowHunter = Boolean(website) && newHunterReviewed < Math.max(0, hunterLimit - existingEnrichment.hunterReviewed);
          const contactDiscovery = website && newContactPagesReviewed < contactResearchLimit
            ? await discoverWebsiteContacts({ website, businessName, allowHunter })
            : null;
          if (contactDiscovery) newContactPagesReviewed += 1;
          if (contactDiscovery && allowHunter) newHunterReviewed += 1;
          const discoveredFacebook = contactDiscovery?.facebookUrl ?? null;
          const discoveredMessenger = contactDiscovery?.messengerUrl ?? messengerUrlForFacebook(discoveredFacebook);
          rows.push({
            category: "Targeted Campaign",
            campaign_type: "targeted_mailing",
            business_name: businessName,
            industry: search.vertical,
            business_type: search.vertical,
            vertical: search.vertical,
            phone: firstString(result.phone),
            email: contactDiscovery?.email ?? null,
            website,
            facebook_url: discoveredFacebook,
            messenger_url: discoveredMessenger,
            city: address.city,
            state: address.state,
            source: "serpapi_google_maps",
            priority: score >= 82 ? "urgent" : score >= 70 ? "high" : "medium",
            outreach_priority_score: score,
            status: "available",
            notes: `${search.vertical} prospect found from SerpAPI Google Maps. Contact details require human review before outreach.`,
            metadata: {
              source: "serpapi_google_maps",
              source_url: "https://serpapi.com/search",
              serpapi_place_id: result.place_id ?? null,
              search_market: market,
              search_query: `${search.query} near ${market}`,
              rating: result.rating ?? null,
              reviews: result.reviews ?? null,
              address: result.address ?? null,
              latitude: result.gps_coordinates?.latitude ?? null,
              longitude: result.gps_coordinates?.longitude ?? null,
              website_contact_discovery: contactDiscovery,
              verification_status: "public_business_result_unverified_contact",
              email_status: contactDiscovery?.email
                ? `${contactDiscovery.emailProvider === "hunter" ? "Hunter domain search" : "Public website"} email found; human review required`
                : "Not publicly found",
              messenger_status: discoveredMessenger ? "Public Messenger/Facebook route found; manual handoff required" : "Not publicly found",
              generated_for_daily_targeted_campaigns: true,
              human_review_required: true,
              no_auto_send: true,
            },
          });
        }
      } catch (error) {
        warnings.push(error instanceof Error ? error.message : `Targeted prospect search failed for ${search.vertical} in ${market}.`);
      }
    }
  }

  if (rows.length) {
    const { error } = await db.from("outreach_prospects").insert(rows);
    if (error) throw error;
    inserted = rows.length;
  }

  await logOutreachActivity(db, {
    actorId: args.actorId,
    outreachDate: args.date ?? todayKey(),
    activityType: "targeted_daily_prospects_refreshed",
    category: "Targeted Campaign",
    summary: `Refreshed targeted campaign prospects: ${inserted} inserted, ${skipped} skipped, ${searched} public results reviewed.`,
    metadata: {
      provider: "serpapi_google_maps",
      provider_configured: Boolean(apiKey) && enabled,
      inserted,
      enriched,
      skipped,
      searched,
      markets,
      categories: TARGETED_SERPAPI_SEARCHES.map((search) => search.vertical),
      warnings,
      existing_contact_pages_reviewed: existingEnrichment.reviewed,
      existing_hunter_queries: existingEnrichment.hunterReviewed,
      new_contact_pages_reviewed: newContactPagesReviewed,
      new_hunter_queries: newHunterReviewed,
      human_review_required: true,
      no_auto_send: true,
    },
  });

  return {
    ok: warnings.length === 0,
    inserted,
    enriched,
    skipped,
    searched,
    warnings,
    providerConfigured: Boolean(apiKey) && enabled,
    markets,
    categories: TARGETED_SERPAPI_SEARCHES.map((search) => search.vertical),
  };
}

export async function fetchTargetedOutreachPlan(date = todayKey()): Promise<TargetedPlanPayload> {
  const db = createServiceClient();
  const [{ data: tasks }, { data: socialPosts }, { data: activity }] = await Promise.all([
    db
      .from("daily_outreach_tasks")
      .select("*")
      .eq("outreach_date", date)
      .eq("category", "Targeted Campaign")
      .order("completed", { ascending: true })
      .order("outreach_priority_score", { ascending: false, nullsFirst: false }),
    db
      .from("daily_social_posts")
      .select("id,post_type,category,audience,content,short_content,status,posted")
      .eq("outreach_date", date)
      .eq("category", "Targeted Campaign")
      .in("post_type", ["Facebook group post suggestion", "Local vertical-specific post suggestion"])
      .order("created_at", { ascending: true }),
    db
      .from("outreach_activity_log")
      .select("id,task_id,activity_type,channel,status,summary,metadata,created_at")
      .gte("outreach_date", date)
      .lte("outreach_date", date)
      .order("created_at", { ascending: false })
      .limit(80),
  ]);

  const targetedTasks = ((tasks ?? []) as DailyOutreachTask[])
    .filter((task) => task.metadata?.plan_type === TARGETED_PLAN_TYPE);
  const actionActivity = (activity ?? []) as TargetedPlanPayload["activity"];
  const completedActions = new Set(actionActivity.map((item) => `${item.task_id}:${item.activity_type}`));
  const emailActivityTypes = ["email_sent", "email_handoff_opened"];
  const smsActivityTypes = ["sms_sent", "sms_handoff_opened"];
  const dmActivityTypes = ["dm_sent", "messenger_handoff_opened"];
  const newProspects = targetedTasks.filter((task) => task.action_type !== "follow_up").length;
  const followUpsDue = targetedTasks.filter((task) => task.action_type === "follow_up" || task.outcome_status === "Follow-Up Due").length;
  const completedCount = targetedTasks.filter((task) => task.completed).length;

  return {
    date,
    stats: {
      newProspects,
      followUpsDue,
      emailsCompleted: targetedTasks.filter((task) => emailActivityTypes.some((type) => completedActions.has(`${task.id}:${type}`))).length,
      textsCompleted: targetedTasks.filter((task) => smsActivityTypes.some((type) => completedActions.has(`${task.id}:${type}`))).length,
      dmsCompleted: targetedTasks.filter((task) => dmActivityTypes.some((type) => completedActions.has(`${task.id}:${type}`))).length,
      callsCompleted: targetedTasks.filter((task) => completedActions.has(`${task.id}:called`)).length,
      interestedReplies: targetedTasks.filter((task) => task.outcome_status === "Interested").length,
      quotesNeeded: targetedTasks.filter((task) => task.outcome_status === "Needs Quote").length,
      dailyGoal: DAILY_TARGETED_NEW_GOAL,
      followUpGoal: DAILY_TARGETED_FOLLOW_UP_GOAL,
      completionPercent: targetedTasks.length ? Math.round((completedCount / targetedTasks.length) * 100) : 0,
    },
    tasks: targetedTasks,
    socialPosts: socialPosts ?? [],
    activity: actionActivity,
    sourceWarning: targetedTasks.length ? null : "No targeted plan exists for today yet. Generate the plan to pull real dealership, auto, medical, dental, and local-service prospects from existing records.",
  };
}

export async function generateTargetedOutreachPlan(
  date = todayKey(),
  actorId?: string | null,
  options: { refreshExternalProspects?: boolean; forceTopUp?: boolean } = {},
) {
  const db = createServiceClient();
  const prospectRefresh = options.refreshExternalProspects
    ? await generateDailyTargetedProspects({ actorId, date })
    : null;
  const syncedContactTasks = await syncTargetedTaskContactsFromProspects(db, date);
  const { data: existing } = await db
    .from("daily_outreach_tasks")
    .select("id,metadata,source_table,source_id,email,phone,business_name,city,state,website")
    .eq("outreach_date", date)
    .eq("category", "Targeted Campaign")
    .limit(80);
  const existingPlanRows = ((existing ?? []) as DailyOutreachTask[])
    .filter((row) => row.metadata?.plan_type === TARGETED_PLAN_TYPE);
  if (existingPlanRows.length && !options.forceTopUp) {
    return fetchTargetedOutreachPlan(date);
  }

  const [configured, sales, dueFollowUps] = await Promise.all([
    loadConfiguredProspects(120),
    loadSalesLeadProspects(240),
    loadDueFollowUps(date),
  ]);

  const used = new Set<string>();
  for (const row of existingPlanRows) {
    for (const key of taskDedupeKeys(row)) used.add(key);
  }
  const sourceProspects = [...configured, ...sales];
  const auto = unique(rotate(sourceProspects.filter((item) => isAutoVertical(item.vertical)), 40), 12, used);
  const medical = unique(rotate(sourceProspects.filter((item) => isMedicalVertical(item.vertical)), 40), 12, used);
  const localService = unique(rotate(sourceProspects.filter((item) => isLocalServiceVertical(item.vertical)), 40), 8, used);
  const followUps = unique(rotate(dueFollowUps, 24), DAILY_TARGETED_FOLLOW_UP_GOAL, used);
  const rows = [
    ...auto.map((prospect) => taskRow(prospect, date)),
    ...medical.map((prospect) => taskRow(prospect, date)),
    ...localService.map((prospect) => taskRow(prospect, date)),
    ...followUps.map((prospect) => taskRow(prospect, date, true)),
  ];

  const socialRows = existingPlanRows.length ? [] : buildSocialPosts(date);
  const [{ error: taskError }, { error: socialError }] = await Promise.all([
    rows.length ? db.from("daily_outreach_tasks").insert(rows) : Promise.resolve({ error: null }),
    socialRows.length ? db.from("daily_social_posts").insert(socialRows) : Promise.resolve({ error: null }),
  ]);
  if (taskError) throw taskError;
  if (socialError) throw socialError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: date,
    activityType: "daily_targeted_outreach_plan_generated",
    category: "Targeted Campaign",
    summary: `Generated ${rows.length} targeted postcard outreach tasks.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      auto_count: auto.length,
      medical_count: medical.length,
      local_service_count: localService.length,
      follow_up_count: followUps.length,
      social_post_count: socialRows.length,
      existing_plan_count: existingPlanRows.length,
      prospect_refresh: prospectRefresh,
      synced_contact_tasks: syncedContactTasks,
      manual_review_required: true,
      outreach_agent_mode: "high_throughput_draft_queue",
    },
  });

  return fetchTargetedOutreachPlan(date);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToEmailHtml(text: string) {
  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#111827;white-space:pre-wrap">${escapeEmailHtml(text)}</div>`;
}

function targetedEmailText(task: DailyOutreachTask) {
  const body = (task.email_body ?? "").trim();
  if (/\bunsubscribe\b/i.test(body)) return body;
  return `${body}\n\nIf this is not useful, reply unsubscribe and I will remove this address.`;
}

function safeProviderMetadata(task: DailyOutreachTask) {
  const safeValue = (value: string | null | undefined, fallback = "") => {
    const normalized = (value ?? fallback).replace(/[^\w .:@-]/g, " ").replace(/\s+/g, " ").trim();
    return normalized.slice(0, 80) || fallback.slice(0, 80);
  };

  return {
    source: "targeted",
    task_id: safeValue(task.id),
    sender: safeValue(task.sender_key ?? "manual"),
    vertical: safeValue(task.vertical ?? task.industry ?? "targeted"),
  };
}

async function findActiveEmailSuppression(
  db: ReturnType<typeof createServiceClient>,
  email: string,
) {
  const normalized = email.trim().toLowerCase();
  const { data, error } = await db
    .from("outreach_suppression_list")
    .select("id,reason,channel")
    .eq("active", true)
    .in("channel", ["email", "all"])
    .ilike("contact_email", normalized)
    .limit(1);

  if (error && error.code !== "42P01") throw error;
  return (data ?? [])[0] as { id: string; reason?: string | null; channel?: string | null } | undefined;
}

function stripHtml(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, "\"")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(html: string, pattern: RegExp) {
  const match = html.match(pattern);
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 240) ?? null;
}

async function fetchHomepage(url: string, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "HomeReachBot/1.0 (+https://home-reach.com; targeted campaign research)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Website returned ${response.status}.`);
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("text/html")) {
      throw new Error("Website did not return HTML.");
    }
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function detectSignals(text: string, vertical: string) {
  const lower = text.toLowerCase();
  const serviceSignals: string[] = [];
  const offerSignals: string[] = [];
  const trustSignals: string[] = [];
  const addIf = (condition: boolean, bucket: string[], label: string) => {
    if (condition && !bucket.includes(label)) bucket.push(label);
  };

  addIf(/new patient|accepting new patients|appointment|schedule/.test(lower), offerSignals, "appointment scheduling");
  addIf(/family|children|kids|pediatric/.test(lower), serviceSignals, "family-friendly services");
  addIf(/emergency|same day|urgent/.test(lower), offerSignals, "urgent or same-day availability");
  addIf(/implant|invisalign|cosmetic|veneers|whitening/.test(lower), serviceSignals, "premium dental treatment");
  addIf(/primary care|family medicine|wellness|preventive/.test(lower), serviceSignals, "primary care and wellness");
  addIf(/service department|oil change|brake|tire|trade|inventory|pre-owned|used/.test(lower), serviceSignals, "service lane, inventory, or trade-in demand");
  addIf(/sunday|service times|worship|kids ministry|small groups|new here/.test(lower), serviceSignals, "Sunday worship and community invitation");
  addIf(/locally owned|family owned|independent|serving/.test(lower), trustSignals, "local ownership or service history");
  addIf(/reviews|testimonials|rated|award|since \d{4}/.test(lower), trustSignals, "public proof or reputation signal");

  if (serviceSignals.length === 0) serviceSignals.push(`${vertical.toLowerCase()} visibility`);
  if (offerSignals.length === 0) offerSignals.push("clear local call-to-action");
  if (trustSignals.length === 0) trustSignals.push("website reviewed for route-specific postcard fit");

  return { serviceSignals, offerSignals, trustSignals };
}

function postcardAngleFor(vertical: string, signals: { serviceSignals: string[]; offerSignals: string[] }) {
  if (vertical === "Dealership" || isAutoVertical(vertical)) return "local service, trade-in, and inventory visibility";
  if (vertical === "Dentist" || vertical.includes("dentist")) return "new-patient family neighborhood campaign";
  if (vertical === "Doctor" || isMedicalVertical(vertical)) return "new-patient appointment access campaign";
  if (vertical === "Church") return "warm neighborhood invitation campaign";
  return `${signals.serviceSignals[0]} campaign`;
}

async function researchWebsiteForTask(task: DailyOutreachTask): Promise<WebsiteResearch> {
  const url = normalizeHttpUrl(task.website);
  const retrievedAt = new Date().toISOString();
  if (!url) {
    return {
      status: "missing_website",
      url: null,
      serviceSignals: [task.vertical ?? task.industry ?? "local visibility"],
      offerSignals: ["clear local call-to-action"],
      trustSignals: ["website not available"],
      recommendedPostcardAngle: postcardAngleFor(task.vertical ?? task.industry ?? "Local business", {
        serviceSignals: [task.vertical ?? task.industry ?? "local visibility"],
        offerSignals: ["clear local call-to-action"],
      }),
      confidence: 35,
      retrievedAt,
      error: "No public website was available for this prospect.",
    };
  }

  try {
    const html = await fetchHomepage(url);
    const title = extractTag(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const description = extractTag(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)
      ?? extractTag(html, /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["'][^>]*>/i);
    const text = stripHtml(html).slice(0, 10000);
    const signals = detectSignals(`${title ?? ""} ${description ?? ""} ${text}`, task.vertical ?? task.industry ?? "Local business");
    return {
      status: "researched",
      url,
      title,
      description,
      ...signals,
      recommendedPostcardAngle: postcardAngleFor(task.vertical ?? task.industry ?? "Local business", signals),
      confidence: Math.min(92, 50 + signals.serviceSignals.length * 8 + signals.offerSignals.length * 6 + signals.trustSignals.length * 5),
      retrievedAt,
    };
  } catch (error) {
    return {
      status: "failed",
      url,
      serviceSignals: [task.vertical ?? task.industry ?? "local visibility"],
      offerSignals: ["clear local call-to-action"],
      trustSignals: ["website fetch failed"],
      recommendedPostcardAngle: postcardAngleFor(task.vertical ?? task.industry ?? "Local business", {
        serviceSignals: [task.vertical ?? task.industry ?? "local visibility"],
        offerSignals: ["clear local call-to-action"],
      }),
      confidence: 30,
      retrievedAt,
      error: error instanceof Error ? error.message : "Website research failed.",
    };
  }
}

function researchBasedDrafts(task: DailyOutreachTask, research: WebsiteResearch) {
  const business = task.business_name ?? "your business";
  const contact = firstName(task.contact_name);
  const city = task.city ?? "your area";
  const senderKey = task.sender_key ?? "josh";
  const sender = DAILY_OUTREACH_SENDER_PROFILES[senderKey];
  const senderFirst = senderFirstName(senderKey);
  const service = research.serviceSignals[0] ?? task.vertical ?? "local visibility";
  const angle = research.recommendedPostcardAngle;
  const websiteNote = research.status === "researched"
    ? `I looked at ${business}'s site and noticed the ${service} angle.`
    : `I was reviewing ${business} for a targeted local postcard campaign.`;
  const subject = `${business}: ${angle}`;
  const body = `${contact ? `Hi ${contact},` : "Hi,"}

${websiteNote}

That looks like a good fit for a route-based HomeReach campaign in ${city}: mapped households first, a clean postcard proof, QR tracking, and optional digital retargeting after the mail drops.

The first concept I would test is simple: ${angle}. We can keep it focused on ${research.offerSignals[0] ?? "one clear CTA"} and show the route map before anything is printed.

Want me to send a quick neighborhood map and postcard preview for ${business}?

${sender.senderName}
HomeReach
${sender.senderEmail}

If this is not useful, reply unsubscribe and I will remove this address.`;

  return {
    subject,
    body,
    sms: `Hi${contact ? ` ${contact}` : ""}, ${senderFirst} with HomeReach. I reviewed ${business}'s site and have a ${angle} idea for ${city}. Want a quick map + postcard preview? Reply STOP to opt out.`,
    dm: `Hi${contact ? ` ${contact}` : ""} - ${senderFirst} with HomeReach. I reviewed ${business}'s site and had a route-based postcard idea around ${service}. I can send a quick map and proof preview before anything is printed. Worth a look?`,
  };
}

function buildPostcardBrief(task: DailyOutreachTask, research: WebsiteResearch): PostcardDesignBrief {
  const business = task.business_name ?? "Local business";
  const city = task.city ?? "your neighborhood";
  const vertical = task.vertical ?? task.industry ?? "Local business";
  const service = research.serviceSignals[0] ?? vertical.toLowerCase();
  const offer = research.offerSignals[0] ?? "simple local appointment request";
  const trust = research.trustSignals[0] ?? "local website reviewed";
  const sourceUrl = research.url ?? normalizeHttpUrl(task.website);

  const ctaByVertical = vertical === "Church"
    ? "Plan your first visit"
    : isAutoVertical(vertical)
      ? "Schedule service or view current options"
      : isMedicalVertical(vertical)
        ? "Request an appointment"
        : "Request a quick estimate";
  const headlineByVertical = vertical === "Church"
    ? `${city} neighbors are welcome here`
    : isAutoVertical(vertical)
      ? `${business} is close by when your vehicle needs attention`
      : isMedicalVertical(vertical)
        ? `A nearby team for ${service}`
        : `${service} help close to home`;

  return {
    format: "6x9_postcard",
    businessName: business,
    vertical,
    frontHeadline: headlineByVertical,
    frontSubheadline: `${business} can use a focused HomeReach postcard drop to reach households around ${city} with a clear, local message.`,
    offer,
    cta: ctaByVertical,
    qrDestination: sourceUrl ?? "HomeReach tracking landing page needed",
    backBody: `HomeReach would target selected carrier routes around ${city}, use a clean postcard proof for ${business}, and connect the QR/CTA to ${offer}. Message angle: ${research.recommendedPostcardAngle}. Trust signal to consider: ${trust}.`,
    imageDirection: vertical === "Church"
      ? "Warm exterior/community image, simple service-time callout, no pressure language."
      : isMedicalVertical(vertical)
        ? "Bright professional office or staff-forward image, appointment CTA, calm healthcare tone."
        : isAutoVertical(vertical)
          ? "Clean dealership or service-lane image, vehicle/service cue, strong local CTA."
          : "Clear service image with local neighborhood context and one primary CTA.",
    brandNotes: [
      research.title ? `Website title: ${research.title}` : "Use business name prominently.",
      research.description ? `Website description cue: ${research.description}` : `Lead with ${service}.`,
      `Keep the message helpful and locally specific for ${city}.`,
    ],
    recommendedAudience: `Households within selected carrier routes around ${city}; start with 1,000-2,500 homes unless the operator expands the market.`,
    recommendedQuantity: 2500,
    complianceNotes: [
      "Human approval required before print, mail, payment, or public use.",
      "Do not imply affiliation, guaranteed results, or unsupported healthcare/financial outcomes.",
      "Use source-backed website facts only; review the final proof with the business owner.",
    ],
    generatedAt: new Date().toISOString(),
    sourceUrl,
    sourceConfidence: research.confidence,
  };
}

export async function researchTargetedOutreachTaskWebsite(taskId: string, actorId?: string | null) {
  const db = createServiceClient();
  const { data: task, error } = await db.from("daily_outreach_tasks").select("*").eq("id", taskId).maybeSingle<DailyOutreachTask>();
  if (error) throw error;
  if (!task) return null;

  const research = await researchWebsiteForTask(task);
  const drafts = researchBasedDrafts(task, research);
  const metadata = {
    ...metadataObject(task.metadata),
    website_research: research,
    website_research_required_for_postcard: research.status !== "researched",
    draft_personalization_source: research.url,
    human_review_required: true,
    no_auto_send: true,
  };

  const { data: updated, error: updateError } = await db
    .from("daily_outreach_tasks")
    .update({
      email_subject: drafts.subject,
      email_body: drafts.body,
      sms_body: drafts.sms,
      dm_body: drafts.dm,
      metadata,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("*")
    .single<DailyOutreachTask>();
  if (updateError) throw updateError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: updated.outreach_date,
    taskId,
    prospectId: updated.prospect_id,
    category: "Targeted Campaign",
    activityType: "website_research_completed",
    channel: "website",
    summary: `Researched website and refreshed outreach drafts for ${updated.business_name ?? "targeted prospect"}.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      website_research_status: research.status,
      source_url: research.url,
      confidence: research.confidence,
      human_review_required: true,
    },
  });

  return updated;
}

export async function generateTargetedPostcardDesign(taskId: string, actorId?: string | null) {
  const db = createServiceClient();
  const { data: task, error } = await db.from("daily_outreach_tasks").select("*").eq("id", taskId).maybeSingle<DailyOutreachTask>();
  if (error) throw error;
  if (!task) return null;

  const existingResearch = metadataObject(task.metadata).website_research as WebsiteResearch | undefined;
  const research = existingResearch?.retrievedAt ? existingResearch : await researchWebsiteForTask(task);
  const design = buildPostcardBrief(task, research);
  const metadata = {
    ...metadataObject(task.metadata),
    website_research: research,
    postcard_design: design,
    postcard_design_status: "draft_ready_for_human_review",
    design_engine_destination: "/admin/creative-studio",
    human_review_required: true,
    no_auto_send: true,
  };

  const { data: updated, error: updateError } = await db
    .from("daily_outreach_tasks")
    .update({
      metadata,
      visual_type: "postcard_design_brief",
      visual_alt: `${design.businessName} ${design.format} design brief`,
      notes: [task.notes, `Postcard design draft generated: ${design.frontHeadline}`].filter(Boolean).join("\n\n"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .select("*")
    .single<DailyOutreachTask>();
  if (updateError) throw updateError;

  await logOutreachActivity(db, {
    actorId,
    outreachDate: updated.outreach_date,
    taskId,
    prospectId: updated.prospect_id,
    category: "Targeted Campaign",
    activityType: "postcard_design_generated",
    channel: "postcard",
    summary: `Generated a website-informed postcard design brief for ${updated.business_name ?? "targeted prospect"}.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      source_url: design.sourceUrl,
      source_confidence: design.sourceConfidence,
      format: design.format,
      human_review_required: true,
    },
  });

  return updated;
}

export async function sendTargetedOutreachEmail(taskId: string, actorId?: string | null) {
  const db = createServiceClient();
  const { data: task, error } = await db
    .from("daily_outreach_tasks")
    .select("*")
    .eq("id", taskId)
    .maybeSingle<DailyOutreachTask>();
  if (error) throw error;
  if (!task) return null;
  if (task.category !== "Targeted Campaign" || task.metadata?.plan_type !== TARGETED_PLAN_TYPE) {
    throw new Error("This is not a targeted outreach task.");
  }
  if (!task.email) throw new Error("This prospect does not have an email address.");
  if (!task.email_subject || !task.email_body) throw new Error("This prospect is missing an email draft.");
  if (["sent", "sending"].includes(String(task.send_status ?? "").toLowerCase())) {
    throw new Error("This email has already been sent or is currently sending.");
  }
  if (["bounced", "complained", "unsubscribed"].includes(String(task.delivery_status ?? "").toLowerCase())) {
    throw new Error("This recipient is blocked by prior delivery or unsubscribe status.");
  }

  const suppression = await findActiveEmailSuppression(db, task.email);
  if (suppression) {
    await logOutreachActivity(db, {
      actorId,
      outreachDate: task.outreach_date,
      taskId,
      prospectId: task.prospect_id,
      category: "Targeted Campaign",
      activityType: "email_send_blocked_suppression",
      channel: "email",
      status: "blocked",
      summary: `Suppression blocked email to ${task.email}.`,
      metadata: {
        plan_type: TARGETED_PLAN_TYPE,
        suppression_id: suppression.id,
        suppression_reason: suppression.reason ?? null,
        human_review_required: true,
      },
    });
    throw new Error(`Email is suppressed: ${suppression.reason ?? "active suppression record"}.`);
  }

  const now = new Date().toISOString();
  await db
    .from("daily_outreach_tasks")
    .update({
      send_status: "sending",
      approval_status: "approved",
      approved_at: task.approved_at ?? now,
      approved_by: task.approved_by ?? actorId ?? null,
      last_error: null,
      updated_at: now,
      last_action_at: now,
    })
    .eq("id", taskId);

  const text = targetedEmailText(task);
  const result = await sendEmail({
    to: task.email,
    subject: task.email_subject,
    html: textToEmailHtml(text),
    text,
    fromEmail: task.sender_email ?? undefined,
    fromName: task.sender_name ?? undefined,
    replyTo: task.sender_email ?? undefined,
    messageStream: process.env.POSTMARK_MESSAGE_STREAM ?? "outbound",
    tags: ["targeted-outreach"],
    metadata: safeProviderMetadata(task),
    intent: "prospecting",
  });

  const completedAt = new Date().toISOString();
  if (!result.success) {
    const { data: failed } = await db
      .from("daily_outreach_tasks")
      .update({
        send_status: "failed",
        delivery_status: "failed",
        last_error: result.error ?? "Email provider send failed.",
        send_attempts: (task.send_attempts ?? 0) + 1,
        updated_at: completedAt,
        last_action_at: completedAt,
      })
      .eq("id", taskId)
      .select("*")
      .single<DailyOutreachTask>();

    await logOutreachActivity(db, {
      actorId,
      outreachDate: task.outreach_date,
      taskId,
      prospectId: task.prospect_id,
      category: "Targeted Campaign",
      activityType: "email_send_failed",
      channel: "email",
      status: "failed",
      summary: result.error ?? `Email send failed for ${task.business_name ?? task.email}.`,
      metadata: {
        plan_type: TARGETED_PLAN_TYPE,
        provider: result.provider ?? null,
        test_mode: result.testMode ?? false,
        manual_click_send: true,
      },
    });

    return {
      ok: false,
      task: failed,
      result,
    };
  }

  const { data: updated, error: updateError } = await db
    .from("daily_outreach_tasks")
    .update({
      send_status: "sent",
      delivery_status: result.testMode ? "test_sent" : "sent",
      approval_status: "approved",
      approved_at: task.approved_at ?? now,
      approved_by: task.approved_by ?? actorId ?? null,
      provider_message_id: result.externalId ?? null,
      send_attempts: (task.send_attempts ?? 0) + 1,
      outcome_status: "Contacted",
      status: "in_progress",
      last_error: null,
      updated_at: completedAt,
      last_action_at: completedAt,
    })
    .eq("id", taskId)
    .select("*")
    .single<DailyOutreachTask>();
  if (updateError) throw updateError;

  if (task.prospect_id) {
    await db
      .from("outreach_prospects")
      .update({
        status: "contacted",
        last_contacted_at: completedAt,
        updated_at: completedAt,
      })
      .eq("id", task.prospect_id);
  }

  await logOutreachActivity(db, {
    actorId,
    outreachDate: updated.outreach_date,
    taskId,
    prospectId: updated.prospect_id,
    category: "Targeted Campaign",
    activityType: "email_sent",
    channel: "email",
    status: "logged",
    summary: `Sent targeted campaign email to ${updated.business_name ?? updated.email}.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      provider: result.provider ?? null,
      provider_message_id: result.externalId ?? null,
      test_mode: result.testMode ?? false,
      manual_click_send: true,
      human_approved_by_click: true,
    },
  });

  return {
    ok: true,
    task: updated,
    result,
  };
}

export async function updateTargetedOutreachTask(
  taskId: string,
  patch: {
    outcome_status?: TargetedOutcomeStatus;
    notes?: string;
    follow_up_date?: string | null;
    completed?: boolean;
    activity_type?: string;
    channel?: string;
  },
  actorId?: string | null
) {
  const db = createServiceClient();
  const { data: task, error } = await db.from("daily_outreach_tasks").select("*").eq("id", taskId).maybeSingle();
  if (error) throw error;
  if (!task) return null;

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_action_at: new Date().toISOString(),
  };
  if (patch.outcome_status && OUTCOME_STATUSES.includes(patch.outcome_status)) {
    update.outcome_status = patch.outcome_status;
    update.status = patch.outcome_status === "Follow-Up Due" ? "follow_up" : patch.outcome_status === "Contacted" ? "in_progress" : task.status;
  }
  if ("notes" in patch) update.notes = patch.notes ?? null;
  if ("follow_up_date" in patch) {
    update.follow_up_date = patch.follow_up_date ?? null;
    if (patch.follow_up_date) update.outcome_status = "Follow-Up Due";
  }
  if (patch.completed) {
    update.completed = true;
    update.completed_at = new Date().toISOString();
    update.completed_by = actorId ?? null;
    update.status = "completed";
  }

  const { data: updated, error: updateError } = await db
    .from("daily_outreach_tasks")
    .update(update)
    .eq("id", taskId)
    .select("*")
    .single();
  if (updateError) throw updateError;

  const activityType = patch.activity_type ?? (patch.completed ? "task_completed" : "task_updated");
  await logOutreachActivity(db, {
    actorId,
    outreachDate: updated.outreach_date,
    taskId,
    prospectId: updated.prospect_id,
    category: "Targeted Campaign",
    activityType,
    channel: patch.channel,
    summary: `${activityType.replace(/_/g, " ")} for ${updated.business_name ?? "targeted outreach prospect"}.`,
    metadata: {
      plan_type: TARGETED_PLAN_TYPE,
      outcome_status: update.outcome_status ?? updated.outcome_status,
      follow_up_date: update.follow_up_date ?? updated.follow_up_date,
    },
  });

  return updated as DailyOutreachTask;
}
