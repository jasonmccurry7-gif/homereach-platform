# AI Workforce OS Phase 1Q - Shared AI Action Policy

## What Changed

Phase 1Q adds one shared AI action policy engine for risk, approval, guardrails, and internal handoff rules.

## Files Added

- `apps/web/lib/ai-orchestration/ai-action-policy.ts`

## Files Updated

- `apps/web/lib/ai-orchestration/autopilot.ts`

## What It Centralizes

- Risk level
- Required human approval
- Guardrail summary
- Internal handoff eligibility
- Reason an action cannot execute
- Prohibited actions

## Safety Rules Preserved

- Political actions remain human-approved.
- Gov Contracts actions cannot submit bids or commit pricing/certifications/subcontractors.
- Messaging actions require suppression, opt-out, quiet-hour, provider readiness, and approval.
- Learning Engine ideas cannot publish, deploy, send, bill, order, or change production by themselves.
- Procurement recommendations cannot place supplier orders without owner approval.

## Why It Matters

Future agents now have one reusable policy layer instead of each dashboard inventing its own automation safety rules.
