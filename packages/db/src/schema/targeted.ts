// ─────────────────────────────────────────────────────────────────────────────
// Targeted Route Campaigns — HomeReach Targeted Direct Mail Product
//
// Separate from postcard bundle campaigns (marketing_campaigns).
// ~500 homes around a business address, starting at $400.
// We handle design, printing, postage, delivery.
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { leads } from "./leads";

// ── Status enums ──────────────────────────────────────────────────────────────

export const targetedCampaignStatusEnum = pgEnum("targeted_campaign_status", [
  "intake_complete",  // intake form submitted, not yet paid
  "paid",             // payment received
  "design_queued",    // ready for designer
  "design_in_progress",
  "design_ready",     // pending customer approval
  "approved",         // customer approved design
  "mailed",           // postcards sent
  "complete",         // campaign finished
  "cancelled",
]);

export const designStatusEnum = pgEnum("design_status", [
  "not_started",
  "queued",
  "in_progress",
  "ready",
  "approved",
]);

export const mailingStatusEnum = pgEnum("mailing_status", [
  "not_mailed",
  "scheduled",
  "mailed",
]);

// ── Table ─────────────────────────────────────────────────────────────────────

export const targetedRouteCampaigns = pgTable("targeted_route_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Link back to the lead that generated this campaign
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),

  // Campaign owner info (captured at intake — denormalized for resilience)
  businessName:    text("business_name").notNull(),
  contactName:     text("contact_name"),
  email:           text("email").notNull(),
  phone:           text("phone"),

  // Target area
  businessAddress:  text("business_address"),
  targetCity:       text("target_city"),
  targetAreaNotes:  text("target_area_notes"), // "Where do you want more customers?"

  // Campaign specs
  homesCount:  integer("homes_count").notNull().default(500),
  priceCents:  integer("price_cents").notNull().default(40000), // $400

  // Pipeline
  status:        targetedCampaignStatusEnum("status").notNull().default("intake_complete"),
  designStatus:  designStatusEnum("design_status").notNull().default("not_started"),
  mailingStatus: mailingStatusEnum("mailing_status").notNull().default("not_mailed"),

  // Review tracking
  reviewRequested:   boolean("review_requested").notNull().default(false),
  reviewRequestedAt: timestamp("review_requested_at", { withTimezone: true }),

  // Payment — Stripe identifiers
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId:   text("stripe_payment_intent_id"),

  // Admin notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
