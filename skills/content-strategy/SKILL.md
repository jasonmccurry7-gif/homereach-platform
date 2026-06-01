---
name: content-strategy
description: HomeReach content strategy workflow for messaging plans, content calendars, sales angles, campaign strategies, follow-up sequences, and offer positioning. Use when Codex needs to turn business goals into an approval-gated campaign plan.
---

# Content Strategy

## Purpose

Turn a business objective into a clear strategy that can feed copy, creative, outreach, and reporting.

## Required Inputs

- Offer, audience, geography, channel, desired outcome, and timeline.
- Relevant examples from AI Assets.

## Workflow

1. Load AGENTS.md and the relevant prompt chain.
2. Clarify audience, pain point, offer, CTA, and conversion path.
3. Choose content angles and channel sequence.
4. Create a calendar or workflow sequence.
5. Define assets needed and approval points.
6. Save the plan with status `needs_review` when customer-facing.

## Output Format

- Strategy summary
- Audience and offer angle
- Channel plan
- Content calendar or sequence
- Assets needed
- Approval points
- Next action

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/content-strategy`.

## Approval Rules

Human approval is required before public, political, outbound, or pricing-related use.

## Error Handling

If the offer, audience, or price is unclear, mark the task `blocked` and request missing inputs.

## QA Checklist

- Strategy matches approved HomeReach positioning.
- CTA is clear and low-friction.
- No unsupported claims or hidden operational complexity.

## Logging Requirement

Log workflow, assumptions, data sources, and approval status in `ai_workforce_activity_logs`.
