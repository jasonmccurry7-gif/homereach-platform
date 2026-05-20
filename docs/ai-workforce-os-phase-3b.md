# AI Workforce OS Phase 3B: Command Center Priority Routing

## What changed

Phase 3B turns the existing Command Center `topPriorities` field into a real supervised AI Workforce priority list.

It now detects where each durable AI Workforce task is in the safe lifecycle:

- Needs Plan Only
- Needs approval queue handoff
- Needs human approval
- Needs Dry Run Preview
- Needs Safe Handoff
- Needs internal CRM task creation
- Needs internal CRM task completion
- Blocked and needs review

The existing Agent Command Center now renders those priorities in a compact card list above the safe next steps and system signals.

## Files changed

- `apps/web/lib/ai-orchestration/command-center.ts`
- `apps/web/app/(admin)/admin/agents/agents-dashboard.tsx`
- `docs/ai-workforce-os-phase-3b.md`

## Safety

This phase is read-only. It does not create tasks, queue handoffs, send outreach, change payments, submit bids, publish content, or touch external systems.
