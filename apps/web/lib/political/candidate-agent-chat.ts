import {
  AMY_ACTON_CAMPAIGN_PROFILE,
  AMY_ACTON_CAMPAIGN_RECOMMENDATIONS,
  summarizeAmyActonRecommendations,
} from "./candidate-agent-recommendations";

export type CandidateAgentChatRole = "agent" | "user";

export interface CandidateAgentChatMessage {
  role: CandidateAgentChatRole;
  text: string;
}

export interface CandidateAgentChatResult {
  reply: string;
  mode: "ai" | "fallback";
}

const MAX_HISTORY_MESSAGES = 12;
const MAX_USER_MESSAGE_LENGTH = 1_200;

function moneyFromCents(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getCandidateContext() {
  const summary = summarizeAmyActonRecommendations();
  const plans = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.map((plan) => ({
    title: plan.title,
    planType: plan.planType,
    summary: plan.summary,
    candidateFit: plan.candidateFit,
    cities: plan.cities,
    geographyRationale: plan.geographyRationale,
    drops: plan.drops,
    households: plan.households,
    estimatedVoterReach: plan.estimatedVoterReach,
    pricePerPostcard: moneyFromCents(plan.pricePerPostcardCents),
    estimatedTotal: moneyFromCents(plan.estimatedTotalCents),
    costPerVoter: moneyFromCents(plan.costPerVoterCents),
    phaseCadence: plan.phaseCadence,
    nextAction: plan.nextAction,
    confidenceScore: plan.confidenceScore,
  }));

  return {
    profile: AMY_ACTON_CAMPAIGN_PROFILE,
    summary: {
      plans: summary.plans,
      households: number(summary.households),
      estimatedVoterReach: number(summary.estimatedVoterReach),
      investment: moneyFromCents(summary.investmentCents),
    },
    plans,
  };
}

function normalizeMessages(messages: CandidateAgentChatMessage[]) {
  return messages
    .filter((message) => (message.role === "user" || message.role === "agent") && message.text.trim().length > 0)
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, MAX_USER_MESSAGE_LENGTH),
    }));
}

export function buildCandidateAgentFallbackReply(prompt: string): string {
  const normalized = prompt.toLowerCase();
  const summary = summarizeAmyActonRecommendations();

  if (normalized.includes("postcard") || normalized.includes("creative") || normalized.includes("design")) {
    return "The loaded Acton workspace includes postcard concept paths for statewide introduction, health-cost trust building, suburban visibility, and ballot-window reminders. Use the creative engine for draft concepts, then keep every piece in human review until campaign-approved copy, disclaimer placement, and final production specs are verified.";
  }

  if (normalized.includes("cost") || normalized.includes("price") || normalized.includes("budget") || normalized.includes("voter")) {
    const lowest = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.reduce((best, plan) =>
      plan.estimatedTotalCents < best.estimatedTotalCents ? plan : best,
    );
    return `The lowest modeled Acton option is "${lowest.title}" at ${moneyFromCents(lowest.estimatedTotalCents)} across ${number(lowest.totalPieces)} postcards. Cost per voter is modeled as total postcard investment divided by aggregate estimated reach, not individual voter scoring. Final proposal pricing still needs verified USPS counts, print pricing, postage, and human approval.`;
  }

  if (normalized.includes("city") || normalized.includes("cities") || normalized.includes("map") || normalized.includes("geography")) {
    const cities = Array.from(new Set(AMY_ACTON_CAMPAIGN_RECOMMENDATIONS.flatMap((plan) => plan.cities))).slice(0, 16);
    return `The loaded plans include Ohio geography such as ${cities.join(", ")}. The recommendation logic is aggregate geography and route-density planning only. Before quoting, the map should attach verified USPS EDDM/carrier-route counts and source timestamps.`;
  }

  if (normalized.includes("compliance") || normalized.includes("limit") || normalized.includes("guardrail")) {
    return "Compliance lock is active. The agent can discuss public candidate context, aggregate households, geography, delivery timing, costs, and production readiness. It cannot infer individual political beliefs, score individual voters, target sensitive attributes, claim vote impact, or send campaign-facing materials without human approval.";
  }

  if (normalized.includes("next") || normalized.includes("approve") || normalized.includes("proposal") || normalized.includes("launch")) {
    return "Recommended next step: select one strategy path, validate route counts in Maps, confirm campaign contact and source freshness, lock print/postage pricing, then generate a human-reviewed proposal. Checkout and production should stay disabled until those gates pass.";
  }

  if (normalized.includes("compare") || normalized.includes("best") || normalized.includes("strategy")) {
    const ranked = AMY_ACTON_CAMPAIGN_RECOMMENDATIONS
      .map((plan) => `${plan.title}: ${plan.confidenceScore}% confidence, ${number(plan.households)} households, ${plan.drops} drops`)
      .join("; ");
    return `The four loaded strategy paths are: ${ranked}. The best path depends on budget, timing, and whether the campaign wants broad statewide familiarity, metro repetition, suburban visibility, or a shorter ballot-window push.`;
  }

  return `I can help with the selected Acton campaign workspace: ${summary.plans} strategy paths, ${number(summary.households)} modeled households, ${number(summary.estimatedVoterReach)} aggregate estimated reach, budget explanation, route-readiness questions, postcard concepts, and next-step planning. Ask me about strategy, geography, pricing, compliance, creative, proposal readiness, or launch blockers.`;
}

async function getOpenAIClient(): Promise<import("openai").OpenAI | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  try {
    const { default: OpenAI } = await import("openai");
    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch {
    return null;
  }
}

export async function answerCandidateAgentChat(
  prompt: string,
  messages: CandidateAgentChatMessage[],
): Promise<CandidateAgentChatResult> {
  const trimmedPrompt = prompt.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
  if (!trimmedPrompt) {
    return {
      mode: "fallback",
      reply: "Ask a question about strategy, geography, pricing, postcard creative, compliance, proposal readiness, or launch next steps.",
    };
  }

  const client = await getOpenAIClient();
  if (!client) {
    return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt) };
  }

  const context = getCandidateContext();
  const safeHistory = normalizeMessages(messages);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.POLITICAL_AGENT_MODEL ?? "gpt-4o-mini",
      temperature: 0.35,
      max_tokens: 420,
      messages: [
        {
          role: "system",
          content:
            "You are the HomeReach Political Command AI Campaign Agent for the currently selected candidate. Answer as an operational campaign mail planning assistant. Use only supplied context and clearly mark missing/uncertain data as a research gap. Keep answers concise, practical, and campaign-operations focused. Do not infer individual political beliefs, score individual voters, target sensitive attributes, claim vote impact, write deceptive content, or authorize outreach/checkout/production without human approval.",
        },
        {
          role: "system",
          content: `Selected candidate context JSON:\n${JSON.stringify(context)}`,
        },
        ...safeHistory.map((message) => ({
          role: message.role === "user" ? ("user" as const) : ("assistant" as const),
          content: message.text,
        })),
        { role: "user" as const, content: trimmedPrompt },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    if (!reply) {
      return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt) };
    }

    return { mode: "ai", reply };
  } catch {
    return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt) };
  }
}
