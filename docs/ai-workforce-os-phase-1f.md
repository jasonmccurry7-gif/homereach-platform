# HomeReach AI Workforce OS - Phase 1F

## Purpose

Phase 1F creates a running "Jason Action Required" readiness layer so engineering can keep moving while credentials, approvals, migrations, and production confirmations are tracked clearly.

## What Was Added

- `getUserActionReadiness`
  - Builds a normalized list of items that require human action.
  - Reads the existing Dashboard Agent Matrix for missing required env vars, optional env vars, and manual blockers.
  - Adds known production prerequisites like migrations, Learning Engine launch mode, Twilio A2P, Postmark sender verification, and policy confirmations.
- `GET /api/admin/ai-orchestration/user-actions`
  - Admin-only readiness endpoint.
- `/admin/agents` panel
  - Shows total required items, critical items, go-live blockers, and autonomy blockers.
  - Keeps each item plain-English and action-oriented.
- `docs/home-reach-user-action-required.md`
  - Running human-action checklist outside the app.

## Safety Boundary

This phase is visibility only.

It does not:

- change environment variables
- apply migrations
- enable SMS
- send messages
- enable Learning Engine ingestion
- change payments
- change political automation
- modify production data

## Why This Matters

The AI Workforce OS needs a clear split between:

- engineering work Codex can continue,
- production setup Jason must complete,
- and actual hard blockers.

This panel prevents go-live prerequisites from being lost in chat while allowing safe build phases to continue.

## Next Safe Phase

Phase 1G should add a safe "Promote Learning Item" action that creates an internal task through the existing approval/handoff path, not a new backlog.
