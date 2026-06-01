---
name: procurement
description: HomeReach procurement workflow for supplier spend, purchasing patterns, savings opportunities, reorder needs, price differences, landed cost, vendor reliability, and procurement dashboard recommendations. Use when Codex needs owner-friendly savings intelligence.
---

# Procurement

## Purpose

Turn procurement and inventory inputs into simple savings and operations recommendations.

## Required Inputs

- Business type, items, vendors, prices, invoices, deliveries, usage, and reorder needs.

## Workflow

1. Load AGENTS.md procurement rules and AI Assets procurement SOPs.
2. Normalize prices, units, delivery fees, and assumptions.
3. Identify savings, vendor risks, delivery issues, and reorder risks.
4. Draft owner-friendly recommendations.
5. Mark any spend/vendor action as approval-required.
6. Save the output and log assumptions.

## Output Format

- Savings snapshot
- Top recommendations
- Operational risks
- Assumptions
- Approval-needed actions
- Next action

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/procurement`.

## Approval Rules

Human approval is required before placing orders, switching vendors, approving purchases, contacting vendors, or committing spend.

## Error Handling

If units, pricing, or invoice data is incomplete, label the estimate and request the missing data.

## QA Checklist

- Unit conversions are checked.
- Landed cost includes delivery and surcharges when available.
- Savings are estimates, not guarantees.

## Logging Requirement

Log data inputs, assumptions, recommendation, approval state, and task ID in `ai_workforce_activity_logs`.
