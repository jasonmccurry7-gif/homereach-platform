import "server-only";

import { generateText } from "@/lib/ai/llm";
import {
  GROUP_OPPORTUNITY_CATEGORIES,
  type GroupAnalyzeInput,
  type GroupAnalyzeResult,
  type GroupOpportunityCategory,
  type GroupUrgencyLevel,
} from "./types";

const OHIO_CITIES = [
  "Akron",
  "Canton",
  "Massillon",
  "Wooster",
  "Medina",
  "Cleveland",
  "Columbus",
  "Cincinnati",
  "Dayton",
  "Toledo",
  "Youngstown",
  "Cuyahoga Falls",
  "Wadsworth",
  "Stow",
  "Kent",
  "Brunswick",
  "Barberton",
];

const PAIN_PATTERNS: Array<{ label: string; pattern: RegExp; points: number }> = [
  { label: "Low sales or slow foot traffic", pattern: /\b(low sales|slow|dead|quiet|foot traffic|not busy|empty)\b/i, points: 14 },
  { label: "Rising supply costs", pattern: /\b(costs?|prices?|inflation|vendor|supplier|wholesale|ingredients?|materials?)\b/i, points: 14 },
  { label: "Not enough leads", pattern: /\b(leads?|customers?|bookings?|appointments?|jobs?|calls?|traffic)\b/i, points: 13 },
  { label: "Marketing or advertising struggle", pattern: /\b(marketing|advertising|ads?|boosted|facebook|google|visibility|reach)\b/i, points: 12 },
  { label: "Inventory or vendor issue", pattern: /\b(inventory|stock|out of stock|reorder|delivery|supplier|vendor)\b/i, points: 12 },
  { label: "Restaurant dessert or catering need", pattern: /\b(catering|desserts?|cupcakes?|bakery|restaurant|dinner|corporate order|event)\b/i, points: 11 },
  { label: "Realtor gifting need", pattern: /\b(realtor|real estate|closing gift|open house|client gift)\b/i, points: 11 },
  { label: "Political campaign outreach", pattern: /\b(candidate|campaign|voters?|yard signs?|mailers?|election|petition)\b/i, points: 11 },
  { label: "Asking for recommendations", pattern: /\b(recommend|looking for|who do you use|anyone know|need someone|iso)\b/i, points: 15 },
  { label: "Urgent timing", pattern: /\b(asap|urgent|today|tomorrow|this week|right away|last minute)\b/i, points: 12 },
];

const CATEGORY_PATTERNS: Array<{ category: GroupOpportunityCategory; pattern: RegExp; fit: string; angle: string }> = [
  {
    category: "Supplyfy opportunity",
    pattern: /\b(supply|supplier|vendor|ingredients?|inventory|materials?|food cost|wholesale|delivery|stock|price increase)\b/i,
    fit: "Supplyfy procurement savings and vendor visibility review",
    angle: "Reduce hidden cost leaks by comparing vendors, delivery options, and reorder timing before the owner wastes more time.",
  },
  {
    category: "HomeReach postcard opportunity",
    pattern: /\b(leads?|customers?|homeowners?|advertising|marketing|postcards?|mailers?|visibility|slow season|booked|jobs?)\b/i,
    fit: "HomeReach targeted postcard or shared postcard campaign",
    angle: "Help the business reach nearby homeowners directly instead of relying only on posts, referrals, or digital ads.",
  },
  {
    category: "Sunshine Cupcakes partnership opportunity",
    pattern: /\b(cupcakes?|bakery|desserts?|sweet treats?|treat boxes?)\b/i,
    fit: "Sunshine Cupcakes partnership or local gifting offer",
    angle: "Offer local dessert or gifting support in a way that helps them solve the immediate event/customer need.",
  },
  {
    category: "Catering / corporate order opportunity",
    pattern: /\b(catering|corporate order|office event|employee appreciation|party|event|lunch|meeting)\b/i,
    fit: "Catering or corporate order conversation",
    angle: "Make the event easier with a simple local order option and a clear next step.",
  },
  {
    category: "Restaurant dessert partnership opportunity",
    pattern: /\b(restaurant|menu|dessert|dinner|coffee shop|cafe|bakery partnership)\b/i,
    fit: "Restaurant dessert partnership or recurring wholesale conversation",
    angle: "Suggest a low-lift dessert add-on or local partnership that can increase ticket size.",
  },
  {
    category: "Realtor gifting opportunity",
    pattern: /\b(realtor|real estate|closing gift|open house|client appreciation|home buyer|home seller)\b/i,
    fit: "Realtor gifting and local visibility partnership",
    angle: "Position a polished local gifting option that keeps the realtor memorable after closing.",
  },
  {
    category: "Political outreach opportunity",
    pattern: /\b(candidate|campaign|voter|petition|yard sign|election|committee|fundraiser|canvass)\b/i,
    fit: "Political mail execution, campaign logistics, or proposal follow-up",
    angle: "Offer neutral campaign execution help around geography, timing, mail pieces, and logistics.",
  },
];

