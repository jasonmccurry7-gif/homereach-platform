-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 18 — Public Nonprofit Applications
--
-- Stores public nonprofit registration form submissions.
-- No businessId required — used BEFORE a business record is created.
-- Admin reviews and links to a business manually after verification.
--
-- RUN THIS IN SUPABASE SQL EDITOR.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public_nonprofit_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Organization info
  org_name        TEXT NOT NULL,
  ein             TEXT,             -- 501(c)(3) EIN, e.g. "12-3456789"
  website         TEXT,
  mission         TEXT,             -- brief mission statement

  -- Contact info
  contact_name    TEXT NOT NULL,
  email           TEXT NOT NULL,
  phone           TEXT,
  city            TEXT,

  -- Pipeline
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Optional link to a business record after admin verification
  linked_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,

  -- Admin notes
  admin_notes     TEXT,
  reviewed_at     TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS pub_nonprofit_status_idx ON public_nonprofit_applications(status);
CREATE INDEX IF NOT EXISTS pub_nonprofit_email_idx  ON public_nonprofit_applications(email);

-- RLS
ALTER TABLE public_nonprofit_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON public_nonprofit_applications
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
