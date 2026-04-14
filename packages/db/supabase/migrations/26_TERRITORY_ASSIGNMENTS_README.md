# Migration 26: Territory Assignment System

## Overview

This migration implements an exclusive territory assignment system for HomeReach sales agents. Each city is assigned to exactly one agent, with automatic lead routing and comprehensive reporting.

## Components Created

### 1. Core Table: `agent_territories`

**Schema:**
```sql
CREATE TABLE agent_territories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  city TEXT NOT NULL,  -- matches sales_leads.city exactly
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(city)  -- one agent per city, enforce exclusivity
);
```

**Features:**
- Enforces one agent per city via UNIQUE constraint
- Soft-deletes via `is_active` flag (preserve history, exclude from routing)
- Cascades on agent deletion
- Indexing on `city` (fast lookups) and `agent_id` (agent dashboards)

---

### 2. Trigger: Automatic Lead Assignment

**Function:** `auto_assign_lead_to_agent()`

Fires on **BEFORE INSERT** to `sales_leads`, checks if the lead's city has an active territory, and automatically assigns the agent if found.

**Behavior:**
- Case-insensitive city matching
- Only assigns if `is_active = TRUE` (locks out inactive territories)
- Leaves `assigned_agent_id = NULL` if no territory match found

**SQL:**
```sql
CREATE TRIGGER trg_auto_assign_lead
BEFORE INSERT ON sales_leads
FOR EACH ROW
EXECUTE FUNCTION auto_assign_lead_to_agent();
```

---

### 3. Views

#### `v_agent_lead_counts` - Territory Overview Dashboard

Shows each agent's territory assignments with lead counts by status.

**Columns:**
- `agent_id`, `agent_name`, `city`, `is_active`
- `total_leads`, `leads_queued`, `leads_contacted`, `leads_replied`, `leads_interested`, `leads_payment_sent`, `leads_closed`, `leads_dead`
- `total_messages_sent`, `total_replies`
- `created_at`, `updated_at`

**Use Case:** Agent dashboards, lead forecasting, territory performance tracking

#### `v_unassigned_cities` - Cities Awaiting Assignment

Shows all cities in `sales_leads` that do NOT have an active territory agent.

**Columns:**
- `city`

**Use Case:** Identify gaps in coverage, prioritize new territories

---

### 4. Helper Functions (RPCs)

#### `get_agent_for_city(p_city TEXT)` → TABLE

Returns the agent assigned to a given city (if active territory exists).

**Returns:**
- `agent_id`, `full_name`, `from_email` (for outbound sending)

**Example:**
```sql
SELECT * FROM get_agent_for_city('Ravenna');
-- Returns Josh's UUID, full name, and email
```

#### `reassign_lead_to_agent(p_lead_id UUID, p_agent_id UUID)` → JSONB

Manually reassign a lead to a different agent (overrides territory assignment).

**Returns:**
```json
{
  "success": true,
  "lead_id": "...",
  "previous_agent_id": "...",
  "new_agent_id": "...",
  "city": "Ravenna"
}
```

#### `get_agent_territories(p_agent_id UUID)` → TABLE

Returns all territories (cities) assigned to a given agent.

**Returns:**
- `city`, `is_active`, `total_leads`

---

### 5. Backfill

The migration includes an automatic backfill statement that assigns `assigned_agent_id` to all existing leads in `sales_leads` based on their city and the `agent_territories` table:

```sql
UPDATE sales_leads sl
SET assigned_agent_id = at.agent_id, updated_at = NOW()
FROM agent_territories at
WHERE LOWER(sl.city) = LOWER(at.city)
  AND at.is_active = TRUE
  AND sl.assigned_agent_id IS NULL;
```

This is idempotent and safe to run multiple times.

---

## Seed Data

### Active Territories (with Agents)

| Agent   | Cities              |
|---------|---------------------|
| Josh    | Ravenna, Massillon  |
| Heather | Medina, Wooster     |
| Chris   | Green, Stow         |
| Jason   | Cuyahoga Falls, Hudson |

### Locked Territories (no Agent)

| City          | Status              |
|---------------|---------------------|
| Fairlawn      | Inactive (reserved) |
| North Canton  | Inactive (reserved) |
| Twinsburg     | Inactive (reserved) |
| Strongsville  | Inactive (reserved) |

---

## UUID Replacement (CRITICAL)

The migration uses placeholder UUIDs for all agents:

