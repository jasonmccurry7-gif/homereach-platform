-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 26: Territory Assignment System
-- Exclusive city assignments to sales agents with automatic lead routing
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Agent Territories: one agent per city, enforced ──────────────────────────

CREATE TABLE IF NOT EXISTS agent_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  city TEXT NOT NULL,  -- matches sales_leads.city exactly
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city)  -- one agent per city, enforce exclusivity
);

CREATE INDEX IF NOT EXISTS idx_agent_territories_city ON agent_territories(city);
CREATE INDEX IF NOT EXISTS idx_agent_territories_agent ON agent_territories(agent_id);

-- ── Trigger function: Auto-assign leads to agents based on territory ────────
-- Fires on INSERT to sales_leads, checks if city has an assigned agent
-- Sets assigned_agent_id if territory match found

CREATE OR REPLACE FUNCTION auto_assign_lead_to_agent()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_agent_id UUID;
BEGIN
  -- Look up the city in agent_territories
  SELECT agent_id INTO v_agent_id
  FROM agent_territories
  WHERE LOWER(city) = LOWER(NEW.city) AND is_active = TRUE
  LIMIT 1;

  -- If a territory is found, assign the agent
  IF v_agent_id IS NOT NULL THEN
    NEW.assigned_agent_id := v_agent_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on sales_leads INSERT
CREATE TRIGGER IF NOT EXISTS trg_auto_assign_lead
BEFORE INSERT ON sales_leads
FOR EACH ROW
EXECUTE FUNCTION auto_assign_lead_to_agent();

-- ── Index on sales_leads.assigned_agent_id for dashboard queries ───────────
-- Used for agent lead dashboards and lead counts

CREATE INDEX IF NOT EXISTS idx_sales_leads_assigned_agent ON sales_leads(assigned_agent_id);

-- ── View: Agent Lead Counts and Territory Overview ────────────────────────

CREATE OR REPLACE VIEW v_agent_lead_counts AS
SELECT
  at.id AS territory_id,
  at.agent_id,
  p.full_name AS agent_name,
  at.city,
  at.is_active,
  COUNT(DISTINCT sl.id) AS total_leads,
  COUNT(DISTINCT CASE WHEN sl.status = 'queued'      THEN sl.id END) AS leads_queued,
  COUNT(DISTINCT CASE WHEN sl.status = 'contacted'   THEN sl.id END) AS leads_contacted,
  COUNT(DISTINCT CASE WHEN sl.status = 'replied'     THEN sl.id END) AS leads_replied,
  COUNT(DISTINCT CASE WHEN sl.status = 'interested'  THEN sl.id END) AS leads_interested,
  COUNT(DISTINCT CASE WHEN sl.status = 'payment_sent' THEN sl.id END) AS leads_payment_sent,
  COUNT(DISTINCT CASE WHEN sl.status = 'closed'      THEN sl.id END) AS leads_closed,
  COUNT(DISTINCT CASE WHEN sl.status = 'dead'        THEN sl.id END) AS leads_dead,
  COALESCE(SUM(sl.total_messages_sent), 0) AS total_messages_sent,
  COALESCE(SUM(sl.total_replies), 0) AS total_replies,
  at.created_at,
  at.updated_at
FROM agent_territories at
LEFT JOIN profiles p ON p.id = at.agent_id
LEFT JOIN sales_leads sl ON LOWER(sl.city) = LOWER(at.city)
GROUP BY at.id, at.agent_id, p.full_name, at.city, at.is_active, at.created_at, at.updated_at
ORDER BY at.agent_id, at.city;

-- ── View: Unassigned Cities (no territory agent) ──────────────────────────

CREATE OR REPLACE VIEW v_unassigned_cities AS
SELECT DISTINCT sl.city
FROM sales_leads sl
WHERE NOT EXISTS (
  SELECT 1 FROM agent_territories at
  WHERE LOWER(at.city) = LOWER(sl.city) AND at.is_active = TRUE
)
AND sl.city IS NOT NULL
ORDER BY sl.city;

