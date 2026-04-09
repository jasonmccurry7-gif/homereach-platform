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
      "Hey! HomeReach here — we work with {{category}} businesses in {{city}} to fill their schedule with local homeowners. Got an open spot. Want me to check if your area's still available?",
      "Hi {{firstName}}! Quick heads up — we have an exclusive marketing spot for {{category}} businesses in {{city}}. Only one per category. Still available if you're interested?",
      "Hey, I'm with HomeReach — we do direct mail postcard campaigns for local {{category}} companies. Have a spot open in {{city}} right now. Worth a quick look?",
      "Hi! We run local postcard campaigns for {{category}} businesses in {{city}} — one exclusive spot per category. Want to see what it looks like for your area?",
    ],
  },

  acknowledge_reply: {
    intent: "acknowledge_reply",
    variants: [
      "Great to hear from you! So HomeReach sends direct mail to homeowners in your area — and it's exclusive, meaning only your {{category}} business gets the spot.",
      "Hey! Thanks for getting back. We basically put {{businessName}} in front of every homeowner in {{city}} through targeted postcards. Super simple. Want me to walk you through it?",
      "Glad you replied! Real quick — we cover {{city}} with direct mail campaigns, one business per category. Your {{category}} spot would be exclusive to you.",
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
      "Most {{category}} businesses we work with see 2–5 new homeowner calls per postcard run. Exclusive coverage means no competitors on the card.",
      "It's really straightforward — we mail to every homeowner in your route, your name and number front and center. No sharing the card.",
      "Basically — we flood your service area with your business every 30 days. Homeowners keep postcards. You stay top of mind.",
    ],
  },

  progress_forward: {
    intent: "progress_forward",
    variants: [
      "Want me to check if {{city}} is still open for {{category}}? I can have an answer in a few minutes.",
      "I can show you exactly what this would look like for {{businessName}} — takes 2 minutes. Want me to pull it up?",
      "Most businesses start with a 2,500-home run to test the market. Want me to walk you through what that looks like in {{city}}?",
      "If you're open to it, I can send over a quick example of what your postcard would look like. No commitment — just so you can see it.",
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
      "Totally fair — what's the main concern? Happy to address it.",
      "That makes sense. What would make this feel like the right fit for you?",
      "No worries at all. Is it more about timing, budget, or something else?",
      "Understood. What would you need to see to feel comfortable moving forward?",
    ],
  },

  follow_up_1: {
    intent: "follow_up_1",
    variants: [
      "Hey {{firstName}}, just circling back — the {{city}} spot is still open. Worth 2 minutes to take a look?",
      "Hi! Checking in on the {{city}} {{category}} spot — still available right now. Want me to hold it while you decide?",
      "Hey, wanted to follow up. The spot's still there — no pressure, just didn't want you to miss it if timing's right.",
    ],
  },

  follow_up_2: {
    intent: "follow_up_2",
    variants: [
      "One more quick touch — if {{city}} timing isn't right, no worries at all. Just wanted to make sure you had the info.",
      "{{firstName}}, last check-in on this. Happy to answer any questions if you have them — otherwise no stress.",
      "Hey — still here if you want to revisit the {{city}} spot. If the timing's off, totally get it. Just let me know either way.",
    ],
  },

  follow_up_3: {
    intent: "follow_up_3",
    variants: [
      "Last one, promise. If the timing's not right right now, I'll check back in a few months. Just say the word if things change.",
      "Totally okay if it's not the right time. I'll keep {{businessName}} in mind and reach back out when we have new availability in {{city}}.",
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
  // Deterministic variant selection — same lead always gets same variant unless overridden
  const hash = (leadId.charCodeAt(0) + leadId.length + seed) % templateSet.variants.length;
  return templateSet.variants[hash];
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
