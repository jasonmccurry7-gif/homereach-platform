import type {
  ConversationContext,
  DetectedIntent,
  IntentType,
  MessageChannel,
} from "./types";

interface IntentRule {
  type: IntentType;
  keywords: string[];
  weight: number;
}

interface ResponseTemplate {
  intent: IntentType;
  channel: MessageChannel;
  templates: string[];
}

const INTENT_RULES: IntentRule[] = [
  {
    type: "ready_to_buy",
    keywords: ["let's do it", "lets do it", "sign me up", "send the link", "ready", "send it over", "i'm in", "im in", "yes let's", "yes lets", "do it", "sign up", "lock it in"],
    weight: 10,
  },
  {
    type: "interested",
    keywords: ["sounds good", "interested", "tell me more", "how much", "pricing", "price", "what's included", "whats included", "how does it work", "tell me", "more info", "looks good", "that's cool", "thats cool"],
    weight: 8,
  },
  {
    type: "objection",
    keywords: ["too expensive", "too much", "can't afford", "cant afford", "not sure", "need to think", "maybe later", "have to think", "too busy", "not a good time", "already have", "don't need", "dont need", "tight budget"],
    weight: 7,
  },
  {
    type: "asking_questions",
    keywords: ["how many", "what cities", "which areas", "who else", "how long", "cancel", "contract", "commitment", "when", "how soon", "minimum", "how does", "explain", "what is", "what are"],
    weight: 5,
  },
  {
    type: "not_interested",
    keywords: ["not interested", "no thanks", "stop", "unsubscribe", "remove me", "don't contact", "dont contact", "leave me alone", "never mind", "nevermind", "no thank you"],
    weight: 9,
  },
];

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  {
    intent: "ready_to_buy",
    channel: "sms",
    templates: [
      "Great. Here is the quick intake link: {{intakeLink}}\n\nIt takes about 3 minutes. Once it is in, I will confirm the {{city}} {{category}} setup and next step.",
      "Perfect. Start here: {{intakeLink}}\n\nAfter you send it in, I will confirm the protected {{category}} option in {{city}} and keep the process simple.",
    ],
  },
  {
    intent: "ready_to_buy",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nGreat to get this moving. Here is the intake link for the protected {{category}} visibility option in {{city}}:\n\n{{intakeLink}}\n\nIt should take about 3 minutes. Once it is complete, I will confirm the setup and the next campaign step so you are not left guessing.\n\nTalk soon,\n{{ownerName}}",
    ],
  },
  {
    intent: "interested",
    channel: "sms",
    templates: [
      "Simple version: one {{category}} business gets protected visibility in {{city}}, and HomeReach handles the postcard path around it.\n\nPricing starts at $299/mo. Want the full breakdown?",
      "The goal is steady local recognition without another complicated marketing task. One business per category in {{city}}.\n\nPricing starts at $299/mo. Want me to send the details?",
    ],
  },
  {
    intent: "interested",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nThanks for your interest. Here is the simple version:\n\n- One {{category}} business gets protected visibility in {{city}}\n- HomeReach handles the campaign structure, postcard setup, and mail path\n- Pricing starts at $299/month, with no long-term contract required\n\nIf you want, I can send the full breakdown so you can review it without pressure.\n\n{{ownerName}}",
    ],
  },
  {
    intent: "objection",
    channel: "sms",
    templates: [
      "Totally fair. The goal is not pressure - it is clearer local visibility with a simple commitment. Is the concern timing, budget, or fit?",
      "Makes sense. A lot of owners are protecting every dollar right now. Would a simple cost/coverage breakdown help you decide?",
    ],
  },
  {
    intent: "objection",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nI completely understand the hesitation. Local marketing should not feel like another risky thing on your plate.\n\nThe HomeReach setup is meant to be simple: protected {{category}} visibility in {{city}}, a clear postcard path, and no long-term contract required.\n\nIf helpful, tell me whether the main concern is timing, budget, or fit and I will answer directly.\n\n{{ownerName}}",
    ],
  },
  {
    intent: "asking_questions",
    channel: "sms",
    templates: [
      "Great question. Short version: protected category visibility in {{city}}, postcard setup handled by HomeReach, pricing from $299/mo, no long-term contract. What would you like clarified?",
      "Happy to answer. Are you wondering about pricing, design, coverage, timing, or how much work it takes on your end?",
    ],
  },
  {
    intent: "asking_questions",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nHappy to answer your questions. Quick overview:\n\n- One business per category in {{city}}\n- HomeReach handles the postcard setup and campaign path\n- Design support is included\n- Pricing starts at $299/mo, with no long-term contract required\n\nWhat would make the decision feel clearer?\n\n{{ownerName}}",
    ],
  },
  {
    intent: "not_interested",
    channel: "sms",
    templates: [
      "No problem at all, {{firstName}}. I'll take you off the list. If you ever want to revisit the {{city}} area, just shoot me a text. Take care.",
    ],
  },
  {
    intent: "not_interested",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nAbsolutely no problem. I'll remove you from our list right away. If you ever want to revisit the {{category}} spot in {{city}}, just reach out.\n\nTake care,\n{{ownerName}}",
    ],
  },
  {
    intent: "unknown",
    channel: "sms",
    templates: [
      "Hi {{firstName}}, checking in on the {{city}} {{category}} visibility option. Happy to send the simple breakdown or close the loop.",
    ],
  },
  {
    intent: "unknown",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nJust wanted to follow up and see if you had any questions about the {{category}} visibility option in {{city}}. I can keep it simple: coverage, cost, and the next step.\n\n{{ownerName}}",
    ],
  },
];