-- ── RPC: Reassign lead to agent (manual) ──────────────────────────────────

CREATE OR REPLACE FUNCTION reassign_lead_to_agent(
  p_lead_id UUID,
  p_agent_id UUID
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_lead RECORD;
BEGIN
  -- Fetch the lead
  SELECT id, city, assigned_agent_id INTO v_lead
  FROM sales_leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Lead not found');
  END IF;

  -- Update the lead's agent
  UPDATE sales_leads
  SET assigned_agent_id = p_agent_id, updated_at = NOW()
  WHERE id = p_lead_id;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'previous_agent_id', v_lead.assigned_agent_id,
    'new_agent_id', p_agent_id,
    'city', v_lead.city
  );
END;
$$;

-- ── RPC: Get agent for city ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_agent_for_city(p_city TEXT)
RETURNS TABLE(agent_id UUID, full_name TEXT, from_email TEXT) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    at.agent_id,
    p.full_name,
    ai.from_email
  FROM agent_territories at
  LEFT JOIN profiles p ON p.id = at.agent_id
  LEFT JOIN agent_identities ai ON ai.agent_id = at.agent_id
  WHERE LOWER(at.city) = LOWER(p_city)
    AND at.is_active = TRUE
  LIMIT 1;
$$;

-- ── RPC: Get all territories for an agent ─────────────────────────────────

CREATE OR REPLACE FUNCTION get_agent_territories(p_agent_id UUID)
RETURNS TABLE(city TEXT, is_active BOOLEAN, total_leads INT) LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    at.city,
    at.is_active,
    COUNT(DISTINCT sl.id)::INT AS total_leads
  FROM agent_territories at
  LEFT JOIN sales_leads sl ON LOWER(sl.city) = LOWER(at.city)
  WHERE at.agent_id = p_agent_id
  GROUP BY at.city, at.is_active
  ORDER BY at.city;
$$;

-- ── Backfill: Assign existing sales_leads based on territory ───────────────
-- This retroactively assigns all unassigned or mis-assigned leads

UPDATE sales_leads sl
SET assigned_agent_id = at.agent_id, updated_at = NOW()
FROM agent_territories at
WHERE LOWER(sl.city) = LOWER(at.city)
  AND at.is_active = TRUE
  AND sl.assigned_agent_id IS NULL;

-- ── TERRITORY SEED DATA ──────────────────────────────────────────────────────
-- IMPORTANT: Replace placeholder UUIDs with real Supabase auth.users UUIDs
-- Get the actual UUIDs from Supabase → Authentication → Users
--
-- Replace these placeholders:
-- JOSH_UUID:     run `SELECT id FROM auth.users WHERE email = 'josh@...'`
-- HEATHER_UUID:  run `SELECT id FROM auth.users WHERE email = 'heather@...'`
-- CHRIS_UUID:    run `SELECT id FROM auth.users WHERE email = 'chris@...'`
-- JASON_UUID:    run `SELECT id FROM auth.users WHERE email = 'jason@...'`
--
-- Then update the INSERT statement below with real UUIDs.

-- Delete existing seed data (safe to re-run migration)
DELETE FROM agent_territories
WHERE city IN ('Ravenna', 'Massillon', 'Medina', 'Wooster', 'Green', 'Stow', 'Cuyahoga Falls', 'Hudson', 'Fairlawn', 'North Canton', 'Twinsburg', 'Strongsville');

