# HomeReach Ecosystem AI Agent Audit

Date: 2026-05-19

## Scope Audited

This audit reviewed the current HomeReach deployment repo for dashboard surfaces, route structure, API coverage, database migrations, external integrations, and existing AI/automation code. The goal is to move toward autonomous AI agents for each dashboard without rebuilding or duplicating working systems.

Current footprint:

- 137 app pages
- 161 API routes
- 71 admin pages
- Existing admin, customer, political, procurement, targeted campaign, shared campaign, growth, messaging, Gov Contracts, and agent command surfaces

## Existing AI And Automation Systems

The platform already has multiple partial agent systems:

- APEX/system agent registry under `/admin/agents`
- Admin system orchestration APIs under `/api/admin/system/*`
- Political candidate agents, coverage options, creative concepts, and candidate chat
- Revenue messaging and outreach foundations
- Inventory/procurement email automation
- Growth, SEO, content intelligence, and review queue foundations
- Gov Contracts SAM.gov sync, opportunity scoring, and bid-room foundations
- QA/health/checking surfaces

The main risk is not lack of AI. The main risk is fragmented AI ownership. Each dashboard needs a clearly assigned agent, autonomy level, guardrails, blockers, and next safe phase.

## Phase 1 Implementation

Phase 1 adds a shared Dashboard Agent Readiness Matrix to the existing `/admin/agents` command center.

This is additive only. It does not replace APEX, political agents, messaging, procurement, Gov Contracts, Stripe, route logic, or existing dashboards.

Each dashboard agent now tracks:

- Assigned agent name
- Primary dashboard and route
- Mission
- Current autonomy level
- Target autonomy level
- Connected systems
- Primary data dependencies
- Required environment variables
- Optional environment variables
- Manual blockers
- Guardrails
- Current phase
- Next phase
- Readiness score

## Dashboard Agent Coverage

Phase 1 registers these dashboard agents:

- Executive OS Agent: `/os`, `/admin/control-center`, `/admin/operator`
- Sales Revenue Agent: `/admin/sales-dashboard`
- Outreach Messaging Agent: `/admin/inbox`
- Political Command Agent: `/political/candidate-agent`
- Procurement Savings Agent: `/inventory-purchasing/dashboard`
- Gov Contracts Agent: `/admin/gov-contracts`
- Growth SEO Agent: `/admin/growth`
- Targeted Campaign Agent: `/targeted`
- Shared Campaign Agent: `/get-started`
- Creative Production Agent: `/admin/ad-designer`
- Customer Success Agent: `/dashboard`
- QA Watchtower Agent: `/admin/qa`

## Highest-Value Enhancement Opportunities

1. Create one cross-dashboard Action Center
   - Consolidate pending approvals, hot leads, campaign readiness issues, procurement smart buys, Gov Contracts deadlines, and payment issues.

2. Add a shared AI memory and event log
   - Use existing records first: agent logs, revenue message threads, political activity logs, Gov Contracts audit logs, order/campaign events, and review queue records.

3. Add dashboard-specific autonomous runners
   - Start with scheduled monitors and human-approved drafts.
   - Avoid autonomous outreach, ordering, bid submission, checkout, or political persuasion.

4. Build morning/evening AI briefings
   - Executive summary of leads, payments, campaign status, procurement savings, Gov Contracts opportunities, broken workflows, and next best actions.

5. Harden revenue path automation
   - Every AI recommendation should tie to a customer action, admin follow-up, proposal, payment, or verified operational next step.

6. Connect live AI chat where appropriate
   - Political candidate chat requires `OPENAI_API_KEY`.
   - Content and some QA systems require `ANTHROPIC_API_KEY`.
   - All chat actions must remain advisory or approval-gated unless explicitly allowed.

7. Finish channel readiness
   - Postmark is appropriate for inventory/procurement email automation.
   - Twilio SMS should remain guarded until A2P is accepted.

