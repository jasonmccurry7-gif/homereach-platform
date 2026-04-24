// ─────────────────────────────────────────────────────────────────────────────
// Sales Execution System — leads + event tracking
// ─────────────────────────────────────────────────────────────────────────────

import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profiles } from "./users";
// Forward-reference only for the sales_events.political_campaign_id column
// added by migration 059. Lazy-referenced via `() => politicalCampaigns.id`
// so Drizzle's dependency graph stays acyclic.
import { politicalCampaigns } from "./political";

// ── Enums ─────────────────────────────────────────────────────────────────────

export const salesChannelEnum = pgEnum("sales_channel", [
  "sms",
  "email",
  "facebook",
  "call",
]);

export const salesActionTypeEnum = pgEnum("sales_action_type", [
  "lead_loaded",
  "lead_skipped",
  "message_sent",
  "email_sent",
  "text_sent",
  "facebook_sent",
  "reply_received",
  "conversation_started",
  "follow_up_sent",
  "payment_link_created",
  "deal_closed",
]);

export const salesLeadPriorityEnum = pgEnum("sales_lead_priority", [
  "low",
  "medium",
  "high",
]);

export const salesLeadStatusEnum = pgEnum("sales_lead_status", [
  "queued",
  "contacted",
  "replied",
  "interested",
  "payment_sent",
  "closed",
  "dead",
]);

// ── Tables ────────────────────────────────────────────────────────────────────

export const salesLeads = pgTable("sales_leads", {
  id:             uuid("id").primaryKey().defaultRandom(),
  externalId:     text("external_id"),
  businessName:   text("business_name").notNull(),
  contactName:    text("contact_name"),
  email:          text("email"),
  phone:          text("phone"),
  website:        text("website"),
  facebookUrl:    text("facebook_url"),
  address:        text("address"),
  city:           text("city"),
  state:          text("state").default("OH"),
  category:       text("category"),
  cityId:         integer("city_id"),
  categoryId:     integer("category_id"),
  score:          integer("score").default(0),
  priority:       salesLeadPriorityEnum("priority").default("medium"),
  rating:         numeric("rating", { precision: 3, scale: 1 }),
  reviewsCount:   integer("reviews_count").default(0),
  buyingSignal:   boolean("buying_signal").default(false),
  doNotContact:   boolean("do_not_contact").default(false),
  smsOptOut:      boolean("sms_opt_out").default(false),
  status:         salesLeadStatusEnum("status").default("queued"),
  notes:          text("notes"),
  lastContactedAt:    timestamp("last_contacted_at",  { withTimezone: true }),
  lastReplyAt:        timestamp("last_reply_at",      { withTimezone: true }),
  assignedAgentId:    uuid("assigned_agent_id").references(() => profiles.id),
  totalMessagesSent:  integer("total_messages_sent").default(0),
  totalReplies:       integer("total_replies").default(0),
  createdAt:  timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const salesEvents = pgTable("sales_events", {
  id:           uuid("id").primaryKey().defaultRandom(),
  agentId:      uuid("agent_id").references(() => profiles.id),
  leadId:       uuid("lead_id").references(() => salesLeads.id),
  actionType:   salesActionTypeEnum("action_type").notNull(),
  channel:      salesChannelEnum("channel"),
  city:         text("city"),
  category:     text("category"),
  message:      text("message"),
  revenueCents: integer("revenue_cents"),
  metadata:     jsonb("metadata").$type<Record<string, unknown>>().default({}),
  // Additive column from migration 059 — optional FK to political_campaigns
  // so the Political Command Center can reuse this activity log without
  // duplicating event infrastructure. Null for all non-political events.
  politicalCampaignId: uuid("political_campaign_id").references(
    () => politicalCampaigns.id,
    { onDelete: "set null" },
  ),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── Relations ─────────────────────────────────────────────────────────────────

export const salesLeadsRelations = relations(salesLeads, ({ many, one }) => ({
  events:        many(salesEvents),
  assignedAgent: one(profiles, {
    fields:     [salesLeads.assignedAgentId],
    references: [profiles.id],
  }),
}));

export const salesEventsRelations = relations(salesEvents, ({ one }) => ({
  lead: one(salesLeads, {
    fields:     [salesEvents.leadId],
    references: [salesLeads.id],
  }),
  agent: one(profiles, {
    fields:     [salesEvents.agentId],
    references: [profiles.id],
  }),
}));

// ── Types ─────────────────────────────────────────────────────────────────────

export type SalesLead  = typeof salesLeads.$inferSelect;
export type SalesEvent = typeof salesEvents.$inferSelect;
export type SalesLeadInsert  = typeof salesLeads.$inferInsert;
export type SalesEventInsert = typeof salesEvents.$inferInsert;
