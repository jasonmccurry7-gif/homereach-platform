-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 22: Commission Tracking + Leaderboard Enhancements
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Commission tiers ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_commission_tiers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  min_deals     INT  NOT NULL DEFAULT 0,
  rate_pct      NUMERIC(5,2) NOT NULL,  -- e.g. 10.00 = 10%
  bonus_flat    INT  NOT NULL DEFAULT 0, -- bonus in cents for hitting tier
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO crm_commission_tiers (name, min_deals, rate_pct, bonus_flat) VALUES
  ('Starter',    0,  8.00,    0),
  ('Performer',  5, 10.00,  2500),
  ('Closer',    10, 12.00,  5000),
  ('Elite',     20, 15.00, 10000)
ON CONFLICT DO NOTHING;

-- ── Commission ledger ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crm_commissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  deal_id         UUID REFERENCES crm_deals(id) ON DELETE SET NULL,
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  gross_revenue   INT  NOT NULL DEFAULT 0,  -- cents
  commission_rate NUMERIC(5,2) NOT NULL,
  commission_amt  INT  NOT NULL DEFAULT 0,  -- cents
  bonus_amt       INT  NOT NULL DEFAULT 0,  -- cents
  tier_name       TEXT NOT NULL DEFAULT 'Starter',
  paid_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_commissions_agent ON crm_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_crm_commissions_period ON crm_commissions(period_start, period_end);

-- ── Period performance rollup ─────────────────────────────────────────────────
-- Materialized view (refresh daily) for fast leaderboard reads
CREATE TABLE IF NOT EXISTS crm_leaderboard_cache (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period           TEXT NOT NULL,  -- 'today' | 'week' | 'month' | 'all_time'
  period_date      DATE NOT NULL,
  messages_sent    INT  NOT NULL DEFAULT 0,
  replies          INT  NOT NULL DEFAULT 0,
  deals_closed     INT  NOT NULL DEFAULT 0,
  revenue_cents    INT  NOT NULL DEFAULT 0,
  reply_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  close_rate       NUMERIC(5,2) NOT NULL DEFAULT 0,
  avg_deal_cents   INT  NOT NULL DEFAULT 0,
  rank_overall     INT,
  rank_revenue     INT,
  rank_close_rate  INT,
  commission_cents INT  NOT NULL DEFAULT 0,
  tier_name        TEXT NOT NULL DEFAULT 'Starter',
  refreshed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, period, period_date)
);

CREATE INDEX IF NOT EXISTS idx_crm_leaderboard_period ON crm_leaderboard_cache(period, period_date);

-- ── RPC: refresh leaderboard cache for a period ───────────────────────────────
CREATE OR REPLACE FUNCTION refresh_leaderboard(p_period TEXT, p_date DATE)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Delete stale entries for this period/date
  DELETE FROM crm_leaderboard_cache WHERE period = p_period AND period_date = p_date;

  -- Recompute from sales_events + crm_deals
  WITH period_bounds AS (
    SELECT
      CASE p_period
        WHEN 'today' THEN p_date
        WHEN 'week'  THEN p_date - INTERVAL '7 days'
        WHEN 'month' THEN p_date - INTERVAL '30 days'
        ELSE DATE '2000-01-01'
      END AS start_ts,
      p_date + INTERVAL '1 day' AS end_ts
  ),
  agent_msgs AS (
    SELECT
      se.agent_id,
      COUNT(*) FILTER (WHERE se.action_type IN ('sms_sent','email_sent','fb_message_sent','follow_up_sent')) AS messages_sent,
      COUNT(*) FILTER (WHERE se.action_type IN ('reply_received','fb_reply_received'))                        AS replies,
      COUNT(*) FILTER (WHERE se.action_type = 'deal_closed')                                                  AS deals_closed,
      COALESCE(SUM(se.revenue_cents) FILTER (WHERE se.action_type = 'deal_closed'), 0)                        AS revenue_cents
    FROM sales_events se, period_bounds pb
    WHERE se.created_at >= pb.start_ts AND se.created_at < pb.end_ts
    GROUP BY se.agent_id
  ),
  with_rates AS (
    SELECT *,
      CASE WHEN messages_sent > 0 THEN ROUND((replies::numeric / messages_sent) * 100, 2) ELSE 0 END AS reply_rate,
      CASE WHEN replies > 0 THEN ROUND((deals_closed::numeric / replies) * 100, 2) ELSE 0 END         AS close_rate,
      CASE WHEN deals_closed > 0 THEN (revenue_cents / deals_closed)::int ELSE 0 END                  AS avg_deal_cents
    FROM agent_msgs
  ),
  with_tier AS (
    SELECT wr.*,
      ct.name AS tier_name,
      ct.rate_pct,
      ROUND(wr.revenue_cents * ct.rate_pct / 100)::int AS commission_cents
    FROM with_rates wr
    LEFT JOIN LATERAL (
      SELECT name, rate_pct FROM crm_commission_tiers
      WHERE min_deals <= wr.deals_closed
      ORDER BY min_deals DESC LIMIT 1
    ) ct ON true
  )
  INSERT INTO crm_leaderboard_cache
    (agent_id, period, period_date, messages_sent, replies, deals_closed, revenue_cents,
     reply_rate, close_rate, avg_deal_cents, rank_overall, rank_revenue, rank_close_rate,
     commission_cents, tier_name, refreshed_at)
  SELECT
    agent_id, p_period, p_date, messages_sent, replies, deals_closed, revenue_cents,
    reply_rate, close_rate, avg_deal_cents,
    ROW_NUMBER() OVER (ORDER BY deals_closed DESC, revenue_cents DESC) AS rank_overall,
    ROW_NUMBER() OVER (ORDER BY revenue_cents DESC)                    AS rank_revenue,
    ROW_NUMBER() OVER (ORDER BY close_rate DESC)                       AS rank_close_rate,
    COALESCE(commission_cents, 0),
    COALESCE(tier_name, 'Starter'),
    now()
  FROM with_tier;
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE crm_commission_tiers   ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_commissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_leaderboard_cache  ENABLE ROW LEVEL SECURITY;

-- Commission tiers: public read
CREATE POLICY "tiers_read_all" ON crm_commission_tiers FOR SELECT USING (true);

-- Commissions: agent sees own, admin sees all
CREATE POLICY "commissions_agent_read" ON crm_commissions FOR SELECT
  USING (agent_id = auth.uid() OR (auth.jwt()->'app_metadata'->>'user_role') = 'admin');

CREATE POLICY "commissions_admin_write" ON crm_commissions FOR ALL
  USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

CREATE POLICY "commissions_service" ON crm_commissions FOR ALL
  USING (auth.role() = 'service_role');

-- Leaderboard cache: authenticated read, service write
CREATE POLICY "leaderboard_auth_read" ON crm_leaderboard_cache FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "leaderboard_service_write" ON crm_leaderboard_cache FOR ALL
  USING (auth.role() = 'service_role');
