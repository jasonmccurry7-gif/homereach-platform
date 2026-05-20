# HomeReach AI Workforce OS - Phase 1C

## Purpose

Phase 1C connects the Learning Engine to the existing Unified Action Center and human-approved autopilot handoff path.

The goal is to turn research into supervised operator work without creating another backlog, another task table, or another dashboard-specific approval system.

## What Changed

- `getUnifiedActionCenter` now reads high-scoring Learning Engine artifacts:
  - `ci_insights`
  - `ci_enhancements`
  - `ci_automations`
- Qualified Learning Engine items appear as Action Center items with:
  - source dashboard: `Learning Engine`
  - route: `/admin/content-intel`
  - explicit human approval requirement
  - safe recommended action language
- The existing autopilot approval layer now gives Learning Engine items a specific guardrail:
  - approvals can create internal implementation tasks only
  - approvals do not publish, deploy, send outreach, change pricing, bill, order, or alter production
- The Content Intelligence feedback endpoint now maps outcomes to each table's valid status values:
  - insight/automation/enhancement `win` -> `approved`
  - insight/automation/enhancement `failed` -> `rejected`
  - action/script/offer outcomes continue using `win`, `neutral`, or `failed`

## Safety Boundary

This phase only creates visibility and internal task handoffs.

It does not:

- publish SEO pages
- send email, SMS, DM, or political outreach
- modify Stripe or pricing
- place procurement orders
- submit government bids
- deploy code
- change public website content
- create customer-facing commitments

## Operator Workflow

1. Learning Engine ingests and scores research.
2. High-scoring insights and implementation ideas appear in the Unified Action Center.
3. Admin reviews them in `/admin/agents`.
4. Admin may approve a gate.
5. For safe low/medium-risk items, admin may queue an internal handoff.
6. Admin may create a `crm_tasks` item for human implementation.
7. A human still performs any real production or customer-facing action.

## Go-Live Requirements

- Apply migrations `097` through `102` in Supabase for durable Action Center, autopilot handoffs, internal tasks, and Learning Engine taxonomy.
- Set `ENABLE_CONTENT_INTEL=true` only after YouTube/transcript/API credentials are present.
- Keep `DISABLE_CONTENT_INTEL_AI=true` until extractor credentials and review workflow are verified.
- Run the Learning Engine in review-only mode before enabling any scheduled ingestion.