const HIGH_VALUE_INDUSTRIES = /\b(roof|hvac|plumb|landscap|restaurant|bakery|coffee|contractor|real estate|med spa|auto repair|salon)\b/i;

export async function analyzeGroupObservation(input: GroupAnalyzeInput): Promise<GroupAnalyzeResult> {
  const fallback = deterministicAnalysis(input);
  if (process.env.GROUP_INTELLIGENCE_AI_ENABLED !== "true") return fallback;

  try {
    const ai = await generateText({
      feature: "group-intelligence",
      responseFormat: "json",
      maxTokens: 1200,
      temperature: 0.2,
      system: [
        "You are HomeReach's supervised Group Intelligence Agent.",
        "Analyze only the user-provided Facebook/local group text.",
        "Do not infer sensitive traits, do not recommend spam, and do not send or post.",
        "Draft helpful, local, short, non-hype responses that require human review.",
        "Return strict JSON only.",
      ].join(" "),
      prompt: JSON.stringify({
        allowedCategories: GROUP_OPPORTUNITY_CATEGORIES,
        input,
        requiredJsonShape: {
          painPointSummary: "one sentence",
          urgencyLevel: "low|medium|high|urgent",
          opportunityCategory: "one allowed category",
          opportunityScore: "integer 0-100",
          recommendedResponseAngle: "plain English",
          suggestedServiceFit: "plain English",
          followUpSuggestion: "plain English",
          publicCommentDraft: "short helpful public comment",
          privateDmDraft: "short personalized DM",
          followUpDraft: "short follow-up",
          facebookPostIdeas: ["three post ideas based on observed pain"],
          detectedCity: "city or null",
          detectedPainPoints: ["strings"],
          safetyNotes: ["human review required"],
        },
      }),
    });

    return sanitizeAiResult(JSON.parse(ai.text), fallback);
  } catch {
    return {
      ...fallback,
      safetyNotes: [
        ...fallback.safetyNotes,
        "AI provider unavailable or returned invalid JSON; deterministic supervised analysis was used.",
      ],
    };
  }
}

function deterministicAnalysis(input: GroupAnalyzeInput): GroupAnalyzeResult {
  const text = compact(`${input.sourceText} ${input.businessName ?? ""} ${input.businessType ?? ""}`);
  const detectedPainPoints = PAIN_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
  const detectedCity = detectCity(text);
  const category = detectCategory(text);
  const categoryConfig = CATEGORY_PATTERNS.find((item) => item.category === category);
  const score = scoreOpportunity(input, text, detectedPainPoints, category);
  const urgencyLevel = urgencyFromScore(score);
  const painPointSummary = summarizePain(text, detectedPainPoints, input.businessName);
  const serviceFit = categoryConfig?.fit ?? "Helpful local business advice and light-touch follow-up";
  const angle = categoryConfig?.angle ?? "Offer one practical idea first, then let the owner decide whether they want an example.";
  const authorFirstName = getFirstName(input.postAuthorName) ?? "there";
  const groupName = input.groupName || "the group";

  return {
    painPointSummary,
    urgencyLevel,
    opportunityCategory: category,
    opportunityScore: score,
    recommendedResponseAngle: angle,
    suggestedServiceFit: serviceFit,
    followUpSuggestion: followUpFor(category, detectedCity),
    publicCommentDraft: publicCommentFor({ category, painPointSummary, detectedCity }),
    privateDmDraft: [
      `Hi ${authorFirstName} - saw your post in ${groupName}.`,
      dmValueLine(category, input.businessName, detectedCity),
      "I did not want to clutter the thread, but I can send you a quick example of how I would approach it if helpful.",
    ].join(" "),
    followUpDraft: [
      `Hi ${authorFirstName} - just circling back on your post from ${groupName}.`,
      "If it is still an issue, I can send a simple example or quick checklist you can use.",
    ].join(" "),
    facebookPostIdeas: postIdeasFor(category, detectedPainPoints),
    detectedCity,
    detectedPainPoints: detectedPainPoints.length ? detectedPainPoints : ["General business-owner friction"],
    safetyNotes: [
      "Manual/import-assisted workflow only.",
      "Human review required before any comment or DM is posted.",
      "No auto-posting, auto-DM, scraping bypass, or platform-limit bypass is enabled.",
    ],
  };
}

