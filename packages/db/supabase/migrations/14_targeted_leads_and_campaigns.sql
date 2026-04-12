-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 14: Targeted Route Campaigns + Lead Pipeline
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ─────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM (
    'new', 'contacted', 'intake_sent', 'intake_started',
    'intake_complete', 'paid', 'active', 'mailed', 'review_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE lead_source AS ENUM ('facebook', 'web', 'manual', 'sms', 'referral');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE targeted_campaign_status AS ENUM (
    'intake_complete', 'paid', 'design_queued', 'design_in_progress',
    'design_ready', 'approved', 'mailed', 'complete', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE design_status AS ENUM (
    'not_started', 'queued', 'in_progress', 'ready', 'approved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE mailing_status AS ENUM ('not_mailed', 'scheduled', 'mailed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Leads table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contact
  name                TEXT,
  business_name       TEXT,
  phone               TEXT,
  email               TEXT,

  -- Source + pipeline
  source              lead_source   NOT NULL DEFAULT 'facebook',
  status              lead_status   NOT NULL DEFAULT 'new',

  -- Geography (freeform)
  city                TEXT,
  notes               TEXT,

  -- Intake link token (unique per lead)
  intake_token        UUID UNIQUE DEFAULT gen_random_uuid(),

  -- Pipeline event timestamps
  intake_sent_at      TIMESTAMPTZ,
  intake_submitted_at TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  mailed_at           TIMESTAMPTZ,
  review_requested_at TIMESTAMPTZ,

  -- Review tracking
  review_requested    BOOLEAN NOT NULL DEFAULT FALSE,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status  ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_source  ON leads (source);
CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);

-- ── Targeted route campaigns table ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS targeted_route_campaigns (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Link to originating lead
  lead_id                    UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Campaign owner (captured at intake)
  business_name              TEXT NOT NULL,
  contact_name               TEXT,
  email                      TEXT NOT NULL,
  phone                      TEXT,

  -- Target area
  business_address           TEXT,
  target_city                TEXT,
  target_area_notes          TEXT,

  -- Campaign specs
  homes_count                INTEGER NOT NULL DEFAULT 500,
  price_cents                INTEGER NOT NULL DEFAULT 40000,

  -- Pipeline
  status                     targeted_campaign_status NOT NULL DEFAULT 'intake_complete',
  design_status              design_status            NOT NULL DEFAULT 'not_started',
  mailing_status             mailing_status           NOT NULL DEFAULT 'not_mailed',

  -- Review tracking
  review_requested           BOOLEAN NOT NULL DEFAULT FALSE,
  review_requested_at        TIMESTAMPTZ,

  -- Stripe
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id   TEXT,

  notes                      TEXT,

  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trc_status     ON targeted_route_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_trc_lead_id    ON targeted_route_campaigns (lead_id);
CREATE INDEX IF NOT EXISTS idx_trc_created    ON targeted_route_campaigns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trc_stripe_sid ON targeted_route_campaigns (stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;
