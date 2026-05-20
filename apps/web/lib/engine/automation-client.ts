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
      "Let's lock it in. Here's your intake link: {{intakeLink}}\n\nTakes about 3 minutes. I'll have your spot secured same day.",
      "Perfect. Sending your intake link now: {{intakeLink}}\n\nOnce you fill it out I'll confirm everything and lock in your {{category}} spot in {{city}}.",
    ],
  },
  {
    intent: "ready_to_buy",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nExcited to get this going. Here's your intake link to lock in your exclusive {{category}} spot in {{city}}:\n\n{{intakeLink}}\n\nTakes about 3 minutes. I'll confirm everything same day and you'll be set for your first mailing.\n\nTalk soon,\n{{ownerName}}",
    ],
  },
  {
    intent: "interested",
    channel: "sms",
    templates: [
      "Here's the deal: you get the exclusive {{category}} spot in {{city}}. No other {{category}} can advertise in that area. 2,500+ homeowners see your name every month.\n\nStarts at $299/mo. Want me to hold the spot while you look it over?",
      "Awesome. One business per category, per city. You'd be the only {{category}} on the postcard for {{city}}. Homeowners keep it on their fridge.\n\nPricing starts at $299/mo. Want the full breakdown?",
    ],
  },
  {
    intent: "interested",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nThanks for your interest. Here's how it works:\n\n- You get the exclusive {{category}} spot in {{city}} with no competitors allowed\n- 2,500+ homeowners receive the postcard every month\n- Starts at $299/month, no long-term contract required\n\nWant me to hold your spot while you review? I can send over the full details.\n\n{{ownerName}}",
    ],
  },
  {
    intent: "objection",
    channel: "sms",
    templates: [
      "Totally fair. Most clients think about it this way: one new customer from a postcard pays for 3+ months. No long-term contract either. Worth trying?",
      "Makes sense. Most clients break even on the first new customer they get. No long-term commitment, and your spot is exclusive while you're in. What's holding you back: timing, budget, or something else?",
    ],
  },
  {
    intent: "objection",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nCompletely understand the hesitation. Here's what I'd say:\n\n- No long-term contract. You can cancel after 3 months.\n- Most clients break even on their first new customer.\n- Your {{category}} spot in {{city}} is exclusive while you're in.\n\nWhat's the main concern? I'm happy to address it directly.\n\n{{ownerName}}",
    ],
  },
  {
    intent: "asking_questions",
    channel: "sms",
    templates: [
      "Great question. Short version: one spot per category, per city. Exclusive. 2,500+ homes/month. Starting at $299/mo, cancel anytime after 3 months. What else do you want to know?",
      "Happy to answer. Are you wondering about pricing, postcard design, tracking results, or something else?",
    ],
  },
  {
    intent: "asking_questions",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nHappy to answer your questions. Quick overview:\n\n- One business per category in {{city}}, fully exclusive\n- 2,500+ homeowners reached every month\n- Postcard design included\n- Starts at $299/mo, cancel after 3 months\n\nWhat else can I clarify for you?\n\n{{ownerName}}",
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
      "Hey {{firstName}}. Just checking in: still interested in the {{category}} spot in {{city}}? Happy to answer any questions.",
    ],
  },
  {
    intent: "unknown",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nJust wanted to follow up and see if you had any questions about the {{category}} opportunity in {{city}}. Happy to jump on a quick call too.\n\n{{ownerName}}",
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
    .replace(/{{ownerName}}/g, vars.ownerName ?? process.env.NEXT_PUBLIC_OWNER_NAME ?? "Jason McCurry");
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
