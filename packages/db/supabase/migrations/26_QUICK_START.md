# Territory System - Quick Start

## Files
- `26_territory_assignments.sql` - Main migration (284 lines)
- `26_TERRITORY_ASSIGNMENTS_README.md` - Full documentation
- `26_QUICK_START.md` - This file

## What Gets Created

### Table
- `agent_territories` - City ↔ Agent assignments (UNIQUE per city)

### Trigger
- `auto_assign_lead_to_agent()` - Fires on new sales_leads INSERT

### Views
- `v_agent_lead_counts` - Agent dashboards (lead counts by status)
- `v_unassigned_cities` - Coverage gaps

### Functions (RPCs)
- `get_agent_for_city(city)` - Find agent for a city
- `reassign_lead_to_agent(lead_id, agent_id)` - Manual reassignment
- `get_agent_territories(agent_id)` - Agent's territories

### Indexes
- `idx_agent_territories_city` - Fast city lookups
- `idx_agent_territories_agent` - Agent dashboards
- `idx_sales_leads_assigned_agent` - Lead queries by agent

---

## Seed Data (Default Assignments)

### Active (8 cities)
```
Josh   → Ravenna, Massillon
Heather → Medina, Wooster
Chris  → Green, Stow
Jason  → Cuyahoga Falls, Hudson
```

### Locked (4 cities, no agent yet)
```
Fairlawn, North Canton, Twinsburg, Strongsville
```

---

## Critical: UUID Replacement

The SQL uses placeholder UUIDs. **You MUST update them after deploying.**

### Placeholders in SQL
```
Josh:    00000000-0000-0000-0000-000000000001
Heather: 00000000-0000-0000-0000-000000000002
Chris:   00000000-0000-0000-0000-000000000003
Jason:   00000000-0000-0000-0000-000000000004
```

### How to Update

1. **Create auth.users** (Supabase Dashboard → Authentication → Users)

2. **Get real UUIDs:**
   ```sql
   SELECT id, email FROM auth.users 
   WHERE email IN ('josh@...', 'heather@...', 'chris@...', 'jason@...');
   ```

3. **Update territories:**
   ```sql
   UPDATE agent_territories
   SET agent_id = '<JOSH_REAL_UUID>'
   WHERE city IN ('Ravenna', 'Massillon');

   UPDATE agent_territories
   SET agent_id = '<HEATHER_REAL_UUID>'
   WHERE city IN ('Medina', 'Wooster');

   UPDATE agent_territories
   SET agent_id = '<CHRIS_REAL_UUID>'
   WHERE city IN ('Green', 'Stow');

   UPDATE agent_territories
   SET agent_id = '<JASON_REAL_UUID>'
   WHERE city IN ('Cuyahoga Falls', 'Hudson');
   ```

---

## How It Works

### New Leads
1. Lead inserted into `sales_leads` with a city
2. Trigger fires, looks up city in `agent_territories`
3. If match found and `is_active = TRUE` → auto-assigns `assigned_agent_id`
4. Done! No manual assignment needed

### Manual Reassignment
```sql
SELECT reassign_lead_to_agent(
  'lead-id',
  'new-agent-id'
);
```

### Dashboard Queries
```sql
-- See all agent territories + lead counts
SELECT * FROM v_agent_lead_counts;

-- See unassigned cities
SELECT * FROM v_unassigned_cities;

-- Get Josh's territories
SELECT * FROM get_agent_territories('<josh-uuid>');
```

---

## RLS (Access Control)

**Agents:** Can read territories (read-only)  
**Admins:** Full access (create, update, delete)  
**Service role:** Full access (API use)

---

## Key Features

✓ **Exclusive assignments** - UNIQUE(city) prevents conflicts  
✓ **Automatic routing** - Trigger auto-assigns new leads  
✓ **Soft deletes** - `is_active` flag preserves history  
✓ **Case-insensitive** - Handles city name variations  
✓ **Safe re-runs** - IF NOT EXISTS on all CREATE statements  
✓ **Manual overrides** - Reassign function for edge cases  
✓ **Dashboard views** - Territory overview + coverage gaps  

---

## Testing Checklist

After deploying:

- [ ] UUID replacement complete
- [ ] `SELECT COUNT(*) FROM agent_territories;` → should be 12 (8 active + 4 locked)
- [ ] `SELECT * FROM v_agent_lead_counts;` → shows all agents with lead counts
- [ ] `SELECT * FROM v_unassigned_cities;` → should be empty or show unintended cities
- [ ] Insert test lead with assigned city → check `assigned_agent_id` is populated
- [ ] Try `SELECT * FROM get_agent_for_city('Ravenna');` → returns Josh's details
- [ ] Check RLS policies on `agent_territories` table

---

## Rollback

If you need to remove this system (not recommended):

```sql
DROP TABLE agent_territories CASCADE;
```

This will:
- Drop the table
- Drop the trigger (CASCADE)
- Drop the views (CASCADE)

However, the `assigned_agent_id` column on `sales_leads` will remain.
To fully remove, also run:

```sql
ALTER TABLE sales_leads DROP COLUMN assigned_agent_id;
```

---

## Files in This Migration

| File | Size | Purpose |
|------|------|---------|
| `26_territory_assignments.sql` | 13 KB | Main SQL migration |
| `26_TERRITORY_ASSIGNMENTS_README.md` | 8.1 KB | Full documentation |
| `26_QUICK_START.md` | This file | Quick reference |

---

## Support

See `26_TERRITORY_ASSIGNMENTS_README.md` for detailed docs on:
- Schema design
- Trigger behavior
- RLS policies
- Example queries
- Integration patterns
