# AI Workforce OS Phase 2K: Internal Task Creation Linkage

## What changed

Phase 2K connects a queued safe internal handoff to the existing Autopilot internal task workflow.

This adds a `Create Task` action on AI Workforce task cards after the prior gates are complete:

1. Plan Only
2. Send Approval
3. Human approval
4. Dry Run Preview
5. Queue Handoff
6. Create Task

The task creation path reuses the existing `create_internal_task` Autopilot operation. It creates an internal CRM task for a human to complete the next operational step. It does not send messages, contact customers, publish content, place orders, submit bids, change pricing, or trigger payments.

## Files changed

- `apps/web/lib/ai-orchestration/workforce-memory.ts`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`
- `docs/ai-workforce-os-phase-2k.md`

## Safety controls

- The approval must already be approved.
- The safe handoff must already be queued.
- A duplicate internal task is not created when one is already linked.
- Existing Autopilot guardrails still own the actual insert into `crm_tasks`.

## Go-live notes

No database migration was added in this phase. The UI reads linked execution run and internal task state from existing Autopilot tables.
