-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 076 — Schema drift repair
-- Generated 2026-04-30 from Drizzle ↔ prod audit.
--
-- Catches up production schema with code expectations. ADDITIVE only —
-- nothing destructive, safe to apply on a live DB.
--
-- Drift found:
--   1. businesses missing: stripe_customer_id, is_military, military_verified_at
--   2. bundles missing: pricing_profile_id
--   3. order_items missing: spot_assignment_id
--   4. email_events table missing entirely (Migration 074 was never applied)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. businesses: missing columns ──────────────────────────────────────────

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

CREATE UNIQUE INDEX IF NOT EXISTS businesses_stripe_customer_id_unique
  ON businesses (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_military boolean NOT NULL DEFAULT false;

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS military_verified_at timestamptz;

-- ── 2. bundles.pricing_profile_id ───────────────────────────────────────────

ALTER TABLE bundles
  ADD COLUMN IF NOT EXISTS pricing_profile_id uuid REFERENCES pricing_profiles(id);

-- ── 3. order_items.spot_assignment_id ───────────────────────────────────────

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS spot_assignment_id uuid REFERENCES spot_assignments(id);

-- ── 4. email_events table (Migration 074 was never applied here) ────────────

CREATE TABLE IF NOT EXISTS email_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider        text NOT NULL,
  event_type      text NOT NULL,
  message_id      text,
  recipient       text,
  subject         text,
  bounce_type     text,
  error_code      text,
  error_message   text,
  click_url       text,
  ip              text,
  user_agent      text,
  geo_country     text,
  geo_region      text,
  geo_city        text,
  tags            text[],
  raw_payload     jsonb,
  received_at     timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_events_message_id_idx  ON email_events (message_id);
CREATE INDEX IF NOT EXISTS email_events_recipient_idx   ON email_events (recipient);
CREATE INDEX IF NOT EXISTS email_events_event_type_idx  ON email_events (event_type);
CREATE INDEX IF NOT EXISTS email_events_provider_idx    ON email_events (provider);
CREATE INDEX IF NOT EXISTS email_events_received_at_idx ON email_events (received_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification (run after applying):
--
--   -- Re-run the schema audit query — should return 0 rows of drift.
--   -- Spot-check the new columns:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='businesses' AND column_name IN
--          ('stripe_customer_id','is_military','military_verified_at');
--   SELECT count(*) FROM email_events;
-- ─────────────────────────────────────────────────────────────────────────────
