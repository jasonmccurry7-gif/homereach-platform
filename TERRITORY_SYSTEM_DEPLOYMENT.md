# Territory Assignment System - Deployment Instructions

## Overview

A complete territory assignment system has been created for HomeReach to manage exclusive city assignments to sales agents with automatic lead routing.

**Files Location:**
```
packages/db/supabase/migrations/
├── 26_territory_assignments.sql           (main migration - 284 lines)
├── 26_TERRITORY_ASSIGNMENTS_README.md     (full documentation)
└── 26_QUICK_START.md                      (quick reference)
```

## What Was Built

### Database Components
- **1 Table:** `agent_territories` (city ↔ agent mapping with UNIQUE constraint)
- **2 Views:** `v_agent_lead_counts`, `v_unassigned_cities`
- **4 Functions:** Auto-assignment trigger + 3 RPC helpers
- **3 Indexes:** For fast lookups and dashboard queries
- **RLS Policies:** Admin write, agent read, service role full access

### Default Territory Map
```
ACTIVE (8 cities with agents):
  Josh   → Ravenna, Massillon
  Heather → Medina, Wooster
  Chris  → Green, Stow
  Jason  → Cuyahoga Falls, Hudson

LOCKED (4 cities, no agent yet):
  ⊘ Fairlawn, North Canton, Twinsburg, Strongsville
```

## Deployment Checklist

### Step 1: Deploy Migration to Supabase
```bash
# Run in your Supabase migration CLI:
supabase migration up
# or use Supabase dashboard SQL editor to run 26_territory_assignments.sql
```

### Step 2: Create Supabase Auth Users
Go to **Supabase Dashboard → Authentication → Users** and create:
- Josh (josh@homereach.io or similar)
- Heather (heather@homereach.io)
- Chris (chris@homereach.io)
- Jason (jason@homereach.io)

### Step 3: Get Real UUIDs from Supabase
```sql
-- Run this in Supabase SQL editor
SELECT id, email FROM auth.users 
WHERE email IN ('josh@...', 'heather@...', 'chris@...', 'jason@...');
```

Copy the UUIDs returned.

### Step 4: Replace Placeholder UUIDs

The migration contains placeholder UUIDs:
```
Josh:    00000000-0000-0000-0000-000000000001
Heather: 00000000-0000-0000-0000-000000000002
Chris:   00000000-0000-0000-0000-000000000003
Jason:   00000000-0000-0000-0000-000000000004
```

**Replace with real UUIDs** by running these UPDATE statements:

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

### Step 5: Verify Deployment
```sql
-- Check all territories are created
SELECT COUNT(*) FROM agent_territories;
-- Should return: 12 (8 active + 4 locked)

-- View territory overview
SELECT * FROM v_agent_lead_counts;
-- Should show all agents with their cities and lead counts

-- Check unassigned cities
SELECT * FROM v_unassigned_cities;
-- Should be empty or show cities not in the default map
```

### Step 6: Test Auto-Assignment
Create a test lead:
```sql
INSERT INTO sales_leads (business_name, city, state)
VALUES ('Test Business', 'Ravenna', 'OH');

-- Then check:
SELECT assigned_agent_id FROM sales_leads WHERE city = 'Ravenna' LIMIT 1;
-- Should be Josh's UUID
```

### Step 7: Backfill Existing Leads (Optional)
If you have existing leads that need assignment:
```sql
UPDATE sales_leads sl
SET assigned_agent_id = at.agent_id, updated_at = NOW()
FROM agent_territories at
WHERE LOWER(sl.city) = LOWER(at.city)
  AND at.is_active = TRUE
  AND sl.assigned_agent_id IS NULL;
```

### Step 8: Deploy Frontend Dashboard
Use these views/functions in your Next.js app:

**Dashboard Component:**
```typescript
// Get all territories with lead counts
const { data: territories } = await supabase
  .from('v_agent_lead_counts')
  .select('*')
  .eq('is_active', true);

// Show unassigned cities
const { data: unassigned } = await supabase
  .from('v_unassigned_cities')
  .select('city');
```

**Lead Assignment (automatic):**
```typescript
// Insert lead - auto-assignment happens via trigger
const { data: lead } = await supabase
  .from('sales_leads')
  .insert([{ business_name, city, email, phone }])
  .select();

// assigned_agent_id will be populated automatically if city has territory
```

**Manual Reassignment:**
```typescript
// Reassign lead to different agent
const { data: result } = await supabase
  .rpc('reassign_lead_to_agent', {
    p_lead_id: lead_uuid,
    p_agent_id: new_agent_uuid
  });
```

