-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 21: HomeReach Full CRM Schema
-- Built on top of sales_leads + sales_events (Migration 20)
-- Adds: companies, contacts, assignments, outreach_events, conversations,
--       notes, tasks, pipeline, tags, suppression, activity_metrics, deals
-- ─────────────────────────────────────────────────────────────────────────────

-- ── New enums ─────────────────────────────────────────────────────────────────

CREATE TYPE crm_company_status AS ENUM (
  'prospect', 'active', 'churned', 'suspended'
);

CREATE TYPE crm_outreach_type AS ENUM (
  'sms_initial', 'sms_follow_up', 'email_initial', 'email_follow_up',
  'fb_dm', 'fb_follow_up', 'call', 'voicemail',
  'intake_link', 'payment_link', 'other'
);

CREATE TYPE crm_outreach_status AS ENUM (
  'generated', 'approved', 'sent', 'delivered', 'failed', 'bounced'
);

CREATE TYPE crm_outreach_direction AS ENUM ('outbound', 'inbound');

CREATE TYPE crm_task_type AS ENUM (
  'follow_up', 'call', 'send_payment_link', 'send_intake',
  'check_in', 'close', 'other'
);

CREATE TYPE crm_task_status AS ENUM (
  'pending', 'in_progress', 'done', 'snoozed', 'cancelled'
);

CREATE TYPE crm_pipeline_stage AS ENUM (
  'new',           -- just imported, never contacted
  'contacted',     -- at least one message sent
  'replied',       -- lead has responded
  'interested',    -- strong buying signal
  'negotiating',   -- discussing pricing/details
  'payment_sent',  -- payment link or invoice sent
  'closed_won',    -- deal signed / payment received
  'closed_lost',   -- not interested / unresponsive
  'suppressed'     -- DNC / opted out
);

CREATE TYPE crm_note_type AS ENUM (
  'call', 'meeting', 'observation', 'system', 'other'
);

CREATE TYPE crm_suppression_reason AS ENUM (
  'do_not_contact', 'email_opt_out', 'sms_opt_out',
  'unsubscribed', 'invalid_contact', 'competitor', 'closed_lost'
);

-- ── crm_companies ─────────────────────────────────────────────────────────────
-- Paying advertisers and hot prospects (11 from Replit)

CREATE TABLE crm_companies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT,                         -- original businesses.id
  name            TEXT NOT NULL,
  contact_name    TEXT,
  email           TEXT,
  phone           TEXT,
  address         TEXT,
  website         TEXT,
  industry        TEXT,
  stripe_customer_id TEXT,
  status          crm_company_status DEFAULT 'prospect',
  mrr_cents       INTEGER DEFAULT 0,            -- monthly recurring revenue
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_companies_status ON crm_companies(status);
CREATE INDEX idx_crm_companies_email  ON crm_companies(email);

-- ── crm_lead_companies (join: lead → company when converted) ──────────────────

ALTER TABLE sales_leads
  ADD COLUMN IF NOT EXISTS company_id        UUID REFERENCES crm_companies(id),
  ADD COLUMN IF NOT EXISTS pipeline_stage    crm_pipeline_stage DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS assigned_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_follow_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_note_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_duplicate      BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of_id   UUID REFERENCES sales_leads(id),
  ADD COLUMN IF NOT EXISTS unreachable        BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fb_never_sent     BOOLEAN DEFAULT FALSE;

-- ── crm_assignments ───────────────────────────────────────────────────────────
-- Agent ownership of leads — one active assignment per lead at a time

CREATE TABLE crm_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  agent_id    UUID NOT NULL REFERENCES profiles(id),
  assigned_by UUID REFERENCES profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ,       -- NULL = still active
  notes       TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_assignments_lead    ON crm_assignments(lead_id);
CREATE INDEX idx_crm_assignments_agent   ON crm_assignments(agent_id);
CREATE INDEX idx_crm_assignments_active  ON crm_assignments(is_active) WHERE is_active = TRUE;

