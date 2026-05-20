# HomeReach AI Workforce OS - Phase 1G

## Purpose

Phase 1G adds a safe promotion path from the Learning Engine into the existing Action Center.

This lets a reviewed Learning Engine insight become supervised internal work without adding another backlog, bypassing approval gates, or executing production changes.

## What Was Added

- `POST /api/admin/ai-orchestration/learning-promote`
  - Admin-only.
  - Promotes a `ci_insights` row into `unified_action_items`.
  - Writes a `unified_action_events` audit row.
  - Marks the promotion as internal-review-only.
- `getUnifiedActionCenter`
  - Now reads durable `learning_engine_promotion` Action Center items in addition to generated items.
- Learning Engine UI
  - Adds `Promote to Action Center` on insight rows.

## Safety Boundary

Promoting a Learning Engine item:

- does not publish content
- does not send outreach
- does not deploy code
- does not change pricing
- does not create checkout
- does not place procurement orders
- does not submit bids
- does not contact customers

It creates an internal review action only. A human still approves any further handoff in `/admin/agents`.

## Next Safe Phase

Phase 1H should improve the promoted-item workflow with visible promotion status and optional notes, then add a small smoke test endpoint for the AI Workforce OS admin APIs.
