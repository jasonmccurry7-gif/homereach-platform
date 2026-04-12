// ─────────────────────────────────────────────────────────────────────────────
// Growth — Daily outbound sales activity tracking
//
// One row per day per channel. Used by /admin/growth to compare
// expected vs actual performance and generate daily optimization reports.
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable,
  uuid,
  text,
  integer,
  date,
  timestamp,
  pgEnum,
  unique,
} from "drizzle-orm/pg-core";

// ── Channel enum ──────────────────────────────────────────────────────────────

export const growthChannelEnum = pgEnum("growth_channel", [
  "email",
  "sms",
  "facebook_dm",
  "facebook_post",
  "facebook_ads",
]);

// ── Table ─────────────────────────────────────────────────────────────────────

export const growthActivityLogs = pgTable(
  "growth_activity_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Which day this log covers
    date: date("date").notNull(),

    // Which channel
    channel: growthChannelEnum("channel").notNull(),

    // Activity inputs
    // email/sms/facebook_dm: messages sent
    // facebook_post: posts published
    // facebook_ads: set to 1; use adSpendCents for the real metric
    volumeSent: integer("volume_sent").notNull().default(0),

    // Only used for facebook_ads (in cents)
    adSpendCents: integer("ad_spend_cents").notNull().default(0),

    // Responses received (replies for email/sms/dm, leads for posts/ads)
    responses: integer("responses").notNull().default(0),

    // Qualified conversations that started from this channel on this day
    conversationsStarted: integer("conversations_started").notNull().default(0),

    // Deals closed attributed to this channel on this day
    dealsClosed: integer("deals_closed").notNull().default(0),

    // Optional notes
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    // One row per (date, channel) combination
    uniqueDateChannel: unique().on(table.date, table.channel),
  })
);

export type GrowthActivityLog      = typeof growthActivityLogs.$inferSelect;
export type NewGrowthActivityLog   = typeof growthActivityLogs.$inferInsert;
export type GrowthChannel          = (typeof growthChannelEnum.enumValues)[number];

// ── Benchmarks ────────────────────────────────────────────────────────────────
// Source of truth for expected performance targets.
// Referenced by both the admin dashboard and the daily report generator.

export const CHANNEL_BENCHMARKS = {
  email: {
    label:             "Email",
    emoji:             "📧",
    volumeTarget:      50,
    responseRateLow:   0.03,
    responseRateHigh:  0.08,
    responseLabel:     "Replies",
    metricLabel:       "Emails sent",
  },
  sms: {
    label:             "SMS",
    emoji:             "📱",
    volumeTarget:      30,
    responseRateLow:   0.10,
    responseRateHigh:  0.25,
    responseLabel:     "Replies",
    metricLabel:       "SMS sent",
  },
  facebook_dm: {
    label:             "Facebook DM",
    emoji:             "💬",
    volumeTarget:      50,
    responseRateLow:   0.15,
    responseRateHigh:  0.35,
    responseLabel:     "Replies",
    metricLabel:       "DMs sent",
  },
  facebook_post: {
    label:             "Facebook Posts",
    emoji:             "📢",
    volumeTarget:      15,           // middle of 10–20 range
    responseRateLow:   0.05,
    responseRateHigh:  0.15,
    responseLabel:     "Leads",
    metricLabel:       "Posts made",
    leadsLow:          5,
    leadsHigh:         15,
  },
  facebook_ads: {
    label:             "Facebook Ads",
    emoji:             "📣",
    volumeTarget:      1,            // 1 "campaign" per day
    adSpendTargetCents: 5000,        // $50/day
    responseRateLow:   0,            // N/A — use leads/$ instead
    responseRateHigh:  0,
    responseLabel:     "Leads",
    metricLabel:       "Ad spend",
    leadsPerDayLow:    3,
    leadsPerDayHigh:   10,
  },
} as const satisfies Record<GrowthChannel, object>;

export const GROWTH_TARGETS = {
  conversationsPerDayLow:  15,
  conversationsPerDayHigh: 30,
  dealsPerDayLow:          3,
  dealsPerDayHigh:         6,
  citiesTarget:            12,
  cityFillWeeks:           4,
} as const;
