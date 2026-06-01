import {
  buildCandidateCoveragePlan,
  type CandidateAgentCoveragePlan,
} from "./candidate-coverage-plan";
import {
  findOhioCandidateSelectorOption,
  OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS,
  type OhioCandidateSelectorOption,
} from "./ohio-candidate-selector";

export type CandidateAgentChatRole = "agent" | "user";

export interface CandidateAgentChatMessage {
  role: CandidateAgentChatRole;
  text: string;
}

export interface CandidateAgentChatContext {
  candidate: OhioCandidateSelectorOption;
  coveragePlan: CandidateAgentCoveragePlan;
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
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
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

function sanitizeString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.slice(0, 240) : fallback;
}

export function resolveCandidateAgentChatContext(
  candidateSlug: string | undefined,
  candidateProfile?: Partial<OhioCandidateSelectorOption> | null,
): CandidateAgentChatContext | null {
  const known = findOhioCandidateSelectorOption(
    OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS,
    candidateSlug ?? "",
  );

  const candidate =
    known ??
    (candidateProfile?.value
      ? {
          value: sanitizeString(candidateProfile.value),
          candidateName: sanitizeString(candidateProfile.candidateName, "Selected candidate"),
          officeSought: sanitizeString(candidateProfile.officeSought, "Office pending"),
          party: sanitizeString(candidateProfile.party, "Party/committee pending"),
          geography: sanitizeString(candidateProfile.geography, "Ohio"),
          electionLabel: sanitizeString(candidateProfile.electionLabel, "Election pending"),
          raceType: sanitizeString(candidateProfile.raceType, "race pending"),
          campaignStatus: sanitizeString(candidateProfile.campaignStatus, "prebuilt profile"),
          sourceLabel: sanitizeString(candidateProfile.sourceLabel, "candidate selector profile"),
          sourceUrl: sanitizeString(candidateProfile.sourceUrl) || undefined,
          liveCandidateId: sanitizeString(candidateProfile.liveCandidateId) || undefined,
          isAmyActon: Boolean(candidateProfile.isAmyActon),
        }
      : null);

  if (!candidate) return null;

  return {
    candidate,
    coveragePlan: buildCandidateCoveragePlan(candidate),
  };
}

function summarizeOptions(context: CandidateAgentChatContext) {
  return context.coveragePlan.options
    .map((option) => {
      return `${option.label}: ${number(option.households)} households, ${option.drops} drops, ${number(option.totalPieces)} pieces, ${moneyFromCents(option.totalEstimateCents)} planning estimate`;
    })
    .join("; ");
}

export function buildCandidateAgentFallbackReply(
  prompt: string,
  context: CandidateAgentChatContext,
): string {
  const normalized = prompt.toLowerCase();
  const { candidate, coveragePlan } = context;

  if (normalized.includes("phase") || normalized.includes("timeline") || normalized.includes("wave")) {
    const lines = coveragePlan.options.map((option) => {
      const phases = option.phases.map((phase) => `${phase.name} (${phase.timing})`).join(", ");
      return `${option.label}: ${phases}`;
    });
    return `${candidate.candidateName}'s agent built multi-phase coverage paths. ${lines.join(" ")} Proposal and checkout stay locked until USPS counts and pricing are verified.`;
  }

  if (normalized.includes("cost") || normalized.includes("price") || normalized.includes("budget") || normalized.includes("standard") || normalized.includes("premium")) {
    const standard = coveragePlan.options[0];
    const premium = coveragePlan.options.find((option) => option.key === "premium") ?? coveragePlan.options[2];
    const command = coveragePlan.options[coveragePlan.options.length - 1];
    if (!standard || !premium || !command) {
      return `${candidate.candidateName}'s agent needs at least one coverage option loaded before it can compare budget tiers. Proposal and checkout stay locked until USPS counts and pricing are verified.`;
    }
    return `For ${candidate.candidateName}, the lower-budget path is ${standard.label} at ${moneyFromCents(standard.totalEstimateCents)} for ${number(standard.households)} households. The premium path is ${premium.label} at ${moneyFromCents(premium.totalEstimateCents)} for ${number(premium.households)} households. The highest-coverage path is ${command.label} at ${moneyFromCents(command.totalEstimateCents)}. These are planning estimates, not final USPS quotes.`;
  }

  if (normalized.includes("geograph") || normalized.includes("county") || normalized.includes("zip") || normalized.includes("route") || normalized.includes("map")) {
    return `${candidate.candidateName}'s recommended aggregate geography starts with ${coveragePlan.recommendedGeographies.slice(0, 5).join("; ")}. The agent is using public geography, household planning counts, route-density assumptions, and office/geography fit only. Final map work still needs USPS EDDM/carrier-route counts and source timestamps.`;
  }

  if (normalized.includes("compliance") || normalized.includes("lock") || normalized.includes("checkout") || normalized.includes("proposal")) {
    return `Compliance lock is active for ${candidate.candidateName}. The agent can explain geography, coverage tiers, phases, timing, and planning estimates. It cannot infer individual political beliefs, score voters, claim vote impact, or enable proposal/checkout/production without verified USPS counts, pricing, source timestamps, and human approval.`;
  }

  if (normalized.includes("compare") || normalized.includes("option") || normalized.includes("plan") || normalized.includes("best")) {
    return `The four coverage options for ${candidate.candidateName} are: ${summarizeOptions(context)}. The best operational choice depends on budget, timing, and how much of ${coveragePlan.universeLabel} should receive repeated mail visibility.`;
  }

  if (normalized.includes("why") || normalized.includes("specific") || normalized.includes("candidate")) {
    return `${candidate.candidateName}'s plan is specific to ${candidate.officeSought}, ${candidate.geography}, ${candidate.party}, and ${candidate.raceType}. The plan frame is: ${coveragePlan.planFrame}. Strategic needs: ${coveragePlan.strategicNeeds.join(" ")} The agent keeps this operational and aggregate only.`;
  }

  return `${candidate.candidateName}'s AI Campaign Agent can compare four budget-to-coverage paths, explain phases, show recommended aggregate geographies, walk through planning estimates, and identify readiness blockers. Current options: ${summarizeOptions(context)}`;
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
  context: CandidateAgentChatContext,
): Promise<CandidateAgentChatResult> {
  const trimmedPrompt = prompt.trim().slice(0, MAX_USER_MESSAGE_LENGTH);
  if (!trimmedPrompt) {
    return {
      mode: "fallback",
      reply: "Ask a question about the selected candidate's coverage options, phases, geography, budget, readiness gates, or proposal next steps.",
    };
  }

  const client = await getOpenAIClient();
  if (!client) {
    return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt, context) };
  }

  const safeHistory = normalizeMessages(messages);

  try {
    const completion = await client.chat.completions.create({
      model: process.env.POLITICAL_AGENT_MODEL ?? "gpt-4o-mini",
      temperature: 0.3,
      max_tokens: 480,
      messages: [
        {
          role: "system",
          content:
            "You are the HomeReach Political Command AI Campaign Agent for the currently selected candidate. Answer as an operational campaign mail planning assistant. Use only supplied context and clearly mark missing or uncertain data as a research gap. Keep answers concise, practical, and campaign-operations focused. Do not infer individual political beliefs, score individual voters, target sensitive attributes, claim vote impact, write deceptive content, or authorize outreach, checkout, proposal, or production without human approval.",
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
      return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt, context) };
    }

    return { mode: "ai", reply };
  } catch {
    return { mode: "fallback", reply: buildCandidateAgentFallbackReply(trimmedPrompt, context) };
  }
}
