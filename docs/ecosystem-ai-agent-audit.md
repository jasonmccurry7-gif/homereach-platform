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
