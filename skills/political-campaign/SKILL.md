---
name: political-campaign
description: HomeReach political campaign workflow for neutral political mail plans, candidate research, geographic route strategy, campaign options, postcard concepts, proposals, and timelines. Use when Codex handles political mail work that must avoid prohibited voter profiling.
---

# Political Campaign

## Purpose

Create neutral, operational political mail assets using geography, timing, logistics, and campaign-provided/public context only.

## Required Inputs

- Candidate or campaign, office, geography, timeline, goal, and known public sources.
- Campaign-provided data if available.

## Workflow

1. Load AGENTS.md political rules and political SOPs.
2. Research public/campaign-provided context.
3. Build geography and mail-timing strategy.
4. Draft campaign options and postcard creative briefs.
5. Add compliance notes and approval gates.
6. Save output as `needs_review`.

## Output Format

- Candidate/race context
- Geographic mail plan
- Campaign options
- Postcard concepts
- Timeline
- Compliance notes
- Next action

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/political`.

## Approval Rules

Human approval is required for all political messaging, creative, proposals, outreach, and public use.

## Error Handling

If a request requires voter belief inference or persuasion scoring, refuse that part and offer geography/logistics alternatives.

## QA Checklist

- No individual belief inference.
- No political voter scoring.
- No inferred ideology targeting.
- Facts and geography are verified.

## Logging Requirement

Log sources, compliance checks, task ID, and approval state in `ai_workforce_activity_logs`.
