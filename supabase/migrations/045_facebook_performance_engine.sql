-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 045: Facebook Performance Engine
-- Additive only — no changes to existing tables.
-- Creates dedicated tables for Facebook engagement tracking, scoring,
-- alert events, and sales opportunity association.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. facebook_activity_logs ─────────────────────────────────────────────────
-- One row per logged Facebook task completion by a rep.
CREATE TABLE IF NOT EXISTS facebook_activity_logs (
  id                        uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id                  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type                 text        NOT NULL,
  -- task_type enum:
  --   authority_post | power_comment | conversation_builder
  --   dm_conversion | group_contribution | sales_opportunity_followup

  -- Context
  city                      text,
  category                  text,
  lead_id                   uuid        REFERENCES sales_leads(id) ON DELETE SET NULL,

  -- What they did
  proof_text                text,
  proof_url                 text,
  script_used               text,

  -- Engagement depth tracking
  thread_depth              integer     DEFAULT 1,   -- number of replies in thread
  prospect_type             text,                    -- business_owner | homeowner | unknown
  dm_converted              boolean     DEFAULT false,
  business_owner_interaction boolean    DEFAULT false,

  -- Next step tracking
  next_action               text,       -- continue_thread | move_to_dm | send_intake | call | nurture
  outcome                   text,       -- replied | no_reply | dm_started | intake_sent | call_booked

  -- Quality scoring (0-100, not vanity-based)
  quality_score             integer     DEFAULT 50,
  -- Score breakdown:
  --   +10 proof_url provided
  --   +15 thread_depth >= 2
  --   +20 dm_converted = true
  --   +15 business_owner_interaction = true
  --   +5  next_action set

  created_at                timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_logs_agent_id   ON facebook_activity_logs (agent_id);
CREATE INDEX IF NOT EXISTS idx_fb_logs_created_at ON facebook_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fb_logs_task_type  ON facebook_activity_logs (task_type);
CREATE INDEX IF NOT EXISTS idx_fb_logs_city       ON facebook_activity_logs (city);

-- ── 2. facebook_performance_scores ────────────────────────────────────────────
-- Daily snapshot of each rep's Facebook performance scores.
-- Computed at end of day or on demand.
CREATE TABLE IF NOT EXISTS facebook_performance_scores (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score_date            date        NOT NULL DEFAULT CURRENT_DATE,

  -- Score breakdown (0–100 each)
  visibility_score      integer     DEFAULT 0,
  engagement_score      integer     DEFAULT 0,
  conversion_score      integer     DEFAULT 0,
  revenue_opp_score     integer     DEFAULT 0,
  overall_score         integer     DEFAULT 0,

  -- Raw activity counts for the day
  posts_completed       integer     DEFAULT 0,
  comments_completed    integer     DEFAULT 0,
  conversations_active  integer     DEFAULT 0,
  dm_transitions        integer     DEFAULT 0,
  group_posts           integer     DEFAULT 0,
  sales_followups       integer     DEFAULT 0,

  -- Depth metrics
  avg_thread_depth      numeric(4,2) DEFAULT 0,
  avg_quality_score     integer      DEFAULT 0,
  biz_owner_interactions integer     DEFAULT 0,
  dm_converted_count    integer      DEFAULT 0,

  -- Streak tracking
  streak_days           integer     DEFAULT 0,

  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now(),

  UNIQUE (agent_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_fb_scores_agent_date ON facebook_performance_scores (agent_id, score_date DESC);

-- ── 3. facebook_alert_events ──────────────────────────────────────────────────
-- Tracks Twilio alerts sent to reps for Facebook engagement opportunities.
-- Kept SEPARATE from customer/business texting flows.
CREATE TABLE IF NOT EXISTS facebook_alert_events (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type      text        NOT NULL,
  -- alert_type enum:
  --   comment_reply | dm_opportunity | hot_thread | biz_owner_engaged
  --   intake_ready | thread_waiting | warm_opportunity
  --   daily_mission_done | streak_milestone

  message         text        NOT NULL,
  context         jsonb       DEFAULT '{}',
  priority        text        NOT NULL DEFAULT 'medium', -- high | medium | low

  -- Delivery status
  delivery_status text        NOT NULL DEFAULT 'pending', -- pending | sent | failed | delivered
  sent_to_phone   text,
  twilio_sid      text,
  error_detail    text,

  -- Deduplication
  acknowledged_at timestamptz,

  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_alerts_agent_id   ON facebook_alert_events (agent_id);
CREATE INDEX IF NOT EXISTS idx_fb_alerts_created_at ON facebook_alert_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fb_alerts_priority   ON facebook_alert_events (priority) WHERE delivery_status = 'sent';

-- ── 4. facebook_sales_opportunities ──────────────────────────────────────────
-- Tracks Facebook public interactions that have been identified as
-- potential sales opportunities. Links to city/category inventory.
CREATE TABLE IF NOT EXISTS facebook_sales_opportunities (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id             uuid        REFERENCES sales_leads(id) ON DELETE SET NULL,

  -- Opportunity context
  prospect_name       text,
  prospect_fb_url     text,
  city                text,
  category            text,
  source_thread_url   text,
  source_type         text,       -- post_comment | group_post | dm | mention

  -- Sales stage
  opportunity_stage   text        NOT NULL DEFAULT 'engaged',
  -- engaged | dm_started | intake_ready | call_booked | closed | nurture

  -- City/category slot context
  has_open_slot       boolean     DEFAULT false,
  spot_type           text,       -- front | back | anchor | targeted_campaign

  -- Scoring
  opportunity_score   integer     DEFAULT 50,    -- 0-100
  is_business_owner   boolean     DEFAULT false,
  likely_category     text,

  -- Notes
  notes               text,
  next_action         text,
  next_action_at      timestamptz,

  -- Conversion tracking
  intake_sent_at      timestamptz,
  deal_closed_at      timestamptz,

  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fb_opps_agent_id ON facebook_sales_opportunities (agent_id);
CREATE INDEX IF NOT EXISTS idx_fb_opps_stage    ON facebook_sales_opportunities (opportunity_stage);
CREATE INDEX IF NOT EXISTS idx_fb_opps_city     ON facebook_sales_opportunities (city);

-- ── 5. facebook_streak_tracking ──────────────────────────────────────────────
-- Per-agent Facebook engagement streaks.
CREATE TABLE IF NOT EXISTS facebook_streak_tracking (
  agent_id            uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_streak      integer     DEFAULT 0,
  longest_streak      integer     DEFAULT 0,
  total_active_days   integer     DEFAULT 0,
  last_active_date    date,
  streak_broken_at    timestamptz,
  updated_at          timestamptz DEFAULT now()
);

-- ── 6. Row-level security (same pattern as rest of system) ────────────────────
ALTER TABLE facebook_activity_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_performance_scores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_alert_events            ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_sales_opportunities     ENABLE ROW LEVEL SECURITY;
ALTER TABLE facebook_streak_tracking         ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (consistent with all API routes using createServiceClient)
-- No additional policies needed for service-role access.

-- Allow authenticated users to view their own records
CREATE POLICY "fb_logs_own"     ON facebook_activity_logs
  FOR ALL USING (auth.uid() = agent_id);

CREATE POLICY "fb_scores_own"   ON facebook_performance_scores
  FOR ALL USING (auth.uid() = agent_id);

CREATE POLICY "fb_alerts_own"   ON facebook_alert_events
  FOR SELECT USING (auth.uid() = agent_id);

CREATE POLICY "fb_opps_own"     ON facebook_sales_opportunities
  FOR ALL USING (auth.uid() = agent_id);

CREATE POLICY "fb_streak_own"   ON facebook_streak_tracking
  FOR ALL USING (auth.uid() = agent_id);

-- ── 7. Helpful function: compute daily score snapshot ─────────────────────────
CREATE OR REPLACE FUNCTION compute_facebook_daily_score(p_agent_id uuid, p_date date)
RETURNS void AS $$
DECLARE
  v_posts      integer;
  v_comments   integer;
  v_convos     integer;
  v_dms        integer;
  v_groups     integer;
  v_followups  integer;
  v_biz_owner  integer;
  v_dm_conv    integer;
  v_avg_depth  numeric;
  v_avg_qual   integer;
  v_vis_score  integer;
  v_eng_score  integer;
  v_conv_score integer;
  v_rev_score  integer;
  v_overall    integer;
BEGIN
  -- Count by type for the day
  SELECT
    COUNT(*) FILTER (WHERE task_type = 'authority_post'),
    COUNT(*) FILTER (WHERE task_type = 'power_comment'),
    COUNT(*) FILTER (WHERE task_type = 'conversation_builder'),
    COUNT(*) FILTER (WHERE task_type = 'dm_conversion'),
    COUNT(*) FILTER (WHERE task_type = 'group_contribution'),
    COUNT(*) FILTER (WHERE task_type = 'sales_opportunity_followup'),
    COUNT(*) FILTER (WHERE business_owner_interaction = true),
    COUNT(*) FILTER (WHERE dm_converted = true),
    COALESCE(AVG(thread_depth), 1),
    COALESCE(AVG(quality_score), 50)
  INTO v_posts, v_comments, v_convos, v_dms, v_groups, v_followups,
       v_biz_owner, v_dm_conv, v_avg_depth, v_avg_qual
  FROM facebook_activity_logs
  WHERE agent_id = p_agent_id
    AND created_at::date = p_date;

  -- Compute sub-scores
  v_vis_score  := LEAST(100, (v_posts::float/2 * 40 + v_groups::float/2 * 30 + v_comments::float/10 * 30)::int);
  v_eng_score  := LEAST(100, (v_convos::float/5 * 40 + v_avg_depth/3 * 30 + v_comments::float/10 * 30)::int);
  v_conv_score := LEAST(100, (v_dms::float/5 * 50 + v_dm_conv::float/3 * 30 + v_followups::float/5 * 20)::int);
  v_rev_score  := LEAST(100, (v_biz_owner::float/3 * 50 + v_followups::float/5 * 30 + v_dm_conv::float/3 * 20)::int);
  v_overall    := (v_vis_score + v_eng_score + v_conv_score + v_rev_score) / 4;

  -- Upsert score snapshot
  INSERT INTO facebook_performance_scores (
    agent_id, score_date,
    visibility_score, engagement_score, conversion_score, revenue_opp_score, overall_score,
    posts_completed, comments_completed, conversations_active, dm_transitions, group_posts, sales_followups,
    avg_thread_depth, avg_quality_score, biz_owner_interactions, dm_converted_count,
    updated_at
  ) VALUES (
    p_agent_id, p_date,
    v_vis_score, v_eng_score, v_conv_score, v_rev_score, v_overall,
    v_posts, v_comments, v_convos, v_dms, v_groups, v_followups,
    v_avg_depth, v_avg_qual, v_biz_owner, v_dm_conv,
    now()
  )
  ON CONFLICT (agent_id, score_date) DO UPDATE SET
    visibility_score      = EXCLUDED.visibility_score,
    engagement_score      = EXCLUDED.engagement_score,
    conversion_score      = EXCLUDED.conversion_score,
    revenue_opp_score     = EXCLUDED.revenue_opp_score,
    overall_score         = EXCLUDED.overall_score,
    posts_completed       = EXCLUDED.posts_completed,
    comments_completed    = EXCLUDED.comments_completed,
    conversations_active  = EXCLUDED.conversations_active,
    dm_transitions        = EXCLUDED.dm_transitions,
    group_posts           = EXCLUDED.group_posts,
    sales_followups       = EXCLUDED.sales_followups,
    avg_thread_depth      = EXCLUDED.avg_thread_depth,
    avg_quality_score     = EXCLUDED.avg_quality_score,
    biz_owner_interactions = EXCLUDED.biz_owner_interactions,
    dm_converted_count    = EXCLUDED.dm_converted_count,
    updated_at            = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