-- Seed active territories (assigned agents)
-- Josh → Ravenna, Massillon
INSERT INTO agent_territories (agent_id, city, is_active)
VALUES
  -- !! REPLACE '00000000-0000-0000-0000-000000000001' WITH JOSH'S REAL UUID !!
  ('00000000-0000-0000-0000-000000000001', 'Ravenna', TRUE),
  ('00000000-0000-0000-0000-000000000001', 'Massillon', TRUE),

  -- !! REPLACE '00000000-0000-0000-0000-000000000002' WITH HEATHER'S REAL UUID !!
  ('00000000-0000-0000-0000-000000000002', 'Medina', TRUE),
  ('00000000-0000-0000-0000-000000000002', 'Wooster', TRUE),

  -- !! REPLACE '00000000-0000-0000-0000-000000000003' WITH CHRIS'S REAL UUID !!
  ('00000000-0000-0000-0000-000000000003', 'Green', TRUE),
  ('00000000-0000-0000-0000-000000000003', 'Stow', TRUE),

  -- !! REPLACE '00000000-0000-0000-0000-000000000004' WITH JASON'S REAL UUID !!
  ('00000000-0000-0000-0000-000000000004', 'Cuyahoga Falls', TRUE),
  ('00000000-0000-0000-0000-000000000004', 'Hudson', TRUE)
ON CONFLICT (city) DO UPDATE SET
  agent_id = EXCLUDED.agent_id,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- Seed LOCKED territories (no agent assigned, blocked from auto-assignment)
-- These cities exist in sales_leads but are not yet assigned to any agent.
-- Set is_active = FALSE to mark them as locked (no new assignments).
INSERT INTO agent_territories (agent_id, city, is_active)
VALUES
  -- Locked cities: NULL agent_id means "reserved" or "on hold"
  -- Use a sentinel NULL to indicate these are placeholders
  (NULL, 'Fairlawn', FALSE),
  (NULL, 'North Canton', FALSE),
  (NULL, 'Twinsburg', FALSE),
  (NULL, 'Strongsville', FALSE)
ON CONFLICT (city) DO UPDATE SET
  agent_id = EXCLUDED.agent_id,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE agent_territories ENABLE ROW LEVEL SECURITY;

-- Admin: full access
CREATE POLICY IF NOT EXISTS "territories_admin" ON agent_territories FOR ALL TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  WITH CHECK ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

-- Service role: full access
CREATE POLICY IF NOT EXISTS "territories_service" ON agent_territories FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Agents: read only
CREATE POLICY IF NOT EXISTS "territories_agent_read" ON agent_territories FOR SELECT TO authenticated
  USING ((auth.jwt()->'app_metadata'->>'user_role') IN ('admin', 'sales_agent'));

-- ── Views: RLS ────────────────────────────────────────────────────────────────
-- Views inherit RLS from underlying tables, so no additional policies needed

-- ─────────────────────────────────────────────────────────────────────────────
-- MANUAL STEPS AFTER DEPLOYMENT:
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1. Create Supabase auth.users for: Josh, Heather, Chris, Jason
--    Go to Supabase Dashboard → Authentication → Users → Add user
--
-- 2. Get each user's UUID from auth.users
--    SELECT id, email FROM auth.users WHERE email IN ('josh@...', 'heather@...', 'chris@...', 'jason@...');
--
-- 3. Update agent_territories with real UUIDs:
--    UPDATE agent_territories
--    SET agent_id = 'JOSH_REAL_UUID'
--    WHERE city IN ('Ravenna', 'Massillon');
--
--    UPDATE agent_territories
--    SET agent_id = 'HEATHER_REAL_UUID'
--    WHERE city IN ('Medina', 'Wooster');
--
--    UPDATE agent_territories
--    SET agent_id = 'CHRIS_REAL_UUID'
--    WHERE city IN ('Green', 'Stow');
--
--    UPDATE agent_territories
--    SET agent_id = 'JASON_REAL_UUID'
--    WHERE city IN ('Cuyahoga Falls', 'Hudson');
--
-- 4. (Optional) Run backfill again to assign any new leads added since deployment:
--    UPDATE sales_leads sl
--    SET assigned_agent_id = at.agent_id, updated_at = NOW()
--    FROM agent_territories at
--    WHERE LOWER(sl.city) = LOWER(at.city)
--      AND at.is_active = TRUE
--      AND sl.assigned_agent_id IS NULL;
--
-- 5. Verify territories are working:
--    SELECT * FROM v_agent_lead_counts;
--    SELECT * FROM v_unassigned_cities;
--
-- ─────────────────────────────────────────────────────────────────────────────
