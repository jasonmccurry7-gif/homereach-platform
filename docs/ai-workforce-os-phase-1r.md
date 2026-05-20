# AI Workforce OS Phase 1R - Agent Permission Matrix

## What Changed

Phase 1R adds an explicit digital employee permission matrix.

Every dashboard agent now exposes whether it can:

- read data
- draft recommendations
- create Action Center items
- request approval
- run scheduled monitors
- queue safe internal handoffs
- send external messages
- change payment/pricing
- place orders or bids
- publish or deploy

## Files Added

- `apps/web/lib/ai-orchestration/agent-permissions.ts`
- `apps/web/app/api/admin/ai-orchestration/permissions/route.ts`

## Files Updated

- `apps/web/app/(admin)/admin/agents/page.tsx`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`

## Safety Posture

External execution capabilities are disabled by default:

- no autonomous external sends
- no pricing/payment changes
- no orders or bids
- no publishing or deployment

Agents can only move toward deeper execution after go-live gates, approval workflow, policy rules, and source freshness are clear.
