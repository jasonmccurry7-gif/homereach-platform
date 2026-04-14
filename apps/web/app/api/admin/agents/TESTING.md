# Agent System Testing Guide

Quick reference for testing the Echo, Closer, and Anchor agents during development and before production deployment.

## Quick Test Commands

### Check Agent Status

```bash
# All agents status
curl http://localhost:3000/api/admin/agents/run

# Individual agent status
curl http://localhost:3000/api/admin/agents/echo
curl http://localhost:3000/api/admin/agents/closer
curl http://localhost:3000/api/admin/agents/anchor
```

### Run Agents

```bash
# Run all agents in sequence
curl -X POST http://localhost:3000/api/admin/agents/run

# Run specific agents
curl -X POST http://localhost:3000/api/admin/agents/run?agents=echo,anchor

# Run Echo only
curl -X POST http://localhost:3000/api/admin/agents/echo

# Run Closer only
curl -X POST http://localhost:3000/api/admin/agents/closer

# Run Anchor only
curl -X POST http://localhost:3000/api/admin/agents/anchor
```

## Test Data Setup

### 1. Test Echo (Outbound Prospecting)

Create a queued lead:

```sql
-- Insert test lead
INSERT INTO sales_leads (
  business_name, 
  contact_name,
  email, 
  phone, 
  city, 
  category,
  status, 
  assigned_agent_id,
  do_not_contact, 
  sms_opt_out,
  created_at
) VALUES (
  'Echo Test Plumbing',
  'John Doe',
  'john@echotest.com',
  '+15551234567',
  'Akron',
  'Plumbing',
  'queued',
  'jason-agent-id',
  false,
  false,
  now()
);
```

Run Echo:

```bash
curl -X POST http://localhost:3000/api/admin/agents/echo
```

Verify:

```sql
-- Check lead status changed to 'contacted'
SELECT id, status, last_contacted_at FROM sales_leads 
WHERE business_name = 'Echo Test Plumbing';

-- Check event was logged
SELECT * FROM sales_events 
WHERE message LIKE '%Echo Test%' 
ORDER BY created_at DESC LIMIT 1;
```

### 2. Test Closer (Follow-up with Warm Leads)

Create a recently-replied lead:

```sql
INSERT INTO sales_leads (
  business_name,
  contact_name,
  email,
  phone,
  city,
  status,
  last_reply_at,
  do_not_contact,
  sms_opt_out,
  created_at
) VALUES (
  'Closer Test HVAC',
  'Jane Smith',
  'jane@closertest.com',
  '+15559876543',
  'Hudson',
  'replied',
  now() - interval '1 hour',
  false,
  false,
  now()
);
```

Run Closer:

```bash
curl -X POST http://localhost:3000/api/admin/agents/closer
```

Verify:

```sql
-- Check event logged
SELECT * FROM sales_events 
WHERE message LIKE '%get-started%' 
ORDER BY created_at DESC LIMIT 1;

-- Verify lead still in 'replied' status (Closer doesn't change status)
SELECT id, status FROM sales_leads 
WHERE business_name = 'Closer Test HVAC';
```

### 3. Test Anchor (Client Renewals)

Create an active spot approaching renewal (25 days out):

```sql
-- First, create a test business
INSERT INTO businesses (id, name, phone, email, city, created_at)
VALUES (
  gen_random_uuid(),
  'Anchor Test Electrician',
  '+15551111111',
  'anchor@test.com',
  'Stow',
  now()
)
RETURNING id AS business_id;
-- Note: Copy the business_id returned above

-- Then create a spot assignment (replace business_id with the one above)
INSERT INTO spot_assignments (
  business_id,
  city_id,
  category_id,
  spot_type,
  status,
  commitment_ends_at,
  activated_at,
  monthly_value_cents,
  created_at
) VALUES (
  'PASTE_BUSINESS_ID_HERE',
  (SELECT id FROM cities LIMIT 1),
  (SELECT id FROM categories LIMIT 1),
  'anchor',
  'active',
  now() + interval '25 days',
  now() - interval '65 days',
  9900,
  now()
);
```

Create a paused spot (win-back candidate):

```sql
-- Win-back test spot
INSERT INTO spot_assignments (
  business_id,
  city_id,
  category_id,
  spot_type,
  status,
  created_at
) VALUES (
  'PASTE_BUSINESS_ID_HERE',
  (SELECT id FROM cities LIMIT 1),
  (SELECT id FROM categories LIMIT 1),
  'anchor',
  'paused',
  now()
);
```

Run Anchor:

```bash
curl -X POST http://localhost:3000/api/admin/agents/anchor
```

Verify:

```sql
-- Check Anchor events
SELECT * FROM sales_events 
WHERE message LIKE '%paused%' OR message LIKE '%renews in%'
ORDER BY created_at DESC LIMIT 5;

-- Check spot status unchanged
SELECT id, status FROM spot_assignments 
WHERE business_id = 'PASTE_BUSINESS_ID_HERE';
```

## Integration Test

Test the full orchestrator running all agents:

```bash
curl -X POST http://localhost:3000/api/admin/agents/run
```

Expected response:

