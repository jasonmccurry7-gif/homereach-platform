// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Dan Martell SaaS → Local Services Translator
//
// When insights come from a channel with ci_trusted_channels.translate_saas=true,
// we run every insight through this translator BEFORE the APEX filter.
// The goal is to rewrite SaaS-flavored language ("MRR", "churn", "trial") into
// local-services equivalents ("monthly recurring revenue", "lost clients",
// "introductory visit") without losing the tactical core.
//
// If the Claude call fails, we fall back to the original insight (never drop).
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtractedInsight } from "./extractor";
import { getAnthropicKey, getTranslatorModel, isContentIntelAiDisabled } from "./env";

const SYSTEM = `You translate SaaS-flavored business insights into language that applies to a local home-services company (HomeReach) selling pressure washing, lawn care, window cleaning, gutter cleaning, pest control, and roofing.

Rules:
- Preserve the tactical core — do not water it down.
- Replace SaaS jargon with services equivalents (examples: MRR → recurring monthly revenue; churn → lost clients; trial → first-visit offer; freemium → free quote; onboarding → first service; seat → crew slot).
- Keep the insight to ONE sentence or two short sentences.
- If the insight is already service-ready, return it unchanged.

Return ONLY valid JSON:
{"insight_text":"...","rationale":"..."}`;

export async function translateInsight(ins: ExtractedInsight): Promise<ExtractedInsight> {
  if (isContentIntelAiDisabled()) return ins;

  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": getAnthropicKey(),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: getTranslatorModel(),
        max_tokens: 400,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `Insight: ${ins.insight_text}\n\nRationale: ${ins.rationale}`,
          },
        ],
      }),
    });
  } catch {
    return ins;
  }

  if (!res.ok) return ins;

  const json = (await res.json().catch(() => null)) as any;
  if (!json) return ins;
  const text = (json.content || [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("")
    .trim();

  let parsed: any = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
    }
  }
  if (!parsed || typeof parsed.insight_text !== "string") return ins;

  return {
    ...ins,
    insight_text: String(parsed.insight_text).slice(0, 800),
    rationale: String(parsed.rationale ?? ins.rationale).slice(0, 500),
  };
}
