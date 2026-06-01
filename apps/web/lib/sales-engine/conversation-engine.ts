// ─────────────────────────────────────────────────────────────────────────────
// Conversation Engine
//
// Generates AI messages that sound like a top SDR texting — short, natural,
// confident, never pushy. Max 1–3 sentences per message.
//
// Principles:
//   - Short (1–3 sentences)
//   - Natural/human-sounding
//   - Confident but not aggressive
//   - Always nudge toward the next step
//   - Guide, never force
//   - AI does NOT close. AI surfaces opportunities.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SalesLead, AIResponseContext, AIResponseResult, AIResponseIntent,
} from "./types";
import { classifyFromMessage } from "./classifier";
import { detectSignals, isHotSignalPresent } from "./hot-lead-detector";

// ─────────────────────────────────────────────────────────────────────────────
// Response Templates
// Multiple variants per intent to prevent repetition
// ─────────────────────────────────────────────────────────────────────────────

// {{firstName}} {{businessName}} {{city}} {{category}} substitutions

type TemplateSet = { variants: string[]; intent: AIResponseIntent };

const TEMPLATES: Record<AIResponseIntent, TemplateSet> = {

  initial_outreach: {
    intent: "initial_outreach",
    variants: [
      "Hi {{firstName}}, HomeReach helps {{category}} businesses in {{city}} stay visible with local homeowners without taking on a huge ad budget. Want me to check if your category is still protected?",
      "Hi {{firstName}}, quick note from HomeReach. We are opening category-protected local visibility for {{category}} businesses in {{city}}. Want a quick look?",
      "Hi, I am with HomeReach. We help local {{category}} companies stay remembered in the neighborhoods they already serve. Want me to send what {{city}} coverage looks like?",
      "Hi {{firstName}}, HomeReach gives one {{category}} business in {{city}} a clean postcard presence alongside other strong local businesses. Want me to check availability?",
    ],
  },

  acknowledge_reply: {
    intent: "acknowledge_reply",
    variants: [
      "Thanks for getting back. HomeReach makes this simple: one {{category}} business gets protected visibility in {{city}}, and we handle the mail execution around it.",
      "Appreciate the reply. The idea is straightforward: keep {{businessName}} visible with nearby homeowners, without making you manage another complicated marketing channel.",
      "Glad you replied. We build local postcard visibility around {{city}} with one business per category, so your {{category}} message has room to be remembered.",
    ],
  },

  qualify: {
    intent: "qualify",
    variants: [
      "Quick question — are you mostly serving {{city}} or do you cover nearby areas too? Just want to make sure the coverage makes sense for you.",
      "Just to confirm — you're doing {{category}} work, right? And you're based in {{city}}?",
      "To check your spot — are you a {{category}} company based in {{city}}? Takes two seconds to confirm.",
    ],
  },

  surface_value: {
    intent: "surface_value",
    variants: [
      "The value is consistency: homeowners see a real local {{category}} option before they need one, and your category is not crowded by direct competitors on the card.",
      "It is built to feel low-lift for you. HomeReach handles the campaign structure, postcard path, and follow-up details so you can stay focused on the business.",
      "The goal is simple local recognition. Your business shows up in the homes you want to serve, with a clear offer and a clean next step.",
    ],
  },

  progress_forward: {
    intent: "progress_forward",
    variants: [
      "Want me to check whether {{city}} is still open for {{category}} and send the simple breakdown?",
      "I can show what this would look like for {{businessName}} in plain terms: coverage, cost, and next step. Want me to pull it together?",
      "A lot of owners start by reviewing one clean local coverage option first. Want me to send the {{city}} version?",
      "If you are open to it, I can send a quick example so you can see the visibility plan before making any decision.",
    ],
  },

  hold_for_human: {
    intent: "hold_for_human",
    variants: [
      "Love that. Let me get you connected with someone on our team who can walk you through the full setup — give me just a moment.",
      "Perfect — this sounds like a great fit. I'm pulling in one of our territory specialists right now. One sec.",
      "Awesome. I want to make sure you get the right info on availability and pricing. Someone from our team will be right with you.",
      "Great — I'm flagging this for our team now. Someone will have the exact numbers for your area shortly.",
    ],
  },

  objection_surface: {
    intent: "objection_surface",
    variants: [
      "Totally fair. Is the concern more timing, budget, or whether it will feel simple enough to manage?",
      "That makes sense. What would you need to see for this to feel like a confident local visibility decision?",
      "No worries at all. I can keep this simple: is the hesitation timing, budget, or fit?",
      "Understood. The goal is not pressure. What would make the next step feel clear and low-risk?",
    ],
  },

  follow_up_1: {
    intent: "follow_up_1",
    variants: [
      "Hi {{firstName}}, quick follow-up on the {{city}} {{category}} visibility option. Want me to send the simple breakdown before you decide?",
      "Hi {{firstName}}, checking back on {{city}}. If local visibility is still on your mind, I can send the coverage and pricing in one clean note.",
      "Hi {{firstName}}, no pressure here. I just wanted to make sure you had the {{city}} option before the category is reviewed with another business.",
    ],
  },

  follow_up_2: {
    intent: "follow_up_2",
    variants: [
      "One more quick touch. If {{city}} is not the right timing, no problem. I can still send the details so you have them for later.",
      "{{firstName}}, happy to answer questions if this is still on your list. If not, no stress - I do not want to add noise to your day.",
      "Still here if you want to revisit the {{city}} option. If the timing is off, just tell me and I will close the loop.",
    ],
  },

  follow_up_3: {
    intent: "follow_up_3",
    variants: [
      "Last note from me. If timing is not right, I will close the loop for now. If visibility in {{city}} becomes a priority, just reply.",
      "Totally okay if this is not the right time. I will keep {{businessName}} in mind and reach back out only when there is a clear {{city}} reason.",
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Template Renderer
// ─────────────────────────────────────────────────────────────────────────────

function fill(template: string, lead: SalesLead): string {
  return template
    .replace(/\{\{firstName\}\}/g,    lead.contactName?.split(" ")[0] ?? "there")
    .replace(/\{\{businessName\}\}/g, lead.businessName)
    .replace(/\{\{city\}\}/g,         lead.city)
    .replace(/\{\{category\}\}/g,     lead.category.replace(/_/g, " "));
}

function pickVariant(
  templateSet: TemplateSet,
  leadId: string,
  seed: number = 0
): string {
  if (templateSet.variants.length === 0) return "";
  // Deterministic variant selection — same lead always gets same variant unless overridden
  const hash = (leadId.charCodeAt(0) + leadId.length + seed) % templateSet.variants.length;
  return templateSet.variants[hash]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// Determine AI Intent from Context
// ─────────────────────────────────────────────────────────────────────────────

export function determineIntent(ctx: AIResponseContext): AIResponseIntent {
  const { lead, inboundMessage } = ctx;
  const q = lead.qualification;

  // If HOT or human is already in control — hold for human
  if (lead.classification.temperature === "hot" || lead.control === "ai_assist") {
    return "hold_for_human";
  }

  // Inbound message analysis
  if (inboundMessage) {
    if (isHotSignalPresent(inboundMessage)) {
      return "hold_for_human";
    }

    const signals = detectSignals(inboundMessage, new Date().toISOString());
    const signalTypes = signals.map((s) => s.type);

    if (signalTypes.includes("asked_pricing"))      return "hold_for_human";
    if (signalTypes.includes("asked_how_to_start")) return "hold_for_human";
    if (signalTypes.includes("asked_next_steps"))   return "hold_for_human";
    if (signalTypes.includes("expressed_urgency"))  return "hold_for_human";

    // Objection signals
    const objectionPatterns = [
      /not (interested|right now|sure)/i,
      /too (expensive|much)/i,
      /can.{0,5}t afford/i,
      /already (have|using|working with)/i,
      /busy (right now|season)/i,
    ];
    if (objectionPatterns.some((p) => p.test(inboundMessage))) {
      return "objection_surface";
    }

    // First reply — acknowledge and begin qualifying
    const replyCount = lead.messages.filter((m) => m.role === "lead").length;
    if (replyCount <= 1) {
      return "acknowledge_reply";
    }

    // Need qualification data
    if (!q.city || !q.category || !q.interestLevel || q.interestLevel === "none") {
      return "qualify";
    }

    // Warm — surface value or progress
    if (lead.classification.temperature === "warm") {
      return Math.random() > 0.5 ? "surface_value" : "progress_forward";
    }
  }

  // No inbound message — outbound
  if (!q.hasReplied) {
    if (lead.followUpCount === 0) return "initial_outreach";
    if (lead.followUpCount === 1) return "follow_up_1";
    if (lead.followUpCount === 2) return "follow_up_2";
    return "follow_up_3";
  }

  return "progress_forward";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Response Generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateResponse(ctx: AIResponseContext): AIResponseResult {
  const intent      = ctx.intent === "initial_outreach" ? ctx.intent : determineIntent(ctx);
  const templateSet = TEMPLATES[intent];
  const raw         = pickVariant(templateSet, ctx.lead.id, ctx.lead.messages.length);
  const body        = fill(raw, ctx.lead);

  // Determine if this message should trigger escalation
  const shouldEscalate =
    intent === "hold_for_human" ||
    (ctx.inboundMessage ? isHotSignalPresent(ctx.inboundMessage) : false);

  let escalateReason: string | undefined;
  if (shouldEscalate && ctx.inboundMessage) {
    const signals = detectSignals(ctx.inboundMessage, new Date().toISOString());
    escalateReason = signals[0]
      ? `Signal: "${signals[0].type.replace(/_/g, " ")}" detected.`
      : "Strong intent signal detected.";
  }

  // Update classification if we have a new inbound message
  let newClassification = ctx.lead.classification;
  if (ctx.inboundMessage) {
    newClassification = classifyFromMessage(
      ctx.lead.classification,
      ctx.inboundMessage,
      new Date().toISOString()
    );
  }

  return {
    body,
    intent,
    shouldEscalate,
    escalateReason,
    newClassification,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Safety Check
// Never generate a message if outreach is suppressed
// ─────────────────────────────────────────────────────────────────────────────

export function canSendAIMessage(lead: SalesLead): {
  ok:     boolean;
  reason?: string;
} {
  if (lead.control === "human") {
    return { ok: false, reason: "Human has control. AI is silent." };
  }
  if (lead.stage === "do_not_contact") {
    return { ok: false, reason: "Lead is marked do_not_contact." };
  }
  if (lead.stage === "closed_won" || lead.stage === "closed_lost") {
    return { ok: false, reason: "Conversation is closed." };
  }
  if (lead.followUpCount >= lead.maxFollowUps && !lead.qualification.hasReplied) {
    return { ok: false, reason: `Max follow-ups (${lead.maxFollowUps}) reached. No response.` };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick initial outreach message generator (for batch sending)
// ─────────────────────────────────────────────────────────────────────────────

export function buildInitialOutreach(lead: SalesLead): string {
  const templateSet = TEMPLATES.initial_outreach;
  const raw = pickVariant(templateSet, lead.id);
  return fill(raw, lead);
}