```json
{
  "success": true,
  "timestamp": "2026-04-13T15:30:00.000Z",
  "agents_run": [
    {
      "name": "echo",
      "success": true,
      "summary": {
        "leads_processed": 1,
        "sms_sent": 0,
        "emails_sent": 1,
        "errors": 0
      },
      "duration_ms": 250
    },
    {
      "name": "closer",
      "success": true,
      "summary": {
        "leads_processed": 1,
        "follow_ups_sent": 1,
        "payment_links_sent": 1,
        "errors": 0
      },
      "duration_ms": 200
    },
    {
      "name": "anchor",
      "success": true,
      "summary": {
        "spots_processed": 2,
        "renewals_approaching": 1,
        "win_backs_sent": 1,
        "retention_sent": 0,
        "errors": 0
      },
      "duration_ms": 220
    }
  ],
  "total_duration_ms": 670
}
```

## Error Scenarios

### No Leads to Process

If all agents return `leads_processed: 0`, verify test data exists:

```sql
-- Check Echo queue
SELECT COUNT(*) FROM sales_leads 
WHERE status = 'queued' AND assigned_agent_id IS NOT NULL;

-- Check Closer queue
SELECT COUNT(*) FROM sales_leads 
WHERE status IN ('replied', 'interested') 
AND last_reply_at > now() - interval '2 hours';

-- Check Anchor queue
SELECT COUNT(*) FROM spot_assignments 
WHERE status IN ('active', 'paused') 
AND (
  commitment_ends_at <= now() + interval '30 days'
  OR status = 'paused'
);
```

### SMS Not Sending

Check if phone number is valid and lead doesn't have SMS opt-out:

```sql
SELECT id, phone, sms_opt_out, do_not_contact FROM sales_leads 
WHERE business_name LIKE '%Test%';
```

Also verify Twilio credentials in environment:

```bash
echo $TWILIO_ACCOUNT_SID
echo $TWILIO_AUTH_TOKEN
echo $TWILIO_PHONE_NUMBER
```

### Email Not Sending

Check Mailgun credentials:

```bash
echo $MAILGUN_API_KEY
echo $MAILGUN_DOMAIN
echo $MAILGUN_FROM_EMAIL
```

Also verify email address is valid:

```sql
SELECT id, email FROM sales_leads WHERE business_name LIKE '%Test%';
```

## Advanced Testing

### Load Test (Many Leads)

Create 50 test leads for Echo:

```sql
INSERT INTO sales_leads (
  business_name, email, phone, city, category,
  status, assigned_agent_id, do_not_contact, sms_opt_out
)
SELECT
  'Load Test ' || i,
  'test' || i || '@example.com',
  '+1555' || LPAD(i::text, 7, '0'),
  CASE (i % 4)
    WHEN 0 THEN 'Akron'
    WHEN 1 THEN 'Hudson'
    WHEN 2 THEN 'Green'
    ELSE 'Stow'
  END,
  'Plumbing',
  'queued',
  'jason-agent-id',
  false,
  false
FROM generate_series(1, 50) AS t(i);
```

Run Echo and measure performance:

```bash
time curl -X POST http://localhost:3000/api/admin/agents/echo | jq .summary
```

### Message Deduplication Test

Echo sends the same message twice to the same lead:

```bash
# First run
curl -X POST http://localhost:3000/api/admin/agents/echo

# Update lead back to 'queued'
UPDATE sales_leads SET status = 'queued' WHERE business_name = 'Echo Test Plumbing';

# Second run
curl -X POST http://localhost:3000/api/admin/agents/echo
```

Second run should fail with "Identical message already sent" error.

### Territory Fallback Test

Create a lead in unmapped city:

```sql
INSERT INTO sales_leads (
  business_name, email, phone, city, category,
  status, assigned_agent_id, do_not_contact, sms_opt_out
) VALUES (
  'Unmapped City Test',
  'test@unmapped.com',
  '+15551234567',
  'UnmappedCity',
  'Plumbing',
  'queued',
  NULL,
  false,
  false
);
```

Run Echo. Should assign to Jason (default agent).

## Database Cleanup

After testing, clean up test data:

```sql
-- Delete test leads
DELETE FROM sales_leads 
WHERE business_name LIKE 'Echo Test%' 
  OR business_name LIKE 'Closer Test%' 
  OR business_name LIKE 'Anchor Test%'
  OR business_name LIKE 'Load Test%'
  OR business_name LIKE 'Unmapped%';

-- Delete test businesses
DELETE FROM businesses 
WHERE name LIKE 'Anchor Test%';

-- Delete test spot assignments
DELETE FROM spot_assignments 
WHERE business_id IN (
  SELECT id FROM businesses WHERE name LIKE 'Anchor Test%'
);

-- Delete test events
DELETE FROM sales_events 
WHERE message LIKE '%Test%' 
  OR message LIKE '%Load Test%';
```

## Continuous Testing

For CI/CD pipelines, run the agents on a schedule:

```yaml
# Example: GitHub Actions workflow
name: Agent Tests
on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:

jobs:
  test-agents:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Test Echo
        run: curl -X POST ${{ secrets.NEXTAUTH_URL }}/api/admin/agents/echo
      - name: Test Closer
        run: curl -X POST ${{ secrets.NEXTAUTH_URL }}/api/admin/agents/closer
      - name: Test Anchor
        run: curl -X POST ${{ secrets.NEXTAUTH_URL }}/api/admin/agents/anchor
```

## Performance Benchmarks

Expected performance on standard leads (as baseline):

| Agent | Leads Processed | Duration | Notes |
|-------|-----------------|----------|-------|
| Echo | 20 | 1-2s | Depends on message template length |
| Closer | 10 | 1-1.5s | Checks for recent payment link |
| Anchor | 30 | 1.5-2s | Queries renewals + paused spots |

If actual times exceed these by 50%, investigate query performance and Supabase connection.
