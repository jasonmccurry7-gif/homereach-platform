---
name: seo-growth
description: HomeReach SEO growth workflow for technical SEO audits, local SEO authority, content and topic clusters, conversion SEO reviews, metadata/schema recommendations, and SEO QA. Use when Codex needs to improve HomeReach's own organic visibility through approval-gated, non-spammy SEO planning or review.
---

# SEO Growth

## Purpose

Improve HomeReach's own organic visibility while protecting brand trust, approval gates, and factual accuracy.

## Required Inputs

- Agent lane: technical SEO, local SEO authority, content/topic cluster, conversion SEO, or SEO QA.
- Target page, route, topic, geography, or workflow.
- Approved HomeReach business context and existing website copy.
- Search Console, analytics, CRM, or public source context when available.

## Workflow

1. Load AGENTS.md and confirm the relevant SEO agent lane.
2. Reuse AI Assets business context, approved examples, existing pages, and current records before researching externally.
3. Define the search intent, target audience, conversion path, approval requirement, and related entity.
4. Draft the audit, brief, metadata, schema recommendation, local authority note, topic cluster, or QA report.
5. Flag source gaps, claim risks, spam risks, implementation risk, and human approval requirements.
6. Save public-facing or implementation-ready outputs with status `needs_review`.

## Output Format

- SEO lane
- Target route, topic, geography, or artifact
- Inputs used
- Sources referenced
- Findings or recommendations
- Approval status
- Related entity
- Destination
- Next action

## File / Database Destination

Save reusable outputs to `ai_outputs`; local exports go to `ai-workforce/seo-growth`, `ai-workforce/seo-technical`, `ai-workforce/seo-content`, or `ai-workforce/seo-local`.

## Approval Rules

Human approval is required before publishing SEO copy, changing metadata, adding schema, changing redirects or indexing controls, updating local profiles/citations, changing CTAs, or using SEO recommendations in customer-facing material.

## SEO Guardrails

- Do not keyword-stuff, cloak content, create doorway pages, mass-generate thin pages, plagiarize, fabricate sources, fabricate reviews, fabricate local presence, buy/trade links, impersonate competitors, or make ranking/ROI guarantees.
- Keep HomeReach positioned as an AI-powered operational growth and execution ecosystem for modern local businesses and campaigns.
- Translate SEO improvements into useful human outcomes: clearer discovery, stronger trust, easier decisions, and more confident next actions.
- Separate facts, assumptions, recommendations, and unknowns.

## Error Handling

If business context, page ownership, source support, pricing, approval status, or technical state is unclear, mark the task `blocked` or `needs_review` and request the missing input.

## QA Checklist

- Output uses approved HomeReach positioning.
- Sources support factual claims.
- No spam tactics, unsupported guarantees, or fabricated local authority.
- CTA, pricing language, and compliance-sensitive claims are approval-gated.
- Technical recommendations include affected route, expected impact, risk, and next action.

## Logging Requirement

Log lane, target, sources, assumptions, findings, approval status, related entity, destination, and next action in `ai_workforce_activity_logs`.
