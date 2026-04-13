-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 25: Agent Identities + Send Rate Limiting
-- Enables per-agent email/SMS sending with enforced daily limits
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Agent outbound identities ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_identities (
  agent_id         UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  -- Email sending
  from_email       TEXT,            -- e.g. jason@home-reach.com
  from_name        TEXT,            -- e.g. Jason
  mailgun_domain   TEXT,            -- override if agent uses different domain
  reply_to_email   TEXT,            -- optional
  -- SMS sending
  twilio_phone     TEXT,            -- E.164 format: +1XXXXXXXXXX (agent's assigned number)
  twilio_msgsvc_sid TEXT,           -- optional: Twilio Messaging Service SID
  -- Daily limits
  email_daily_limit  INT NOT NULL DEFAULT 30,  -- start with 30, ramp to 100
  sms_daily_limit    INT NOT NULL DEFAULT 150,
  -- Ramp tracking (email warmup)
  email_ramp_day       INT NOT NULL DEFAULT 1,
  email_ramp_started   DATE,
  -- Status
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Daily send counters ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_daily_send_counts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  send_date   DATE NOT NULL,
  channel     TEXT NOT NULL,  -- 'email' | 'sms'
  sent_count  INT NOT NULL DEFAULT 0,
  UNIQUE(agent_id, send_date, channel)
);

CREATE INDEX IF NOT EXISTS idx_daily_counts_agent_date ON agent_daily_send_counts(agent_id, send_date);

-- ── RPC: check + increment daily send count (atomic) ─────────────────────────
CREATE OR REPLACE FUNCTION check_and_increment_send_count(
  p_agent_id UUID,
  p_channel  TEXT,
  p_date     DATE DEFAULT CURRENT_DATE
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_limit     INT;
  v_current   INT;
  v_identity  RECORD;
BEGIN
  -- Get agent limit
  SELECT
    CASE p_channel WHEN 'email' THEN email_daily_limit ELSE sms_daily_limit END,
    from_email, twilio_phone, is_active
  INTO v_identity
  FROM agent_identities WHERE agent_id = p_agent_id;

  IF NOT FOUND OR NOT v_identity.is_active THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'no_identity_or_inactive');
  END IF;

  v_limit := CASE p_channel WHEN 'email' THEN
    (SELECT email_daily_limit FROM agent_identities WHERE agent_id = p_agent_id)
  ELSE
    (SELECT sms_daily_limit FROM agent_identities WHERE agent_id = p_agent_id)
  END;

  -- Get current count
  SELECT COALESCE(sent_count, 0) INTO v_current
  FROM agent_daily_send_counts
  WHERE agent_id = p_agent_id AND send_date = p_date AND channel = p_channel;

  IF COALESCE(v_current, 0) >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_reached',
      'limit', v_limit,
      'sent', v_current
    );
  END IF;

  -- Increment atomically
  INSERT INTO agent_daily_send_counts (agent_id, send_date, channel, sent_count)
  VALUES (p_agent_id, p_date, p_channel, 1)
  ON CONFLICT (agent_id, send_date, channel)
  DO UPDATE SET sent_count = agent_daily_send_counts.sent_count + 1;

  RETURN jsonb_build_object(
    'allowed', true,
    'sent', COALESCE(v_current, 0) + 1,
    'limit', v_limit,
    'remaining', v_limit - COALESCE(v_current, 0) - 1
  );
END;
$$;

-- ── RPC: advance email ramp (call daily) ─────────────────────────────────────
CREATE OR REPLACE FUNCTION advance_email_ramp(p_agent_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_day INT;
  v_new_limit INT;
BEGIN
  SELECT email_ramp_day INTO v_day
  FROM agent_identities WHERE agent_id = p_agent_id;

  -- Ramp schedule: day 1-7: 30/day, day 8-14: 50/day, day 15+: 100/day
  v_new_limit := CASE
    WHEN v_day < 8  THEN 30
    WHEN v_day < 15 THEN 50
    ELSE 100
  END;

  UPDATE agent_identities
  SET
    email_ramp_day    = email_ramp_day + 1,
    email_daily_limit = v_new_limit,
    updated_at        = now()
  WHERE agent_id = p_agent_id;
END;
$$;

-- ── Message variation tracking (prevent identical messages) ──────────────────
CREATE TABLE IF NOT EXISTS agent_message_hashes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lead_id    UUID NOT NULL REFERENCES sales_leads(id) ON DELETE CASCADE,
  channel    TEXT NOT NULL,
  msg_hash   TEXT NOT NULL,   -- SHA-256 of message body
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, lead_id, channel, msg_hash)
);

