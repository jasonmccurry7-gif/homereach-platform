# HomeReach Agent System

The agent system is a collection of specialized outbound messaging engines that handle different stages of the sales and retention lifecycle.

## Architecture

The system consists of three primary agents:

1. **Echo** — Outbound prospecting & lead routing
2. **Closer** — Follow-up with warm leads & payment links
3. **Anchor** — Client retention & renewal management

All agents:
- Use **Supabase** for data access
- Route messages through **`/api/admin/sales/event`** for actual SMS/Email sends
- Log actions to **`sales_events`** table
- Are **territory-aware** (agent assignment by city)
- Respect **opt-out flags** and **pause controls**

## Agents

### Echo — Outbound Prospecting

**Endpoint:** `POST /api/admin/agents/echo`  
**Purpose:** Route queued sales leads to assigned agents and send personalized SMS/email outreach

#### Workflow

1. Fetch up to 20 leads where:
   - `status = 'queued'`
   - `assigned_agent_id IS NOT NULL`
   - `do_not_contact = FALSE`
   - `sms_opt_out = FALSE`

2. For each lead:
   - Resolve agent identity (database lookup → territory map → default)
   - Choose channel: SMS if phone exists, Email otherwise
   - Build personalized message (SMS max 160 chars, Email with agent contact)
   - Call `/api/admin/sales/event` to send and log
   - Update lead status to `contacted`

3. Return summary: leads processed, SMS sent, emails sent, errors

#### Message Templates

**SMS (160 char max):**
```
Hi [business_name]! I'm [agent_name] with HomeReach — 
we help local [category] businesses get in front of 
homeowners in [city] via direct mail. Interested? Reply YES.
```

**Email:**
```
Subject: Exclusive [city] [category] spot — HomeReach

Hi [business_name],

My name is [agent_name] and I help [category] businesses 
in [city] grow through targeted direct mail to homeowners.

We have one exclusive spot remaining for a [category] 
business in [city]. Once it's taken, no other [category] 
business in the area can advertise through us.

Interested in learning more? Just reply to this email 
or call me directly.

[agent_name]
HomeReach
[agent_phone]
[agent_email]
```

#### Response

```json
{
  "success": true,
  "summary": {
    "leads_processed": 20,
    "sms_sent": 15,
    "emails_sent": 5,
    "errors": 0
  },
  "details": [
    {
      "lead_id": "uuid",
      "status": "sent",
      "channel": "sms"
    }
  ]
}
```

#### GET Status

Returns current queue size and last run metadata.

---

### Closer — Follow-up & Payment Links

**Endpoint:** `POST /api/admin/agents/closer`  
**Purpose:** Follow up with warm leads showing interest and send payment/conversion links

#### Workflow

1. Fetch leads where:
   - `status IN ('replied', 'interested')`
   - `last_reply_at > NOW() - 2 hours`
   - `do_not_contact = FALSE`
   - `sms_opt_out = FALSE`

2. For each lead:
   - Check if payment link sent in last 7 days (skip if yes)
   - Verify phone exists (SMS only)
   - Resolve agent identity
   - Send SMS with payment link and CTA
   - Update `pipeline_stage` to `negotiating`
   - Log as `follow_up_sent`

3. Return summary: leads processed, follow-ups sent, payment links sent, errors

#### Message Template

```
Hi [business_name]! This is [agent_name] from HomeReach. 
Ready to lock in your exclusive [city] spot? Here's your link: 
https://home-reach.com/get-started Reply STOP to opt out.
```

#### Response

```json
{
  "success": true,
  "summary": {
    "leads_processed": 10,
    "follow_ups_sent": 7,
    "payment_links_sent": 7,
    "errors": 0
  },
  "details": [
    {
      "lead_id": "uuid",
      "status": "sent",
      "reason": null
    }
  ]
}
```

#### GET Status

Returns count of warm leads ready for follow-up.

---

### Anchor — Client Retention

**Endpoint:** `POST /api/admin/agents/anchor`  
**Purpose:** Track renewals and churn risk; send win-back and retention messages

#### Workflow

1. Fetch spot assignments:

   **Win-back candidates:**
   - `status = 'paused'` (payment failed)

   **Renewal approaching:**
   - `status = 'active'`
   - `commitment_ends_at <= NOW() + 30 days`
   - `commitment_ends_at > NOW()`

2. For each paused spot:
   - Get business phone
   - Resolve agent by city
   - Send win-back SMS with payment update link
   - Log as `follow_up_sent`

3. For each renewal-approaching spot:
   - Only send at trigger dates: **30 days out** and **7 days out**
   - Send retention SMS with days-until-renewal
   - Log as `follow_up_sent`

4. Return summary: renewals approaching, win-backs sent, retention sent, errors

#### Message Templates

