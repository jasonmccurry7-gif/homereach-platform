import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const outreachChannelEnum = pgEnum("outreach_channel", ["sms", "email"]);

export const campaignTypeEnum = pgEnum("campaign_type", [
  "sms",
  "email",
  "both",
]);

export const campaignStatusEnum = pgEnum("campaign_status", [
  "draft",
  "scheduled",
  "sending",
  "sent",
  "paused",
  "cancelled",
]);

export const messageStatusEnum = pgEnum("message_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
  "bounced",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Contacts
// Recipients of campaigns for a given business.
// Opt-out must be honored — once opted out, never message again.
// ─────────────────────────────────────────────────────────────────────────────

export const outreachContacts = pgTable("outreach_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name"),
  email: text("email"),
  phone: text("phone"),
  optedOut: boolean("opted_out").notNull().default(false),
  optedOutAt: timestamp("opted_out_at", { withTimezone: true }),
  // e.g. 'import', 'manual', 'funnel', 'webhook'
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaigns
// A single outreach campaign (SMS, email, or both) for a business.
// ─────────────────────────────────────────────────────────────────────────────

export const campaigns = pgTable("campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: campaignTypeEnum("type").notNull(),
  status: campaignStatusEnum("status").notNull().default("draft"),
  subject: text("subject"), // email campaigns only
  messageBody: text("message_body").notNull(),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Messages
// Individual message send events within a campaign.
// externalId stores the Twilio MessageSID or Resend email ID for lookups.
// ─────────────────────────────────────────────────────────────────────────────

export const outreachMessages = pgTable("outreach_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => outreachContacts.id, { onDelete: "cascade" }),
  channel: outreachChannelEnum("channel").notNull(),
  status: messageStatusEnum("status").notNull().default("queued"),
  // Provider-assigned ID (Twilio SID or Resend ID)
  externalId: text("external_id").unique(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Outreach Replies
// Inbound replies from contacts (SMS via Twilio webhook, email via Resend inbound).
// messageId may be null if the reply can't be matched to a specific send.
// ─────────────────────────────────────────────────────────────────────────────

export const outreachReplies = pgTable("outreach_replies", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => outreachMessages.id, {
    onDelete: "set null",
  }),
  contactId: uuid("contact_id")
    .notNull()
    .references(() => outreachContacts.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  channel: outreachChannelEnum("channel").notNull(),
  body: text("body").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  isRead: boolean("is_read").notNull().default(false),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const outreachContactsRelations = relations(
  outreachContacts,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [outreachContacts.businessId],
      references: [businesses.id],
    }),
    messages: many(outreachMessages),
    replies: many(outreachReplies),
  })
);

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  business: one(businesses, {
    fields: [campaigns.businessId],
    references: [businesses.id],
  }),
  messages: many(outreachMessages),
}));

export const outreachMessagesRelations = relations(
  outreachMessages,
  ({ one, many }) => ({
    campaign: one(campaigns, {
      fields: [outreachMessages.campaignId],
      references: [campaigns.id],
    }),
    contact: one(outreachContacts, {
      fields: [outreachMessages.contactId],
      references: [outreachContacts.id],
    }),
    replies: many(outreachReplies),
  })
);

export const outreachRepliesRelations = relations(
  outreachReplies,
  ({ one }) => ({
    message: one(outreachMessages, {
      fields: [outreachReplies.messageId],
      references: [outreachMessages.id],
    }),
    contact: one(outreachContacts, {
      fields: [outreachReplies.contactId],
      references: [outreachContacts.id],
    }),
    business: one(businesses, {
      fields: [outreachReplies.businessId],
      references: [businesses.id],
    }),
  })
);
