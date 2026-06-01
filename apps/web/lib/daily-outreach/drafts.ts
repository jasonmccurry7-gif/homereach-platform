import type {
  DailyOutreachBusinessLine,
  DailyOutreachSenderControl,
  DailyOutreachSenderKey,
  OutreachCategory,
  OutreachPriority,
} from "./types";

export const DAILY_OUTREACH_TARGETS: Record<OutreachCategory, number> = {
  "Targeted Campaign": 5,
  "Procurement / Supplify": 10,
  "Political Outreach": 5,
  "Government Contracting": 0,
};

export const OUTREACH_CATEGORIES = Object.keys(
  DAILY_OUTREACH_TARGETS
) as OutreachCategory[];

export type DailySenderProfile = {
  key: DailyOutreachSenderKey;
  senderName: string;
  senderEmail: string;
  businessLine: DailyOutreachBusinessLine;
  category: OutreachCategory;
  dailyCap: number;
  personality: string;
};

export type DailyVisualAsset = {
  type: string;
  url: string;
  alt: string;
};

export type SenderDraftInput = DraftInput & {
  senderKey: DailyOutreachSenderKey;
  date: string;
  sequence: number;
  sourceId?: string | null;
  sourceTable?: string | null;
  city?: string | null;
  county?: string | null;
  state?: string | null;
};

export type SenderDraftOutput = {
  emailSubject: string;
  emailBody: string;
  smsBody: string;
  dmBody: string;
  visual: DailyVisualAsset;
  subjectVariantKey: string;
  ctaVariantKey: string;
  introVariantKey: string;
  signatureVariantKey: string;
  householdDensityEstimate: string;
  neighborhoodExample: string;
};

export const DAILY_OUTREACH_SENDER_PROFILES: Record<DailyOutreachSenderKey, DailySenderProfile> = {
  heather: {
    key: "heather",
    senderName: "Heather HomeReach",
    senderEmail: "heather@home-reach.com",
    businessLine: "inventory_procurement",
    category: "Procurement / Supplify",
    dailyCap: 5,
    personality: "Polished premium procurement and operational-efficiency advisor",
  },
  josh: {
    key: "josh",
    senderName: "Josh HomeReach",
    senderEmail: "josh@home-reach.com",
    businessLine: "targeted_mailing",
    category: "Targeted Campaign",
    dailyCap: 5,
    personality: "Practical local business shared postcard advisor",
  },
  chelsi: {
    key: "chelsi",
    senderName: "Chelsi HomeReach",
    senderEmail: "chelsi@home-reach.com",
    businessLine: "inventory_procurement",
    category: "Procurement / Supplify",
    dailyCap: 5,
    personality: "Helpful small business savings consultant",
  },
  jason: {
    key: "jason",
    senderName: "Jason McCurry",
    senderEmail: "jason@home-reach.com",
    businessLine: "political",
    category: "Political Outreach",
    dailyCap: 5,
    personality: "Executive campaign operations strategist",
  },
};

