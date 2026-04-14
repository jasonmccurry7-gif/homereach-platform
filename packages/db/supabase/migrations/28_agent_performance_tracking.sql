-- Agent performance metrics and monitoring
-- Aggregated daily statistics and real-time performance views

CREATE TABLE IF NOT EXISTS agent_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT NOT NULL REFERENCES agent_registry(id),
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Activity
  runs INTEGER NOT NULL DEFAULT 0,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  leads_processed INTEGER NOT NULL DEFAULT 0,

  -- Messaging
  sms_sent INTEGER NOT NULL DEFAULT 0,
  emails_sent INTEGER NOT NULL DEFAULT 0,
  fb_drafts_generated INTEGER NOT NULL DEFAULT 0,

  -- Outcomes
  replies_received INTEGER NOT NULL DEFAULT 0,
  reply_rate NUMERIC(5,2) DEFAULT 0,
  leads_converted INTEGER NOT NULL DEFAULT 0,
  revenue_influenced_cents INTEGER NOT NULL DEFAULT 0,

  -- Errors
  errors INTEGER NOT NULL DEFAULT 0,
  error_rate NUMERIC(5,2) DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(agent_id, stat_date)
);

-- Index for efficient daily stats lookups
CREATE INDEX IF NOT EXISTS idx_agent_daily_stats_agent_date ON agent_daily_stats(agent_id, stat_date DESC);
CREATE INDEX IF NOT EXISTS idx_agent_daily_stats_date ON agent_daily_stats(stat_date DESC);

-- Live performance view across all agents
CREATE OR REPLACE VIEW v_agent_performance AS
SELECT
  ar.id as agent_id,
  ar.name,
  ar.layer,
  ar.role,
  ar.is_active,
  ar.completion_pct,
  ar.last_run_at,
  ar.last_run_status,

  -- Today's stats
  COALESCE(today.runs, 0) as runs_today,
  COALESCE(today.sms_sent, 0) as sms_today,
  COALESCE(today.emails_sent, 0) as emails_today,
  COALESCE(today.replies_received, 0) as replies_today,
  COALESCE(today.reply_rate, 0) as reply_rate_today,
  COALESCE(today.revenue_influenced_cents, 0) as revenue_today_cents,
  COALESCE(today.errors, 0) as errors_today,

  -- 7-day totals
  COALESCE(week.total_sms, 0) as sms_7d,
  COALESCE(week.total_emails, 0) as emails_7d,
  COALESCE(week.total_revenue, 0) as revenue_7d_cents,
  COALESCE(week.avg_reply_rate, 0) as avg_reply_rate_7d

FROM agent_registry ar
LEFT JOIN agent_daily_stats today ON today.agent_id = ar.id AND today.stat_date = CURRENT_DATE
LEFT JOIN (
  SELECT
    agent_id,
    SUM(sms_sent) as total_sms,
    SUM(emails_sent) as total_emails,
    SUM(revenue_influenced_cents) as total_revenue,
    AVG(reply_rate) as avg_reply_rate
  FROM agent_daily_stats
  WHERE stat_date >= CURRENT_DATE - INTERVAL '7 days'
  GROUP BY agent_id
) week ON week.agent_id = ar.id

ORDER BY ar.layer, ar.name;

-- Enable RLS on agent_daily_stats
ALTER TABLE agent_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_full_access_agent_daily_stats" ON agent_daily_stats;
CREATE POLICY "service_role_full_access_agent_daily_stats" ON agent_daily_stats
  AS PERMISSIVE FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_only_agent_daily_stats" ON agent_daily_stats;
CREATE POLICY "authenticated_read_only_agent_daily_stats" ON agent_daily_stats
  AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (true);

-- Function to log an agent run and update all related tables atomically
CREATE OR REPLACE FUNCTION log_agent_run(
  p_agent_id TEXT,
  p_status TEXT,
  p_actions INT DEFAULT 0,
  p_messages_sent INT DEFAULT 0,
  p_revenue_cents INT DEFAULT 0,
  p_error TEXT DEFAULT NULL,
  p_leads_processed INT DEFAULT 0,
  p_leads_converted INT DEFAULT 0,
  p_sms_sent INT DEFAULT 0,
  p_emails_sent INT DEFAULT 0,
  p_replies_received INT DEFAULT 0
)
RETURNS UUID AS $$
DECLARE
  v_run_id UUID;
  v_reply_rate NUMERIC(5,2);