8. Add source freshness and quote locks
   - Political and targeted campaign quote/checkout actions must stay locked until route counts, pricing, source timestamps, and human approval are present.

## Recommended Build Phases

### Phase 1: Agent Ownership And Readiness

Complete in this update:

- Register dashboard agents in a shared orchestration library.
- Add readiness matrix to `/admin/agents`.
- Add API endpoint for dashboard-agent readiness.
- Add deployment env tracking for OpenAI/live orchestration keys.

### Phase 2: Unified Action Center

Build one internal queue that normalizes:

- Outreach approvals
- Political proposal readiness
- Procurement smart buys
- Gov Contracts bid-room deadlines
- Campaign checkout blockers
- Failed payments
- Broken CTA/route findings

### Phase 3: Shared AI Memory Layer

Create a shared event model that links:

- Customer
- Campaign
- Business
- Candidate
- Lead
- Opportunity
- Message
- Agent recommendation
- Human approval

### Phase 4: Scheduled Dashboard Monitors

Add safe monitors for:

- Gov Contracts opportunities
- Procurement savings and reorder risk
- Political candidate/source freshness
- Messaging replies and failed sends
- Revenue path health
- Dashboard QA smoke tests

### Phase 5: Human-Approved Autopilot

Allow AI to draft, queue, and recommend actions. Human approval remains required for:

- Political outreach
- SMS sends
- Pricing/checkout
- Proposal sending
- Procurement orders
- Government bid submission
- Subcontractor or legal commitments

### Phase 6: Assisted Autopilot For Safe Business Lines

Only after logs, approvals, suppression, and rollback are proven:

- Low-risk email follow-up
- Daily summaries
- Review queue preparation
- Internal alerts
- Non-political customer support drafts

## User Action Required For Go-Live Autonomy

- Add `OPENAI_API_KEY` in Vercel for true live AI chat and agent reasoning where OpenAI is used.
- Add or confirm `ANTHROPIC_API_KEY` in Vercel for content, SEO, and QA intelligence where Anthropic is used.
- Wait for Twilio A2P approval before SMS prospecting or higher-volume SMS automation.
- Keep `OUTREACH_MANUAL_APPROVAL_MODE=true` until suppression, throttling, and reply handling are verified in production.
- Confirm political outreach policy: political remains draft-only or human-approval mode after any response.
- Add real print, postage, USPS, supplier, and vendor APIs before showing final pricing as production-verified.
- Add Canva/API credentials only when the Canva design engine is ready to become the primary design execution layer.

## Production Safety Notes

- No live autonomous sends were enabled.
- No payment flows were changed.
- No dashboard routes were replaced.
- No database migrations were added in this phase.
- No existing APEX agents were removed or renamed.
- The new readiness matrix exposes blockers and safe next phases so the platform can progress toward autonomy without hidden risk.

## Phase 2 Implementation

Phase 2 adds a unified Action Center foundation to the existing `/admin/agents` command center and exposes the same data through `/api/admin/ai-orchestration/action-center`.

The Action Center reads existing systems where available:

- Dashboard agent readiness blockers
- Revenue message approval queue
- Political inbound message threads requiring human follow-up
- AI suggestions waiting for review
- Gov Contracts deadlines and bid-room approvals
- Failed revenue webhook events
- Hot sales leads and payment follow-up items
- Procurement email sequence health

This is intentionally human-controlled. It does not send messages, place procurement orders, submit bids, trigger checkout, or approve political outreach. It only normalizes the highest-value work into one queue.

Phase 2 action cards show:

- Dashboard
- Urgency
- Status
- Reason
- Recommended action
- Expected impact
- Human approval requirement
- Link to the existing dashboard/workflow

## Phase 2 Enhancement Opportunities

Next improvements should keep building on this shared Action Center instead of creating more dashboard-specific queues:

1. Add durable action records
   - Create a shared `unified_action_items` or `home_reach_action_items` table only after validating the generated queue shape in production.
   - This would allow snooze, assign, resolve, comment, and audit history.

