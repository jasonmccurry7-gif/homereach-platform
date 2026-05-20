# AI Workforce OS Phase 1T - Guided Workflow Recipes

## What Changed

Phase 1T adds reusable workflow recipes for the major AI-assisted operating paths:

- Political Campaign Launch Review
- Procurement Savings Review
- Gov Contract Bid Room
- Learning Engine Idea Promotion
- Targeted Campaign Revenue Path

## Files Added

- `apps/web/lib/ai-orchestration/workflow-recipes.ts`
- `apps/web/app/api/admin/ai-orchestration/workflow-recipes/route.ts`

## Files Updated

- `apps/web/app/(admin)/admin/agents/page.tsx`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`

## Safety Posture

Recipes are read-only operating playbooks. They define human-gated steps and prohibited actions before deeper agent autonomy is allowed.

They do not execute external sends, bids, orders, payments, publishing, production launches, or deployments.
