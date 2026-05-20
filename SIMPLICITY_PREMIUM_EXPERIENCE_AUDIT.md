# HomeReach Simplicity + Premium Experience Audit

Audit date: 2026-05-18  
Scope: Simplification audit plus a small read-only Next Best Action enhancement inside the existing HomeReach OS command center.

## Phase 1 Findings

HomeReach already has strong domain systems:

- HomeReach OS: `/admin`
- Sales Intelligence: `/admin/sales-dashboard`
- Revenue Command: `/admin/revenue-operations`
- Communications: `/admin/inbox`
- AI Workforce: `/admin/agents`
- Political Command: `/political/*` and `/admin/political/*`
- Candidate Agent: `/political/candidate-agent` and `/admin/political/candidate-agent`
- Operations Copilot procurement: `/operations-copilot/*` and `/admin/procurement`
- Growth Engine: `/admin/growth-engine`
- Canva Design OS: `/admin/canva`
- Stripe/order visibility: `/admin/orders`, `/admin/profit-center`

The main UX risk is cognitive load from many valid surfaces, not lack of features. The safest simplification path is to keep each specialist workspace intact, but make `/admin` answer one question first:

What should I do next?

## Overlap To Consolidate Carefully

| Area | Current overlap | Simplification decision |
| --- | --- | --- |
| Action centers | Procurement action center, political recommended actions, sales next actions, admin queues | Create a read-only top-level Next Best Action list that links into existing action owners. |
| AI recommendations | Political agents, Operations Copilot, Growth OS, sales AI, QA, content AI | Add shared recommendation shape: confidence, reason, impact, risk, expected outcome. |
| Command dashboards | `/admin`, `/admin/control-center`, `/admin/operator`, `/admin/war-room`, `/admin/revenue-operations` | Keep `/admin` as the calm executive layer; specialist pages remain drill-downs. |
| Communications | Inbox, sales events, conversations, revenue messaging, webhooks | Treat revenue message threads/events as the future canonical timeline; preserve existing bridges. |
| Procurement | `/operations-copilot`, `/inventory-purchasing`, `/admin/procurement` | Operations Copilot remains the domain source; admin procurement is admin visibility. |
| Political | Public command, admin command, candidate agent, maps, proposals, presentation | Candidate/mapping/proposal systems stay connected; no new political mini-app. |

## Screen Standard

Every executive screen should answer:

1. What happened?
2. Why does it matter?
3. What should the user do next?
4. What happens if they do nothing?

The new Next Best Action model follows that standard.

## Implemented Safe Slice

Added a read-only `nextBestActions` layer to the existing HomeReach OS data model.

Each action includes:

- title
- outcome
- reason
- if ignored
- action label
- destination link
- confidence
- urgency
- impact
- risk
- status
- category

This is intentionally a guidance layer, not an automation layer. It does not send messages, approve orders, charge cards, publish content, change maps, or mutate records.

## Current Action Sources

The first implementation derives actions from existing HomeReach OS counts:

- failed/pending payment records
- unread replies
- candidate launch plans needing review
- procurement approval requests
- design approvals
- stale sales follow-ups
- pending proposals
- synchronized map plans
- provider exceptions

## Next Recommended Slice

After migration and provider status is confirmed, promote this into a real shared Action Center:

1. Add a persistence table for dismissed/snoozed/completed cross-domain actions.
2. Add explicit human override states: approve, edit, reject, snooze, ask why.
3. Route domain actions to existing APIs only after each action has a safe, idempotent backend.
4. Add daily Morning Briefing and Evening Briefing from the same action model.
5. Add mobile compact view for “what matters today.”

## Non-Negotiable Guardrails

- Do not create a second admin command center.
- Do not move checkout, Stripe, Twilio, maps, political, or procurement logic into the overview page.
- Do not auto-send outreach from the Action Center.
- Do not auto-approve political content or proposals.
- Do not re-enable SerpAPI without explicit owner direction.
- Do not expose admin-only margin data to client-facing pages.

