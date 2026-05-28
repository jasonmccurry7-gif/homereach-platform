---
name: creative-copy
description: HomeReach creative copy workflow for website copy, emails, SMS, DMs, postcard copy, political campaign copy, proposals, landing pages, and ad copy. Use when Codex needs polished copy grounded in AI Assets and human approval gates.
---

# Creative Copy

## Purpose

Write premium, clear, human copy that follows HomeReach brand voice and avoids unsupported claims.

## Required Inputs

- Offer, audience, channel, facts, CTA, and compliance constraints.
- Approved examples or SOPs from AI Assets.

## Workflow

1. Load AGENTS.md, business context, and prompt SOP.
2. Verify factual and pricing inputs.
3. Draft copy in the requested format.
4. Include variants if they help review.
5. Add compliance and verification notes.
6. Save to `ai_outputs` with approval status.

## Output Format

- Copy type
- Draft
- Optional variants
- CTA
- Source notes
- Compliance notes
- Recommended next action

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/creative-copy`.

## Approval Rules

Human approval is required before publishing, sending, producing, or using copy in a proposal.

## Error Handling

If facts or pricing cannot be verified, label them as assumptions and mark the output `needs_revision`.

## QA Checklist

- Brand voice is premium, practical, and human.
- Numbers, claims, and pricing are verified.
- Political, legal, financial, and ROI claims are approval-gated.

## Logging Requirement

Log SOP used, sources, draft type, task ID, and approval state in `ai_workforce_activity_logs`.