2. Add morning/evening briefings
   - Generate concise summaries from the same Action Center data.
   - Deliver first in-dashboard, then email/SMS after notification safeguards are verified.

3. Add action resolution hooks
   - Allow safe actions like "mark reviewed", "open proposal", "assign owner", or "snooze".
   - Keep send/order/bid/payment actions approval-gated.

4. Feed dashboard agents from the queue
   - Each dashboard agent should consume only its relevant actions and produce recommendations, not mutate production state.

5. Add SLA thresholds
   - Political replies: immediate Jason handoff.
   - Hot sales replies: same-day follow-up.
   - Gov Contracts deadlines: 7-day, 48-hour, 24-hour risk tiers.
   - Failed webhooks: high priority until reviewed.

## Phase 3 Implementation

Phase 3 makes the unified Action Center durable without changing the underlying revenue, outreach, procurement, political, or Gov Contracts execution systems.

Additive database tables:

- `unified_action_items`
  - Stores one durable row per generated action source key.
  - Preserves generated source details, urgency, owner, dashboard route, human approval requirements, snooze state, and resolution state.
- `unified_action_events`
  - Stores audit events for comments, snoozes, resolves, dismissals, reopen events, and future workflow notes.

New admin-only API behavior:

- `GET /api/admin/ai-orchestration/action-center`
  - Still generates the queue from existing systems.
  - Upserts generated actions into the durable queue when migration 097 is present.
  - Falls back to the generated queue if the durable tables are not applied yet.
- `PATCH /api/admin/ai-orchestration/action-center`
  - Supports `resolve`, `snooze`, `dismiss`, `reopen`, and `comment`.
  - Writes an audit event for every state change.

New UI controls on `/admin/agents`:

- Resolve
- Snooze 24h
- Add Note
- Dismiss

Safety boundary:

- These controls only manage Action Center state.
- They do not send messages, place procurement orders, submit government bids, change pricing, create checkouts, approve political outreach, or mutate protected revenue flows.

Operational note:

- Migration 097 must be applied in Supabase before durable persistence is active in production.
- Until the migration is applied, the Action Center continues to work as a generated queue and reports the durable source as unavailable.

## Phase 4 Implementation

Phase 4 adds scheduled monitor snapshots and dashboard-only AI operational briefings on top of the durable Action Center.

Additive database tables:

- `ai_dashboard_monitor_runs`
  - Stores each monitor run, status, source health, action totals, and dashboard-agent readiness counts.
  - Designed for morning/evening cron runs and manual admin-triggered runs.
- `ai_operational_briefings`
  - Stores concise executive briefings generated from Action Center state.
  - Includes headline, summary, top actions, risks, wins, next actions, and delivery status.

New routes:

- `GET /api/admin/ai-orchestration/briefings`
  - Admin-only read endpoint for recent briefings and monitor runs.
- `GET|POST /api/admin/ai-orchestration/briefings/run`
  - Admin or cron guarded.
  - Generates one dashboard-only briefing and one monitor snapshot.
  - `GET` is used by Vercel Cron and infers morning/evening from Eastern time.
  - `POST` is used by the admin UI for manual briefing runs.

New UI:

- `/admin/agents` now includes a Phase 4 briefing panel above the Action Center.
- The panel shows latest monitor status, critical/high/human-gate counts, next actions, risks/wins, recent monitor runs, and a safe manual "Run Briefing" button.

New schedule:

- `apps/web/vercel.json` schedules `/api/admin/ai-orchestration/briefings/run` at 8:00 AM and 5:00 PM Eastern-oriented weekday windows.

Safety boundary:

- Briefings are dashboard-only.
- No email/SMS delivery is enabled by this phase.
- No messages, orders, bids, pricing, checkout, political outreach, supplier actions, or customer-facing commitments are executed.

## Phase 5 Implementation