**Win-back (paused spot):**
```
Hi [business_name], your HomeReach spot in [city] is paused 
due to a billing issue. Update your payment to keep your 
exclusive spot: https://home-reach.com/dashboard
```

**Retention reminder (30/7 days out):**
```
Hi [business_name]! Your HomeReach spot renews in [X] days. 
You're locking in [homes] homes per month. Any questions? 
Reply here.
```

#### Response

```json
{
  "success": true,
  "summary": {
    "spots_processed": 25,
    "renewals_approaching": 15,
    "win_backs_sent": 8,
    "retention_sent": 5,
    "errors": 0
  },
  "details": [
    {
      "spot_id": "uuid",
      "business_id": "uuid",
      "status": "sent",
      "action": "win_back"
    }
  ]
}
```

#### GET Status

Returns count of renewals approaching and paused spots (churn risk).

---

## Orchestrator

**Endpoint:** `POST /api/admin/agents/run?agents=echo,closer,anchor`  
**Purpose:** Run all agents in sequence with performance tracking

### Run All Agents

```bash
curl -X POST http://localhost:3000/api/admin/agents/run
```

### Run Specific Agents

```bash
curl -X POST http://localhost:3000/api/admin/agents/run?agents=echo,anchor
```

### Response

```json
{
  "success": true,
  "timestamp": "2026-04-13T15:30:00Z",
  "agents_run": [
    {
      "name": "echo",
      "success": true,
      "summary": { "leads_processed": 20, ... },
      "duration_ms": 1240
    },
    {
      "name": "closer",
      "success": true,
      "summary": { "leads_processed": 8, ... },
      "duration_ms": 890
    },
    {
      "name": "anchor",
      "success": true,
      "summary": { "renewals_approaching": 12, ... },
      "duration_ms": 1120
    }
  ],
  "total_duration_ms": 3250
}
```

### Check All Agent Status

```bash
curl http://localhost:3000/api/admin/agents/run
```

---

## Territory Assignment

Agents are assigned to territories (Ohio cities). This mapping is hardcoded as a fallback but can be overridden via the `agent_identities` table (not yet created).

### Current Territory Map

| Territory | Agent | Email | Phone |
|-----------|-------|-------|-------|
| Wooster, Medina | Heather | heather@home-reach.com | +13306626331 |
| Massillon, Ravenna | Josh | josh@home-reach.com | +13304224396 |
| Green, Stow | Chris | chris@home-reach.com | +13305949713 |
| Cuyahoga Falls, Hudson, Canton, Akron | Jason | jason@home-reach.com | +13303044916 |
| Any other city | Jason (default) | jason@home-reach.com | +13303044916 |

### To Override Territory Assignment

1. Create `agent_identities` table (schema to be defined)
2. Assign agent to leads via `sales_leads.assigned_agent_id`
3. Agents will look up identity from `agent_identities` first

---

## Error Handling & Resilience

- **Lead validation:** DNC, opt-out, and missing contact checks prevent invalid sends
- **Agent resolution:** Falls back from agent_identities → territory map → default agent
- **Send failures:** Logged but don't block subsequent leads (partial success)
- **Pauses:** System pauses and per-agent pauses respected via control tables
- **Rate limits:** Enforced by `check_and_increment_send_count` RPC

---

## Monitoring & Logging

All agent runs log to `sales_events` table:
- `agent_id`: Which agent ran
- `action_type`: `text_sent`, `email_sent`, `follow_up_sent`, `lead_loaded`
- `channel`: `sms`, `email`, or `null` for aggregates
- `metadata`: JSON summary of run (leads processed, errors, etc.)

To view agent runs:

```sql
SELECT * FROM sales_events 
WHERE action_type IN ('text_sent', 'email_sent', 'follow_up_sent')
ORDER BY created_at DESC;
```

---

## Integration Points

### Dependency: `/api/admin/sales/event`

All agents delegate actual messaging to this endpoint. It handles:
- SMS/email send via Twilio/Mailgun
- Lead status updates
- Rate limit enforcement
- Message deduplication
- Opt-out validation

### Dependency: `agent_identities` Table (Optional)

Once created, allows:
- Dynamic agent assignment (not hardcoded)
- Per-agent phone numbers and email addresses
- Active/inactive toggle for agent pauses

### Expected Schema

```sql
CREATE TABLE agent_identities (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES profiles(id),
  from_name TEXT,
  from_email TEXT,
  twilio_phone TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

---

## Future Enhancements

1. **Agent Pause Controls** — Create `agent_pause_controls` table for per-agent opt-in/out
2. **Dynamic Territory Assignment** — Use `agent_territories` table instead of hardcoded map
3. **A/B Testing** — Message variation tracking and performance comparison
4. **Scheduling** — Cron job integration for recurring agent runs
5. **Webhook Replies** — Inbound SMS/email handling and conversation threading
6. **Performance Dashboard** — Real-time metrics on send volume, reply rates, conversions
