# Admin Architecture and Scheduler Governance

## Executive Admin Layer

`/admin` is the canonical executive command center for HomeReach.

It owns cross-system visibility for revenue movement, outreach, AI workforce status, system health, owner actions, and escalation state.

The following routes are modules inside the executive layer, not competing dashboards:

- `/admin/revenue-operations` - revenue movement, replies, approval queues, and payment visibility.
- `/admin/outreach-command` - manual outreach execution and deliverability-safe actions.
- `/admin/control-center` - control tower, operational health, blockers, and automation readiness.
- `/admin/agents` - AI workforce command center.
- `/admin/ai-assets` - AI business context, SOPs, prompts, examples, outputs, and reviews.
- `/admin/ai-growth-os` - growth module supervision.
- `/admin/contractos` - government-contract product and packaging surface.
- `/admin/gov-contracts` - canonical government-contract approval and execution surface.

`/admin/os` is a compatibility route and redirects to `/admin`.

## Scheduler Source of Truth

The root `vercel.json` is the production deployment source of truth because production deploys run from the repository root.

`apps/web/vercel.json` mirrors the cron set for app-local clarity, but root `vercel.json` is authoritative for production.

Production deployment truth was resolved in favor of:

- Authoritative config: `vercel.json`
- Mirrored app reference: `apps/web/vercel.json`
- Current cron count: 11
- Required validation: root and app cron sets must match before deploy.

Only cron routes that are already durable source code should be enabled in the authoritative config. Newer local automation candidates must remain unscheduled until their endpoint, dependencies, migration requirements, owner, approval gate, and rollback path are committed and validated.

Any scheduler change must update both files in the same change:

- `vercel.json`
- `apps/web/vercel.json`

## Contract Workflow Ownership

ContractOS and Gov Contracts are intentionally separate surfaces with one approval owner.

ContractOS:

- Packages the GovCon offer.
- Shows readiness, revenue, user, and support signals.
- Routes work into Gov Contracts for approval-sensitive actions.

Gov Contracts:

- Owns bid/no-bid state.
- Owns submission readiness.
- Owns external status evidence.
- Owns pricing review.
- Owns compliance review.
- Owns subcontractor commitment controls.

Protected GovCon actions must never be completed from ContractOS alone:

- External bid submission.
- Eligibility or compliance certification.
- Pricing approval.
- Subcontractor commitment.
- Award acceptance.

## Agent Governance Source

`AGENTS.md` is the source of truth for AI workforce behavior and must remain tracked in git.

Local generated artifacts can live under `ai-workforce/`, but AGENTS.md itself is not a generated artifact and should be reviewed like production governance code.

## Executive Review Layer

`/admin/content-review` is the centralized executive review layer.

It owns review visibility for:

- Revenue drafts and one-to-one send approvals.
- Political plans, proposals, creative, and outreach readiness.
- Procurement savings, invoice, and vendor-action recommendations.
- Creative Studio assets and compliance status.
- Gov Contracts bid rooms and submission packages.
- Daily Content, AI Assets, Content Intel, publication records, and Facebook drafts.

Module-specific pages may still own deep workflow details, but they should route approval-sensitive decisions back through the executive review layer or the canonical module owner.

## Readiness Truth

Readiness-heavy admin pages must visibly label their data mode:

- `Live data` means the configured database/runtime returned the expected records.
- `Live + seed` means persistence is live but missing categories are filled by safe seed records.
- `Partial live` means at least one source failed or is unavailable.
- `Seed fallback` means persisted data is not available and the page is showing seeded examples.
- `Demo data` means visible rows are examples and must not be treated as customer records.

This applies to AI Assets, AI Workforce, Control Tower, Local Visibility, and any future readiness modules.

## Command-Center Expansion Freeze

New admin command centers, duplicate shells, and duplicate approval surfaces are frozen unless the change answers all of these before implementation:

- Which existing executive module cannot own this?
- Which approval queue owns the human decision?
- Which cron or automation source owns scheduling?
- Which source of truth owns live-vs-demo readiness?
- What revenue growth outcome justifies the extra surface?
