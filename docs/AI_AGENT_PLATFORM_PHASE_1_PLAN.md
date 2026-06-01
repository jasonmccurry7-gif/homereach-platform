# AI Agent Platform Phase 1 Plan

## Audit Findings

HomeReach/Supplyfy already has the right foundation for an agent-native operating system:

- `/admin/agents` is the AI Workforce Command Center.
- AI Assets already stores business context, SOPs, agent profiles, prompt chains, data sources, outputs, verification checks, and reviews.
- `ai_workforce_tasks` is the task manifest.
- `ai_workforce_activity_logs` is the activity ledger.
- `ai_outputs` and `ai_output_reviews` are the approval artifact layer.
- Revenue Operations, Daily Outreach, Outreach Command, Procurement/Supplyfy, Political, Gov Contracts, ContractOS, Creative Studio, Daily Content, and Control Tower already provide task-specific modules.
- Existing guardrails already prohibit autonomous sends, publishing, bid submission, spend commitments, pricing changes, payment actions, and political targeting based on inferred beliefs.

## Main Gaps

- Agent roles needed clearer coverage for Prospecting, Follow-Up, Creative/Reels, Daily Action Plan, and Supplyfy-specific procurement work.
- Mini-app approval workflows existed conceptually through tasks and outputs, but not as a named reusable framework.
- Daily Action Center needed a stronger command-plan pattern: targeted prospects, Supplyfy prospects, political prospects, posts, drafts, follow-ups, estimates, checkboxes, and export.
- Browser/computer-use readiness needed explicit permission boundaries before connecting Gmail, Facebook, Stripe, Canva, Google Sheets, supplier websites, or desktop workflows.

## Phase 1 Implementation

Phase 1 keeps the existing architecture and adds a foundation layer only.

- Use `/admin/agents` as the Agent Command Center.
- Use existing `ai_workforce_tasks` for all agent assignments.
- Use existing `ai_workforce_activity_logs` for audit history.
- Use existing `ai_outputs` and `ai_output_reviews` for mini-app artifacts and approvals.
- Add agent role definitions and virtual profiles for the missing high-value agents.
- Add a daily action plan launcher.
- Add mini-app blueprint launchers that create review tasks or approval artifacts only.
- Keep all external actions manual or approval-gated.

No new external sending, posting, buying, bidding, pricing, charging, webhook, or production automation behavior is introduced.

## Mini-App Framework

Each mini app should follow this contract:

- Agent-generated recommendation
- Editable draft or structured output
- Approve/reject/revision path
- Copy/export/manual handoff fallback
- Notes and risk status
- Task status update
- Audit ledger entry
- CRM/revenue/task linkage after action

Initial mini-app blueprints:

- Email approval
- SMS approval
- Political plan
- Supplyfy approval cart
- Route-density review
- SAM.gov bid review

## Browser / Computer-Use Readiness

Future browser/computer-use agents may plug in only behind these controls:

- Human approval before email, SMS, Facebook DM, post, Stripe, supplier checkout, Canva publish/export, bid submission, or Google Sheet write.
- Every action writes to `ai_workforce_activity_logs`.
- External tools run in sandbox/test mode first.
- Manual fallback must remain available for every workflow.
- Sensitive actions require explicit confirmation and a related task/output approval.
- Agents must never bypass platform rate limits, spam protections, opt-outs, payment controls, or political compliance rules.

## Highest-Value Next Sequence

1. Harden `/admin/agents` as the single AI workforce command layer.
2. Connect mini-app blueprints to real approval queues one at a time.
3. Make Daily Action Plan pull live data from Revenue Operations, Daily Outreach, Procurement, and Political records.
4. Add browser/computer-use connectors as supervised tools only.
5. Add analytics for completed daily actions, revenue created, time saved, and approval cycle time.

## Phase 2 Candidates

- Live daily action plan generation from CRM/revenue tables.
- Editable mini-app draft form components.
- Unified approval queue linking revenue, AI outputs, political, procurement, GovCon, and creative artifacts.
- Agent pause/resume persisted controls.
- Agent run detail pages.
- Computer-use sandbox runner with permission manifests.
- Supplyfy approval-cart mini app wired to real supplier comparison records.
- Political geofence-first package builder with four campaign options and export.
