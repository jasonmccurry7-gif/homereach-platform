// ─────────────────────────────────────────────────────────────────────────────
// Conversations — Persistent message log
//
// Stores every inbound + outbound message across SMS and email.
// Replaces the in-memory store in SupabaseConversationRepository.
// Created in Migration 17.
// ─────────────────────────────────────────────────────────────────────────────

import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { leads } from "./leads";

export const conversations = pgTable("conversations", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Link to lead (nullable — messages can arrive before a lead record exists)
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),

  // Contact identifiers (denormalized for fast lookups)
  contactPhone:  text("contact_phone"),
  contactEmail:  text("contact_email"),
  leadName:      text("lead_name"),
  businessName:  text("business_name"),
  city:          text("city"),
  category:      text("category"),

  // Message payload
  channel:    text("channel").notNull(),     // "sms" | "email"
  direction:  text("direction").notNull(),   // "inbound" | "outbound"
  message:    text("message").notNull(),
  externalId: text("external_id"),           // Twilio SID or Mailgun message ID

  // AI / automation metadata
  intent:          text("intent"),           // intent type string
  aiGenerated:     boolean("ai_generated").notNull().default(false),
  automationMode:  text("automation_mode").notNull().default("manual"),

  // Read state
  isRead: boolean("is_read").notNull().default(false),

  sentAt:    timestamp("sent_at",    { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
