---
name: data-revenue
description: HomeReach data and revenue analysis workflow for leads, quotes, payments, conversion rates, campaign performance, procurement savings, margins, and revenue opportunities. Use when Codex needs metrics, risks, or next-best-action analysis.
---

# Data / Revenue

## Purpose

Find revenue signals, missed opportunities, payment risks, performance trends, and next actions.

## Required Inputs

- Date range, entity scope, data source, and target metric.
- Relevant CRM, campaign, payment, message, or procurement records.

## Workflow

1. Load AGENTS.md and revenue-related AI Assets.
2. Identify the records and time window.
3. Calculate metrics and compare to expected state.
4. Flag stuck leads, failed payments, missing follow-ups, and low-margin risks.
5. Recommend next actions without executing them.
6. Save analysis and log assumptions.

## Output Format

- Metric summary
- Risks
- Revenue opportunities
- Assumptions
- Recommended actions
- Approval needs

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/data-revenue`.

## Approval Rules

Human approval is required before customer-facing recovery, payment, pricing, or campaign-status actions.

## Error Handling

If data is incomplete, report the gap and avoid overconfident conclusions.

## QA Checklist

- Math and date ranges are checked.
- Payment status and campaign status are not guessed.
- Revenue estimates are labeled as estimates.

## Logging Requirement

Log data scope, findings, task ID, and next action in `ai_workforce_activity_logs`.
