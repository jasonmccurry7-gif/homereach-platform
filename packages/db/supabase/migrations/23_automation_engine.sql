-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 23: Automation Engine — Email + SMS Sequences
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Enums ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE auto_channel AS ENUM ('sms', 'email');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auto_sequence_status AS ENUM ('active', 'paused', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auto_enrollment_status AS ENUM (
    'active', 'completed', 'stopped', 'unsubscribed', 'bounced'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Sequence definitions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_sequences (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  channel       auto_channel NOT NULL,
  category      TEXT,            -- null = applies to all categories
  city          TEXT,            -- null = applies to all cities
  status        auto_sequence_status NOT NULL DEFAULT 'active',
  stop_on_reply BOOLEAN NOT NULL DEFAULT true,
  description   TEXT,
  created_by    UUID REFERENCES profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Sequence steps ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_sequence_steps (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id    UUID NOT NULL REFERENCES auto_sequences(id) ON DELETE CASCADE,
  step_number    INT  NOT NULL,  -- 1-based
  delay_hours    INT  NOT NULL DEFAULT 0,  -- hours after previous step (or enrollment for step 1)
  subject        TEXT,           -- email only
  body           TEXT NOT NULL,  -- supports {{business_name}}, {{contact_name}}, {{city}}, {{category}}
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sequence_id, step_number)
);

-- ── Lead enrollments ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id     UUID NOT NULL REFERENCES auto_sequences(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  agent_id        UUID REFERENCES profiles(id),
  status          auto_enrollment_status NOT NULL DEFAULT 'active',
  current_step    INT NOT NULL DEFAULT 1,
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_send_at    TIMESTAMPTZ,
  stopped_at      TIMESTAMPTZ,
  stop_reason     TEXT,
  completed_at    TIMESTAMPTZ,
  UNIQUE(sequence_id, lead_id)  -- one enrollment per sequence per lead
);

CREATE INDEX IF NOT EXISTS idx_auto_enrollments_lead     ON auto_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_auto_enrollments_next     ON auto_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_auto_enrollments_sequence ON auto_enrollments(sequence_id, status);

-- ── Send log ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_send_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id UUID NOT NULL REFERENCES auto_enrollments(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES auto_sequence_steps(id),
  lead_id       UUID NOT NULL REFERENCES sales_leads(id),
  channel       auto_channel NOT NULL,
  to_address    TEXT NOT NULL,   -- phone or email
  subject       TEXT,
  body_rendered TEXT NOT NULL,   -- after variable substitution
  sent_at       TIMESTAMPTZ,
  status        TEXT NOT NULL DEFAULT 'queued',  -- queued|sent|failed|skipped
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_send_log_enrollment ON auto_send_log(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_auto_send_log_lead       ON auto_send_log(lead_id);

-- ── Stop-on-reply trigger ─────────────────────────────────────────────────────
-- When a reply is logged to sales_events, stop all active enrollments for that lead
CREATE OR REPLACE FUNCTION stop_enrollments_on_reply()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.action_type IN ('reply_received') THEN
    UPDATE auto_enrollments
    SET
      status     = 'stopped',
      stopped_at = now(),
      stop_reason = 'reply_received'
    WHERE
      lead_id  = NEW.lead_id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stop_on_reply ON sales_events;
CREATE TRIGGER trg_stop_on_reply
  AFTER INSERT ON sales_events
  FOR EACH ROW EXECUTE FUNCTION stop_enrollments_on_reply();

-- ── RPC: enroll lead in sequence ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION enroll_lead_in_sequence(
  p_lead_id     UUID,
  p_sequence_id UUID,
  p_agent_id    UUID DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_enrollment_id UUID;
  v_first_delay   INT;
BEGIN
  -- Check lead is not DNC or suppressed
  IF EXISTS (
    SELECT 1 FROM sales_leads
    WHERE id = p_lead_id AND (do_not_contact = true OR sms_opt_out = true)
  ) THEN
    RAISE EXCEPTION 'Lead is DNC/opt-out';
  END IF;

  -- Get delay of first step
  SELECT delay_hours INTO v_first_delay
  FROM auto_sequence_steps
  WHERE sequence_id = p_sequence_id AND step_number = 1;

  -- Insert enrollment (upsert: re-activate if previously stopped)
  INSERT INTO auto_enrollments (sequence_id, lead_id, agent_id, status, current_step, enrolled_at, next_send_at)
  VALUES (
    p_sequence_id, p_lead_id, p_agent_id, 'active', 1,
    now(), now() + (COALESCE(v_first_delay, 0) * INTERVAL '1 hour')
  )
  ON CONFLICT (sequence_id, lead_id)
  DO UPDATE SET
    status       = 'active',
    current_step = 1,
    enrolled_at  = now(),
    stopped_at   = NULL,
    stop_reason  = NULL,
    next_send_at = now() + (COALESCE(v_first_delay, 0) * INTERVAL '1 hour')
  RETURNING id INTO v_enrollment_id;

  RETURN v_enrollment_id;
END;
$$;

-- ── Seed default sequences ─────────────────────────────────────────────────────
INSERT INTO auto_sequences (name, channel, stop_on_reply, description)
VALUES
  ('SMS Cold Outreach',    'sms',   true, '3-step SMS sequence for cold leads'),
  ('Email Cold Outreach',  'email', true, '3-step email sequence for cold leads'),
  ('SMS Follow-Up',        'sms',   true, '2-step follow-up after initial contact')
ON CONFLICT DO NOTHING;

-- ── Seed SMS cold sequence steps ──────────────────────────────────────────────
WITH seq AS (SELECT id FROM auto_sequences WHERE name = 'SMS Cold Outreach' LIMIT 1)
INSERT INTO auto_sequence_steps (sequence_id, step_number, delay_hours, body)
SELECT
  seq.id,
  s.step_number,
  s.delay_hours,
  s.body
FROM seq, (VALUES
  (1, 0,  'Hi {{contact_name}}, I''m reaching out from HomeReach — we help {{category}} businesses in {{city}} get more clients through direct mail. Would you have 5 minutes this week? 🏠'),
  (2, 48, 'Following up from HomeReach, {{contact_name}}! We''re running a campaign for {{category}} businesses in {{city}} this month. Limited spots left — want to grab one?'),
  (3, 96, 'Last outreach, {{contact_name}}. HomeReach direct mail gets your {{category}} business in front of homeowners in {{city}} who are actively buying. Reply STOP to opt out anytime.')
) AS s(step_number, delay_hours, body)
ON CONFLICT DO NOTHING;

-- ── Seed Email cold sequence steps ────────────────────────────────────────────
WITH seq AS (SELECT id FROM auto_sequences WHERE name = 'Email Cold Outreach' LIMIT 1)
INSERT INTO auto_sequence_steps (sequence_id, step_number, delay_hours, subject, body)
SELECT
  seq.id,
  s.step_number,
  s.delay_hours,
  s.subject,
  s.body
FROM seq, (VALUES
  (1, 0,   'Get more {{category}} clients in {{city}}',
            'Hi {{contact_name}},\n\nI wanted to reach out about HomeReach — we help {{category}} businesses in {{city}} connect with homeowners through targeted direct mail.\n\nOur advertisers typically see 3–8 new leads per month. Would love to show you how it works.\n\nBest,\nHomeReach Team'),
  (2, 72,  'Quick follow-up — HomeReach for {{business_name}}',
            'Hi {{contact_name}},\n\nJust following up on my last email. We have a few open spots for {{category}} businesses in {{city}} this month.\n\nIf you''re looking to grow your client base, I''d love to chat.\n\nBest,\nHomeReach Team'),
  (3, 144, 'Last email from HomeReach',
            'Hi {{contact_name}},\n\nI''ll keep this short — if now isn''t the right time to grow your {{category}} business in {{city}}, no worries at all.\n\nFeel free to reach out anytime when you''re ready. We''d love to work with {{business_name}}.\n\nBest,\nHomeReach Team')
) AS s(step_number, delay_hours, subject, body)
ON CONFLICT DO NOTHING;

-- ── Seed SMS follow-up sequence steps ─────────────────────────────────────────
WITH seq AS (SELECT id FROM auto_sequences WHERE name = 'SMS Follow-Up' LIMIT 1)
INSERT INTO auto_sequence_steps (sequence_id, step_number, delay_hours, body)
SELECT
  seq.id,
  s.step_number,
  s.delay_hours,
  s.body
FROM seq, (VALUES
  (1, 24, 'Hey {{contact_name}}, just checking in from HomeReach. Did you get my last message? Happy to answer any questions about our {{city}} {{category}} campaign.'),
  (2, 72, 'One more follow-up from HomeReach, {{contact_name}}. Our {{city}} direct mail campaign for {{category}} is filling up fast. Reply YES if you''d like details, or STOP to opt out.')
) AS s(step_number, delay_hours, body)
ON CONFLICT DO NOTHING;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE auto_sequences       ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_sequence_steps  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_enrollments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_send_log        ENABLE ROW LEVEL SECURITY;

-- Sequences + steps: authenticated read, admin write
CREATE POLICY "sequences_auth_read"   ON auto_sequences      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sequences_admin_write" ON auto_sequences      FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "steps_auth_read"       ON auto_sequence_steps FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "steps_admin_write"     ON auto_sequence_steps FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

-- Enrollments: agent sees own + admin sees all
CREATE POLICY "enrollments_agent_read" ON auto_enrollments FOR SELECT
  USING (agent_id = auth.uid() OR (auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "enrollments_agent_write" ON auto_enrollments FOR INSERT
  WITH CHECK (agent_id = auth.uid() OR (auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "enrollments_admin_update" ON auto_enrollments FOR UPDATE
  USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin' OR agent_id = auth.uid());
CREATE POLICY "enrollments_service" ON auto_enrollments FOR ALL
  USING (auth.role() = 'service_role');

-- Send log: agent sees own lead logs + admin sees all
CREATE POLICY "send_log_auth_read"    ON auto_send_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "send_log_service_write" ON auto_send_log FOR ALL   USING (auth.role() = 'service_role');
