# AI Workforce OS Phase 2J: Safe Internal Handoff Linkage

## What changed

Phase 2J connects persistent AI Workforce task cards to the existing Autopilot safe internal handoff workflow.

This is intentionally not a new executor and not a live automation path. The sequence remains:

1. Plan Only
2. Send Approval
3. Human approval in the existing Autopilot Control Center
4. Dry Run Preview
5. Queue Handoff

The handoff uses the existing `queue_internal_handoff` operation and creates an internal handoff record only. It does not send messages, publish content, order supplies, submit bids, charge payments, or touch external customer workflows.

## Files changed

- `apps/web/lib/ai-orchestration/workforce-memory.ts`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`
- `docs/ai-workforce-os-phase-2j.md`

## Reused systems

- Existing AI Workforce task queue
- Existing Autopilot approval requests
- Existing Autopilot execution run records
- Existing `queueAutopilotInternalHandoff` guardrails
- Existing admin auth guard on `/api/admin/ai-orchestration/autopilot`

## Safety gates

- Queue Handoff only appears after a task has an approval request.
- The linked approval must be approved.
- A dry-run preview must exist.
- Completed, rejected, blocked, already queued, or already-created handoffs cannot be queued again from the Workforce card.

## Go-live notes

No database migration was added in this phase. It reads existing approval and execution status from the Autopilot tables and writes handoffs through the existing Autopilot API.
