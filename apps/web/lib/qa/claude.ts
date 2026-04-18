// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Claude Q&A Answer Generator
//
// Generates a structured answer for a Q&A question using Anthropic Claude.
// Returns strict JSON matching the qa_answers schema: directAnswer,
// whatToSay (sms/email/call/dm), whatToDoNext, whyThisWorks,
// relatedQuestionIds (UUIDs from the retrieval context).
//
// Uses the REST API directly (no SDK dependency) to match the existing
// pattern in apps/web/app/api/admin/agents/echo/route.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { getAnthropicKey, getQaAnswerModel } from "./env";

export type QaRetrievedContext = {
  knowledgeEntries: Array<{ id: string; title: string; body: string }>;
  pastAnswers: Array<{
    id: string;
    questionId: string;
    questionText: string;
    directAnswer: string;
  }>;
  leadContext: {
    leadId?: string | null;
    city?: string | null;
    category?: string | null;
    lastInteractionSummary?: string | null;
  };
};

export type QaAnswerPayload = {
  directAnswer: string;
  whatToSay: {
    sms?: string;
    email?: string;
    call?: string;
    dm?: string;
  };
  whatToDoNext: string;
  whyThisWorks: string;
  relatedQuestionIds: string[];
};

export type QaAnswerResult =
  | {
      ok: true;
      payload: QaAnswerPayload;
      modelName: string;
      tokensInput: number;
      tokensOutput: number;
      latencyMs: number;
    }
  | {
      ok: false;
      error: string;
      modelName: string;
      latencyMs: number;
      rawText?: string;
    };

const SYSTEM_PROMPT = `You are Claude, the Sales Intelligence engine embedded inside HomeReach.
HomeReach sells exclusive city-based category advertising to local service businesses.
Your job is to give HomeReach sales reps precise, field-ready answers to their questions.

Reply with STRICT JSON matching this TypeScript type (no markdown, no preamble):
{
  "directAnswer": string,         // 1-3 sentence plain-English answer
  "whatToSay": {                  // channel-specific scripts; omit channels not applicable
    "sms"?:   string,             // <= 320 chars, friendly, no emojis unless lead has used them
    "email"?: string,             // short plain text (no HTML), 3-6 sentences
    "call"?:  string,             // short talking-point script for a live call
    "dm"?:    string              // Facebook Messenger tone, short
  },
  "whatToDoNext": string,         // 1-2 sentence action for the rep to take NOW
  "whyThisWorks": string,         // 1-2 sentence coaching layer
  "relatedQuestionIds": string[]  // UUIDs taken ONLY from the retrieval context; [] if none relevant
}

Rules:
- Never quote pricing unless the retrieval context contains a specific price for the lead's city/category.
- Never promise a specific outcome ("you will close 10 deals"). Use probabilistic language.
- Always use the lead's city name if provided.
- Keep every field concise. Total output under 500 words.`;

function buildUserPrompt(
  questionText: string,
  context: QaRetrievedContext,
): string {
  const lines: string[] = [];

  lines.push(`QUESTION:`);
  lines.push(questionText);
  lines.push("");

  if (context.leadContext.leadId || context.leadContext.city || context.leadContext.category) {
    lines.push(`LEAD CONTEXT:`);
    if (context.leadContext.leadId) lines.push(`- lead_id: ${context.leadContext.leadId}`);
    if (context.leadContext.city) lines.push(`- city: ${context.leadContext.city}`);
    if (context.leadContext.category) lines.push(`- category: ${context.leadContext.category}`);
    if (context.leadContext.lastInteractionSummary)
      lines.push(`- last interaction: ${context.leadContext.lastInteractionSummary}`);
    lines.push("");
  }

  if (context.knowledgeEntries.length > 0) {
    lines.push(`OFFICIAL KNOWLEDGE ENTRIES (prefer these when relevant):`);
    for (const k of context.knowledgeEntries) {
      lines.push(`- [${k.id}] ${k.title}`);
      lines.push(`  ${k.body.slice(0, 400)}`);
    }
    lines.push("");
  }

  if (context.pastAnswers.length > 0) {
    lines.push(`PAST SIMILAR Q&A THREADS (may cite any of these ids in relatedQuestionIds):`);
    for (const p of context.pastAnswers) {
      lines.push(`- question_id: ${p.questionId}`);
      lines.push(`  Q: ${p.questionText}`);
      lines.push(`  A: ${p.directAnswer.slice(0, 300)}`);
    }
    lines.push("");
  }

  lines.push(`Respond with STRICT JSON only.`);
  return lines.join("\n");
}

export async function generateQaAnswer(
  questionText: string,
  context: QaRetrievedContext,
): Promise<QaAnswerResult> {
  const apiKey = getAnthropicKey();
  const model = getQaAnswerModel();
  const startedAt = Date.now();

  let rawText = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(questionText, context),
          },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return {
        ok: false,
        error: `Anthropic API ${res.status}: ${body.slice(0, 200)}`,
        modelName: model,
        latencyMs: Date.now() - startedAt,
      };
    }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    rawText = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text || "")
      .join("");

    const trimmed = stripJsonFence(rawText).trim();
    const parsed = JSON.parse(trimmed) as Partial<QaAnswerPayload>;

    const payload = validateAnswer(parsed, context);
    if (!payload) {
      return {
        ok: false,
        error: "Claude returned JSON but it failed schema validation.",
        modelName: model,
        latencyMs: Date.now() - startedAt,
        rawText,
      };
    }

    return {
      ok: true,
      payload,
      modelName: model,
      tokensInput: data.usage?.input_tokens ?? 0,
      tokensOutput: data.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - startedAt,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      modelName: model,
      latencyMs: Date.now() - startedAt,
      rawText,
    };
  }
}

function stripJsonFence(s: string): string {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  return fence ? fence[1] : s;
}

function validateAnswer(
  raw: Partial<QaAnswerPayload>,
  context: QaRetrievedContext,
): QaAnswerPayload | null {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.directAnswer !== "string" || raw.directAnswer.length === 0) return null;
  const wts = raw.whatToSay ?? {};
  if (typeof wts !== "object" || Array.isArray(wts)) return null;
  if (typeof raw.whatToDoNext !== "string") return null;
  if (typeof raw.whyThisWorks !== "string") return null;

  // related ids must be UUIDs from the context
  const validIds = new Set(context.pastAnswers.map((p) => p.questionId));
  const related = Array.isArray(raw.relatedQuestionIds)
    ? raw.relatedQuestionIds.filter((id) => typeof id === "string" && validIds.has(id))
    : [];

  return {
    directAnswer: raw.directAnswer.slice(0, 4000),
    whatToSay: {
      sms: typeof wts.sms === "string" ? wts.sms.slice(0, 640) : undefined,
      email: typeof wts.email === "string" ? wts.email.slice(0, 4000) : undefined,
      call: typeof wts.call === "string" ? wts.call.slice(0, 2000) : undefined,
      dm: typeof wts.dm === "string" ? wts.dm.slice(0, 1000) : undefined,
    },
    whatToDoNext: raw.whatToDoNext.slice(0, 1000),
    whyThisWorks: raw.whyThisWorks.slice(0, 1000),
    relatedQuestionIds: related,
  };
}
