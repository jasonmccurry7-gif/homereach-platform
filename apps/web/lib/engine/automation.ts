// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Automation Engine
//
// Multi-channel conversational automation.
// Detects intent, generates human-like responses, and persists conversations.
//
// Agent 5 — AI Communications
//
// Design:
//   • Static pure methods (detectIntent, generateResponse, etc.)
//   • Static async method (classifyIntentWithAI) — uses OpenAI when key is set
//   • Instance async methods (processInbound, sendAutoReply, etc.) — use repo
//
// Intent detection order:
//   1. If OPENAI_API_KEY is set: use GPT-4o-mini with structured output
//   2. Fallback: keyword matching (fast, no API cost)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  IntentType,
  DetectedIntent,
  ConversationContext,
  AutomationMessage,
  AutomationMode,
  MessageChannel,
} from "./types";
import type { IConversationRepository, UpsertConversationInput } from "./db/interfaces";
import { getConversationRepository } from "./db/factory";
import { getOwnerIdentity } from "@homereach/services/outreach";

// ── OpenAI (optional — loaded lazily if OPENAI_API_KEY is present) ─────────────
// Using dynamic import to avoid breaking the build when openai package isn't
// installed in development. Add OPENAI_API_KEY to .env.local to enable.
let _openaiClient: import("openai").OpenAI | null = null;

async function getOpenAIClient(): Promise<import("openai").OpenAI | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  if (_openaiClient) return _openaiClient;

  try {
    const { default: OpenAI } = await import("openai");
    _openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    return _openaiClient;
  } catch {
    console.warn("[automation] openai package not installed — falling back to keyword detection");
    return null;
  }
}

const INTENT_CLASSIFICATION_PROMPT = `You are an intent classifier for HomeReach, a local direct mail marketing company.

Classify the following inbound SMS or email reply into exactly ONE of these 5 intents:
- ready_to_buy     : clearly wants to proceed, sign up, or get the intake link
- interested       : curious, wants more info, or asking about pricing/details
- objection        : hesitant, thinks it's too expensive, not sure, needs to think
- asking_questions : has specific questions about how it works, areas, cancellation, etc.
- not_interested   : explicitly doesn't want to continue, asks to stop

Respond with ONLY a JSON object with two fields:
  intent: (one of the 5 values above)
  confidence: (0.0 to 1.0)

Example: {"intent":"interested","confidence":0.92}`;

// ── Intent Detection Config ───────────────────────────────────────────────────
// TODO: Replace with OpenAI intent classification in production

interface IntentRule {
  type: IntentType;
  keywords: string[];
  weight: number;
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

// ── Response Templates ────────────────────────────────────────────────────────
// All responses are short, natural, and conversational.
// Placeholders: {{firstName}}, {{city}}, {{category}}, {{intakeLink}}
// TODO: Extend with A/B variants per template for performance tracking.

interface ResponseTemplate {
  intent: IntentType;
  channel: MessageChannel;
  templates: string[];
}

const RESPONSE_TEMPLATES: ResponseTemplate[] = [
  // ── ready_to_buy ────────────────────────────────────────────────────────────
  {
    intent: "ready_to_buy",
    channel: "sms",
    templates: [
      "Let's lock it in! Here's your intake link: {{intakeLink}}\n\nTakes about 3 minutes. I'll have your spot secured same day. 🎯",
      "Perfect — sending your intake link now: {{intakeLink}}\n\nOnce you fill it out I'll confirm everything and lock in your {{category}} spot in {{city}}.",
    ],
  },
  {
    intent: "ready_to_buy",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nExcited to get this going! Here's your intake link to lock in your exclusive {{category}} spot in {{city}}:\n\n{{intakeLink}}\n\nTakes about 3 minutes. I'll confirm everything same day and you'll be set for your first mailing.\n\nTalk soon,\n{{ownerName}}",
    ],
  },

