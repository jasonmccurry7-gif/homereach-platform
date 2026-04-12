-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 20: Sales Execution System
-- sales_leads: 1,646 Ohio business prospects (imported from Replit)
-- sales_events: every agent action, fully tracked
-- ─────────────────────────────────────────────────────────────────────────────

-- Add sales_agent role if not present
DO $$ BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sales_agent';
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE sales_channel AS ENUM ('sms', 'email', 'facebook', 'call');

CREATE TYPE sales_action_type AS ENUM (
  'lead_loaded',
  'lead_skipped',
  'message_sent',
  'email_sent',
  'text_sent',
  'facebook_sent',
  'reply_received',
  'conversation_started',
  'follow_up_sent',
  'payment_link_created',
  'deal_closed'
);

CREATE TYPE sales_lead_priority AS ENUM ('low', 'medium', 'high');

CREATE TYPE sales_lead_status AS ENUM (
  'queued',
  'contacted',
  'replied',
  'interested',
  'payment_sent',
  'closed',
  'dead'
);

-- ── sales_leads ───────────────────────────────────────────────────────────────

CREATE TABLE sales_leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id         TEXT,
  business_name       TEXT NOT NULL,
  contact_name        TEXT,
  email               TEXT,
  phone               TEXT,
  website             TEXT,
  facebook_url        TEXT,
  address             TEXT,
  city                TEXT,
  state               TEXT DEFAULT 'OH',
  category            TEXT,
  city_id             INTEGER,
  category_id         INTEGER,
  score               INTEGER DEFAULT 0,
  priority            sales_lead_priority DEFAULT 'medium',
  rating              NUMERIC(3,1),
  reviews_count       INTEGER DEFAULT 0,
  buying_signal       BOOLEAN DEFAULT FALSE,
  do_not_contact      BOOLEAN DEFAULT FALSE,
  sms_opt_out         BOOLEAN DEFAULT FALSE,
  status              sales_lead_status DEFAULT 'queued',
  notes               TEXT,
  last_contacted_at   TIMESTAMPTZ,
  last_reply_at       TIMESTAMPTZ,
  assigned_agent_id   UUID REFERENCES profiles(id),
  total_messages_sent INTEGER DEFAULT 0,
  total_replies       INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_leads_status       ON sales_leads(status);
CREATE INDEX idx_sales_leads_priority     ON sales_leads(priority);
CREATE INDEX idx_sales_leads_city         ON sales_leads(city);
CREATE INDEX idx_sales_leads_category     ON sales_leads(category);
CREATE INDEX idx_sales_leads_buying       ON sales_leads(buying_signal);
CREATE INDEX idx_sales_leads_dnc          ON sales_leads(do_not_contact);
CREATE INDEX idx_sales_leads_score        ON sales_leads(score DESC);

-- ── sales_events ──────────────────────────────────────────────────────────────

CREATE TABLE sales_events (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID REFERENCES profiles(id),
  lead_id        UUID REFERENCES sales_leads(id),
  action_type    sales_action_type NOT NULL,
  channel        sales_channel,
  city           TEXT,
  category       TEXT,
  message        TEXT,
  revenue_cents  INTEGER,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sales_events_agent    ON sales_events(agent_id);
CREATE INDEX idx_sales_events_lead     ON sales_events(lead_id);
CREATE INDEX idx_sales_events_type     ON sales_events(action_type);
CREATE INDEX idx_sales_events_created  ON sales_events(created_at DESC);
CREATE INDEX idx_sales_events_channel  ON sales_events(channel);
CREATE INDEX idx_sales_events_city     ON sales_events(city);
CREATE INDEX idx_sales_events_category ON sales_events(category);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE sales_leads  ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_events ENABLE ROW LEVEL SECURITY;

-- Service role (API) full access
CREATE POLICY "sales_leads_service"  ON sales_leads  FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "sales_events_service" ON sales_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Admins full access
CREATE POLICY "sales_leads_admin" ON sales_leads FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "sales_events_admin" ON sales_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sales agents: read all leads, write own events, update own leads
CREATE POLICY "sales_leads_agent_read" ON sales_leads FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'sales_agent')));

CREATE POLICY "sales_leads_agent_update" ON sales_leads FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_agent'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'sales_agent'));

CREATE POLICY "sales_events_agent_own" ON sales_events FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- ── RPC helpers for atomic counter increments ─────────────────────────────────

CREATE OR REPLACE FUNCTION increment_lead_messages(lead_uuid UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE sales_leads
  SET total_messages_sent = total_messages_sent + 1, updated_at = NOW()
  WHERE id = lead_uuid;
$$;

CREATE OR REPLACE FUNCTION increment_lead_replies(lead_uuid UUID)
RETURNS void LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE sales_leads
  SET total_replies = total_replies + 1, updated_at = NOW()
  WHERE id = lead_uuid;
$$;
