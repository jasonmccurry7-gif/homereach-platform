import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// stripe_webhook_events
//
// Idempotency log for Stripe webhook receives. Every incoming event is
// recorded with its Stripe event.id as primary key. Duplicate deliveries
// (Stripe retries on 5xx) are detected by INSERT ... ON CONFLICT DO NOTHING
// and skipped.
//
// status:
//   received   — row inserted, handler not yet finished
//   processed  — handler completed successfully
//   failed     — handler threw; check `error` column
//   skipped    — duplicate delivery; first row already processed
//
// Migration: supabase/migrations/075_orders_expires_and_webhook_idempotency.sql
// ─────────────────────────────────────────────────────────────────────────────

export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  id: text("id").primaryKey(),
  eventType: text("event_type").notNull(),
  status: text("status").notNull().default("received"),
  payload: jsonb("payload").$type<Record<string, unknown>>(),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});
