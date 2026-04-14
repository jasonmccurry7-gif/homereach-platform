-- ============================================================================
-- HomeReach Sales Event System: Missing RPC Functions & Tables
-- ============================================================================
-- Safe to run multiple times - all operations use IF NOT EXISTS
-- Purpose: Ensure all database functions and tables exist for sales/event route
-- ============================================================================

-- ============================================================================
-- 1. Ensure sales_leads has all required columns for message tracking
-- ============================================================================

ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS total_messages_sent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS total_replies INTEGER NOT NULL DEFAULT 0;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ;
ALTER TABLE sales_leads ADD COLUMN IF NOT EXISTS last_reply_at TIMESTAMPTZ;

-- ============================================================================
-- 2. RPC: increment_lead_messages
-- ============================================================================
-- Called from sales/event route to increment message count
-- Usage: await supabase.rpc("increment_lead_messages", { lead_uuid: UUID })

CREATE OR REPLACE FUNCTION increment_lead_messages(lead_uuid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE sales_leads
  SET total_messages_sent = COALESCE(total_messages_sent, 0) + 1,
      last_contacted_at = NOW(),
      updated_at = NOW()
  WHERE id = lead_uuid;
END;
$$;

-- ============================================================================
-- 3. agent_message_hashes Table
-- ============================================================================
-- Purpose: Store SHA256 hashes to prevent duplicate message sends
-- Schema: Stores hash of message content per lead + agent
-- Indexes: Optimized for lead lookups and hash deduplication checks

CREATE TABLE IF NOT EXISTS agent_message_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id TEXT,
  lead_id UUID REFERENCES sales_leads(id) ON DELETE CASCADE,
  message_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(lead_id, message_hash)
);

CREATE INDEX IF NOT EXISTS idx_msg_hashes_lead ON agent_message_hashes(lead_id);
CREATE INDEX IF NOT EXISTS idx_msg_hashes_hash ON agent_message_hashes(message_hash);
CREATE INDEX IF NOT EXISTS idx_msg_hashes_created ON agent_message_hashes(created_at DESC);

-- ============================================================================
-- 4. RPC: check_and_increment_send_count
-- ============================================================================
-- Purpose: Enforce daily send limits per agent per channel
-- Returns: JSON with {allowed: boolean, reason?: string, limit: int, current: int}
-- Channels: 'sms' or 'email'
-- Default limits: SMS 150/day, Email 30/day (overridable per agent)

CREATE OR REPLACE FUNCTION check_and_increment_send_count(
  p_agent_id UUID,
  p_channel TEXT,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_current_count INTEGER;
  v_limit INTEGER;
  v_agent_limit INTEGER;
BEGIN
  -- Get agent's configured daily limit for this channel
  SELECT CASE
    WHEN p_channel = 'sms' THEN sms_daily_limit
    ELSE email_daily_limit
  END
  INTO v_agent_limit
  FROM agent_identities WHERE agent_id = p_agent_id;

  -- Use agent limit if set, otherwise use defaults
  v_limit := COALESCE(v_agent_limit,
    CASE WHEN p_channel = 'sms' THEN 150 ELSE 30 END
  );

  -- Upsert daily send count
  INSERT INTO agent_daily_send_counts (agent_id, send_date, channel, count)
  VALUES (p_agent_id, p_date, p_channel, 1)
  ON CONFLICT (agent_id, send_date, channel) DO UPDATE
  SET count = agent_daily_send_counts.count + 1
  RETURNING count INTO v_current_count;

  -- Check if limit exceeded
  IF v_current_count > v_limit THEN
    -- Rollback: decrement the count we just incremented
    UPDATE agent_daily_send_counts
    SET count = count - 1
    WHERE agent_id = p_agent_id AND send_date = p_date AND channel = p_channel;

    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'daily_limit_exceeded',
      'limit', v_limit,
      'current', v_current_count - 1
    );
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current_count,
    'limit', v_limit
  );
END;
$$;

-- ============================================================================
-- 5. agent_daily_send_counts Table
-- ============================================================================
-- Purpose: Track daily send counts per agent per channel
-- Used by: check_and_increment_send_count RPC for rate limiting
-- Constraint: Only one row per agent + date + channel combo

CREATE TABLE IF NOT EXISTS agent_daily_send_counts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID,
  send_date DATE NOT NULL DEFAULT CURRENT_DATE,
  channel TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(agent_id, send_date, channel)
);

CREATE INDEX IF NOT EXISTS idx_daily_counts_agent_date
  ON agent_daily_send_counts(agent_id, send_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_counts_channel
  ON agent_daily_send_counts(channel);

-- ============================================================================
-- 6. Ensure sales_events has all required columns
-- ============================================================================

ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE sales_events ADD COLUMN IF NOT EXISTS event_type TEXT DEFAULT 'message_sent';

-- ============================================================================
-- 7. Verification Queries
-- ============================================================================
-- Run these to confirm all objects were created successfully

SELECT 'Verification Results' as check_type;

SELECT 'increment_lead_messages function' as object,
       COUNT(*) > 0 as exists
FROM pg_proc
WHERE proname = 'increment_lead_messages'
UNION ALL
SELECT 'agent_message_hashes table',
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_message_hashes')
UNION ALL
SELECT 'agent_daily_send_counts table',
       EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_daily_send_counts')
UNION ALL
SELECT 'check_and_increment_send_count function',
       COUNT(*) > 0
FROM pg_proc
WHERE proname = 'check_and_increment_send_count'
UNION ALL
SELECT 'sales_leads.total_messages_sent column',
       EXISTS(
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'sales_leads' AND column_name = 'total_messages_sent'
       )
UNION ALL
SELECT 'sales_leads.total_replies column',
       EXISTS(
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'sales_leads' AND column_name = 'total_replies'
       )
UNION ALL
SELECT 'sales_events.metadata column',
       EXISTS(
         SELECT 1 FROM information_schema.columns
         WHERE table_name = 'sales_events' AND column_name = 'metadata'
       );
