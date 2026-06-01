---
name: sam-gov
description: HomeReach SAM.gov workflow for opportunity scan, fit analysis, bid/no-bid support, subcontractor needs, proposal package drafting, approval checklists, and submission package organization. Use when Codex works on government contract opportunities without autonomous submission.
---

# SAM.gov

## Purpose

Organize government contracting work around profitable, executable, compliance-aware bids.

## Required Inputs

- Opportunity title, agency, solicitation number, due date, requirements, attachments, capabilities, pricing assumptions.

## Workflow

1. Load AGENTS.md SAM.gov rules and AI Assets SAM.gov SOPs.
2. Summarize opportunity and deadlines.
3. Assess capability, compliance, financial, operational, and competition fit.
4. Identify subcontractor or teaming needs.
5. Draft bid/no-bid recommendation and proposal checklist.
6. Save as `needs_review`.

## Output Format

- Opportunity summary
- Fit analysis
- Risks
- Missing requirements
- Subcontractor needs
- Bid/no-bid recommendation
- Approval checklist

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/sam-gov`.

## Approval Rules

Human approval is required before pricing decisions, compliance claims, bid submissions, subcontractor commitments, or proposal delivery.

## Error Handling

If solicitation data is missing or ambiguous, mark the task `blocked` and list the exact missing requirement.

## QA Checklist

- Deadlines, time zones, submission method, documents, and pricing assumptions are checked.
- No fabricated qualifications or compliance certifications.
- No autonomous submission.

## Logging Requirement

Log opportunity, sources, risks, approval state, and task ID in `ai_workforce_activity_logs`.