-- ── crm_outreach_events ───────────────────────────────────────────────────────
-- Every message sent or received — imported from Replit + new

CREATE TABLE crm_outreach_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     TEXT,                         -- original lead_outreach_log.id
  lead_id         UUID REFERENCES sales_leads(id),
  agent_id        UUID REFERENCES profiles(id),
  company_id      UUID REFERENCES crm_companies(id),
  -- Contact info at time of send (denormalized for history)
  contact_phone   TEXT,
  contact_email   TEXT,
  contact_name    TEXT,
  business_name   TEXT,
  city            TEXT,
  category        TEXT,
  -- Message details
  channel         sales_channel,
  direction       crm_outreach_direction DEFAULT 'outbound',
  type            crm_outreach_type DEFAULT 'other',
  subject         TEXT,                         -- email subject
  message_body    TEXT,
  -- Delivery
  status          crm_outreach_status DEFAULT 'generated',
  twilio_sid      TEXT,                         -- Twilio message SID
  mailgun_id      TEXT,                         -- Mailgun message ID
  -- AI metadata
  ai_generated    BOOLEAN DEFAULT FALSE,
  -- Response tracking
  got_reply       BOOLEAN DEFAULT FALSE,
  buying_signal   BOOLEAN DEFAULT FALSE,
  sentiment       TEXT,                         -- neutral, positive, negative
  objection_type  TEXT,
  -- Facebook warning
  fb_actually_sent BOOLEAN DEFAULT TRUE,        -- FALSE = generated but never delivered
  -- Timing
  scheduled_at    TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_outreach_lead     ON crm_outreach_events(lead_id);
CREATE INDEX idx_crm_outreach_agent    ON crm_outreach_events(agent_id);
CREATE INDEX idx_crm_outreach_channel  ON crm_outreach_events(channel);
CREATE INDEX idx_crm_outreach_status   ON crm_outreach_events(status);
CREATE INDEX idx_crm_outreach_sent_at  ON crm_outreach_events(sent_at DESC);
CREATE INDEX idx_crm_outreach_city     ON crm_outreach_events(city);
CREATE INDEX idx_crm_outreach_category ON crm_outreach_events(category);
CREATE INDEX idx_crm_outreach_reply    ON crm_outreach_events(got_reply) WHERE got_reply = TRUE;

-- ── crm_conversations ─────────────────────────────────────────────────────────
-- Grouped thread summary per lead

