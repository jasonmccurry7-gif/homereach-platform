---
name: revenue-integrity
description: HomeReach revenue integrity workflow for stuck leads, missing follow-ups, unpaid quotes, failed intake attempts, inactive campaigns, payment issues, abandoned opportunities, and daily revenue risks. Use when Codex needs to find what should make money next.
---

# Revenue Integrity

## Purpose

Protect revenue by surfacing stuck opportunities, failed money flows, and owner decisions.

## Required Inputs

- Date range, leads, quotes, payments, campaigns, messages, tasks, approvals, and follow-ups.

## Workflow

1. Load AGENTS.md and revenue audit SOPs.
2. Review leads, quotes, payments, campaigns, messages, and tasks.
3. Identify stale, failed, unpaid, abandoned, or blocked opportunities.
4. Estimate impact carefully and label assumptions.
5. Draft recovery actions for approval.
6. Save report and log owner actions needed.

## Output Format

- Executive summary
- Revenue risks
- Stuck opportunities
- Recovery drafts
- Owner decisions needed
- Recommended next actions

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/revenue-integrity`.

## Approval Rules

Human approval is required before customer outreach, payment changes, discounting, campaign-status updates, or subscription changes.

## Error Handling

If data is missing or contradictory, list the blocker and avoid assigning revenue impact as fact.

## QA Checklist

- Dollar values, payment status, last-contact dates, and campaign status are verified.
- Recovery actions do not execute automatically.

## Logging Requirement

Log records checked, risk summary, estimated impact, approval state, and task ID in `ai_workforce_activity_logs`.
