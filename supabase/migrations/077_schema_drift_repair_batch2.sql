-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 077 — Schema drift repair, batch 2
-- Generated 2026-04-30 from comprehensive Drizzle ↔ prod audit.
--
-- Creates 5 missing tables + their enums:
--   1. pricing_profiles + idx_pp_*
--   2. discount_rules
--   3. growth_activity_logs (with unique(date, channel) constraint)
--   4. conversations
--   5. public_nonprofit_applications
--
-- Enums created idempotently with DO $$ EXCEPTION blocks. ADDITIVE only.
-- After this migration, also need to backfill bundles.pricing_profile_id FK
-- (Migration 076 added the column without the FK because pricing_profiles
-- didn't exist yet).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums (idempotent) ──────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE pricing_product_type AS ENUM
    ('spot', 'addon', 'automation', 'bundle', 'campaign', 'setup_fee');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE spot_type AS ENUM
    ('anchor', 'front_feature', 'back_feature', 'full_card');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE billing_interval AS ENUM
    ('monthly', 'one_time', 'per_unit', 'per_drop');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE discount_rule_type AS ENUM
    ('military', 'multi_spot', 'promo_code', 'future_reserved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE growth_channel AS ENUM
    ('email', 'sms', 'facebook_dm', 'facebook_post', 'facebook_ads');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── 1. pricing_profiles ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pricing_profiles (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                        text NOT NULL,
  product_type                pricing_product_type NOT NULL,
  spot_type                   spot_type,
  billing_interval            billing_interval NOT NULL,
  base_price_cents            integer NOT NULL DEFAULT 0,
  compare_at_price_cents      integer,
  founding_price_cents        integer,
  per_unit_price_cents_min    integer,
  per_unit_price_cents_max    integer,
  min_quantity                integer,
  max_quantity                integer,
  min_commitment_months       integer,
  homes_per_drop              integer,
  setup_fee_profile_id        uuid REFERENCES pricing_profiles(id) ON DELETE SET NULL,
  is_active                   boolean NOT NULL DEFAULT true,
  effective_from              timestamptz,
  effective_until             timestamptz,
  metadata                    jsonb,
  created_at                  timestamptz NOT NULL DEFAULT NOW(),
  updated_at                  timestamptz NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pp_active_unique_lookup
  ON pricing_profiles (product_type, billing_interval)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_pp_product_type ON pricing_profiles (product_type);
CREATE INDEX IF NOT EXISTS idx_pp_spot_type    ON pricing_profiles (spot_type);
CREATE INDEX IF NOT EXISTS idx_pp_is_active    ON pricing_profiles (is_active);

-- ── 2. discount_rules ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS discount_rules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  rule_type       discount_rule_type NOT NULL,
  description     text NOT NULL,
  discount_pct    numeric(5,2),
  discount_cents  integer,
  conditions      jsonb NOT NULL DEFAULT '{}'::jsonb,
  effect          jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority        integer NOT NULL DEFAULT 100,
  stackable       boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT NOW(),
  updated_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 3. growth_activity_logs ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS growth_activity_logs (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date                     date NOT NULL,
  channel                  growth_channel NOT NULL,
  volume_sent              integer NOT NULL DEFAULT 0,
  ad_spend_cents           integer NOT NULL DEFAULT 0,
  responses                integer NOT NULL DEFAULT 0,
  conversations_started    integer NOT NULL DEFAULT 0,
  deals_closed             integer NOT NULL DEFAULT 0,
  notes                    text,
  created_at               timestamptz NOT NULL DEFAULT NOW(),
  updated_at               timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT growth_activity_logs_date_channel_unique UNIQUE (date, channel)
);

-- ── 4. conversations ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS conversations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid REFERENCES leads(id) ON DELETE SET NULL,
  contact_phone   text,
  contact_email   text,
  lead_name       text,
  business_name   text,
  city            text,
  category        text,
  channel         text NOT NULL,
  direction       text NOT NULL,
  message         text NOT NULL,
  external_id     text,
  intent          text,
  ai_generated    boolean NOT NULL DEFAULT false,
  automation_mode text NOT NULL DEFAULT 'manual',
  is_read         boolean NOT NULL DEFAULT false,
  sent_at         timestamptz NOT NULL DEFAULT NOW(),
  created_at      timestamptz NOT NULL DEFAULT NOW()
);

-- ── 5. public_nonprofit_applications ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_nonprofit_applications (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_name            text NOT NULL,
  ein                 text,
  website             text,
  mission             text,
  contact_name        text NOT NULL,
  email               text NOT NULL,
  phone               text,
  city                text,
  status              text NOT NULL DEFAULT 'pending',
  linked_business_id  uuid REFERENCES businesses(id) ON DELETE SET NULL,
  admin_notes         text,
  reviewed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT NOW(),
  updated_at          timestamptz NOT NULL DEFAULT NOW()
);

-- ── Optional follow-up: add the FK we skipped in Migration 076 ──────────────
-- bundles.pricing_profile_id was created without REFERENCES because
-- pricing_profiles didn't exist. Now it does — add the FK.

ALTER TABLE bundles
  DROP CONSTRAINT IF EXISTS bundles_pricing_profile_id_fkey;

ALTER TABLE bundles
  ADD CONSTRAINT bundles_pricing_profile_id_fkey
  FOREIGN KEY (pricing_profile_id) REFERENCES pricing_profiles(id) ON DELETE SET NULL;