```
Josh:    00000000-0000-0000-0000-000000000001
Heather: 00000000-0000-0000-0000-000000000002
Chris:   00000000-0000-0000-0000-000000000003
Jason:   00000000-0000-0000-0000-000000000004
```

**You MUST replace these with real Supabase `auth.users` UUIDs after creating the accounts.**

### Steps

1. **Create auth.users** in Supabase Dashboard → Authentication → Users
2. **Get UUIDs:**
   ```sql
   SELECT id, email FROM auth.users WHERE email IN ('josh@...', 'heather@...', 'chris@...', 'jason@...');
   ```
3. **Update territories:**
   ```sql
   UPDATE agent_territories
   SET agent_id = 'JOSH_REAL_UUID'
   WHERE city IN ('Ravenna', 'Massillon');

   -- Repeat for Heather, Chris, Jason
   ```

---

## Row-Level Security (RLS)

**`agent_territories` Policies:**

| Policy | Role | Access |
|--------|------|--------|
| `territories_admin` | Authenticated + admin role | Full (SELECT, INSERT, UPDATE, DELETE) |
| `territories_service` | Service role | Full |
| `territories_agent_read` | Authenticated + sales_agent role | SELECT only |

Agents can read all territories but cannot modify them.

---

## Production Safety Features

- **IF NOT EXISTS** on all CREATE statements (safe to re-run)
- **UNIQUE(city)** constraint prevents duplicate assignments
- **ON CONFLICT** in seed data allows safe re-runs
- **is_active** flag enables soft-delete without losing history
- **Cascading delete** on agent deletion cleans up territories
- **LOWER()** case-insensitive city matching
- **Comprehensive comments** throughout SQL

---

## Example Queries

### View all active territories
```sql
SELECT * FROM v_agent_lead_counts WHERE is_active = TRUE;
```

### Check unassigned cities
```sql
SELECT * FROM v_unassigned_cities;
```

### Get agent for a city
```sql
SELECT * FROM get_agent_for_city('Ravenna');
```

### Manually reassign a lead
```sql
SELECT reassign_lead_to_agent(
  'lead-uuid-here',
  'agent-uuid-here'
);
```

### Get all territories for Josh
```sql
SELECT * FROM get_agent_territories('josh-uuid-here');
```

### Rerun backfill for new leads
```sql
UPDATE sales_leads sl
SET assigned_agent_id = at.agent_id, updated_at = NOW()
FROM agent_territories at
WHERE LOWER(sl.city) = LOWER(at.city)
  AND at.is_active = TRUE
  AND sl.assigned_agent_id IS NULL;
```

---

## Integration Points

### Dashboard
- Use `v_agent_lead_counts` to show each agent's territory and lead stats
- Query `v_unassigned_cities` to flag coverage gaps

### Lead Import/Creation
- The `trg_auto_assign_lead` trigger automatically assigns new leads
- No manual assignment needed (unless lead is in an unassigned city)

### Outbound Communication
- Use `get_agent_for_city()` to find the agent's email/SMS details
- Check agent identities from `agent_identities` table (join on agent_id)

### Reassignment Workflows
- Use `reassign_lead_to_agent()` for manual overrides
- Logs previous + new assignment in return value

---

## Indexes Created

| Index | Table | Columns | Use Case |
|-------|-------|---------|----------|
| `idx_agent_territories_city` | agent_territories | city | Fast territory lookups by city |
| `idx_agent_territories_agent` | agent_territories | agent_id | Agent dashboard queries |
| `idx_sales_leads_assigned_agent` | sales_leads | assigned_agent_id | Agent lead dashboards |

---

## Next Steps

1. Deploy this migration to Supabase
2. Create auth.users for Josh, Heather, Chris, Jason
3. Replace placeholder UUIDs with real ones
4. Verify via `v_agent_lead_counts` and `v_unassigned_cities`
5. Deploy frontend dashboard using these views/RPCs
6. Test new lead creation (should auto-assign)
7. Test manual reassignment workflow

---

## Notes

- The system is **additive**: you can add new territories/agents anytime without migration
- Locked territories (Fairlawn, North Canton, Twinsburg, Strongsville) can be activated later by updating their `agent_id` and `is_active = TRUE`
- The trigger is case-insensitive to handle data inconsistencies
- All RPCs have `SECURITY DEFINER` to bypass RLS (controlled admin access)
