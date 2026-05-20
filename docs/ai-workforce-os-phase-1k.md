# AI Workforce OS Phase 1K - Agent Mission Control

## What Changed

Phase 1K adds an Agent Mission Control layer for the admin Agent Command Center.

Each dashboard-level AI agent now has a clear:

- operating mode
- readiness score
- risk level
- allowed actions
- prohibited actions
- source freshness warnings
- human approval gate
- next safe task

## Operating Modes

- `blocked`
- `manual`
- `draft_only`
- `human_approval`
- `scheduled_monitor`
- `assisted_ready`

## Files Added

- `apps/web/lib/ai-orchestration/agent-mission-control.ts`
- `apps/web/app/api/admin/ai-orchestration/mission-control/route.ts`

## Files Updated

- `apps/web/app/(admin)/admin/agents/page.tsx`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`

## Safety Posture

This is a supervision layer only. It does not enable autonomous sending, ordering, bidding, checkout, publishing, or deployment.

The goal is to make autonomy explicit, auditable, and easy to supervise before expanding any agent permissions.
