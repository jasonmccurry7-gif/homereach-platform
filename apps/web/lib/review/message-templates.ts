// ─────────────────────────────────────────────────────────────────────────────
// Review Message Templates
//
// Natural, conversational messages — NOT robotic or automated-sounding.
// Three variants per message type for rotation (prevents repetition).
// Use {{firstName}}, {{businessName}}, {{reviewLink}}, {{agentName}},
//     {{companyPhone}} as placeholders.
// ─────────────────────────────────────────────────────────────────────────────

import type { MessageTemplate, RenderedMessage, MessageType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Template Library
// ─────────────────────────────────────────────────────────────────────────────

export const MESSAGE_TEMPLATES: MessageTemplate[] = [

  // ──────────────────────────────────────────────────────────────────────────
  // SATISFACTION CHECK — SMS (3 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "satisfaction_check", channel: "sms", variantIdx: 0,
    body: "Hey {{firstName}}! Quick check-in — how's {{businessName}}'s campaign going? Happy with things so far? Just reply YES or NO 😊 — {{agentName}}",
  },
  {
    type: "satisfaction_check", channel: "sms", variantIdx: 1,
    body: "Hi {{firstName}}! It's {{agentName}} from HomeReach. Just checking in on your campaign — are you happy with how things are going? Reply YES or NO and I'll follow up 👋",
  },
  {
    type: "satisfaction_check", channel: "sms", variantIdx: 2,
    body: "{{firstName}}, hey! Your HomeReach postcard campaign is live — loving it so far? Quick reply: YES or NO. Want to make sure you're seeing results 🙌 — {{agentName}}",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // SATISFACTION CHECK — Email (3 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "satisfaction_check", channel: "email", variantIdx: 0,
    subject: "Quick check-in on your campaign, {{firstName}}",
    body: `Hi {{firstName}},

Just wanted to check in on {{businessName}}'s campaign — how are things going so far?

Are you happy with your experience with HomeReach?

Just hit reply with a quick YES or NO — takes two seconds and it really helps us make sure we're hitting the mark for you.

Talk soon,
{{agentName}}
HomeReach`,
  },
  {
    type: "satisfaction_check", channel: "email", variantIdx: 1,
    subject: "How's the campaign going, {{firstName}}?",
    body: `Hey {{firstName}},

Your postcard campaign for {{businessName}} is live and we're hoping you're seeing some great results!

Quick question: are you happy with your experience with HomeReach so far?

Reply YES or NO — we read every response personally and want to make sure you're getting value.

Thanks,
{{agentName}} | HomeReach`,
  },
  {
    type: "satisfaction_check", channel: "email", variantIdx: 2,
    subject: "{{firstName}}, loving your HomeReach campaign?",
    body: `Hi {{firstName}},

Quick one — how's {{businessName}}'s campaign feeling? We put a lot of care into getting these results right and would love to know it's working for you.

Happy so far? Just reply YES or NO.

{{agentName}}
HomeReach`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // REVIEW REQUEST — SMS (after positive check, 3 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "review_request", channel: "sms", variantIdx: 0,
    body: "So glad to hear it, {{firstName}}! 🙌 If you have 30 seconds, a quick Google review would mean the world to us — it helps other local businesses find us: {{reviewLink}} No pressure, and thank you! — {{agentName}}",
  },
  {
    type: "review_request", channel: "sms", variantIdx: 1,
    body: "That's awesome {{firstName}}! Would you mind sharing a quick review on Google? Even a sentence helps us a ton and only takes a minute: {{reviewLink}} 🙏 Thank you! — {{agentName}}",
  },
  {
    type: "review_request", channel: "sms", variantIdx: 2,
    body: "Love hearing that! Hey {{firstName}}, any chance you'd leave us a quick Google review? It genuinely helps small local businesses like {{businessName}} trust us: {{reviewLink}} — Thanks so much! {{agentName}}",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // REVIEW REQUEST — Email (3 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "review_request", channel: "email", variantIdx: 0,
    subject: "{{firstName}}, would you share a quick review? 🌟",
    body: `Hi {{firstName}},

So glad your experience with HomeReach has been a good one!

If you have 60 seconds, we'd love it if you could leave us a quick Google review. It makes a huge difference in helping other local businesses find us:

👉 {{reviewLink}}

It doesn't need to be long — even a few honest words means the world to us and the whole team.

Thank you so much,
{{agentName}}
HomeReach`,
  },
  {
    type: "review_request", channel: "email", variantIdx: 1,
    subject: "Would you help us reach more clients like {{businessName}}?",
    body: `Hey {{firstName}},

Glad things are going well with the campaign!

Here's a quick favor to ask: would you consider leaving us a review on Google? It takes less than a minute and genuinely helps us connect with more local businesses who need what we offer:

→ {{reviewLink}}

Your words carry a lot of weight — thank you for considering it!

{{agentName}} | HomeReach`,
  },
  {
    type: "review_request", channel: "email", variantIdx: 2,
    subject: "Loving your results? We'd love a review ⭐",
    body: `Hi {{firstName}},

We're thrilled your campaign is going well!

When you get a moment, would you mind sharing your experience on Google? Honest reviews from clients like {{businessName}} help us grow and keep improving:

{{reviewLink}}

Only takes a minute — no pressure either way. We appreciate you!

{{agentName}}
HomeReach`,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // REVIEW REMINDER — SMS (follow-up if no action, 2 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "review_reminder", channel: "sms", variantIdx: 0,
    body: "Hey {{firstName}}, just a gentle reminder — if you ever get a free minute, a quick review helps us a lot: {{reviewLink}} No worries if you're busy! — {{agentName}}",
  },
  {
    type: "review_reminder", channel: "sms", variantIdx: 1,
    body: "{{firstName}}! Last nudge, promise 😄 — if you're happy with HomeReach, a quick Google review would mean a lot: {{reviewLink}} Thank you! — {{agentName}}",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // NEGATIVE FEEDBACK ROUTE — SMS (after NO on satisfaction check, 2 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "negative_feedback_route", channel: "sms", variantIdx: 0,
    body: "Thanks for being honest, {{firstName}} — we genuinely want to make this right for {{businessName}}. Can you tell us what's not working? Reply here or call us at {{companyPhone}} and we'll fix it. — {{agentName}}",
  },
  {
    type: "negative_feedback_route", channel: "sms", variantIdx: 1,
    body: "We're sorry to hear that, {{firstName}} — your feedback matters. What can we do better for {{businessName}}? Feel free to reply here or reach us at {{companyPhone}}. We're listening. — {{agentName}}",
  },

  // ──────────────────────────────────────────────────────────────────────────
  // NEGATIVE FEEDBACK ROUTE — Email (2 variants)
  // ──────────────────────────────────────────────────────────────────────────

  {
    type: "negative_feedback_route", channel: "email", variantIdx: 0,
    subject: "We want to make this right, {{firstName}}",
    body: `Hi {{firstName}},

Thanks for being honest — that really matters to us.

We're sorry to hear things haven't been ideal for {{businessName}}. We take this seriously and want to make it right.

Could you take a minute to share what's not working or what we could do better? You can reply directly to this email or call us at {{companyPhone}} — we'll personally review your feedback and follow up.

We appreciate you giving us the chance to improve.

{{agentName}}
HomeReach`,
  },
  {
    type: "negative_feedback_route", channel: "email", variantIdx: 1,
    subject: "Your feedback is important to us, {{firstName}}",
    body: `Hey {{firstName}},

We're sorry your experience hasn't met expectations — we genuinely care about getting this right for {{businessName}}.

We'd love to understand what went wrong. Can you share any details about what we can improve? Reply to this email or reach us at {{companyPhone}} anytime.

Your feedback goes directly to our team and we take it seriously.

{{agentName}} | HomeReach`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Template Resolver
// ─────────────────────────────────────────────────────────────────────────────

export function getTemplate(
  type: MessageType,
  channel: "sms" | "email",
  variantIdx = 0
): MessageTemplate | undefined {
  const matches = MESSAGE_TEMPLATES.filter(
    (t) => t.type === type && t.channel === channel
  );
  if (matches.length === 0) return undefined;
  return matches[variantIdx % matches.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Message Renderer — fills placeholders with real values
// ─────────────────────────────────────────────────────────────────────────────

export interface MessageVars {
  firstName?:    string;
  businessName?: string;
  reviewLink?:   string;
  agentName?:    string;
  companyPhone?: string;
}

export function renderMessage(
  type: MessageType,
  channel: "sms" | "email",
  vars: MessageVars,
  variantIdx = 0
): RenderedMessage | null {
  const template = getTemplate(type, channel, variantIdx);
  if (!template) return null;

  function fill(str: string): string {
    return str
      .replace(/\{\{firstName\}\}/g,    vars.firstName    ?? "there")
      .replace(/\{\{businessName\}\}/g, vars.businessName ?? "your business")
      .replace(/\{\{reviewLink\}\}/g,   vars.reviewLink   ?? "[review link]")
      .replace(/\{\{agentName\}\}/g,    vars.agentName    ?? "The HomeReach Team")
      .replace(/\{\{companyPhone\}\}/g, vars.companyPhone ?? "(330) 867-4200");
  }

  return {
    body:    fill(template.body),
    subject: template.subject ? fill(template.subject) : undefined,
    channel,
  };
}

/** All available message types for admin preview */
export function getAllMessageTypes(): MessageType[] {
  return [
    "satisfaction_check",
    "review_request",
    "review_reminder",
    "negative_feedback_route",
  ];
}