function sanitizeAiResult(value: unknown, fallback: GroupAnalyzeResult): GroupAnalyzeResult {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const category = GROUP_OPPORTUNITY_CATEGORIES.includes(record.opportunityCategory as GroupOpportunityCategory)
    ? record.opportunityCategory as GroupOpportunityCategory
    : fallback.opportunityCategory;
  return {
    painPointSummary: stringValue(record.painPointSummary) ?? fallback.painPointSummary,
    urgencyLevel: urgencyValue(record.urgencyLevel) ?? fallback.urgencyLevel,
    opportunityCategory: category,
    opportunityScore: clampScore(numberValue(record.opportunityScore) ?? fallback.opportunityScore),
    recommendedResponseAngle: stringValue(record.recommendedResponseAngle) ?? fallback.recommendedResponseAngle,
    suggestedServiceFit: stringValue(record.suggestedServiceFit) ?? fallback.suggestedServiceFit,
    followUpSuggestion: stringValue(record.followUpSuggestion) ?? fallback.followUpSuggestion,
    publicCommentDraft: stringValue(record.publicCommentDraft) ?? fallback.publicCommentDraft,
    privateDmDraft: stringValue(record.privateDmDraft) ?? fallback.privateDmDraft,
    followUpDraft: stringValue(record.followUpDraft) ?? fallback.followUpDraft,
    facebookPostIdeas: stringArray(record.facebookPostIdeas).slice(0, 3).concat(fallback.facebookPostIdeas).slice(0, 3),
    detectedCity: stringValue(record.detectedCity) ?? fallback.detectedCity,
    detectedPainPoints: stringArray(record.detectedPainPoints).length ? stringArray(record.detectedPainPoints) : fallback.detectedPainPoints,
    safetyNotes: Array.from(new Set([...fallback.safetyNotes, ...stringArray(record.safetyNotes)])),
  };
}

function detectCity(text: string) {
  const lower = text.toLowerCase();
  return OHIO_CITIES.find((city) => lower.includes(city.toLowerCase())) ?? null;
}

function detectCategory(text: string): GroupOpportunityCategory {
  for (const item of CATEGORY_PATTERNS) {
    if (item.pattern.test(text)) return item.category;
  }
  return PAIN_PATTERNS.some(({ pattern }) => pattern.test(text))
    ? "General small business advice opportunity"
    : "Not relevant";
}

function scoreOpportunity(
  input: GroupAnalyzeInput,
  text: string,
  painPoints: string[],
  category: GroupOpportunityCategory,
) {
  let score = 18;
  score += painPoints.reduce((total, label) => {
    const match = PAIN_PATTERNS.find((pattern) => pattern.label === label);
    return total + (match?.points ?? 6);
  }, 0);
  if (input.businessName || /\b(my|our|we own|owner|my business|our business)\b/i.test(text)) score += 10;
  if (detectCity(text)) score += 8;
  if (category !== "Not relevant" && category !== "General small business advice opportunity") score += 16;
  if (/\b(recommend|looking for|need|help|who do you use|iso)\b/i.test(text)) score += 12;
  if (/\b(today|tomorrow|asap|urgent|this week)\b/i.test(text)) score += 8;
  if (HIGH_VALUE_INDUSTRIES.test(text)) score += 8;
  if (/\b(again|keeps happening|every week|always|constantly)\b/i.test(text)) score += 5;

  if (input.observedAt) {
    const observed = Date.parse(input.observedAt);
    if (Number.isFinite(observed) && Date.now() - observed <= 7 * 24 * 60 * 60 * 1000) score += 8;
  } else {
    score += 5;
  }

  if (category === "Not relevant") score = Math.min(score, 35);
  return clampScore(score);
}

function urgencyFromScore(score: number): GroupUrgencyLevel {
  if (score >= 82) return "urgent";
  if (score >= 65) return "high";
  if (score >= 40) return "medium";
  return "low";
}

function summarizePain(text: string, painPoints: string[], businessName?: string | null) {
  const subject = businessName?.trim() ? businessName.trim() : "This post";
  if (painPoints.length) return `${subject} is signaling ${painPoints.slice(0, 2).join(" and ").toLowerCase()}.`;
  const sentence = text.split(/[.!?\n]/).map((part) => part.trim()).find(Boolean);
  return sentence ? `${subject} mentioned: ${sentence.slice(0, 160)}.` : `${subject} has a possible local business follow-up opportunity.`;
}