function defaultIntakeLink() {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return base ? `${base}/get-started` : "/get-started";
}

function templateResponse(
  intent: IntentType,
  channel: MessageChannel,
  vars: { firstName: string; city: string; category: string; intakeLink: string; ownerName?: string }
): string {
  const match =
    RESPONSE_TEMPLATES.find((template) => template.intent === intent && template.channel === channel) ??
    RESPONSE_TEMPLATES.find((template) => template.intent === "unknown" && template.channel === channel);

  if (!match) return "Hey, just following up. Let me know if you have any questions.";

  const template = match.templates[Math.floor(Math.random() * match.templates.length)] ?? match.templates[0] ?? "";
  return template
    .replace(/{{firstName}}/g, vars.firstName)
    .replace(/{{city}}/g, vars.city)
    .replace(/{{category}}/g, vars.category)
    .replace(/{{intakeLink}}/g, vars.intakeLink)
    .replace(/{{ownerName}}/g, vars.ownerName ?? process.env.OWNER_NAME ?? process.env.NEXT_PUBLIC_OWNER_NAME ?? "HomeReach");
}

export class AutomationClientEngine {
  static detectIntent(messageBody: string): DetectedIntent {
    const lower = messageBody.toLowerCase();
    let topMatch: IntentRule | null = null;
    let topScore = 0;
    const matchedKeywords: string[] = [];

    for (const rule of INTENT_RULES) {
      const hits = rule.keywords.filter((keyword) => lower.includes(keyword));
      if (hits.length === 0) continue;

      const score = hits.length * rule.weight;
      if (score > topScore) {
        topScore = score;
        topMatch = rule;
        matchedKeywords.splice(0, matchedKeywords.length, ...hits);
      }
    }

    const type: IntentType = topMatch?.type ?? "unknown";
    const confidence = topScore > 0 ? Math.min(1, topScore / 20) : 0.1;

    return {
      type,
      confidence,
      keywords: matchedKeywords,
      suggestedResponse: templateResponse(type, "sms", {
        firstName: "",
        city: "",
        category: "",
        intakeLink: defaultIntakeLink(),
      }),
    };
  }

  static generateResponse(
    intent: IntentType,
    channel: MessageChannel,
    vars: { firstName: string; city: string; category: string; intakeLink?: string }
  ): string {
    return templateResponse(intent, channel, {
      ...vars,
      intakeLink: vars.intakeLink ?? defaultIntakeLink(),
    });
  }

  static scoreConversation(ctx: ConversationContext): number {
    let score = 0;

    const inbound = ctx.messages.filter((message) => message.direction === "inbound");
    const outbound = ctx.messages.filter((message) => message.direction === "outbound");

    score += Math.min(inbound.length, 4) * 20;

    const priceKeywords = ["price", "cost", "how much", "pricing", "rate", "fee", "charge", "pay", "afford"];
    const hasPriceAsk = inbound.some((message) =>
      priceKeywords.some((keyword) => message.body.toLowerCase().includes(keyword))
    );
    if (hasPriceAsk) score += 30;

    const intakeSent = outbound.some((message) =>
      message.body.includes("/targeted") || message.body.includes("intake") || message.body.includes("get-started")
    );
    if (intakeSent) score += 15;

    if (outbound.length > 0 && inbound.length === 0) {
      score -= 10;
    } else if (outbound.length > 0 && inbound.length > 0) {
      const lastOut = outbound[outbound.length - 1]!;
      const lastIn = inbound[inbound.length - 1]!;
      if (lastOut.sentAt > lastIn.sentAt) score -= 10;
    }

    if (ctx.lastIntent === "ready_to_buy") score += 20;
    if (ctx.lastIntent === "interested") score += 10;
    if (ctx.lastIntent === "not_interested") score = Math.min(score, 10);

    return Math.max(0, score);
  }

  static getScoreBadge(score: number): { label: string; color: string; emoji: string } {
    if (score >= 90) return { label: "On Fire", color: "bg-red-100 text-red-800 border-red-200", emoji: "!!" };
    if (score >= 60) return { label: "Hot", color: "bg-orange-100 text-orange-800 border-orange-200", emoji: "+" };
    if (score >= 30) return { label: "Warm", color: "bg-yellow-100 text-yellow-800 border-yellow-200", emoji: "~" };
    return { label: "Cold", color: "bg-gray-100 text-gray-600 border-gray-200", emoji: "-" };
  }

  static getIntentBadge(intent: IntentType): { label: string; color: string } {
    const badges: Record<IntentType, { label: string; color: string }> = {
      ready_to_buy: { label: "Ready to buy", color: "bg-green-100 text-green-800" },
      interested: { label: "Interested", color: "bg-blue-100 text-blue-800" },
      asking_questions: { label: "Has questions", color: "bg-yellow-100 text-yellow-800" },
      objection: { label: "Has objection", color: "bg-orange-100 text-orange-800" },
      not_interested: { label: "Not interested", color: "bg-red-100 text-red-800" },
      unknown: { label: "Unknown", color: "bg-gray-100 text-gray-600" },
    };

    return badges[intent] ?? badges.unknown;
  }
}

export { AutomationClientEngine as AutomationEngine };
