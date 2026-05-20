// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Pattern Detector
//
// Once a week, reads the last 30 days of ci_competitor_insights and asks
// Claude Haiku: "what patterns REPEAT across multiple competitors?"
// Each surfaced pattern is promoted to ci_patterns with source_count + weight.
//
// No agent-facing output. This fills the "Patterns" tab in the admin UI so
// you can see which offer angles / messaging frames / urgency plays are
// showing up across the competitor set.
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { getAnthropicKey, getExtractorModel, isContentIntelAiDisabled } from "./env";

type Supa = ReturnType<typeof createServiceClient>;

const LOOKBACK_DAYS = 30;
const MIN_INSIGHTS_TO_RUN = 5; // skip if we have too few signals

export type PatternRunSummary = {
  ok: boolean;
  insightsAnalyzed: number;
  patternsPromoted: number;
  patternsUpdated: number;
  skipReason?: string;
  errors: string[];
};

const SYSTEM = `You are HomeReach's cross-competitor pattern detector.
You read a corpus of competitor insights (already tactical, each from a different advertiser or channel) and surface the PATTERNS that repeat across 3+ competitors.

Examples of a valid pattern:
  - "$0 down / free-quote lead magnet" (seen across multiple advertisers)
  - "Storm-response urgency framing" (multiple roofing competitors)
  - "Neighborhood referral scarcity" (multiple agencies)
  - "Guaranteed-results language" (positioning)
  - "Monthly-plan pricing anchor"

STRICT RULES:
  - Only return patterns observed in AT LEAST 3 distinct competitors.
  - Be concrete and actionable. No "use social proof." That is not a pattern.
  - Classify each pattern by pattern_type: offer | messaging | funnel | pricing | positioning | tactic | urgency.
  - For each, provide source_count (how many competitors use it), a short label,
    and a 1-2 sentence description of the underlying play.
  - Skip patterns that don't transfer to local home services.

Return ONLY valid JSON:
{"patterns":[{"category":"roofing|lawn_care|window_cleaning|gutter_cleaning|pest_control|pressure_washing|*","pattern_type":"offer|messaging|funnel|pricing|positioning|tactic|urgency","label":"...","description":"...","source_count":3}]}`;

export async function detectPatterns(): Promise<PatternRunSummary> {
  if (isContentIntelAiDisabled()) {
    return { ok: false, insightsAnalyzed: 0, patternsPromoted: 0, patternsUpdated: 0, skipReason: "AI disabled", errors: [] };
  }

  const supa: Supa = createServiceClient();
  const errors: string[] = [];
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const { data: insights, error } = await supa
    .from("ci_competitor_insights")
    .select("competitor_name, category, insight_type, insight_text, apex_score")
    .gte("created_at", since)
    .order("apex_score", { ascending: false })
    .limit(200);
  if (error) errors.push(`select: ${error.message}`);

  const corpus = insights ?? [];
  if (corpus.length < MIN_INSIGHTS_TO_RUN) {
    return {
      ok: true, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0,
      skipReason: `only ${corpus.length} competitor insights in last ${LOOKBACK_DAYS} days (need ${MIN_INSIGHTS_TO_RUN})`,
      errors,
    };
  }

  // Serialize corpus compactly for Claude
  const payload = corpus
    .map((i: any, idx: number) =>
      `[${idx + 1}] (${i.competitor_name} · ${i.category} · ${i.insight_type} · APEX ${i.apex_score}) ${i.insight_text}`,
    )
    .join("\n")
    .slice(0, 30_000);

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
        model: getExtractorModel(),
        max_tokens: 2000,
        system: SYSTEM,
        messages: [{ role: "user", content: `Corpus (${corpus.length} competitor insights, last ${LOOKBACK_DAYS} days):\n\n${payload}\n\nReturn JSON only.` }],
      }),
    });
  } catch (err: any) {
    errors.push(`network: ${err?.message ?? String(err)}`);
    return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors };
  }

  if (!res.ok) {
    errors.push(`http ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors };
  }

  const json = (await res.json().catch(() => null)) as any;
  if (!json) {
    errors.push("non-json response");
    return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors };
  }
  const text = (json.content || []).filter((b: any) => b?.type === "text").map((b: any) => b.text).join("").trim();

  let parsed: any;
  try { parsed = JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) { errors.push("no JSON in response"); return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors }; }
    try { parsed = JSON.parse(m[0]); }
    catch (e: any) { errors.push(`parse: ${e?.message}`); return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors }; }
  }

  if (!parsed || !Array.isArray(parsed.patterns)) {
    errors.push("missing patterns array");
    return { ok: false, insightsAnalyzed: corpus.length, patternsPromoted: 0, patternsUpdated: 0, errors };
  }

  let patternsPromoted = 0;
  let patternsUpdated = 0;
  const VALID_CATS = new Set(["roofing","lawn_care","window_cleaning","gutter_cleaning","pest_control","pressure_washing","*","competitor","sales_scaling"]);

  for (const p of parsed.patterns) {
    if (!p?.label || !VALID_CATS.has(p.category)) continue;

    const category = p.category === "*" ? "competitor" : p.category;
    const pattern  = String(p.label).slice(0, 200);
    const sourceCount = Math.max(1, Math.min(20, Number(p.source_count ?? 3)));
    // Weight grows with source_count, capped at 3.0 (new patterns start at 1.0)
    const weight = Math.min(3.0, 1.0 + 0.15 * Math.max(0, sourceCount - 3));

    const { data: existing } = await supa
      .from("ci_patterns")
      .select("id, source_count, weight")
      .eq("category", category)
      .eq("pattern", pattern)
      .maybeSingle();

    if (existing) {
      const nextSourceCount = Math.max(Number((existing as any).source_count ?? 1), sourceCount);
      const nextWeight = Math.min(3.0, Math.max(Number((existing as any).weight ?? 1.0), weight));
      await supa.from("ci_patterns")
        .update({ source_count: nextSourceCount, weight: nextWeight })
        .eq("id", (existing as any).id);
      patternsUpdated++;
    } else {
      await supa.from("ci_patterns").insert({
        category, pattern, source_count: sourceCount, win_count: 0, weight,
      });
      patternsPromoted++;
    }
  }

  return {
    ok: true,
    insightsAnalyzed: corpus.length,
    patternsPromoted,
    patternsUpdated,
    errors,
  };
}
