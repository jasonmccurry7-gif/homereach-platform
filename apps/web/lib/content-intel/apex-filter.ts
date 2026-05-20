// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — APEX Filter & Output Caps
//
// Discards insights scoring <15 total. Generates downstream execution artifacts
// (actions / scripts / offers / automations / enhancements) from the top
// surviving insights, respecting the per-run output caps from the spec:
//   3 actions / 2 scripts / 1 offer / 1 automation / 1 enhancement
//
// Generation is deterministic (template-based from the insight text). We do
// NOT call Claude again here — keeps cost predictable and lets us ship fast.
// A future version can optionally replace each template with a Claude call.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExtractedInsight } from "./extractor";

export type FilteredInsight = ExtractedInsight & {
  apex_score: number;
  is_translated: boolean;
  source_video_id: string;
  category: string;
};

export const APEX_THRESHOLD = 15;

export const OUTPUT_CAPS = {
  actions: 3,
  scripts: 2,
  offers: 1,
  automations: 1,
  enhancements: 1,
} as const;

export function filterByApex(insights: FilteredInsight[]): FilteredInsight[] {
  return insights
    .filter((i) => i.apex_score >= APEX_THRESHOLD)
    .sort((a, b) => b.apex_score - a.apex_score);
}

export type GeneratedArtifacts = {
  actions: Array<{ insight_id: string | null; category: string; title: string; steps: string[] }>;
  scripts: Array<{ insight_id: string | null; category: string; channel: "dm" | "sms" | "email" | "call"; title: string; body: string }>;
  offers: Array<{ insight_id: string | null; category: string; title: string; improvement: string; supporting_script: string }>;
  automations: Array<{ insight_id: string | null; category: string; title: string; trigger_desc: string; action_desc: string }>;
  enhancements: Array<{ insight_id: string | null; category: string; title: string; description: string; kind: "micro" | "system" | "strategic" }>;
};

/**
 * Given APEX-filtered insights (already sorted desc by score) and their DB ids,
 * produce up to (3 actions / 2 scripts / 1 offer / 1 automation / 1 enhancement).
 */
export function generateArtifacts(
  ranked: Array<FilteredInsight & { id: string }>,
): GeneratedArtifacts {
  const out: GeneratedArtifacts = {
    actions: [], scripts: [], offers: [], automations: [], enhancements: [],
  };

  for (const ins of ranked) {
    if (out.actions.length < OUTPUT_CAPS.actions) {
      out.actions.push({
        insight_id: ins.id,
        category: ins.category,
        title: shortTitle(ins.insight_text),
        steps: toActionSteps(ins.insight_text),
      });
    }
    if (out.scripts.length < OUTPUT_CAPS.scripts) {
      const channel = pickScriptChannel(ins);
      out.scripts.push({
        insight_id: ins.id,
        category: ins.category,
        channel,
        title: shortTitle(ins.insight_text),
        body: toScriptBody(ins, channel),
      });
    }
    if (out.offers.length < OUTPUT_CAPS.offers && mentionsOffer(ins)) {
      out.offers.push({
        insight_id: ins.id,
        category: ins.category,
        title: shortTitle(ins.insight_text),
        improvement: ins.insight_text,
        supporting_script: toScriptBody(ins, "dm"),
      });
    }
    if (out.automations.length < OUTPUT_CAPS.automations && mentionsAutomation(ins)) {
      out.automations.push({
        insight_id: ins.id,
        category: ins.category,
        title: shortTitle(ins.insight_text),
        trigger_desc: `When: ${firstClauseWith(ins.insight_text, ["when", "if", "after"]) ?? "a lead replies"}`,
        action_desc: `Then: ${ins.insight_text}`,
      });
    }
    if (out.enhancements.length < OUTPUT_CAPS.enhancements) {
      out.enhancements.push({
        insight_id: ins.id,
        category: ins.category,
        title: shortTitle(ins.insight_text),
        description: ins.rationale || ins.insight_text,
        kind: classifyEnhancementKind(ins),
      });
    }

    if (
      out.actions.length      >= OUTPUT_CAPS.actions &&
      out.scripts.length      >= OUTPUT_CAPS.scripts &&
      out.offers.length       >= OUTPUT_CAPS.offers &&
      out.automations.length  >= OUTPUT_CAPS.automations &&
      out.enhancements.length >= OUTPUT_CAPS.enhancements
    ) break;
  }

  return out;
}

// ── helpers ──────────────────────────────────────────────────────────────────
function shortTitle(s: string): string {
  const t = s.trim().replace(/\s+/g, " ");
  if (t.length <= 80) return t;
  return t.slice(0, 77).replace(/\s+\S*$/, "") + "…";
}

function toActionSteps(insight: string): string[] {
  // Split on obvious numbered or bullet markers; otherwise produce a 1-step
  // action whose single step is the insight itself.
  const numbered = insight.match(/\d[\.)]\s+[^]+?(?=\s+\d[\.)]|$)/g);
  if (numbered && numbered.length >= 2) {
    return numbered.slice(0, 3).map((s) => s.replace(/^\d[\.)]\s*/, "").trim());
  }
  const sentences = insight.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 3);
  if (sentences.length >= 2) return sentences.slice(0, 3);
  return [insight];
}

function pickScriptChannel(ins: FilteredInsight): "dm" | "sms" | "email" | "call" {
  const t = ins.insight_text.toLowerCase();
  if (t.includes("call")  || t.includes("phone"))   return "call";
  if (t.includes("email") || t.includes("subject")) return "email";
  if (t.includes("sms")   || t.includes("text"))    return "sms";
  return "dm";
}

function toScriptBody(ins: FilteredInsight, channel: "dm" | "sms" | "email" | "call"): string {
  const core = ins.insight_text.replace(/\s+/g, " ").trim();
  switch (channel) {
    case "email":
      return [
        "Subject: Quick question",
        "",
        `Hey {{first_name}} — ${core}`,
        "Worth a 10-min chat to see if it fits?",
        "",
        "— {{agent_first_name}}",
      ].join("\n");
    case "sms":
      return `Hey {{first_name}}, ${core} — want me to send details?`;
    case "call":
      return `Opening line: "Hey {{first_name}}, quick reason I'm calling — ${core}. Does that resonate?"`;
    case "dm":
    default:
      return `Hey {{first_name}} — ${core}. Open to a quick chat?`;
  }
}

function mentionsOffer(ins: FilteredInsight): boolean {
  const t = ins.insight_text.toLowerCase();
  return /(offer|bonus|guarantee|bundle|free|trial|upsell|downsell|pricing)/.test(t);
}

function mentionsAutomation(ins: FilteredInsight): boolean {
  const t = ins.insight_text.toLowerCase();
  return /(automate|workflow|trigger|reminder|drip|sequence|cadence|follow.?up)/.test(t);
}

function firstClauseWith(text: string, hints: string[]): string | null {
  const parts = text.split(/[,.;]/);
  for (const p of parts) {
    const low = p.toLowerCase();
    if (hints.some((h) => low.includes(h))) return p.trim();
  }
  return null;
}

function classifyEnhancementKind(ins: FilteredInsight): "micro" | "system" | "strategic" {
  if (ins.ease_score >= 4 && ins.speed_score >= 4) return "micro";
  if (ins.advantage_score >= 4) return "strategic";
  return "system";
}
