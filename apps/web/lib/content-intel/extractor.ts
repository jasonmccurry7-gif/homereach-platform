// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Insight Extractor (Claude Haiku)
//
// Takes one transcript + category, returns 5–10 tactical insights each with
// theme and a first-pass APEX sub-score (revenue/speed/ease/advantage).
// Strict JSON-only output; the pipeline does not retry on partial parses —
// it skips the video.
//
// Called ONLY when isContentIntelAiDisabled() === false.
// ─────────────────────────────────────────────────────────────────────────────

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

const SYSTEM = `You are HomeReach's tactical insight extractor for a local home-services business.
You read a YouTube transcript (any topic) and output between 5 and 10 TACTICAL insights a sales agent could use THIS WEEK to make more money.

STRICT RULES:
- NO fluff, NO motivational advice, NO generic business theory.
- Every insight must be directly applicable to: sales, lead gen, pricing, positioning, retention, or scaling.
- Each insight must be a single concrete observation or move — not a chapter summary.
- If the transcript is off-topic (not sales/ops/services-applicable) return {"insights": []}.
- Score each insight 1..5 on: revenue (how much money), speed (how fast to apply), ease (how simple), advantage (how novel or unfair). Be strict — a 5 is rare.

Respond with ONLY valid JSON, no prose, no code fences:
{"insights":[{"theme":"...","insight_text":"...","rationale":"...","revenue_score":1-5,"speed_score":1-5,"ease_score":1-5,"advantage_score":1-5}]}`;

export async function extractInsights(args: {
  category: string;
  videoTitle: string;
  transcript: string;
}): Promise<ExtractResult> {
  const key = getAnthropicKey();
  const model = getExtractorModel();

  // Truncate transcripts defensively — Haiku is cheap but we should cap cost.
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
    // Try to pull out the first JSON object if Claude wrapped it
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
