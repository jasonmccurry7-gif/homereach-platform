# AI Workforce OS Phase 2F - Supervised Execution Planning

## What changed

Phase 2F adds a safe planning step between AI Workforce task review and any future execution layer.

## Added

- `plan_task_execution` operation on `/api/admin/ai-orchestration/workforce-memory`
- `planAiWorkforceTaskExecution` in `apps/web/lib/ai-orchestration/workforce-memory.ts`
- Admin-only `Plan Only` button in the AI Workforce Data Foundation task queue
- Durable playbook memory item for each planned task
- Audit event showing that a plan was generated without external execution

## Safety model

The planning step is advisory only. It does not:

- send SMS, email, DMs, or political outreach
- publish pages, posts, creative, or campaign content
- place orders or approve purchases
- submit government bids or make certification claims
- create payment links or alter Stripe records
- launch campaigns or change customer-facing workflows

## What the plan includes

Each generated plan stores:

- recommended steps
- human approval gates
- prohibited actions
- safe handoff instructions
- `externalWorkflowTouched: false`

## Why this matters

HomeReach now has a supervised bridge from durable AI memory and task queues into reviewable execution playbooks. This moves the system toward autonomous AI agents while preserving human control and auditability.

## Go-live posture

Phase 2F is production-safe once migration `103_ai_workforce_memory_foundation.sql` is applied. It remains admin-only and plan-only.