function publicCommentFor({
  category,
  painPointSummary,
  detectedCity,
}: {
  category: GroupOpportunityCategory;
  painPointSummary: string;
  detectedCity: string | null;
}) {
  const local = detectedCity ? ` around ${detectedCity}` : " locally";
  if (category === "Supplyfy opportunity") {
    return `Totally understand this. A lot of owners are seeing supplier and inventory costs move faster than expected. One practical first step is comparing the full delivered cost, not just the shelf price. I have been working on that exact problem${local} and can send a quick example if useful.`;
  }
  if (category === "HomeReach postcard opportunity") {
    return `That is a real issue right now. One thing that helps is getting in front of nearby homeowners consistently instead of waiting on the algorithm or referrals to cooperate. I have been working on local postcard options${local} and can send a quick example if it would help.`;
  }
  if (category.includes("Cupcakes") || category.includes("Catering") || category.includes("Restaurant")) {
    return `This makes sense. For events or slower nights, simple local partnerships can help without adding a ton of work. ${painPointSummary} I may have a practical idea that fits this and can send it over if helpful.`;
  }
  if (category === "Realtor gifting opportunity") {
    return `Totally get this. The best realtor gifts are easy to order, local, and memorable without feeling generic. I have a simple local gifting idea that may fit this if you want me to send an example.`;
  }
  if (category === "Political outreach opportunity") {
    return `This is where clear campaign logistics matter. Mail timing, geography, and route planning can get confusing fast. I work on campaign execution planning and can send a simple example if useful.`;
  }
  return `Totally understand this. A lot of local businesses are dealing with the same pressure right now. One practical step is narrowing the problem into one clear action you can test this week. Happy to send a quick example if useful.`;
}

function dmValueLine(category: GroupOpportunityCategory, businessName?: string | null, city?: string | null) {
  const business = businessName?.trim() ? ` for ${businessName.trim()}` : "";
  const local = city ? ` in ${city}` : " locally";
  if (category === "Supplyfy opportunity") return `I am local and have been working on a done-for-you way to spot supplier cost leaks${business}${local}.`;
  if (category === "HomeReach postcard opportunity") return `I am local and have been working on a simple way to help businesses reach nearby homeowners${business}${local}.`;
  if (category === "Political outreach opportunity") return `I work on campaign mail execution and route-level planning, and your post sounded like it may need a cleaner outreach plan.`;
  if (category === "Realtor gifting opportunity") return `I am local and have a simple gifting idea that could make this easier without turning it into a big project.`;
  if (category.includes("Cupcakes") || category.includes("Catering") || category.includes("Restaurant")) return `I am local and may have a simple partnership/order idea that fits what you were asking about.`;
  return `I am local and have been working on a practical solution for exactly this kind of business problem.`;
}

function followUpFor(category: GroupOpportunityCategory, city: string | null) {
  const local = city ? ` in ${city}` : "";
  if (category === "Supplyfy opportunity") return `Offer a quick supplier cost review${local}; ask for 3 common items or vendors before proposing anything.`;
  if (category === "HomeReach postcard opportunity") return `Offer a simple local campaign example${local}; do not pitch until they ask for details.`;
  if (category === "Political outreach opportunity") return "Offer a neutral route/timing snapshot; keep all political content approval-only.";
  if (category === "Not relevant") return "Archive unless the thread develops a clearer business-owner pain point.";
  return "Reply with practical advice first, then offer to send one concrete example.";
}

function postIdeasFor(category: GroupOpportunityCategory, painPoints: string[]) {
  if (category === "Supplyfy opportunity") {
    return [
      "Most owners compare item price. The quiet leak is delivered cost.",
      "If vendor prices moved this month, your margins may have changed without you noticing.",
      "One simple supply review can show where money is leaking before the next order.",
    ];
  }
  if (category === "HomeReach postcard opportunity") {
    return [
      "If referrals slow down, nearby homeowners still need to know you exist.",
      "Local visibility works better when it reaches the same neighborhood consistently.",
      "The best time to build a local campaign is before the slow season gets loud.",
    ];
  }
  if (category === "Political outreach opportunity") {
    return [
      "Campaign mail works best when timing, geography, and creative are planned together.",
      "A clear mail plan can turn a scattered campaign calendar into a real execution system.",
      "Route-level campaign planning keeps outreach practical, visible, and accountable.",
    ];
  }
  return [
    `Local businesses are talking about ${painPoints[0]?.toLowerCase() ?? "rising pressure"}. Here is the practical fix.`,
    "The hidden cost of waiting is usually time, not just money.",
    "A simple weekly business review can catch problems before they become expensive.",
  ];
}

function getFirstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? null;
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function urgencyValue(value: unknown): GroupUrgencyLevel | null {
  return value === "low" || value === "medium" || value === "high" || value === "urgent" ? value : null;
}

function stringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.reduce<string[]>((items, item) => {
    if (typeof item !== "string") return items;
    const trimmed = item.trim();
    if (trimmed) items.push(trimmed);
    return items;
  }, []);
}