  // ── interested ──────────────────────────────────────────────────────────────
  {
    intent: "interested",
    channel: "sms",
    templates: [
      "Here's the deal — you get the exclusive {{category}} spot in {{city}}. No other {{category}} can advertise in that area. 2,500+ homeowners see your name every month.\n\nStarts at $299/mo. Want me to hold the spot while you look it over?",
      "Awesome! So it's pretty simple — one business per category, per city. You'd be the only {{category}} on the postcard for {{city}}. Homeowners keep it on their fridge.\n\nPricing starts at $299/mo. Want the full breakdown?",
    ],
  },
  {
    intent: "interested",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nThanks for your interest! Here's how it works:\n\n• You get the exclusive {{category}} spot in {{city}} — no competitors allowed\n• 2,500+ homeowners receive the postcard every month\n• Starts at $299/month, no long-term contract required\n\nWant me to hold your spot while you review? I can send over the full details.\n\n{{ownerName}}",
    ],
  },

  // ── objection ───────────────────────────────────────────────────────────────
  {
    intent: "objection",
    channel: "sms",
    templates: [
      "Totally fair — I get it. Here's how most of our clients think about it: one new customer from a postcard pays for 3+ months. Most see their first call within 2–3 weeks.\n\nNo contract either — you can cancel after 3 months if it's not working. Worth trying?",
      "Makes sense. What if I told you most clients break even on the first new customer they get? No long-term commitment, and your spot is exclusive while you're in.\n\nWhat's holding you back — is it timing, budget, or something else?",
    ],
  },
  {
    intent: "objection",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nCompletely understand the hesitation — here's what I'd say:\n\n• No long-term contract. You can cancel after 3 months.\n• Most clients break even on their first new customer.\n• Your {{category}} spot in {{city}} is exclusive while you're in — no competitors.\n\nWhat's the main concern? I'm happy to address it directly.\n\n{{ownerName}}",
    ],
  },

  // ── asking_questions ────────────────────────────────────────────────────────
  {
    intent: "asking_questions",
    channel: "sms",
    templates: [
      "Great question. Here's the short version: one spot per category, per city. Exclusive. 2,500+ homes/month. Starting at $299/mo, cancel anytime after 3 months.\n\nWhat else do you want to know?",
      "Happy to answer! What specifically are you wondering about — the pricing, the postcard design, how we track results, or something else?",
    ],
  },
  {
    intent: "asking_questions",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nHappy to answer your questions! Quick overview:\n\n• One business per category in {{city}} — fully exclusive\n• 2,500+ homeowners reached every month\n• Postcard design included, no design experience needed\n• Starts at $299/mo, cancel after 3 months\n\nWhat else can I clarify for you?\n\n{{ownerName}}",
    ],
  },

  // ── not_interested ──────────────────────────────────────────────────────────
  {
    intent: "not_interested",
    channel: "sms",
    templates: [
      "No problem at all, {{firstName}}! I'll take you off the list. If you ever want to revisit the {{city}} area, just shoot me a text. Take care! 👋",
    ],
  },
  {
    intent: "not_interested",
    channel: "email",
    templates: [
      "Hi {{firstName}},\n\nAbsolutely no problem — I'll remove you from our list right away. If you ever want to revisit the {{category}} spot in {{city}}, just reach out.\n\nTake care,\n{{ownerName}}",
    ],
  },

  // ── unknown (fallback) ──────────────────────────────────────────────────────
  {
    intent: "unknown",
    channel: "sms",
    templates: [
      "Hey {{firstName}}! Just checking in — still interested in the {{category}} spot in {{city}}? Happy to answer any questions.",
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

// ─────────────────────────────────────────────────────────────────────────────
// DailyRateLimiter
//
// In-process rate limiter. Tracks sends per contact per calendar day.
// For multi-instance deployments, swap _store for a Redis client.
// ─────────────────────────────────────────────────────────────────────────────

class DailyRateLimiter {
  private _store = new Map<string, number[]>();

  constructor(private readonly maxPerDay: number) {}

  /** Returns true if the contact has hit the daily limit. */
  check(key: string): boolean {
    const today = new Date().toISOString().slice(0, 10); // "2026-04-11"
    const sends = (this._store.get(key) ?? []).filter(
      (ts) => new Date(ts).toISOString().slice(0, 10) === today
    );
    return sends.length >= this.maxPerDay;
  }

  /** Record a send event for the contact. */
  record(key: string): void {
    const now = Date.now();
    const existing = this._store.get(key) ?? [];
    // Keep only last 7 days to prevent unbounded memory growth
    const cutoff = now - 7 * 24 * 60 * 60 * 1000;
    this._store.set(key, [...existing.filter((ts) => ts > cutoff), now]);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EmailPauseGuard
//
// Tracks email delivery metrics and auto-pauses the engine when:
//   • Bounce rate > 5%  (over last 100 sends)
//   • Spam rate   > 0.1% (over last 1000 sends)
//
// In production: hook into Mailgun webhooks to feed real bounce/spam events.
// ─────────────────────────────────────────────────────────────────────────────

class EmailPauseGuard {
  private _sent  = 0;
  private _bounces = 0;
  private _spams   = 0;

  // Thresholds
  private readonly BOUNCE_RATE_THRESHOLD = 0.05;   // 5%
  private readonly SPAM_RATE_THRESHOLD   = 0.001;  // 0.1%
  private readonly MIN_SAMPLE_SIZE       = 20;     // don't pause before 20 sends

  recordSent():   void { this._sent++;    }
  recordBounce(): void { this._bounces++; }
  recordSpam():   void { this._spams++;   }

  isPaused(): "bounce" | "spam" | null {
    if (this._sent < this.MIN_SAMPLE_SIZE) return null;
    if (this._bounces / this._sent > this.BOUNCE_RATE_THRESHOLD) return "bounce";
    if (this._spams   / this._sent > this.SPAM_RATE_THRESHOLD)   return "spam";
    return null;
  }

  getStatus(): null | { reason: string; bounceRate: number; spamRate: number } {
    const paused = this.isPaused();
    if (!paused) return null;
    return {
      reason:     paused === "bounce" ? "Bounce rate exceeded 5%" : "Spam rate exceeded 0.1%",
      bounceRate: this._sent > 0 ? this._bounces / this._sent : 0,
      spamRate:   this._sent > 0 ? this._spams   / this._sent : 0,
    };
  }

  reset(): void { this._sent = 0; this._bounces = 0; this._spams = 0; }
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class AutomationEngine {
  private repo: IConversationRepository;

  constructor(repo?: IConversationRepository) {
    this.repo = repo ?? getConversationRepository();
  }

  // ── Instance methods (async, repo-backed) ─────────────────────────────────

  /**
   * Persist an inbound message, update intent, and optionally auto-reply.
   * Returns the saved message and a suggested auto-reply body (if applicable).
   *
   * AI reply generation uses FULL conversation history so replies are contextual
   * and avoid repeating information already covered in the thread.
   */
  async processInbound(
    conversationId: string,
    body: string,
    channel: MessageChannel,
    sentAt?: string
  ): Promise<{ message: AutomationMessage; autoReply?: string }> {
    // Fetch conversation BEFORE saving (to get prior history for AI context)
    const ctxBefore = await this.repo.getById(conversationId).catch(() => null);

    // Try OpenAI first; fall back to keyword detection
    const detected = await AutomationEngine.classifyIntentWithAI(body)
      ?? AutomationEngine.detectIntent(body);

    // Save the inbound message
    const message = await this.repo.addMessage(conversationId, {
      direction: "inbound",
      channel,
      body,
      intent: detected.type,
      isAutoGenerated: false,
      sentAt,
    });

    // Persist detected intent on the conversation
    await this.repo.setLastIntent(conversationId, detected.type);

    // Fetch full updated conversation (with new message) for AI reply
    const ctx = await this.repo.getById(conversationId);
    let autoReply: string | undefined;

    if (ctx?.automationMode === "auto") {
      const firstName = ctx.leadName?.split(" ")[0] ?? "";

      // Try AI-powered contextual reply using full history first
      const contextualReply = await AutomationEngine._generateContextualReply(
        detected.type,
        channel,
        body,
        ctx.messages,
        { firstName, city: ctx.city ?? "", category: ctx.category ?? "" }
      );
      autoReply = contextualReply ?? undefined;

      // Fallback to template if AI fails
      if (!autoReply) {
        autoReply = AutomationEngine.generateResponse(detected.type, channel, {
          firstName,
          city:       ctx.city ?? "",
          category:   ctx.category ?? "",
        });
      }
    }

    void ctxBefore; // suppress unused variable warning

    return { message, autoReply };
  }

  /**
   * Persist an outbound message (manual reply or auto-generated).
   */
  async sendReply(
    conversationId: string,
    body: string,
    channel: MessageChannel,
    isAutoGenerated = false
  ): Promise<AutomationMessage> {
    return this.repo.addMessage(conversationId, {
      direction: "outbound",
      channel,
      body,
      isAutoGenerated,
    });
  }

  /**
   * Create or update a conversation record.
   */
  async upsertConversation(input: UpsertConversationInput): Promise<ConversationContext> {
    return this.repo.upsert(input);
  }

  /** Fetch a single conversation by ID. */
  async getConversation(conversationId: string): Promise<ConversationContext | null> {
    return this.repo.getById(conversationId);
  }

  /** Fetch all conversations, sorted newest-message first. */
  async getAllConversations(): Promise<ConversationContext[]> {
    return this.repo.getAll();
  }

  /** Fetch all conversations for a lead. */
  async getConversationsByLead(leadId: string): Promise<ConversationContext[]> {
    return this.repo.getByLeadId(leadId);
  }

  /** Toggle automation mode for a conversation. */
  async setAutomationMode(conversationId: string, mode: AutomationMode): Promise<void> {
    return this.repo.setAutomationMode(conversationId, mode);
  }

  /** Mark all inbound messages in a conversation as read. */
  async markRead(conversationId: string): Promise<void> {
    return this.repo.markRead(conversationId);
  }

  /** Total unread inbound message count across all conversations. */
  async getUnreadCount(): Promise<number> {
    return this.repo.getUnreadCount();
  }

  // ── Static pure methods (sync, no repo) ──────────────────────────────────

  /**
   * Classify intent using OpenAI GPT-4o-mini.
   * Returns null if OPENAI_API_KEY is not set or call fails (triggers keyword fallback).
   * Uses structured JSON output for reliable parsing.
   */
  static async classifyIntentWithAI(messageBody: string): Promise<DetectedIntent | null> {
    try {
      const client = await getOpenAIClient();
      if (!client) return null;

      const completion = await client.chat.completions.create({
        model:       "gpt-4o-mini",
        messages: [
          { role: "system", content: INTENT_CLASSIFICATION_PROMPT },
          { role: "user",   content: messageBody.slice(0, 500) }, // cap at 500 chars
        ],
        max_tokens:  80,
        temperature: 0.1, // low temp for consistency
        response_format: { type: "json_object" },
      });

      const raw = completion.choices[0]?.message?.content ?? "";
      const parsed = JSON.parse(raw) as { intent: IntentType; confidence: number };

      const validIntents: IntentType[] = [
        "ready_to_buy", "interested", "objection", "asking_questions", "not_interested",
      ];
      if (!validIntents.includes(parsed.intent)) return null;

      return {
        type:       parsed.intent,
        confidence: Math.min(1, Math.max(0, parsed.confidence ?? 0.8)),
        keywords:   [], // AI doesn't return keywords
        suggestedResponse: AutomationEngine.getTemplateResponse(parsed.intent, "sms", {
          firstName:  "",
          city:       "",
          category:   "",
          intakeLink: (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/get-started",
        }),
      };
    } catch (err) {
      console.error("[automation] OpenAI classification failed, using keyword fallback:", err);
      return null;
    }
  }

  /**
   * Keyword-based intent detection — fast fallback when OpenAI is unavailable.
   * Used when OPENAI_API_KEY is not set or the API call fails.
   */
  static detectIntent(messageBody: string): DetectedIntent {
    const lower = messageBody.toLowerCase();
    let topMatch: IntentRule | null = null;
    let topScore = 0;
    const matchedKeywords: string[] = [];

    for (const rule of INTENT_RULES) {
      const hits = rule.keywords.filter((kw) => lower.includes(kw));
      if (hits.length > 0) {
        const score = hits.length * rule.weight;
        if (score > topScore) {
          topScore = score;
          topMatch = rule;
          matchedKeywords.splice(0, matchedKeywords.length, ...hits);
        }
      }
    }

    const intent: IntentType = topMatch?.type ?? "unknown";
    const confidence = topScore > 0 ? Math.min(1, topScore / 20) : 0.1;

    return {
      type: intent,
      confidence,
      keywords: matchedKeywords,
      suggestedResponse: AutomationEngine.getTemplateResponse(intent, "sms", {
        firstName: "",
        city: "",
        category: "",
        intakeLink: (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/get-started",
      }),
    };
  }

  /**
   * Generate a personalized response from a template.
   */
  static generateResponse(
    intent: IntentType,
    channel: MessageChannel,
    vars: {
      firstName: string;
      city: string;
      category: string;
      intakeLink?: string;
    }
  ): string {
    const link = vars.intakeLink ?? (process.env.NEXT_PUBLIC_APP_URL ?? "") + "/get-started";
    return AutomationEngine.getTemplateResponse(intent, channel, { ...vars, intakeLink: link });
  }

  /**
   * Decide whether to hand off a conversation to a human.
   * Triggers when: ready_to_buy, not_interested, or 5+ auto outbound messages.
   */
  static shouldHandoff(ctx: ConversationContext): boolean {
    if (ctx.lastIntent === "ready_to_buy")   return true;
    if (ctx.lastIntent === "not_interested") return true;
    const outboundCount = ctx.messages.filter(
      (m) => m.direction === "outbound" && m.isAutoGenerated
    ).length;
    return outboundCount >= 5;
  }

  /**
   * Whether the intake link should be triggered (ready_to_buy and not already sent).
   */
  static shouldTriggerIntake(ctx: ConversationContext): boolean {
    return (
      ctx.lastIntent === "ready_to_buy" &&
      !ctx.messages.some((m) => m.body.includes("/get-started"))
    );
  }

  /**
   * Lead scoring — returns a numeric score based on conversation signals.
   *
   * Scoring rules (from ops directive):
   *   +20  any inbound reply
   *   +30  price-related ask (asking_questions with price keywords)
   *   +15  click (intake link sent implies interest click)
   *   -10  no response after outbound (outbound with no follow-up inbound)
   *
   * Score ranges:
   *   0–29   Cold
   *   30–59  Warm
   *   60–89  Hot
   *   90+    On Fire 🔥
   */
  static scoreConversation(ctx: ConversationContext): number {
    let score = 0;

    const inbound  = ctx.messages.filter((m) => m.direction === "inbound");
    const outbound = ctx.messages.filter((m) => m.direction === "outbound");

    // +20 per inbound reply (capped at 4 to prevent score inflation)
    score += Math.min(inbound.length, 4) * 20;

    // +30 if any message suggests price interest
    const priceKeywords = ["price", "cost", "how much", "pricing", "rate", "fee", "charge", "pay", "afford"];
    const hasPriceAsk = inbound.some((m) =>
      priceKeywords.some((kw) => m.body.toLowerCase().includes(kw))
    );
    if (hasPriceAsk) score += 30;

    // +15 if intake link was triggered (ready_to_buy signal)
    const intakeSent = outbound.some((m) => m.body.includes("/targeted") || m.body.includes("intake") || m.body.includes("get-started"));
    if (intakeSent) score += 15;

    // -10 if last message was outbound with no inbound since (unresponded follow-up)
    if (outbound.length > 0 && inbound.length === 0) {
      score -= 10;
    } else if (outbound.length > 0 && inbound.length > 0) {
      const lastOut = outbound[outbound.length - 1];
      const lastIn  = inbound[inbound.length - 1];
      if (lastOut && lastIn && lastOut.sentAt > lastIn.sentAt) {
        score -= 10; // Outbound sent after last inbound = no response yet
      }
    }

    // Boost for ready_to_buy intent
    if (ctx.lastIntent === "ready_to_buy")   score += 20;
    if (ctx.lastIntent === "interested")     score += 10;
    if (ctx.lastIntent === "not_interested") score = Math.min(score, 10);

    return Math.max(0, score);
  }

  /** Get a score badge for display */
  static getScoreBadge(score: number): { label: string; color: string; emoji: string } {
    if (score >= 90) return { label: "On Fire",  color: "bg-red-100 text-red-800 border-red-200",       emoji: "🔥" };
    if (score >= 60) return { label: "Hot",      color: "bg-orange-100 text-orange-800 border-orange-200", emoji: "♨️" };
    if (score >= 30) return { label: "Warm",     color: "bg-yellow-100 text-yellow-800 border-yellow-200", emoji: "🌡" };
    return                   { label: "Cold",    color: "bg-gray-100 text-gray-600 border-gray-200",     emoji: "❄️" };
  }

  /** Intent badge label + Tailwind color class for UI display */
  static getIntentBadge(intent: IntentType): { label: string; color: string } {
    const BADGES: Record<IntentType, { label: string; color: string }> = {
      ready_to_buy:     { label: "🟢 Ready to buy",  color: "bg-green-100 text-green-800" },
      interested:       { label: "🔵 Interested",     color: "bg-blue-100 text-blue-800" },
      asking_questions: { label: "🟡 Has questions",  color: "bg-yellow-100 text-yellow-800" },
      objection:        { label: "🟠 Has objection",  color: "bg-orange-100 text-orange-800" },
      not_interested:   { label: "🔴 Not interested", color: "bg-red-100 text-red-800" },
      unknown:          { label: "⚪ Unknown",         color: "bg-gray-100 text-gray-600" },
    };
    return BADGES[intent] ?? BADGES.unknown;
  }

  /**
   * Send SMS via Twilio (real send).
   *
   * Guards:
   *   1. Opt-out check — contact must NOT have optedOut=true in DB
   *   2. Rate limiting  — max 5 auto SMS/day per number (configurable)
   *
   * Compliance:
   *   • Appends "Reply STOP to opt out." footer to every outbound SMS if not
   *     already present. Required for TCPA / carrier compliance.
   */
  static async sendSms(
    to: string,
    body: string,
    opts: { skipOptOutCheck?: boolean; skipRateLimit?: boolean; skipStopFooter?: boolean } = {}
  ): Promise<{ success: boolean; sid?: string; blocked?: "opted_out" | "rate_limit" }> {
    try {
      // ── 1. Opt-out enforcement ──────────────────────────────────────────────
      if (!opts.skipOptOutCheck) {
        const isOptedOut = await AutomationEngine._checkSmsOptOut(to);
        if (isOptedOut) {
          console.warn(`[AutomationEngine] SMS blocked — ${to} has opted out`);
          return { success: false, blocked: "opted_out" };
        }
      }

      // ── 2. Rate limiting ────────────────────────────────────────────────────
      if (!opts.skipRateLimit) {
        const blocked = AutomationEngine._smsRateLimiter.check(to);
        if (blocked) {
          console.warn(`[AutomationEngine] SMS blocked — rate limit reached for ${to}`);
          return { success: false, blocked: "rate_limit" };
        }
        AutomationEngine._smsRateLimiter.record(to);
      }

      const { appendSmsCompliance, sendSms } = await import("@homereach/services/outreach");
      const finalBody = opts.skipStopFooter ? body : appendSmsCompliance(body);
      const result = await sendSms({ to, body: finalBody, intent: "follow_up" });
      if (!result.success) {
        console.error(`[AutomationEngine] SMS to ${to} failed: ${result.error}`);
      }
      return { success: result.success, sid: result.externalId };
    } catch (err) {
      console.error("[AutomationEngine] sendSms error:", err);
      return { success: false };
    }
  }

  /**
   * Send email via Mailgun (real send).
   *
   * Guards:
   *   1. Rate limiting   — max 3 auto emails/day per address
   *   2. Bounce pausing  — auto-pause if bounce rate for this domain > 5%
   *   3. Spam pausing    — auto-pause if spam flag rate > 0.1%
   */
  static async sendEmail(
    to: string,
    subject: string,
    body: string,
    opts: { skipRateLimit?: boolean; skipBounceCheck?: boolean } = {}
  ): Promise<{ success: boolean; id?: string; blocked?: "rate_limit" | "bounce_paused" | "spam_paused" }> {
    try {
      // ── 1. Rate limiting ─────────────────────────────────────────────────────
      if (!opts.skipRateLimit) {
        const blocked = AutomationEngine._emailRateLimiter.check(to);
        if (blocked) {
          console.warn(`[AutomationEngine] Email blocked — rate limit reached for ${to}`);
          return { success: false, blocked: "rate_limit" };
        }
        AutomationEngine._emailRateLimiter.record(to);
      }

      // ── 2. Bounce / spam auto-pause check ────────────────────────────────────
      if (!opts.skipBounceCheck) {
        const paused = AutomationEngine._emailPauseGuard.isPaused();
        if (paused === "bounce") {
          console.warn(`[AutomationEngine] Email paused — bounce rate threshold exceeded`);
          return { success: false, blocked: "bounce_paused" };
        }
        if (paused === "spam") {
          console.warn(`[AutomationEngine] Email paused — spam rate threshold exceeded`);
          return { success: false, blocked: "spam_paused" };
        }
      }

      const {
        appendEmailComplianceHtml,
        appendEmailComplianceText,
        getDefaultEmailIdentity,
        sendEmail,
      } = await import("@homereach/services/outreach");
      const emailIdentity = getDefaultEmailIdentity();
      const result = await sendEmail({
        to,
        subject,
        html: appendEmailComplianceHtml(`<p>${body.replace(/\n/g, "<br/>")}</p>`, to),
        text: appendEmailComplianceText(body, to),
        fromEmail: emailIdentity.fromEmail,
        fromName: emailIdentity.fromName,
        replyTo: emailIdentity.replyTo,
        intent: "follow_up",
      });

      // Track delivery metrics for auto-pause logic
      if (result.success) {
        AutomationEngine._emailPauseGuard.recordSent();
      } else {
        AutomationEngine._emailPauseGuard.recordBounce();
        console.error(`[AutomationEngine] Email to ${to} failed: ${result.error}`);
      }

      return { success: result.success, id: result.externalId };
    } catch (err) {
      console.error("[AutomationEngine] sendEmail error:", err);
      return { success: false };
    }
  }

  /**
   * Record a spam complaint — called from webhook handler when a user
   * marks an email as spam. Feeds into the auto-pause guard.
   */
  static recordSpamComplaint(): void {
    AutomationEngine._emailPauseGuard.recordSpam();
  }

  /**
   * Check current email pause status.
   * Returns null if not paused, or a string describing the pause reason.
   */
  static getEmailPauseStatus(): null | { reason: string; bounceRate: number; spamRate: number } {
    return AutomationEngine._emailPauseGuard.getStatus();
  }

  // ── Rate limiters (in-process; upgrade to Redis for multi-instance) ─────────

  /** SMS: max 5 messages per phone number per day */
  private static _smsRateLimiter = new DailyRateLimiter(5);

  /** Email: max 3 messages per address per day */
  private static _emailRateLimiter = new DailyRateLimiter(3);

  /** Email auto-pause guard — pauses sends when bounce/spam rate crosses threshold */
  private static _emailPauseGuard = new EmailPauseGuard();

  /** Check if a phone number has opted out via Twilio STOP keyword */
  private static async _checkSmsOptOut(phone: string): Promise<boolean> {
    try {
      const { db, outreachContacts } = await import("@homereach/db");
      const { eq } = await import("drizzle-orm");
      const [contact] = await db
        .select({ optedOut: outreachContacts.optedOut })
        .from(outreachContacts)
        .where(eq(outreachContacts.phone, phone))
        .limit(1);
      return contact?.optedOut === true;
    } catch {
      // If DB check fails, allow send (fail open is safer than silently blocking)
      return false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Generate a contextual AI reply using the FULL conversation history.
   * Falls back to null if OpenAI is unavailable, so caller uses template.
   */
  private static async _generateContextualReply(
    intent:   IntentType,
    channel:  MessageChannel,
    latestMsg: string,
    history:  AutomationMessage[],
    vars:     { firstName: string; city: string; category: string }
  ): Promise<string | null> {
    try {
      const client = await getOpenAIClient();
      if (!client) return null;

      // Build conversation history for GPT context
      const historyText = history
        .slice(-10) // last 10 messages for context window efficiency
        .map((m) => `${m.direction === "inbound" ? "Lead" : "HomeReach"}: ${m.body}`)
        .join("\n");

      const systemPrompt = `You are a friendly, brief sales rep for HomeReach — a local direct mail postcard company.
Business context:
  - Lead: ${vars.firstName || "a business owner"} in ${vars.city || "their city"}, category: ${vars.category || "their trade"}
  - HomeReach sends postcards to 2,500+ targeted homeowners, exclusive per category
  - Starting at $299/mo, no long-term contract required

Respond to the latest message naturally and briefly (1–3 sentences max).
Use the conversation history to avoid repeating yourself.
Intent classification: ${intent}
If intent is not_interested, politely acknowledge and offer to remove them.
If intent is ready_to_buy, send the intake link: ${process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com"}/get-started
Channel: ${channel} — keep SMS replies under 160 characters when possible.
Do NOT add a sign-off or signature.`;

      const completion = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system",    content: systemPrompt },
          { role: "user",      content: `Conversation history:\n${historyText}\n\nLatest message from lead: "${latestMsg}"\n\nReply now:` },
        ],
        max_tokens:  200,
        temperature: 0.7,
      });

      const reply = completion.choices[0]?.message?.content?.trim();
      return reply || null;
    } catch {
      return null; // caller falls back to template
    }
  }

  private static getTemplateResponse(
    intent: IntentType,
    channel: MessageChannel,
    vars: { firstName: string; city: string; category: string; intakeLink: string }
  ): string {
    const match =
      RESPONSE_TEMPLATES.find((t) => t.intent === intent && t.channel === channel) ??
      RESPONSE_TEMPLATES.find((t) => t.intent === "unknown" && t.channel === channel);

    if (!match) return "Hey — just following up! Let me know if you have any questions.";

    const template =
      match.templates[Math.floor(Math.random() * match.templates.length)] ??
      "Hey {{firstName}} - just following up. Let me know if you have any questions.";
    const owner = getOwnerIdentity();
    return template
      .replace(/\{\{firstName\}\}/g, vars.firstName)
      .replace(/\{\{city\}\}/g,      vars.city)
      .replace(/\{\{category\}\}/g,  vars.category)
      .replace(/\{\{intakeLink\}\}/g, vars.intakeLink)
      .replace(/\{\{ownerName\}\}/g, owner.name)
      .replace(/\{\{ownerCellPhone\}\}/g, owner.cellPhone)
      .replace(/\{\{ownerPersonalEmail\}\}/g, owner.personalEmail)
      .replace(/\{\{ownerSecondaryEmail\}\}/g, owner.secondaryEmail)
      .replace(/\{\{ownerDomainEmail\}\}/g, owner.domainEmail);
  }
}