CREATE TABLE crm_conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES profiles(id),
  channel         sales_channel,
  -- Counts
  total_messages      INTEGER DEFAULT 0,
  outbound_count      INTEGER DEFAULT 0,
  inbound_replies     INTEGER DEFAULT 0,
  -- State
  has_replied         BOOLEAN DEFAULT FALSE,
  last_activity_at    TIMESTAMPTZ,
  last_direction      crm_outreach_direction DEFAULT 'outbound',
  last_message_preview TEXT,
  -- Signals
  reply_sentiments    TEXT,
  buying_signals      INTEGER DEFAULT 0,
  -- Timestamps
  opened_at       TIMESTAMPTZ DEFAULT NOW(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_conv_lead     ON crm_conversations(lead_id);
CREATE INDEX idx_crm_conv_agent    ON crm_conversations(agent_id);
CREATE INDEX idx_crm_conv_replied  ON crm_conversations(has_replied) WHERE has_replied = TRUE;
CREATE INDEX idx_crm_conv_activity ON crm_conversations(last_activity_at DESC);

-- ── crm_notes ─────────────────────────────────────────────────────────────────

CREATE TABLE crm_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES sales_leads(id) ON DELETE CASCADE,
  company_id  UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES profiles(id),
  type        crm_note_type DEFAULT 'other',
  body        TEXT NOT NULL,
  is_pinned   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_notes_lead    ON crm_notes(lead_id);
CREATE INDEX idx_crm_notes_company ON crm_notes(company_id);
CREATE INDEX idx_crm_notes_agent   ON crm_notes(agent_id);

-- ── crm_tasks ─────────────────────────────────────────────────────────────────

CREATE TABLE crm_tasks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES sales_leads(id) ON DELETE CASCADE,
  company_id      UUID REFERENCES crm_companies(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES profiles(id),
  type            crm_task_type DEFAULT 'follow_up',
  status          crm_task_status DEFAULT 'pending',
  title           TEXT NOT NULL,
  description     TEXT,
  due_at          TIMESTAMPTZ,
  snoozed_until   TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_tasks_lead    ON crm_tasks(lead_id);
CREATE INDEX idx_crm_tasks_agent   ON crm_tasks(agent_id);
CREATE INDEX idx_crm_tasks_status  ON crm_tasks(status);
CREATE INDEX idx_crm_tasks_due     ON crm_tasks(due_at ASC) WHERE status = 'pending';

-- ── crm_pipeline_history ─────────────────────────────────────────────────────

CREATE TABLE crm_pipeline_history (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  agent_id    UUID REFERENCES profiles(id),
  from_stage  crm_pipeline_stage,
  to_stage    crm_pipeline_stage NOT NULL,
  reason      TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_pipe_hist_lead  ON crm_pipeline_history(lead_id);
CREATE INDEX idx_crm_pipe_hist_stage ON crm_pipeline_history(to_stage);
CREATE INDEX idx_crm_pipe_hist_time  ON crm_pipeline_history(created_at DESC);

-- ── crm_tags + crm_lead_tags ──────────────────────────────────────────────────

CREATE TABLE crm_tags (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE crm_lead_tags (
  lead_id UUID REFERENCES sales_leads(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES crm_tags(id)    ON DELETE CASCADE,
  PRIMARY KEY (lead_id, tag_id)
);

-- ── crm_suppression_list ──────────────────────────────────────────────────────

CREATE TABLE crm_suppression_list (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID REFERENCES sales_leads(id),
  email       TEXT,
  phone       TEXT,
  reason      crm_suppression_reason NOT NULL,
  notes       TEXT,
  added_by    UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_crm_suppress_email ON crm_suppression_list(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_crm_suppress_phone ON crm_suppression_list(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_crm_suppress_lead         ON crm_suppression_list(lead_id);

-- ── crm_activity_metrics ──────────────────────────────────────────────────────
-- Daily roll-up per agent — computed from sales_events + crm_outreach_events

CREATE TABLE crm_activity_metrics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id            UUID NOT NULL REFERENCES profiles(id),
  metric_date         DATE NOT NULL,
  -- Outreach counts
  messages_sent       INTEGER DEFAULT 0,
  emails_sent         INTEGER DEFAULT 0,
  texts_sent          INTEGER DEFAULT 0,
  fb_sent             INTEGER DEFAULT 0,
  calls_made          INTEGER DEFAULT 0,
  -- Engagement
  leads_viewed        INTEGER DEFAULT 0,
  leads_skipped       INTEGER DEFAULT 0,
  replies_received    INTEGER DEFAULT 0,
  conversations_started INTEGER DEFAULT 0,
  follow_ups_sent     INTEGER DEFAULT 0,
  -- Pipeline
  payment_links_sent  INTEGER DEFAULT 0,
  deals_closed        INTEGER DEFAULT 0,
  revenue_cents       INTEGER DEFAULT 0,
  -- Computed
  reply_rate_pct      NUMERIC(5,2) DEFAULT 0,
  close_rate_pct      NUMERIC(5,2) DEFAULT 0,
  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (agent_id, metric_date)
);

CREATE INDEX idx_crm_metrics_agent ON crm_activity_metrics(agent_id);
CREATE INDEX idx_crm_metrics_date  ON crm_activity_metrics(metric_date DESC);

-- ── crm_deals ─────────────────────────────────────────────────────────────────
-- Revenue-generating events — closed deals

CREATE TABLE crm_deals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         UUID REFERENCES sales_leads(id),
  company_id      UUID REFERENCES crm_companies(id),
  agent_id        UUID REFERENCES profiles(id),
  spot_id         INTEGER,                      -- reference to spots table
  city            TEXT,
  category        TEXT,
  -- Revenue
  monthly_value_cents INTEGER NOT NULL,
  contract_months     INTEGER DEFAULT 3,
  total_value_cents   INTEGER,                  -- computed
  -- Stripe
  stripe_customer_id  TEXT,
  stripe_invoice_id   TEXT,
  -- Status
  status          TEXT DEFAULT 'active',        -- active, cancelled, churned
  start_date      DATE,
  end_date        DATE,
  signed_at       TIMESTAMPTZ,
  -- Metadata
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_crm_deals_agent    ON crm_deals(agent_id);
CREATE INDEX idx_crm_deals_lead     ON crm_deals(lead_id);
CREATE INDEX idx_crm_deals_company  ON crm_deals(company_id);
CREATE INDEX idx_crm_deals_status   ON crm_deals(status);

-- ── Seed pipeline stages (for reference) ─────────────────────────────────────

INSERT INTO crm_tags (name, color) VALUES
  ('hot_lead',    '#ef4444'),
  ('follow_up',   '#f59e0b'),
  ('high_score',  '#10b981'),
  ('no_email',    '#6b7280'),
  ('no_phone',    '#6b7280'),
  ('unreachable', '#991b1b'),
  ('fb_only',     '#3b82f6'),
  ('duplicate',   '#8b5cf6')
ON CONFLICT (name) DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE crm_companies         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_outreach_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_conversations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_notes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_pipeline_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_tags              ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_lead_tags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_suppression_list  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_activity_metrics  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_deals             ENABLE ROW LEVEL SECURITY;

-- Service role: full access to everything
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['crm_companies','crm_assignments','crm_outreach_events',
    'crm_conversations','crm_notes','crm_tasks','crm_pipeline_history',
    'crm_tags','crm_lead_tags','crm_suppression_list','crm_activity_metrics','crm_deals']
  LOOP
    EXECUTE format('CREATE POLICY "%s_service" ON %s FOR ALL TO service_role USING (true) WITH CHECK (true)', t, t);
  END LOOP;
END $$;

-- Admin: full access
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['crm_companies','crm_assignments','crm_outreach_events',
    'crm_conversations','crm_notes','crm_tasks','crm_pipeline_history',
    'crm_tags','crm_lead_tags','crm_suppression_list','crm_activity_metrics','crm_deals']
  LOOP
    EXECUTE format(
      'CREATE POLICY "%s_admin" ON %s FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin'')) WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = ''admin''))',
      t, t
    );
  END LOOP;
END $$;

-- Sales agents: read all, write own
CREATE POLICY "crm_outreach_agent_read"    ON crm_outreach_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
CREATE POLICY "crm_outreach_agent_insert"  ON crm_outreach_events FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "crm_notes_agent_read"       ON crm_notes            FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
CREATE POLICY "crm_notes_agent_write"      ON crm_notes            FOR INSERT TO authenticated WITH CHECK (agent_id = auth.uid());
CREATE POLICY "crm_tasks_agent_read"       ON crm_tasks            FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
CREATE POLICY "crm_tasks_agent_write"      ON crm_tasks            FOR ALL    TO authenticated USING (agent_id = auth.uid()) WITH CHECK (agent_id = auth.uid());
CREATE POLICY "crm_metrics_agent_own"      ON crm_activity_metrics FOR SELECT TO authenticated USING (agent_id = auth.uid());
CREATE POLICY "crm_companies_agent_read"   ON crm_companies        FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
CREATE POLICY "crm_conversations_agent"    ON crm_conversations    FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
CREATE POLICY "crm_assignments_agent"      ON crm_assignments      FOR SELECT TO authenticated USING (agent_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "crm_deals_agent_read"       ON crm_deals            FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','sales_agent')));
