# AI Workforce / AI Assets Service Kit

## Status

AI Workforce / AI Assets is production-hardened as internal HomeReach infrastructure. It is the operating layer for task assignment, reusable business context, SOPs, source examples, agent profiles, output drafts, verification checks, approvals, and activity logging.

It is not sold as a client product.

## Live Surfaces

- AI Workforce Command Center: `/admin/agents`
- AI Assets Command Center: `/admin/ai-assets`
- AI Workforce action API: `/api/admin/ai-workforce/actions`
- AI Assets action API: `/api/admin/ai-assets/actions`
- Live smoke: `pnpm smoke:ai-workforce-assets`

## Database Tables

AI Assets:

- `ai_business_context`
- `ai_prompt_sops`
- `ai_data_sources`
- `ai_agent_profiles`
- `ai_prompt_chains`
- `ai_prompt_chain_steps`
- `ai_outputs`
- `ai_verification_checks`
- `ai_output_reviews`

AI Workforce:

- `ai_workforce_tasks`
- `ai_workforce_activity_logs`

Related approval infrastructure:

- `approval_ledger`
- `approval_ledger_events`

## Operating Workflow

1. Owner or admin creates an AI Workforce task.
2. Task is assigned to the proper agent profile.
3. Draft output is saved to `ai_outputs`.
4. Verification checks are created for the output.
5. Human reviewer approves, rejects, or requests revision.
6. Approval and verification status sync to the approval ledger.
7. Activity is logged in `ai_workforce_activity_logs`.
8. Approved and verified outputs may be marked as winning outputs or saved as reusable SOP/source material.

## Required Guardrails

- No sending email, SMS, DMs, or social posts without human approval.
- No public website, SEO, proposal, political, legal, or compliance-sensitive copy goes live without approval.
- No pricing, payment, subscription, charge, or Stripe change without approval.
- No political voter-belief inference, ideology scoring, or individual persuasion targeting.
- No procurement order, supplier switch, purchase approval, or spend commitment.
- No SAM.gov bid submission, certification, fabricated qualification, or binding proposal action.
- Reusable artifact approval does not equal execution approval.

## Verification Rules

Every saved output should include:

- Inputs used
- Sources referenced
- Approval status
- Verification status
- Next action
- Related workflow or task when available

AI Workforce now creates default verification checks for new outputs and requires approval through an artifact approval path before an output can become a winning output.

## Result Tracking

Track:

- Tasks created
- Tasks in progress
- Tasks blocked
- Tasks awaiting approval
- Outputs created
- Outputs approved
- Outputs rejected
- Outputs needing revision
- Winning outputs
- Activity logs
- Approval ledger entries

## Production Smoke

Run:

```bash
pnpm smoke:ai-workforce-assets
```

This verifies:

- `/admin/agents` gates or loads cleanly
- `/admin/ai-assets` gates or loads cleanly
- AI Workforce action API requires admin auth
- AI Assets action API requires admin auth
- Required AI Assets and AI Workforce tables are exposed and queryable
- Recent output/task samples contain core approval/source fields

## Rollback

If AI Workforce / AI Assets causes production issues:

1. Stop creating new AI Workforce tasks.
2. Use existing module-specific manual workflows.
3. Keep AI outputs in `needs_review` or `revision_needed`.
4. Do not delete historical output, review, or activity rows.
5. Roll back the Vercel deployment if admin routes regress.
6. Use a reviewed forward migration for any database correction.
