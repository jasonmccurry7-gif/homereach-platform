import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Email Observability — additive read-side tracking.
//
// Migration: supabase/migrations/074_email_observability.sql
// Owner:     Agent 2 — Outreach Infrastructure (outreach-visibility branch)
//
// Populated by:
//   • POST /api/webhooks/postmark
//   • Future: /api/webhooks/{mailgun,resend,ses}
//   • One-time backfill: packages/db/scripts/import-mailgun-bounces.ts
//
// NEVER written to by /api/admin/sales/event or any send path.
// Provider-agnostic — same table for any ESP via the `provider` column.
// ─────────────────────────────────────────────────────────────────────────────

export const emailEvents = pgTable(
  "email_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: text("provider").notNull(),
    eventType: text("event_type").notNull(),
    messageId: text("message_id"),
    recipient: text("recipient"),
    subject: text("subject"),
    bounceType: text("bounce_type"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    clickUrl: text("click_url"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    geoCountry: text("geo_country"),
    geoRegion: text("geo_region"),
    geoCity: text("geo_city"),
    tags: text("tags").array(),
    rawPayload: jsonb("raw_payload"),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    messageIdIdx: index("email_events_message_id_idx").on(table.messageId),
    recipientIdx: index("email_events_recipient_idx").on(table.recipient),
    eventTypeIdx: index("email_events_event_type_idx").on(table.eventType),
    providerIdx: index("email_events_provider_idx").on(table.provider),
    receivedAtIdx: index("email_events_received_at_idx").on(table.receivedAt),
  }),
);
