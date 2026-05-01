-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach hotfix — intake/checkout revenue blocker
-- Adds:
--   1. orders.expires_at  — auto-release stale pending orders (Tasks #17, #22)
--   2. stripe_webhook_events — idempotency for Stripe webhook receives (Task #20)
--
-- Backfills existing pending orders with a 30-minute window from creation,
-- which immediately frees up any spot inventory locked by abandoned checkouts.
-- Safe to apply on a live system — additive only, no destructive changes.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Orders expiration ─────────────────────────────────────────────────────

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- Backfill: every existing pending order gets a 30-min window from creation.
-- Anything older than 30min becomes immediately expired (frees stuck spots).
-- Anything younger gets a fresh window.
UPDATE orders
   SET expires_at = created_at + INTERVAL '30 minutes'
 WHERE status = 'pending'
   AND expires_at IS NULL;

-- Default for new rows going forward.
ALTER TABLE orders
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 minutes');

-- Partial index — fast availability checks + sweep cron (future).
CREATE INDEX IF NOT EXISTS ix_orders_pending_expires
  ON orders (expires_at)
  WHERE status = 'pending';

-- ── 2. Stripe webhook idempotency ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  -- Stripe's event.id (evt_...) is the natural primary key — guaranteed unique.
  id              text PRIMARY KEY,
  event_type      text NOT NULL,
  status          text NOT NULL DEFAULT 'received'
                  CHECK (status IN ('received', 'processed', 'failed', 'skipped')),
  -- Full event payload retained for debug + replay.
  payload         jsonb,
  -- Failure reason for status='failed' rows; NULL otherwise.
  error           text,
  received_at     timestamptz NOT NULL DEFAULT NOW(),
  processed_at    timestamptz
);

CREATE INDEX IF NOT EXISTS ix_stripe_webhook_events_received_at
  ON stripe_webhook_events (received_at DESC);

CREATE INDEX IF NOT EXISTS ix_stripe_webhook_events_status
  ON stripe_webhook_events (status, received_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- Post-deploy monitoring queries:
--
--   -- Idempotency layer health
--   SELECT status, count(*) FROM stripe_webhook_events GROUP BY status;
--
--   -- Stale pending sweep (manual until cron is wired)
--   SELECT id, business_id, created_at, expires_at
--     FROM orders
--    WHERE status='pending' AND expires_at <= NOW()
--    ORDER BY expires_at ASC;
--
--   -- Failed webhook events (action: replay or investigate)
--   SELECT id, event_type, error, received_at
--     FROM stripe_webhook_events
--    WHERE status='failed'
--    ORDER BY received_at DESC LIMIT 20;
-- ─────────────────────────────────────────────────────────────────────────────
