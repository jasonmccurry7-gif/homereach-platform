---
name: design-brief
description: HomeReach design brief workflow for postcards, sales decks, dashboards, website pages, Canva/Figma handoffs, political mail visuals, proposal visuals, and campaign creative. Use when Codex needs design-ready instructions that still require human approval.
---

# Design Brief

## Purpose

Translate strategy into clear visual direction, production notes, copy blocks, and approval points.

## Required Inputs

- Offer, audience, format, dimensions, brand notes, examples, CTA, compliance constraints.

## Workflow

1. Load AGENTS.md, brand voice, and design-related AI Assets.
2. Identify format and production constraints.
3. Define visual hierarchy, message hierarchy, and CTA.
4. Draft front/back or page/slide sections as needed.
5. Add Canva/Figma handoff notes and approval gates.
6. Save as draft or `needs_review`.

## Output Format

- Objective
- Audience
- Visual direction
- Copy blocks
- Asset list
- Production notes
- Approval checklist

## File / Database Destination

Save to `ai_outputs`; local exports go to `ai-workforce/design-briefs`.

## Approval Rules

Human approval is required before client delivery, public use, political use, print-ready export, or production.

## Error Handling

If dimensions, source assets, or claims are missing, mark the brief `needs_revision`.

## QA Checklist

- CTA, sizing, brand tone, compliance notes, and required assets are present.
- Political and proposal visuals have explicit approval gates.

## Logging Requirement

Log brief type, sources, task ID, and approval status in `ai_workforce_activity_logs`.
