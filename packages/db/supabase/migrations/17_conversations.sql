-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 17 — Conversations Table
--
-- Persists every inbound + outbound message across SMS and email.
-- Replaces the in-memory store in SupabaseConversationRepository.
--
-- RUN THIS IN SUPABASE SQL EDITOR.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── conversations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          UUID REFERENCES leads(id) ON DELETE SET NULL,

  -- Contact identifiers (denormalized for fast lookup without joins)
  contact_phone    TEXT,
  contact_email    TEXT,
  lead_name        TEXT,
  business_name    TEXT,
  city             TEXT,
  category         TEXT,

  -- Message payload
  channel          TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  direction        TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message          TEXT NOT NULL,
  external_id      TEXT,           -- Twilio SID or Mailgun message ID

  -- AI / automation metadata
  intent           TEXT,           -- ready_to_buy | interested | asking_questions | objection | not_interested | unknown
  ai_generated     BOOLEAN NOT NULL DEFAULT FALSE,
  automation_mode  TEXT NOT NULL DEFAULT 'manual' CHECK (automation_mode IN ('auto', 'manual')),

  -- Read state
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,

  sent_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes for common query patterns ─────────────────────────────────────────
CREATE INDEX IF NOT EXISTS conversations_lead_id_idx        ON conversations(lead_id);
CREATE INDEX IF NOT EXISTS conversations_contact_phone_idx  ON conversations(contact_phone);
CREATE INDEX IF NOT EXISTS conversations_contact_email_idx  ON conversations(contact_email);
CREATE INDEX IF NOT EXISTS conversations_sent_at_idx        ON conversations(sent_at DESC);
CREATE INDEX IF NOT EXISTS conversations_direction_idx      ON conversations(direction);

-- ── RLS (Row-Level Security) ──────────────────────────────────────────────────
-- Service role has full access; no direct client access.
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access"
  ON conversations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
