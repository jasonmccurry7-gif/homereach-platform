---
name: research
description: HomeReach research workflow for businesses, markets, competitors, candidates, campaigns, SAM.gov opportunities, postal/geographic context, and customer background. Use when Codex needs source-backed context before outreach, proposals, political planning, procurement analysis, or government contract review.
---

# Research

## Purpose

Build concise, source-backed briefs that separate verified facts from assumptions and unknowns.

## Required Inputs

- Entity name, geography, workflow, and goal.
- Internal context path or database record when available.
- Public source URLs when provided.

## Workflow

1. Load AGENTS.md and AI Assets business context.
2. Identify the workflow: shared postcard, targeted, political, procurement, SAM.gov, sales, or QA.
3. Gather internal context first, then public sources if needed.
4. Separate facts, assumptions, risks, and unknowns.
5. Note source quality and confidence.
6. Prepare the next recommended action.

## Output Format

- Summary
- Verified facts
- Assumptions
- Sources referenced
- Risks
- Unknowns
- Recommended next action

## File / Database Destination

Save drafts to `ai_outputs` and link task work in `ai_workforce_tasks`. Local exports go to `ai-workforce/research`.

## Approval Rules

Human approval is required before research is used in customer-facing, political, financial, legal, or outbound content.

## Error Handling

If sources conflict or are missing, mark the brief `needs_review` and list exactly what is unresolved.

## QA Checklist

- Names, dates, geography, numbers, and public claims are checked.
- Sensitive or political individual profiling is not included.
- Unsupported claims are labeled as assumptions.

## Logging Requirement

Log sources, confidence, task ID, agent, and next action in `ai_workforce_activity_logs`.
