---
name: outreach
description: HomeReach outreach drafting workflow for email, SMS, Facebook DM, Facebook group posts, lead follow-up, reply suggestions, and close sequences. Use when Codex needs approval-gated outbound drafts that must not be sent automatically.
---

# Outreach

## Purpose

Create concise, human outreach drafts that are ready for review, not automatic sending.

## Required Inputs

- Contact or audience.
- Offer, channel, context, desired CTA, and prior conversation.
- Applicable SOP from AI Assets.

## Workflow

1. Load AGENTS.md and AI Assets business context.
2. Select the correct SOP: email, SMS, DM, Facebook post, or follow-up.
3. Resolve the sender persona before drafting:
   - Jason first for political campaigns, high-value candidates, campaign managers, consultants, statewide races, proposals, and strategic campaign conversations.
   - Josh for shorter, practical local business, shared postcard, targeted campaign, and quick engagement outreach.
   - Chelsi for warmer onboarding, nurture, customer follow-up, and supportive procurement demo communication.
   - Heather for polished procurement, savings, vendor, inventory, and operational-efficiency outreach.
4. Check opt-in, channel constraints, pricing, compliance, and duplicate-contact risk.
5. Draft short and long versions when useful, varying subject, opener, CTA, cadence, and sign-off by sender.
6. Add a next-step CTA and approval note.
7. Save the draft as an AI output and mark it `needs_review`.

## Output Format

- Channel
- Subject or opener
- Draft copy
- Short version
- CTA
- Compliance notes
- Next action

## File / Database Destination

Save to `ai_outputs`, connect to `ai_workforce_tasks`, and export local copies to `ai-workforce/outreach`.

## Approval Rules

Human approval is required before sending SMS, email, DMs, social posts, political messages, payment reminders, or public claims.

## Error Handling

If opt-in, pricing, or recipient data is unclear, stop at draft status and mark the task `blocked`.

## QA Checklist

- No unsupported ROI, savings, ranking, or delivery guarantees.
- SMS includes STOP/HELP when appropriate.
- Political messaging obeys AGENTS.md political rules.
- No two sender identities use identical subject lines, openings, CTA wording, sign-offs, cadence, or paragraph structure.
- Jason remains the primary identity for campaign-level political conversations unless there is a deliberate delegation note.
- Sender persona and communication policy metadata are attached to the draft or outbound log.

## Logging Requirement

Log channel, contact/context, draft status, approval state, and task ID in `ai_workforce_activity_logs`.