## How It Works

### Automatic Lead Assignment (Most Important)
When a new lead is created:
1. Lead INSERT triggers `auto_assign_lead_to_agent()` function
2. Function looks up the lead's city in `agent_territories`
3. If city has an active territory, agent is auto-assigned
4. If no territory found, `assigned_agent_id` stays NULL

**No manual work needed!**

### Manual Reassignment
If you need to override or reassign:
```sql
SELECT reassign_lead_to_agent('lead-uuid', 'agent-uuid');
```

### Territory Management
Add/remove territories anytime:
```sql
-- Add new territory
INSERT INTO agent_territories (agent_id, city, is_active)
VALUES ('<agent-uuid>', 'New City', TRUE);

-- Deactivate territory (prevent new assignments)
UPDATE agent_territories SET is_active = FALSE WHERE city = 'Old City';

-- Delete territory (with cleanup)
DELETE FROM agent_territories WHERE city = 'Old City';
```

## Documentation

### 26_territory_assignments.sql
Main migration file with:
- Complete SQL implementation
- Comprehensive inline comments
- Seed data with clear instructions
- RLS policies
- Example queries

### 26_TERRITORY_ASSIGNMENTS_README.md
Full technical documentation:
- Component descriptions
- RLS policies and access control
- Example queries and patterns
- Integration points
- Troubleshooting

### 26_QUICK_START.md
Quick reference with:
- What gets created
- UUID replacement instructions
- Common queries
- Testing checklist

## Key Features

Production-Safe:
- IF NOT EXISTS on all DDL (safe to re-run)
- UNIQUE constraint prevents conflicts
- Cascading deletes clean up orphaned data
- ON CONFLICT clauses make seeding idempotent

Secure:
- Row-Level Security (RLS) enabled
- Admin-only write access to territories
- Agent read-only access
- Service role for API automation

Functional:
- Automatic trigger-based assignment
- Manual reassignment function
- Case-insensitive city matching
- Soft-delete via is_active flag

Observable:
- Territory overview dashboard (v_agent_lead_counts)
- Coverage gap detection (v_unassigned_cities)
- Per-agent metrics and lead counts

## Common Questions

**Q: What if a lead's city isn't in any territory?**
A: The trigger leaves `assigned_agent_id = NULL`. You can manually reassign it later or activate a territory for that city.

**Q: Can I change which agent owns a city?**
A: Yes, use: `UPDATE agent_territories SET agent_id = '<new-agent-uuid>' WHERE city = 'City Name';`

**Q: What if I want to prevent new assignments to a city?**
A: Set `is_active = FALSE` on that territory. Existing leads stay assigned, new leads won't be assigned to it.

**Q: How do I see which cities need agents?**
A: Run: `SELECT * FROM v_unassigned_cities;`

**Q: Can agents see each other's territories?**
A: Yes, RLS allows all authenticated users to read territories. They can only modify with admin role.

**Q: What happens when I delete an agent?**
A: All their territories are deleted (ON DELETE CASCADE). Leads stay in the system with NULL `assigned_agent_id`.

## Troubleshooting

### Issue: Placeholder UUIDs still in database
**Fix:** Run the UPDATE statements from Step 4 above.

### Issue: New leads not getting assigned
**Check:**
1. `SELECT * FROM agent_territories WHERE city = 'City Name';` - territory exists?
2. `is_active = TRUE`? If FALSE, set it to TRUE
3. `assigned_agent_id` in territory is a valid UUID?

### Issue: Trigger not firing
**Check:**
1. `SELECT * FROM information_schema.triggers WHERE trigger_name = 'trg_auto_assign_lead';`
2. If not found, re-run the migration
3. Check for SQL errors in migration output

### Issue: RLS blocking queries
**Check:**
1. Are you querying as admin or authenticated user?
2. Service role should have full access
3. See RLS policies in migration file

## Next Steps

1. **Deploy migration** to Supabase
2. **Create auth.users** for all agents
3. **Update placeholder UUIDs** with real ones
4. **Run verification queries** from Step 5 above
5. **Test auto-assignment** with a test lead
6. **Deploy dashboard** to show territories and lead counts
7. **Monitor** using `v_agent_lead_counts` view

## Support

- See **26_TERRITORY_ASSIGNMENTS_README.md** for detailed technical docs
- See **26_QUICK_START.md** for quick command reference
- See **26_territory_assignments.sql** for implementation details
- Check Supabase logs for trigger/RLS errors