BEGIN
  -- Validate agent exists
  IF NOT EXISTS (SELECT 1 FROM agent_registry WHERE id = p_agent_id) THEN
    RAISE EXCEPTION 'Agent % does not exist', p_agent_id;
  END IF;

  -- Validate status
  IF p_status NOT IN ('success', 'error', 'skipped', 'partial') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be success, error, skipped, or partial.', p_status;
  END IF;

  -- 1. Insert into agent_run_log
  INSERT INTO agent_run_log (
    agent_id,
    run_at,
    status,
    actions_taken,
    leads_processed,
    messages_sent,
    revenue_influenced_cents,
    error_message,
    metadata
  ) VALUES (
    p_agent_id,
    NOW(),
    p_status,
    p_actions,
    p_leads_processed,
    p_messages_sent,
    p_revenue_cents,
    p_error,
    jsonb_build_object(
      'sms_sent', p_sms_sent,
      'emails_sent', p_emails_sent,
      'leads_converted', p_leads_converted,
      'replies_received', p_replies_received
    )
  ) RETURNING id INTO v_run_id;

  -- 2. Update agent_registry with run metadata
  UPDATE agent_registry
  SET
    last_run_at = NOW(),
    last_run_status = p_status,
    run_count_today = CASE
      WHEN DATE(last_run_at) = CURRENT_DATE THEN run_count_today + 1
      ELSE 1
    END,
    run_count_total = run_count_total + 1,
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- 3. Calculate reply rate if we have messages sent
  v_reply_rate := CASE
    WHEN p_sms_sent + p_emails_sent > 0 THEN
      ROUND((p_replies_received::NUMERIC / (p_sms_sent + p_emails_sent)) * 100, 2)
    ELSE 0
  END;

  -- 4. Upsert into agent_daily_stats for today
  INSERT INTO agent_daily_stats (
    agent_id,
    stat_date,
    runs,
    actions_executed,
    leads_processed,
    sms_sent,
    emails_sent,
    replies_received,
    reply_rate,
    leads_converted,
    revenue_influenced_cents,
    errors,
    error_rate
  ) VALUES (
    p_agent_id,
    CURRENT_DATE,
    1,
    p_actions,
    p_leads_processed,
    p_sms_sent,
    p_emails_sent,
    p_replies_received,
    v_reply_rate,
    p_leads_converted,
    p_revenue_cents,
    CASE WHEN p_status = 'error' THEN 1 ELSE 0 END,
    CASE WHEN p_status = 'error' THEN 100 ELSE 0 END
  )
  ON CONFLICT (agent_id, stat_date) DO UPDATE
  SET
    runs = agent_daily_stats.runs + 1,
    actions_executed = agent_daily_stats.actions_executed + EXCLUDED.actions_executed,
    leads_processed = agent_daily_stats.leads_processed + EXCLUDED.leads_processed,
    sms_sent = agent_daily_stats.sms_sent + EXCLUDED.sms_sent,
    emails_sent = agent_daily_stats.emails_sent + EXCLUDED.emails_sent,
    replies_received = agent_daily_stats.replies_received + EXCLUDED.replies_received,
    leads_converted = agent_daily_stats.leads_converted + EXCLUDED.leads_converted,
    revenue_influenced_cents = agent_daily_stats.revenue_influenced_cents + EXCLUDED.revenue_influenced_cents,
    errors = agent_daily_stats.errors + EXCLUDED.errors,
    updated_at = NOW(),
    -- Recalculate reply_rate after aggregation
    reply_rate = CASE
      WHEN (agent_daily_stats.sms_sent + agent_daily_stats.emails_sent +
            EXCLUDED.sms_sent + EXCLUDED.emails_sent) > 0 THEN
        ROUND(((agent_daily_stats.replies_received + EXCLUDED.replies_received)::NUMERIC /
               (agent_daily_stats.sms_sent + agent_daily_stats.emails_sent +
                EXCLUDED.sms_sent + EXCLUDED.emails_sent)) * 100, 2)
      ELSE 0
    END;

  -- Return the run log ID
  RETURN v_run_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution permission to service_role
GRANT EXECUTE ON FUNCTION log_agent_run TO service_role, authenticated;

-- Function to get a summary of agent performance for the current day
CREATE OR REPLACE FUNCTION get_agent_daily_summary(p_agent_id TEXT DEFAULT NULL)
RETURNS TABLE (
  agent_id TEXT,
  agent_name TEXT,
  layer TEXT,
  runs_today INTEGER,
  sms_sent INTEGER,
  emails_sent INTEGER,
  replies_received INTEGER,
  reply_rate NUMERIC,
  revenue_today_cents INTEGER,
  errors_today INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ar.id,
    ar.name,
    ar.layer,
    COALESCE(today.runs, 0),
    COALESCE(today.sms_sent, 0),
    COALESCE(today.emails_sent, 0),
    COALESCE(today.replies_received, 0),
    COALESCE(today.reply_rate, 0),
    COALESCE(today.revenue_influenced_cents, 0),
    COALESCE(today.errors, 0)
  FROM agent_registry ar
  LEFT JOIN agent_daily_stats today ON today.agent_id = ar.id AND today.stat_date = CURRENT_DATE
  WHERE p_agent_id IS NULL OR ar.id = p_agent_id
  ORDER BY ar.layer, ar.name;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION get_agent_daily_summary TO service_role, authenticated;

-- Function to reset daily counters at midnight (run as scheduled job)
CREATE OR REPLACE FUNCTION reset_daily_run_counters()
RETURNS TABLE (
  agent_id TEXT,
  reset_count INTEGER
) AS $$
BEGIN
  UPDATE agent_registry
  SET run_count_today = 0
  WHERE run_count_today > 0;

  RETURN QUERY
  SELECT ar.id, 0
  FROM agent_registry ar;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION reset_daily_run_counters TO service_role;
