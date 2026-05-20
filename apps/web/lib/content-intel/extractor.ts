// HomeReach - Insight Extractor
//
// Takes one transcript plus category and returns 5-10 tactical insights with
// first-pass APEX sub-scores. This is review-only: downstream artifacts do not
// execute production actions without human approval.

import { getAnthropicKey, getExtractorModel } from "./env";

export type ExtractedInsight = {
  theme: string;
  insight_text: string;
  rationale: string;
  revenue_score: number;
  speed_score: number;
  ease_score: number;
  advantage_score: number;
};

export type ExtractResult =
  | { ok: true; insights: ExtractedInsight[]; modelName: string; tokensInput: number; tokensOutput: number }
  | { ok: false; error: string };

const SYSTEM = `You are HomeReach's Learning Engine insight extractor.
You read a transcript and output between 5 and 10 tactical insights HomeReach could use to improve its AI Workforce Operating System.

HomeReach operates across shared postcards, targeted mail, political mail, inventory/procurement, government contracts, outreach, SEO, creative, revenue operations, dashboard UX, automation, and AI agent orchestration.

STRICT RULES:
- NO fluff, NO motivational advice, NO generic business theory.
- Every insight must be directly applicable to HomeReach operations, revenue, automation, product, UX, content, outreach, fulfillment, procurement, political operations, or government-contract operations.
- Each insight must be a single concrete observation or move, not a chapter summary.
- If the transcript is off-topic or cannot produce a useful HomeReach improvement, return {"insights": []}.
- Score each insight 1..5 on: revenue (how much money), speed (how fast to apply), ease (how simple), advantage (how novel or defensible). Be strict; a 5 is rare.
- Do not recommend unsafe actions such as autonomous payments, uncontrolled outreach, political persuasion automation, bid submission, legal commitments, or production deployment without human approval.

Respond with ONLY valid JSON, no prose, no code fences:
{"insights":[{"theme":"...","insight_text":"...","rationale":"...","revenue_score":1-5,"speed_score":1-5,"ease_score":1-5,"advantage_score":1-5}]}`;

export async function extractInsights(args: {
  category: string;
  videoTitle: string;
  transcript: string;
}): Promise<ExtractResult> {
  const key = getAnthropicKey();
  const model = getExtractorModel();

  // Cap model cost and latency on long transcripts.
  const transcript = args.transcript.length > 40_000
    ? args.transcript.slice(0, 40_000)
    : args.transcript;

  const userPrompt = [
    `Category: ${args.category}`,
    `Video title: ${args.videoTitle}`,
    "",
    "Transcript:",
    transcript,
    "",
    "Return JSON only.",
  ].join("\n");

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (err: any) {
    return { ok: false, error: `network: ${err?.message ?? String(err)}` };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `http ${res.status}: ${text.slice(0, 200)}` };
  }

  const json = (await res.json().catch(() => null)) as any;
  if (!json) return { ok: false, error: "non-json response" };

  const content = Array.isArray(json.content) ? json.content : [];
  const text = content
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return { ok: false, error: "no JSON in response" };
    try {
      parsed = JSON.parse(match[0]);
    } catch (err: any) {
      return { ok: false, error: `parse: ${err?.message ?? "bad json"}` };
    }
  }

  if (!parsed || !Array.isArray(parsed.insights)) {
    return { ok: false, error: "missing insights array" };
  }

  const insights = parsed.insights
    .filter(
      (i: any) =>
        typeof i?.insight_text === "string" &&
        typeof i?.theme === "string" &&
        Number.isFinite(i?.revenue_score) &&
        Number.isFinite(i?.speed_score) &&
        Number.isFinite(i?.ease_score) &&
        Number.isFinite(i?.advantage_score),
    )
    .slice(0, 10)
    .map((i: any) => ({
      theme: String(i.theme).slice(0, 80),
      insight_text: String(i.insight_text).slice(0, 800),
      rationale: String(i.rationale ?? "").slice(0, 500),
      revenue_score: clamp(i.revenue_score),
      speed_score: clamp(i.speed_score),
      ease_score: clamp(i.ease_score),
      advantage_score: clamp(i.advantage_score),
    }));

  return {
    ok: true,
    insights,
    modelName: model,
    tokensInput: Number(json?.usage?.input_tokens ?? 0),
    tokensOutput: Number(json?.usage?.output_tokens ?? 0),
  };
}

function clamp(n: any): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return 1;
  return Math.max(1, Math.min(5, Math.round(v)));
}