CREATE INDEX IF NOT EXISTS idx_msg_hashes_agent ON agent_message_hashes(agent_id, channel);

-- ── Seed agent identities for the three agents ───────────────────────────────
-- NOTE: agent_id UUIDs must be updated to match actual Supabase auth.users UUIDs
-- after Jason creates the accounts. These are placeholder entries.
-- Update via: UPDATE agent_identities SET agent_id = '<real_uuid>' WHERE from_email = 'jason@home-reach.com'

-- Jason's identity (update agent_id after confirming from Supabase)
-- Josh's identity (create after Josh's account is made)
-- Heather's identity (create after Heather's account is made)

-- Template insert (run AFTER creating actual user accounts):
-- INSERT INTO agent_identities (agent_id, from_email, from_name, twilio_phone, email_daily_limit, sms_daily_limit, email_ramp_day, email_ramp_started)
-- VALUES (
--   '<jason_uuid>',    -- from Supabase auth.users
--   'jason@home-reach.com',
--   'Jason',
--   '+1XXXXXXXXXX',    -- Jason's actual Twilio number
--   100,               -- Jason is past warmup
--   150,
--   15,
--   CURRENT_DATE - 14
-- );

-- ── Sender health view ────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW v_sender_health AS
SELECT
  ai.agent_id,
  p.full_name,
  ai.from_email,
  ai.twilio_phone,
  ai.email_daily_limit,
  ai.sms_daily_limit,
  ai.email_ramp_day,
  -- Today's counts
  COALESCE(email_today.sent_count, 0) AS emails_sent_today,
  COALESCE(sms_today.sent_count, 0)   AS sms_sent_today,
  -- 7-day reply rate
  COALESCE(
    (COUNT(se_replies.id)::float / NULLIF(COUNT(se_sends.id), 0)) * 100,
    0
  ) AS reply_rate_7d,
  -- Health flags
  CASE
    WHEN COALESCE(email_today.sent_count, 0) >= ai.email_daily_limit * 0.9 THEN 'high_volume'
    WHEN COALESCE(
      (COUNT(se_replies.id)::float / NULLIF(COUNT(se_sends.id), 0)), 1
    ) < 0.02 AND COUNT(se_sends.id) > 20 THEN 'low_reply_risk'
    ELSE 'healthy'
  END AS health_status
FROM agent_identities ai
JOIN profiles p ON p.id = ai.agent_id
LEFT JOIN agent_daily_send_counts email_today
  ON email_today.agent_id = ai.agent_id AND email_today.send_date = CURRENT_DATE AND email_today.channel = 'email'
LEFT JOIN agent_daily_send_counts sms_today
  ON sms_today.agent_id = ai.agent_id AND sms_today.send_date = CURRENT_DATE AND sms_today.channel = 'sms'
LEFT JOIN sales_events se_sends
  ON se_sends.agent_id = ai.agent_id
  AND se_sends.action_type IN ('text_sent','email_sent')
  AND se_sends.created_at >= now() - INTERVAL '7 days'
LEFT JOIN sales_events se_replies
  ON se_replies.agent_id = ai.agent_id
  AND se_replies.action_type IN ('reply_received')
  AND se_replies.created_at >= now() - INTERVAL '7 days'
GROUP BY ai.agent_id, p.full_name, ai.from_email, ai.twilio_phone,
  ai.email_daily_limit, ai.sms_daily_limit, ai.email_ramp_day,
  email_today.sent_count, sms_today.sent_count;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE agent_identities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_daily_send_counts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_message_hashes       ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identities_admin_all"   ON agent_identities        FOR ALL    USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "identities_agent_read"  ON agent_identities        FOR SELECT USING (agent_id = auth.uid());
CREATE POLICY "identities_service"     ON agent_identities        FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "counts_agent_read"      ON agent_daily_send_counts FOR SELECT USING (agent_id = auth.uid() OR (auth.jwt()->'app_metadata'->>'user_role') = 'admin');
CREATE POLICY "counts_service"         ON agent_daily_send_counts FOR ALL    USING (auth.role() = 'service_role');

CREATE POLICY "hashes_service"         ON agent_message_hashes    FOR ALL    USING (auth.role() = 'service_role');
CREATE POLICY "hashes_agent_read"      ON agent_message_hashes    FOR SELECT USING (agent_id = auth.uid());
