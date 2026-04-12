-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 16 — intake_submissions
--
-- Post-payment onboarding table for the shared postcard product.
-- Created automatically when a subscription activates (subscription.created webhook).
-- Customer completes this form at: /intake/[access_token]
--
-- DEPENDS ON: Migration 15 (spot_assignments must exist)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intake_submissions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Links back to the spot that was purchased
  spot_assignment_id  UUID NOT NULL REFERENCES spot_assignments(id) ON DELETE CASCADE,
  business_id         UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Unique token for the public intake URL (/intake/[access_token])
  -- Never expose the spot_assignment_id in the URL — use this instead.
  access_token        UUID NOT NULL DEFAULT gen_random_uuid(),

  -- Lifecycle
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'submitted', 'reviewed')),

  -- Intake form fields (all nullable — filled in by customer)
  service_area        TEXT,         -- "Where do you serve customers?"
  target_customer     TEXT,         -- "Who is your ideal customer?"
  key_offer           TEXT,         -- "What's your main offer or promotion?"
  differentiators     TEXT,         -- "Why should people choose you?"
  additional_notes    TEXT,         -- Anything else admin should know

  -- Timestamps
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Token lookup — the public intake URL uses this
CREATE UNIQUE INDEX IF NOT EXISTS intake_submissions_access_token
  ON intake_submissions (access_token);

-- Admin queue — filter by status
CREATE INDEX IF NOT EXISTS idx_intake_submissions_status
  ON intake_submissions (status);

-- Link to spot
CREATE INDEX IF NOT EXISTS idx_intake_submissions_spot_assignment
  ON intake_submissions (spot_assignment_id);

CREATE INDEX IF NOT EXISTS idx_intake_submissions_business
  ON intake_submissions (business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Verification:
--
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name = 'intake_submissions' ORDER BY ordinal_position;
--
--   SELECT indexname FROM pg_indexes WHERE tablename = 'intake_submissions';
-- ─────────────────────────────────────────────────────────────────────────────
