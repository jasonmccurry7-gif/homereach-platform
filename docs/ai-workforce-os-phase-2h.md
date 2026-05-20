# AI Workforce OS Phase 2H - Approval Handoff

## What changed

Phase 2H connects planned AI Workforce tasks to the existing HomeReach autopilot approval queue.

## Added

- `send_task_to_approval` operation on `/api/admin/ai-orchestration/workforce-memory`
- `sendAiWorkforceTaskToApproval` in `apps/web/lib/ai-orchestration/workforce-memory.ts`
- `Send Approval` button for planned AI Workforce tasks
- AI Workforce task records now store the linked `approval_request_id`
- Task cards show an `Approval Linked` badge when connected to the approval queue

## Reused

- Existing `ai_autopilot_approval_requests`
- Existing `ai_autopilot_approval_events`
- Existing `/admin/agents` Autopilot Control Center approval flow

## Safety model

The handoff creates or refreshes a human approval request only. It does not:

- send SMS, email, DMs, or political outreach
- publish pages, posts, creative, or campaign content
- place orders or approve purchases
- submit bids, pricing, certification claims, or subcontractor commitments
- launch campaigns
- create payment links or modify Stripe records

The task remains human-supervised and records `externalWorkflowTouched: false`.

## Why this matters

HomeReach now has a safe bridge from AI memory -> task plan -> human approval queue. This is the required control layer before dry-run execution simulation or internal task generation can expand further.
