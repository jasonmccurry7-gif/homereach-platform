// ─────────────────────────────────────────────────────────────────────────────
// Leads — Facebook / external lead capture
//
// Tracks prospects before they become paying customers.
// Used for the Targeted Route Campaign product sold via Facebook ads.
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";

// ── Status pipeline ───────────────────────────────────────────────────────────
// new → contacted → intake_sent → intake_started → intake_complete
//     → paid → active → mailed → review_requested

export const leadStatusEnum = pgEnum("lead_status", [
  "new",
  "contacted",
  "intake_sent",
  "intake_started",
  "intake_complete",
  "paid",
  "active",
  "mailed",
  "review_requested",
]);

export const leadSourceEnum = pgEnum("lead_source", [
  "facebook",
  "web",
  "manual",
  "sms",
  "referral",
]);

// ── Table ─────────────────────────────────────────────────────────────────────

export const leads = pgTable("leads", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Contact info
  name:         text("name"),
  businessName: text("business_name"),
  phone:        text("phone"),
  email:        text("email"),

  // Where they came from
  source: leadSourceEnum("source").notNull().default("facebook"),

  // Pipeline stage
  status: leadStatusEnum("status").notNull().default("new"),

  // Geography (freeform — not tied to cities table for flexibility)
  city:  text("city"),

  // Notes from admin
  notes: text("notes"),

  // Unique token used in the intake link — prevents guessing
  // /targeted/intake?token=<intakeToken>
  intakeToken: uuid("intake_token").defaultRandom().unique(),

  // Timestamps for pipeline events
  intakeSentAt:        timestamp("intake_sent_at",        { withTimezone: true }),
  intakeSubmittedAt:   timestamp("intake_submitted_at",   { withTimezone: true }),
  paidAt:              timestamp("paid_at",               { withTimezone: true }),
  mailedAt:            timestamp("mailed_at",             { withTimezone: true }),
  reviewRequestedAt:   timestamp("review_requested_at",  { withTimezone: true }),

  // Review tracking
  reviewRequested: boolean("review_requested").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
