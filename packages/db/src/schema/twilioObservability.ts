import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Twilio Observability — additive read-side tracking tables.
//
// Migration: supabase/migrations/073_twilio_observability.sql
// Owner:     Agent 2 — Outreach Infrastructure (outreach-visibility branch)
//
// These tables are populated only by:
//   • POST /api/webhooks/twilio/status (status callbacks per send)
//   • Manual admin upsert of A2P compliance status
//
// They are NEVER written to by /api/admin/sales/event, sendSms, or any send
// path. Purely receive-side observability.
// ─────────────────────────────────────────────────────────────────────────────

// ─── A2P 10DLC compliance master record ─────────────────────────────────────
export const twilioA2pStatus = pgTable("twilio_a2p_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  brandId: text("brand_id"),
  campaignId: text("campaign_id"),
  useCase: text("use_case"),
  accountTier: text("account_tier"),
  verizonStatus: text("verizon_status"),
  attStatus: text("att_status"),
  tmobileStatus: text("tmobile_status"),
  uscellularStatus: text("uscellular_status"),
  complianceChecklist: jsonb("compliance_checklist"),
  lastAuditAt: timestamp("last_audit_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Append-only log of Twilio status callbacks ─────────────────────────────
export const twilioMessageStatus = pgTable(
  "twilio_message_status",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageSid: text("message_sid").notNull(),
    messageStatus: text("message_status").notNull(),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    toNumber: text("to_number"),
    fromNumber: text("from_number"),
    messagingServiceSid: text("messaging_service_sid"),
    smsSid: text("sms_sid"),
    accountSid: text("account_sid"),
    apiVersion: text("api_version"),
    rawPayload: jsonb("raw_payload"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    messageSidIdx: index("twilio_message_status_message_sid_idx").on(
      table.messageSid,
    ),
    receivedAtIdx: index("twilio_message_status_received_at_idx").on(
      table.receivedAt,
    ),
    messageStatusIdx: index("twilio_message_status_message_status_idx").on(
      table.messageStatus,
    ),
  }),
);
