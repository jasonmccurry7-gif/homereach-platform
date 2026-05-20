# AI Workforce OS Phase 2L: Internal Task Completion Linkage

## What changed

Phase 2L completes the supervised AI Workforce handoff loop by surfacing linked CRM task status and allowing an admin to mark that internal task done from the AI Workforce task card.

The end-to-end supervised path is now:

1. Plan Only
2. Send Approval
3. Human approval
4. Dry Run Preview
5. Queue Handoff
6. Create Task
7. Complete Task

## Reused systems

- Existing `crm_tasks` records
- Existing Autopilot `complete_internal_task` operation
- Existing Autopilot approval events
- Existing AI Workforce memory/event hooks

## Safety controls

- Completion only appears when a linked internal CRM task exists.
- Completion does not execute any external workflow.
- Completion records an Autopilot event and updates the CRM task status through the existing server-side guard.

## Go-live notes

No migration was added. This phase reads CRM task status from existing `crm_tasks` rows linked through existing Autopilot execution runs.
