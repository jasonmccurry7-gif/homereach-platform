---
name: qa-system-health
description: HomeReach QA and system health workflow for route audits, form tests, CTA tests, payment tests, automation tests, mobile tests, auth checks, dashboard reviews, and issue reports. Use when Codex needs to verify functionality and document production risks.
---

# QA / System Health

## Purpose

Verify workflows by actual behavior and report specific issues with reproduction steps.

## Required Inputs

- Route or workflow, expected behavior, test account/state, device viewport, and risk focus.

## Workflow

1. Load AGENTS.md QA rules.
2. Identify protected flows before testing.
3. Test route load, navigation, buttons, forms, API behavior, mobile layout, and error states.
4. Avoid destructive production actions unless approved.
5. Record expected vs actual behavior.
6. Create a prioritized issue report.

## Output Format

- Route/workflow tested
- Result
- Findings by severity
- Reproduction steps
- Root cause if known
- Recommended fix
- Risk of fixing

## File / Database Destination

Save to `ai_outputs`; local reports go to `ai-workforce/qa` or `ai-workforce/reports`.

## Approval Rules

Human approval is required before destructive tests, production data mutation, payment tests, or live sends.

## Error Handling

If a test cannot run because of auth, missing env vars, or integration state, report it as unverified with exact blocker.

## QA Checklist

- Auth, data isolation, payment safety, mobile responsiveness, loading states, and error states are covered when relevant.

## Logging Requirement

Log route, action, result, severity, task ID, and evidence path in `ai_workforce_activity_logs`.