Phase 5 adds a human-approved autopilot control layer. This is the first shared approval gate for future assisted-autopilot behavior across dashboards.

Additive database tables:

- `ai_autopilot_approval_requests`
  - Stores one approval request per generated Action Center source key.
  - Captures source dashboard, route, requested action, expected impact, risk level, approval status, execution mode, executor status, guardrail summary, and decision notes.
- `ai_autopilot_approval_events`
  - Stores audit events for approval, rejection, comments, and future execution events.

New route:

- `GET|PATCH /api/admin/ai-orchestration/autopilot`
  - `GET` materializes Action Center items requiring human approval into approval gates.
  - `PATCH` records `approve`, `reject`, or `comment` decisions.

New UI:

- `/admin/agents` now includes a Phase 5 Human-Approved Autopilot panel.
- The panel shows pending/approved gates, risk levels, guardrails, source workflow links, notes, and explicit Approve Gate / Reject / Add Note controls.

Safety boundary:

- Approving a gate records intent only.
- `executor_status` defaults to `approval_only`.
- No live executor is connected in this phase.
- No email/SMS, procurement order, Gov bid, pricing change, checkout, political outreach, subcontractor commitment, or customer-facing commitment is triggered.

Next step:

- Add narrow safe executors one at a time only after each source workflow has tests, rollback, suppression/permission checks, and a second explicit approval if the action is high-risk.

## Phase 6 Implementation

Phase 6 adds the first assisted-autopilot execution surface as a safe internal handoff queue. This remains intentionally conservative.

Additive database table:

- `ai_autopilot_execution_runs`
  - Stores queued internal handoffs for already approved low/medium-risk gates.
  - Captures request linkage, executor key, status, preview payload, guardrails, rollback note, and audit metadata.
  - Does not call Twilio, Postmark, Stripe, SAM.gov submission, supplier ordering, checkout, pricing, political outreach, or any customer-facing workflow.

Migration updates:

- Expands `ai_autopilot_approval_requests.executor_status` with `handoff_ready` and `handoff_queued`.
- Expands `ai_autopilot_approval_events.event_type` with execution queue/block/completion/failure events.

Route update:

- `POST /api/admin/ai-orchestration/autopilot`
  - Admin-only.
  - Accepts `operation=queue_internal_handoff`.
  - Requires an approved gate.
  - Blocks high-risk, political, Gov Contracts, and messaging gates until workflow-specific executors exist.

UI update:

- `/admin/agents` now shows Phase 6 Assisted Autopilot metrics:
  - Ready gates
  - Queued handoffs
- Approved safe gates expose a `Queue Handoff` button.

Safety boundary:

- Queueing a handoff creates an internal admin work record only.
- External systems and protected revenue/campaign workflows are not executed.
- High-risk gates remain approval-only until each source workflow has tests, rollback, suppression/permission checks, and a second explicit approval.

## Phase 7 Implementation

Phase 7 connects safe handoffs to the existing internal CRM task workflow.

Additive migration:

- `101_ai_autopilot_internal_tasks.sql`
  - Adds `internal_task_id` and `internal_task_created_at` to `ai_autopilot_execution_runs`.
  - Expands executor/event statuses with `task_ready`, `task_created`, and `internal_task_created`.
  - Preserves the existing `crm_tasks` table instead of introducing another task system.

Route update:

- `POST /api/admin/ai-orchestration/autopilot`
  - Adds `operation=create_internal_task`.
  - Requires an approved gate and queued safe internal handoff.
  - Creates a `crm_tasks` record with type `other`, status `pending`, due in 24 hours, and a plain-English safety description.

UI update:

- `/admin/agents` now exposes `Create Task` after a safe handoff is queued.
- The panel shows task-created counts and keeps source workflow links visible.

Safety boundary:

- The created CRM task is an internal admin reminder only.
- It does not send outreach, place procurement orders, submit Gov bids, change pricing, generate checkout, or contact customers.
- Humans still complete any external workflow from the original source dashboard.
