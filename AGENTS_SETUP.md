# Echo Agent System — Setup & Integration Guide

This document covers the setup, deployment, and integration of the HomeReach agent system (Echo, Closer, Anchor).

## Quick Start

### 1. File Structure

The agents are located in: `/apps/web/app/api/admin/agents/`

```
agents/
├── echo/
│   └── route.ts           # Outbound prospecting engine
├── closer/
│   └── route.ts           # Follow-up & payment links
├── anchor/
│   └── route.ts           # Client retention & renewals
├── run/
│   └── route.ts           # Orchestrator (run all agents)
├── types.ts               # Shared types & territory map
└── README.md              # Full agent documentation
```

### 2. Verify Dependencies

All agents depend on existing systems. Verify they're working:

- **Supabase client:** `@/lib/supabase/server` ✓
- **Messaging service:** `@homereach/services/outreach` (sendSms, sendEmail) ✓
- **Sales event endpoint:** `/api/admin/sales/event` ✓
- **Database tables:**
  - `sales_leads` ✓
  - `sales_events` ✓
  - `spot_assignments` (for Anchor) ✓
  - `businesses` (for Anchor) ✓
  - `cities` ✓

### 3. Test Endpoint Connectivity

Before running in production, verify agents can reach the sales/event endpoint:

```bash
# Echo status check
curl http://localhost:3000/api/admin/agents/echo

# Expected response:
{
  "status": "operational",
  "queue_size": 5,
  "last_run_at": "2026-04-13T15:30:00Z",
  "last_run_summary": {...}
}
```

### 4. Manual Testing

#### Test Echo (Outbound Prospecting)

Create a test lead in the database:

```sql
INSERT INTO sales_leads (
  business_name, email, phone, city, category, 
  status, assigned_agent_id, do_not_contact, sms_opt_out
) VALUES (
  'Test Business', 'test@example.com', '+15551234567', 
  'Akron', 'Plumbing', 'queued', 'jason-agent-id', false, false
);
```

Then run:

```bash
curl -X POST http://localhost:3000/api/admin/agents/echo
```

Expected: Lead status changes to `contacted`, event logged to `sales_events`.

#### Test Closer (Follow-up)

Create a replied lead:

```sql
INSERT INTO sales_leads (
  business_name, email, phone, city, 
  status, last_reply_at, do_not_contact, sms_opt_out
) VALUES (
  'Test Business', 'test@example.com', '+15551234567', 
  'Akron', 'replied', now(), false, false
);
```

Run:

```bash
curl -X POST http://localhost:3000/api/admin/agents/closer
```

#### Test Anchor (Renewals)

Create an active spot approaching renewal:

```sql
INSERT INTO spot_assignments (
  business_id, city_id, category_id, status, 
  commitment_ends_at, activated_at
) VALUES (
  'business-uuid', 'city-uuid', 'category-uuid', 'active',
  now() + interval '25 days', now() - interval '65 days'
);
```

Run:

```bash
curl -X POST http://localhost:3000/api/admin/agents/anchor
```

### 5. Schedule Agents with Cron

Use a job scheduler (e.g., Vercel Crons, external cron service) to run agents periodically:

```yaml
# vercel.json cron configuration (future)
{
  "crons": [{
    "path": "/api/admin/agents/run?agents=echo,closer,anchor",
    "schedule": "0 9 * * *"  # 9 AM daily
  }]
}
```

For now, trigger manually or use an external service like:
- **EasyCron:** https://www.easycron.com/
- **Cron-job.org:** https://cron-job.org/en/
- **AWS Lambda + EventBridge**
- **Custom Node.js scheduler in worker thread**

## Configuration

### Territory Assignment

Agents are assigned to territories. Update `types.ts` to modify:

```typescript
const AGENT_TERRITORIES: Record<Territory, AgentIdentity> = {
  "Akron": { ... },
  // Add new cities here
};
```

### Message Templates

Customize message templates directly in agent files:

**Echo:** `buildSmsMessage()`, `buildEmailBody()`  
**Closer:** `sendFollowUp()` message template  
**Anchor:** Win-back and retention message templates in POST handler

