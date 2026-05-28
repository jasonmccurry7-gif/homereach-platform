---
name: orchestration
description: HomeReach orchestration workflow for breaking business requests into AI workforce tasks, assigning agents, checking dependencies, enforcing human approval, logging activity, and producing final reports. Use when Codex coordinates multiple HomeReach workflows or agents.
---

# Orchestration

## Purpose

Coordinate HomeReach AI work so agents operate as one controlled system instead of disconnected dashboards.

## Required Inputs

- User request, workflow area, desired output, priority, dependencies, approval risk, related entity.

## Workflow

1. Load AGENTS.md as the source of truth.
2. Audit existing systems and identify reusable tables/routes/components.
3. Split the request into tasks with expected outputs and dependencies.
4. Assign the best agent and required skill.
5. Enforce approval rules before any high-risk action.
6. Log task creation, progress, blockers, outputs, and final report.

## Output Format

- Task breakdown
- Agent assignments
- Dependencies
- Approval gates
- Outputs created
- Risks
- Final summary

## File / Database Destination

Create/update rows in `ai_workforce_tasks`, log events in `ai_workforce_activity_logs`, and save deliverables in `ai_outputs`.

## Approval Rules

Human approval is required before any public, political, financial, legal, customer-facing, outbound, or campaign-changing action.

## Error Handling

If dependencies are missing, mark affected tasks `blocked` and list what is needed.

## QA Checklist

- Every task has ID, workflow, assigned agent, priority, status, expected output, approval flag, and next action.
- Outputs reference sources and approval state.

## Logging Requirement

Log every assignment, status change, approval change, blocker, and final handoff in `ai_workforce_activity_logs`.