const OUTREACH_VISUAL_BASE_URL =
  (process.env.OUTBOUND_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://www.home-reach.com")
    .replace(/\/+$/, "");

export const DEFAULT_DAILY_OUTREACH_CONTROLS: DailyOutreachSenderControl[] =
  (Object.values(DAILY_OUTREACH_SENDER_PROFILES) as DailySenderProfile[]).map((profile) => ({
    sender_key: profile.key,
    sender_name: profile.senderName,
    sender_email: profile.senderEmail,
    business_line: profile.businessLine,
    daily_cap: profile.dailyCap,
    paused: false,
    manual_approval_required: true,
    min_spacing_minutes: 45,
    business_start_minutes: 510,
    business_end_minutes: 990,
    timezone: "America/New_York",
  }));

type DraftInput = {
  category: OutreachCategory;
  businessName?: string | null;
  campaignName?: string | null;
  contactName?: string | null;
  industry?: string | null;
};

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

function displayName(input: DraftInput) {
  return input.businessName || input.campaignName || "your organization";
}

function stableIndex(seed: string, length: number): number {
  if (length <= 0) return 0;
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

function pick<T>(items: T[], seed: string): { value: T; index: number } {
  if (items.length === 0) throw new Error("Cannot pick from an empty rotation list");
  const index = stableIndex(seed, items.length);
  return { value: items[index] as T, index };
}

function densityEstimate(seed: string) {
  const low = 1450 + stableIndex(`${seed}:density-low`, 950);
  const high = low + 420 + stableIndex(`${seed}:density-high`, 720);
  return `${low.toLocaleString()}-${high.toLocaleString()} households`;
}

function nearbyNeighborhood(seed: string, industry?: string | null) {
  const roofing = ["Highland Square", "Ellet", "Firestone Park", "Wallhaven", "Goodyear Heights", "West Akron"];
  const hvac = ["Cuyahoga Falls", "Fairlawn", "Green", "Stow", "Tallmadge", "North Canton"];
  const landscaping = ["Bath", "Hudson", "Wadsworth", "Uniontown", "Jackson Township", "Norton"];
  const bakery = ["Highland Square", "Downtown Akron", "Fairlawn", "Cuyahoga Falls", "West Market", "Portage Lakes"];
  const text = `${industry ?? ""}`.toLowerCase();
  const pool = text.includes("hvac")
    ? hvac
    : text.includes("landscap")
      ? landscaping
      : text.includes("bakery") || text.includes("restaurant") || text.includes("food")
        ? bakery
        : roofing;
  return pick(pool, seed).value;
}

function firstSentenceName(name?: string | null) {
  const first = firstName(name);
  return first ? `Hi ${first},` : "Hi,";
}

function sourceLabel(sourceTable?: string | null) {
  if (sourceTable === "sales_leads") return "sales lead";
  if (sourceTable === "political_candidate_agents") return "political candidate record";
  if (sourceTable === "outreach_prospects") return "configured prospect";
  return "daily outreach prospect";
}

function buildHomeReachVisualUrl(pathname: string, params: Record<string, string | number | null | undefined>) {
  const url = new URL(pathname, `${OUTREACH_VISUAL_BASE_URL}/`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function politicalCandidateVisualKey(input: SenderDraftInput) {
  return input.campaignName || input.businessName || input.contactName || input.sourceId || "campaign";
}

export function visualForSenderDraft(input: SenderDraftInput, seed: string): DailyVisualAsset {
  const name = displayName(input);
  const neighborhood = nearbyNeighborhood(seed, input.industry);
  const density = densityEstimate(seed);
  const city = input.city || input.county || input.state || neighborhood;

  if (input.senderKey === "josh") {
    return {
      type: "targeted_neighborhood_mailbox_map",
      url: buildHomeReachVisualUrl("/api/outreach-visuals/targeted-neighborhood", {
        business: name,
        city,
        industry: input.industry || input.category,
        neighborhood,
        households: density,
      }),
      alt: `Neighborhood map showing ${name} in the center with postcards dropping into nearby mailboxes`,
    };
  }

  if (input.senderKey === "jason") {
    return {
      type: "candidate_four_postcard_options",
      url: buildHomeReachVisualUrl("/api/political/candidate-options-image", {
        candidate: politicalCandidateVisualKey(input),
        office: input.industry,
        county: input.county,
        city: input.city,
        state: input.state,
      }),
      alt: `${name} side-by-side four campaign postcard options`,
    };
  }

  return {
    type: "supplyfy_ingredient_savings_dashboard",
    url: buildHomeReachVisualUrl("/api/outreach-visuals/supplyfy-savings", {
      business: name,
      category: input.industry || input.category,
      sender: input.senderKey,
    }),
    alt: `SupplyFy dashboard showing ingredient savings and daily best-price visibility for ${name}`,
  };
}

export function scheduleForSender(
  date: string,
  senderKey: DailyOutreachSenderKey,
  sequence: number,
  options: {
    dailyCap?: number;
    businessStartMinutes?: number;
    businessEndMinutes?: number;
    minSpacingMinutes?: number;
    timezone?: string;
  } = {}
) {
  const dailyCap = Math.max(1, options.dailyCap ?? DAILY_OUTREACH_SENDER_PROFILES[senderKey].dailyCap);
  const start = options.businessStartMinutes ?? 510;
  const end = options.businessEndMinutes ?? 990;
  const minSpacing = Math.max(45, options.minSpacingMinutes ?? 45);
  const safeWindow = Math.max(minSpacing, end - start);
  const spacing = dailyCap <= 1
    ? minSpacing
    : Math.max(minSpacing, Math.floor((safeWindow - 18) / Math.max(1, dailyCap - 1)));
  const seed = `${date}:${senderKey}:${sequence}`;
  const jitter = stableIndex(`${seed}:jitter`, 18);
  const rawMinutes = start + jitter + Math.max(0, sequence - 1) * spacing;
  const minutes = Math.min(rawMinutes, end - 8);
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return zonedIso(date, hour, minute, options.timezone ?? "America/New_York");
}

function zonedIso(date: string, hour: number, minute: number, timezone: string) {
  const [year = 1970, month = 1, day = 1] = date.split("-").map((part) => Number(part));
  const probe = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offset = timezoneOffsetLabel(probe, timezone);
  return `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00${offset}`;
}

function timezoneOffsetLabel(date: Date, timezone: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    }).formatToParts(date);
    const raw = parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT-5";
    const match = raw.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return "-05:00";
    const sign = match[1] === "+" ? "+" : "-";
    const hours = String(Number(match[2])).padStart(2, "0");
    const minutes = match[3] ?? "00";
    return `${sign}${hours}:${minutes}`;
  } catch {
    return "-05:00";
  }
}

export function normalizePriority(value?: string | null): OutreachPriority {
  if (value === "urgent" || value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

export function suggestedActionType(category: OutreachCategory, hasEmail: boolean, hasPhone: boolean) {
  if (category === "Government Contracting") return "review_opportunity";
  if (hasEmail) return "email";
  if (hasPhone) return "sms";
  return "facebook_dm";
}

export function buildSenderOutreachDrafts(input: SenderDraftInput): SenderDraftOutput {
  const seed = `${input.date}:${input.senderKey}:${displayName(input)}:${input.sequence}`;
  const name = displayName(input);
  const greeting = firstSentenceName(input.contactName);
  const industry = input.industry || "local business";
  const neighborhood = nearbyNeighborhood(seed, input.industry);
  const density = densityEstimate(seed);
  const visual = visualForSenderDraft(input, `${seed}:visual`);
  const imageToken = `[[image:${visual.url}|${visual.alt}]]`;

  if (input.senderKey === "josh") {
    const subjects = [
      `Route idea near ${name}`,
      `${name}: nearby neighborhood map`,
      `Quick postcard route thought`,
      `Map idea around recent jobs`,
      `A small route around ${name}`,
    ];
    const intros = [
      `I was looking at how a ${industry} business could stay visible around nearby jobs without turning it into a huge campaign.`,
      `Quick note from HomeReach. The strongest postcard routes are often the streets around work you are already doing.`,
      `I had a simple route-density thought for ${name}.`,
      `A small local campaign can work better when it follows the neighborhoods where crews are already visible.`,
    ];
    const ctas = [
      "Want me to show you a sample route near you?",
      "Want to see what neighborhoods would make the most sense?",
      "Would you want me to map one out?",
      "Should I send a quick route example?",
    ];
    const signoffs = ["Josh", "Josh at HomeReach", "Josh\nHomeReach"];
    const subject = pick(subjects, `${seed}:subject`);
    const intro = pick(intros, `${seed}:intro`);
    const cta = pick(ctas, `${seed}:cta`);
    const signature = pick(signoffs, `${seed}:signature`);

    return {
      emailSubject: subject.value,
      emailBody: `${greeting}

${intro.value}

For example, an illustrative ${neighborhood}-style route could put ${name} in front of about ${density}. That estimate is a planning placeholder until a real route is mapped. The visual below shows the basic idea: your current customer or best local job in the middle, then postcards dropping into the nearby mailboxes around that point.

The simple play is reaching neighbors around existing jobs, then sharing cost with other local businesses when the route fits.

${imageToken}

${cta.value}

${signature.value}`,
      smsBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"}, Josh with HomeReach. I mapped a small postcard route idea around neighbors near existing jobs for ${name}. Want the quick example? Reply STOP to opt out.`,
      dmBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"} - Josh with HomeReach. I had a simple nearby route idea for ${name}: neighbors around existing jobs, an illustrative ${density} planning range, with shared-cost options when the area fits. Want me to send the sample map?`,
      visual,
      subjectVariantKey: `josh-subject-${subject.index + 1}`,
      ctaVariantKey: `josh-cta-${cta.index + 1}`,
      introVariantKey: `josh-intro-${intro.index + 1}`,
      signatureVariantKey: `josh-signature-${signature.index + 1}`,
      householdDensityEstimate: density,
      neighborhoodExample: neighborhood,
    };
  }

  if (input.senderKey === "jason") {
    const subjects = [
      `Quick campaign map idea`,
      `${name}: four simple mail options`,
      `District mail plan snapshot`,
      `Quick mail options for ${name}`,
      `Campaign route and postcard idea`,
    ];
    const intros = [
      "I put together a simple way to compare the practical mail paths before a campaign spends time sorting through details.",
      "Quick note from HomeReach. Campaign mail gets easier to judge when the options are visual and tied to geography.",
      "I wanted to make the mail decision easier to scan: options, map, rough pricing, and execution path.",
      "There are four campaign options that usually make the tradeoffs clearer.",
    ];
    const ctas = [
      "Want me to mock up a district plan?",
      "Want a quick sample targeting map?",
      "Interested in seeing what a 3-wave mail plan could look like?",
      "Should I send the simplest recommended option?",
    ];
    const signoffs = ["Jason", "Jason McCurry", "Jason\nHomeReach"];
    const subject = pick(subjects, `${seed}:subject`);
    const intro = pick(intros, `${seed}:intro`);
    const cta = pick(ctas, `${seed}:cta`);
    const signature = pick(signoffs, `${seed}:signature`);

    return {
      emailSubject: subject.value,
      emailBody: `${greeting}

${intro.value}

The four campaign postcard lanes I would show visually are:
1. Candidate introduction / name recognition
2. Local issue and plan card
3. Trust, validators, or contrast card
4. Final ballot-window reminder

HomeReach handles design, printing, route targeting, and mailing. No voter profiling or black-box targeting - just geography, timing, cost, creative, quote/payment flow, and clean execution.

${imageToken}

${cta.value}

${signature.value}`,
      smsBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"}, Jason with HomeReach. I can show four campaign options with a route map and postcard examples for ${name}. Want the quick version? Reply STOP to opt out.`,
      dmBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"} - Jason with HomeReach. I can show a quick four-option campaign postcard view for ${name}: fast launch, county/city route plan, township/ZIP targeting, and multi-wave reminders. Want the sample map?`,
      visual,
      subjectVariantKey: `jason-subject-${subject.index + 1}`,
      ctaVariantKey: `jason-cta-${cta.index + 1}`,
      introVariantKey: `jason-intro-${intro.index + 1}`,
      signatureVariantKey: `jason-signature-${signature.index + 1}`,
      householdDensityEstimate: density,
      neighborhoodExample: neighborhood,
    };
  }

  if (input.senderKey === "chelsi") {
    const subjects = [
      `Quick supply cost check for ${name}`,
      `${name}: simple savings snapshot`,
      `Supplier price drift question`,
      `Small cost leak idea`,
      `Example savings dashboard`,
    ];
    const intros = [
      "I am reaching out because a lot of small businesses are seeing supply costs move without having time to track every line item.",
      "Quick note from HomeReach. We are helping owners spot quiet overspending in recurring supplies and ingredients.",
      "I wanted to share a simple way to see vendor price changes without asking you to manage a spreadsheet.",
      "For many owners, the useful part is not another system. It is a clear view of what changed and where money may be leaking.",
    ];
    const ctas = [
      "Want me to show you where most businesses overspend?",
      "Would it help if I showed you a sample savings report?",
      "Want a quick example dashboard?",
      "Should I send the simple savings snapshot?",
    ];
    const signoffs = ["Chelsi", "Chelsi\nHomeReach", "Chelsi at HomeReach"];
    const subject = pick(subjects, `${seed}:subject`);
    const intro = pick(intros, `${seed}:intro`);
    const cta = pick(ctas, `${seed}:cta`);
    const signature = pick(signoffs, `${seed}:signature`);

    return {
      emailSubject: subject.value.replace("Supplyfy", "Supplify"),
      emailBody: `${greeting}

${intro.value}

The sample dashboard shows ingredient savings in big, plain numbers, compares current vendor pricing against daily best-price visibility, and points out the clearest savings opportunity. It is meant to be simple for restaurants, bakeries, pizza shops, cafes, and food-service operators: ingredients, supplies, vendor price changes, and repeat purchase patterns.

${imageToken}

${cta.value}

${signature.value}`,
      smsBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"}, Chelsi with HomeReach. We are showing small businesses simple supply savings snapshots. Want a quick example for ${name}? Reply STOP to opt out.`,
      dmBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"} - Chelsi with HomeReach. We help owners see supplier price drift and simple savings opportunities without extra spreadsheet work. Want an example dashboard?`,
      visual,
      subjectVariantKey: `chelsi-subject-${subject.index + 1}`,
      ctaVariantKey: `chelsi-cta-${cta.index + 1}`,
      introVariantKey: `chelsi-intro-${intro.index + 1}`,
      signatureVariantKey: `chelsi-signature-${signature.index + 1}`,
      householdDensityEstimate: density,
      neighborhoodExample: neighborhood,
    };
  }

  const subjects = [
    `${name}: supply margin visibility`,
    `Quick Supplify example`,
    `Where supplier costs may be leaking`,
    `Simple margin protection snapshot`,
    `A procurement visibility idea`,
  ];
  const intros = [
    "I am reaching out from HomeReach because recurring supplier costs can move quietly before an owner has time to catch them.",
    "I wanted to send a very simple example of the Supplify view we are using for restaurant, bakery, cafe, pizza shop, and food-service supply costs.",
    "Most owners do not need a heavy procurement system. They need a clearer view of where they are overpaying and what action is worth taking.",
    "The goal is straightforward: see vendor price differences, baseline drift, reorder risk, and the savings opportunity without changing operations first.",
  ];
  const ctas = [
    "Want a quick example dashboard?",
    "Would a sample savings report be useful?",
    "Want me to show the categories where most businesses overspend?",
    "Should I send a simple Supplify snapshot?",
  ];
  const signoffs = ["Heather", "Heather at HomeReach", "Heather\nHomeReach"];
  const subject = pick(subjects, `${seed}:subject`);
  const intro = pick(intros, `${seed}:intro`);
  const cta = pick(ctas, `${seed}:cta`);
  const signature = pick(signoffs, `${seed}:signature`);

  return {
    emailSubject: subject.value,
    emailBody: `${greeting}

${intro.value}

The example view shows ingredient savings in big, plain numbers, current supplier pricing next to daily best-price visibility, then surfaces over/under movement and potential savings. It is designed to start a useful conversation, not bury anyone in software.

${imageToken}

${cta.value}

${signature.value}`,
    smsBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"}, Heather with HomeReach. I can show a simple Supplify savings snapshot for ${name}: baseline pricing, over/under movement, and savings opportunities. Want the quick example? Reply STOP to opt out.`,
    dmBody: `${firstName(input.contactName) ? `Hi ${firstName(input.contactName)}` : "Hi"} - Heather with HomeReach. I can show a simple Supplify example for supply cost visibility and savings opportunities. Want a quick snapshot?`,
    visual,
    subjectVariantKey: `heather-subject-${subject.index + 1}`,
    ctaVariantKey: `heather-cta-${cta.index + 1}`,
    introVariantKey: `heather-intro-${intro.index + 1}`,
    signatureVariantKey: `heather-signature-${signature.index + 1}`,
    householdDensityEstimate: density,
    neighborhoodExample: neighborhood,
  };
}

export function leadSourceForDraft(input: Pick<SenderDraftInput, "sourceTable">) {
  return sourceLabel(input.sourceTable);
}

export function buildOutreachDrafts(input: DraftInput) {
  const name = displayName(input);
  const first = firstName(input.contactName);
  const greeting = first ? `Hi ${first},` : "Hi,";
  const industry = input.industry || "your work";

  if (input.category === "Procurement / Supplify") {
    return {
      emailSubject: `Quick supply savings review for ${name}`,
      emailBody: `${greeting}

I am reaching out from HomeReach because Supplify helps restaurants, bakeries, pizza shops, cafes, and food-service operators find hidden supply and ingredient cost pressure without adding another complicated system.

For ${name}, the first step would be simple: a quick review of recurring supply categories, vendor pressure points, and where margin may be leaking.

Would it be worth a short conversation this week to see if there is anything obvious to tighten up?`,
      smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach helps local businesses spot supply cost leaks and vendor savings opportunities. Open to a quick review for ${name}? Reply STOP to opt out.`,
      dmBody: `${first ? `Hi ${first}` : "Hi"} - I am with HomeReach. We help local businesses find supply and operating cost savings without making the owner chase spreadsheets. Would a quick review be useful for ${name}?`,
    };
  }

  if (input.category === "Political Outreach") {
    return {
      emailSubject: `Campaign mail execution support for ${name}`,
      emailBody: `${greeting}

I am reaching out from HomeReach. We help campaigns plan and execute disciplined direct-mail programs with clear logistics, timelines, route visibility, and production control.

No voter profiling or black-box targeting. The focus is geography, timing, cost, creative readiness, and getting mail executed cleanly.

Would it be useful to compare what you have planned against a fast mail execution timeline?`,
      smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach supports campaign mail execution: geography, timing, cost, and logistics. Open to a quick planning conversation? Reply STOP to opt out.`,
      dmBody: `${first ? `Hi ${first}` : "Hi"} - HomeReach helps campaigns execute mail with clearer logistics, timelines, and route planning. Would a quick planning conversation be useful?`,
    };
  }

  if (input.category === "Government Contracting") {
    return {
      emailSubject: `Bid/no-bid review item for ${name}`,
      emailBody: `${greeting}

HomeReach is reviewing government contracting opportunities through a human-approved bid/no-bid process.

The immediate action is to confirm fit, deadline, required documents, subcontractor needs, and whether the opportunity is operationally realistic.

Next step: review requirements and decide whether this should move into bid prep.`,
      smsBody: `Government contracting review: confirm fit, deadline, required docs, subcontractor needs, and bid/no-bid next action for ${name}.`,
      dmBody: `Government contracting review needed for ${name}: deadline, fit, required docs, subcontractor needs, and bid/no-bid next action.`,
    };
  }

  return {
    emailSubject: `Targeted neighborhood campaign for ${name}`,
    emailBody: `${greeting}

I am reaching out from HomeReach. We help local service businesses get in front of the exact neighborhoods around recent jobs and high-fit local routes.

For a ${industry} business like ${name}, the idea is simple: make the next campaign more local, more visible, and easier to act on.

Would you be open to a quick look at what a targeted neighborhood campaign could look like?`,
    smsBody: `${first ? `Hi ${first}` : "Hi"}, HomeReach helps local businesses target nearby neighborhoods with postcard campaigns around real service areas. Open to a quick look for ${name}? Reply STOP to opt out.`,
    dmBody: `${first ? `Hi ${first}` : "Hi"} - I am with HomeReach. We help local businesses run targeted neighborhood postcard campaigns around high-fit service areas. Would you be open to seeing what that could look like for ${name}?`,
  };
}

export function buildSocialPosts(dateLabel: string) {
  return [
    {
      category: "Authority",
      post_type: "Main Facebook authority post",
      audience: "Local business owners",
      content: `Most local business owners do not need another dashboard. They need a clearer way to find margin, follow up faster, and stay visible in the neighborhoods that already trust local service providers.

That is the lane HomeReach is focused on: practical execution, better targeting, cleaner follow-up, and less operational drag.

If you own a local business and want a simple outside look at where growth or savings may be hiding, I am happy to compare notes.`,
      short_content: `Local businesses need clearer execution: better targeting, faster follow-up, and less operational drag. Happy to compare notes if you want a simple outside look.`,
    },
    {
      category: "Community",
      post_type: "Facebook group post",
      audience: "Local business group",
      content: `Question for local business owners: what is the one operating cost or recurring vendor category you wish you had more visibility into right now?

Supplies, marketing, delivery, printing, software, fuel, something else?

I am mapping the common pressure points local operators are dealing with this month and would genuinely like to hear what is showing up on the ground.`,
      short_content: `Local owners: what recurring cost do you wish you had more visibility into right now? Supplies, marketing, delivery, software, fuel, or something else?`,
    },
    {
      category: "Engagement",
      post_type: "Engagement question",
      audience: "Owners and operators",
      content: `What is harder right now: getting new customers, keeping margins healthy, or finding enough time to follow up with people who already showed interest?`,
      short_content: `What is hardest right now: new customers, healthy margins, or follow-up time?`,
    },
    {
      category: "Targeted Campaign",
      post_type: "Contractor-focused post",
      audience: "Contractors and home service businesses",
      content: `Contractors: when you finish a good job in a neighborhood, the next best opportunity is often nearby.

The play is not blasting everyone. It is staying visible around the streets where your work already creates trust.

That is where targeted neighborhood campaigns can be useful: simple geography, clear offer, consistent follow-up.`,
      short_content: `Contractors: after a good job, the next best opportunity is often nearby. Target the surrounding streets, stay visible, and keep the follow-up simple.`,
    },
    {
      category: "Procurement / Supplify",
      post_type: "Procurement-focused post",
      audience: "Restaurants, bakeries, and operators",
      content: `A lot of savings are not dramatic. They are hidden in repeat orders, vendor creep, delivery charges, substitutions, and categories nobody has had time to review.

For local operators, a small improvement in recurring costs can matter more than a flashy new tool.

That is why procurement visibility is becoming one of HomeReach's core priorities.`,
      short_content: `Savings often hide in repeat orders, vendor creep, delivery charges, and categories nobody has time to review. Small recurring wins matter.`,
    },
    {
      category: "Political Outreach",
      post_type: "Political outreach post optional",
      audience: "Campaign teams",
      content: `Campaign mail works best when the operational details are clear: geography, timing, print readiness, route coverage, cost, and approval flow.

HomeReach's political mail work is focused on disciplined execution, not vague targeting claims.`,
      short_content: `Campaign mail needs clear geography, timing, print readiness, route coverage, cost, and approvals. Discipline beats vague targeting claims.`,
    },
    {
      category: "Local",
      post_type: "Local community/business post",
      audience: "Local community",
      content: `Local businesses are carrying a lot right now: higher costs, tighter margins, more noise, and less time.

The businesses that keep winning usually have one thing in common: they make it easier for people nearby to remember them, trust them, and take the next step.`,
      short_content: `Local businesses are carrying higher costs, tighter margins, and more noise. The winners make it easier for nearby people to remember and trust them.`,
    },
  ].map((post) => ({ ...post, outreach_date: dateLabel }));
}

export function rewriteSocialContent(content: string, mode: "emotional" | "direct" | "professional") {
  if (mode === "direct") {
    return content
      .replace(/\bwould genuinely like to hear\b/gi, "want to hear")
      .replace(/\bcan be useful\b/gi, "helps")
      .replace(/\bmay be hiding\b/gi, "is being missed")
      .trim();
  }

  if (mode === "professional") {
    return `${content.trim()}

The goal is practical: clearer decisions, better follow-up, and stronger operating control.`;
  }

  return `${content.trim()}

Most owners are not looking for more noise. They are looking for relief, clarity, and a little more control over the day.`;
}