### SMS/Email Limits

Rate limits are enforced by `/api/admin/sales/event` via:
- `agent_pause_controls` table (per-agent pause)
- `check_and_increment_send_count` RPC (daily limits)

To adjust limits, modify the RPC or add controls in sales/event endpoint.

## Monitoring

### View Agent Runs

```sql
-- All agent activity
SELECT * FROM sales_events 
WHERE action_type IN ('text_sent', 'email_sent', 'follow_up_sent')
ORDER BY created_at DESC LIMIT 100;

-- Echo runs
SELECT metadata FROM sales_events 
WHERE action_type = 'lead_loaded' AND message LIKE 'Echo%'
ORDER BY created_at DESC LIMIT 10;
```

### Alert on Errors

Set up monitoring for error responses (HTTP 5xx from agent endpoints):

```javascript
// Example: Alert if agent fails
if (!response.ok) {
  await notifySlack(`Agent ${agentName} failed: ${error}`);
}
```

### Performance Metrics

Check agent performance via status endpoints:

```bash
# All agents status
curl http://localhost:3000/api/admin/agents/run

# Individual agent status
curl http://localhost:3000/api/admin/agents/echo
curl http://localhost:3000/api/admin/agents/closer
curl http://localhost:3000/api/admin/agents/anchor
```

## Troubleshooting

### Agent Returns 0 Processed

Check:
1. Queue has leads: `SELECT COUNT(*) FROM sales_leads WHERE status = 'queued' AND assigned_agent_id IS NOT NULL;`
2. Leads aren't marked DNC or opted out: `SELECT COUNT(*) FROM sales_leads WHERE status = 'queued' AND do_not_contact = true;`
3. System isn't paused: `SELECT all_paused FROM system_controls;`

### "No phone number" / "No email address" Errors

Check lead contact fields:
```sql
SELECT id, phone, email FROM sales_leads 
WHERE status = 'contacted' LIMIT 5;
```

Fill in missing contact info before queueing leads.

### Sends Aren't Going Out

Verify:
1. `/api/admin/sales/event` is accessible and working
2. Twilio/Mailgun credentials are valid in environment
3. Lead is not on system DNC list
4. Check sales_events table for error details

### "Unknown agent" or Territory Not Found

Verify:
1. Lead `assigned_agent_id` is set (or city is in TERRITORY_AGENT_MAP)
2. `NEXTAUTH_URL` environment variable is set correctly
3. Agent identity resolution fallback is working

## Production Deployment

### Pre-flight Checklist

- [ ] All dependencies verified and tested
- [ ] Message templates reviewed and approved by each agent
- [ ] Territory assignments confirmed with sales team
- [ ] Twilio/Mailgun accounts configured and tested
- [ ] Supabase RLS policies verified (agents can read/write)
- [ ] Error alerting configured (Slack, email, monitoring service)
- [ ] Rate limits and pause controls are in place
- [ ] Backup/recovery plan for failed sends

### Gradual Rollout

1. **Phase 1:** Run Echo at 20% capacity (tag 1 in 5 leads)
2. **Phase 2:** Monitor for 3-5 days, scale to 100% if healthy
3. **Phase 3:** Enable Closer for warm leads only
4. **Phase 4:** Enable Anchor for renewals (low volume, 1-2x weekly)

### Monitoring Dashboard

Create a dashboard in Vercel/Datadog to track:
- Leads queued vs. processed
- SMS/email send volume
- Failure rate
- Response rate (by agent)
- Revenue attributed to each agent

## Future Enhancements

See `README.md` in `/agents/` directory for planned improvements:
- Agent pause controls UI
- Dynamic territory assignment via DB
- A/B testing framework
- Webhook-based reply handling
- Performance dashboard

## Questions?

Refer to:
- **Full documentation:** `apps/web/app/api/admin/agents/README.md`
- **Type definitions:** `apps/web/app/api/admin/agents/types.ts`
- **Existing endpoints:** `apps/web/app/api/admin/sales/event/route.ts`
