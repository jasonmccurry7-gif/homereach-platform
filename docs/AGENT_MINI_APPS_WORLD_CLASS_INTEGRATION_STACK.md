# Agent Mini Apps World-Class Integration Stack

Research date: 2026-06-01

This document turns the Agent Mini Apps layer into a production integration roadmap. The principle is simple: HomeReach remains the approval system of record, APIs perform deterministic read/draft/queued work, and browser/computer-use automation is only a controlled fallback for systems that lack stable APIs or require account-owner interaction.

## Operating Model

Agent-created work should move through four layers:

1. Context and planning
   - AI Assets, existing CRM/campaign/procurement/SAM records, approved SOPs, and source examples.
   - OpenAI Agents SDK or Responses API for agent tools, handoffs, guardrails, and traceable runs.

2. Review and approval
   - `agent_mini_apps`, `agent_mini_app_events`, `ai_outputs`, `ai_output_reviews`, `ai_workforce_tasks`, and `ai_workforce_activity_logs`.
   - Human approval remains mandatory for sends, posts, purchases, bids, payments, account changes, deletes, exports, and sensitive claims.

3. Execution queue
   - `agent_execution_queue` is the only bridge from approval into action.
   - Default `permission_scope` is `read_only`.
   - Agent-browser/computer-use jobs must start as `queued`, never auto-approved.

4. External systems
   - Prefer official OAuth/API integrations for read, draft, prepare, and approved send flows.
   - Use browser/computer-use only when an API is unavailable, unstable, or intentionally restricted.
   - No passwords, MFA codes, API keys, or private secrets belong in `browser_session_registry`.

## Runtime APIs And Connectors

| Area | Recommended integration | Safe default | Approval-gated actions | Notes |
| --- | --- | --- | --- | --- |
| Agent orchestration | OpenAI Agents SDK / Responses API tools and remote MCP | Generate drafts, structured recommendations, tool plans | Any external write tool call | Use tool definitions with strict permission scopes and store trace IDs on mini apps/events. |
| Durable workflows | Vercel Workflow / durable queue layer | Queue and resume execution plans | Running approved external writes | Good fit for long-running approval chains, retries, and visible execution logs. |
| Database/auth/audit | Supabase Postgres/Auth with RLS | Read user-scoped records | Service-role admin mutations | Use `app_metadata` for roles, never `user_metadata`; keep service role server-only. |
| Email drafts/sends | Gmail API, Microsoft Graph mail, Mailgun/Resend | Create drafts or prepare message payloads | Send email | Prefer user mailbox APIs for one-to-one outreach; use provider webhooks for delivery state. |
| SMS | Twilio Messaging Services and Compliance Toolkit | Draft SMS, check opt-out/compliance metadata | Send SMS | STOP/HELP, opt-out handling, sender registration, and delivery callbacks must feed the communication ledger. |
| Internal ops notifications | Slack API | Notify admins of pending approvals | Post to public/client-facing channels | Useful for daily approval reminders and manual takeover alerts. |
| Payments | Stripe Checkout/Billing/Webhooks | Read payment status, prepare invoice/checkout intent | Charge, refund, subscription/pricing change | Require idempotency keys and signed webhook verification. |
| Website builds | GitHub, Vercel REST API, Vercel deployments | Prepare build branch, draft deployment, inspect domains | Publish/assign domain/change production env | Pair with Website Build Mini Apps and launch checklist. |
| Domains/DNS | GoDaddy Domains API or registrar-specific APIs | Read domain/DNS status | Buy domains, change DNS, renew, transfer | Use browser queue when registrar API access is absent. |
| Local SEO | Google Business Profile APIs | Read/manage approved profile data where allowed | Publish posts, reply to reviews, change business info | Access can be approval/allowlist constrained; browser fallback may be needed. |
| Social publishing | Meta Graph API where approved | Draft posts and media packets | Publish posts/ads/DMs | Meta permissions and review are high-friction; do not depend on this as the only path. |
| SAM.gov | SAM.gov public opportunity/entity APIs | Search opportunities, summarize requirements | Submit bids/certifications | Submission must remain human-only unless a later explicit approval workflow is built. |
| Creative handoff | Canva/Figma/Google Drive | Generate briefs, organize assets, draft designs | Export/send final customer creative | Store final creative references back to AI Assets and related mini apps. |

## Codex/Operator Plugins To Use Now

These are not necessarily product runtime integrations, but they make development and QA materially stronger:

- Supabase: inspect schema, RLS, auth, migrations, and staging data.
- Vercel: inspect deployments, logs, environment variables, routing, and Workflow/Queues options.
- GitHub: open PRs, inspect CI, manage issues, and wire branch protection around Agent Mini Apps gates.
- Chrome/Browser/Computer Use: authenticated local/preview QA, screenshots, and manual workflow verification.
- Gmail/Outlook/Slack: validate future approval notification and draft-review workflows from connected accounts.
- Stripe: validate payment-state reads and safe handoff patterns before wiring revenue-impacting actions.
- Google Drive/Docs/Sheets: turn QA reports, campaign plans, and proposal drafts into reviewable artifacts.
- Figma/Canva: design system and creative handoff for route, postcard, political, and website mini apps.

## Product Tables To Add Next

The current Agent Mini Apps schema is a strong approval foundation. To operate at world-class level, add a connector and policy layer rather than hardcoding vendor behavior into mini app actions.

### `integration_connections`

Purpose: inventory OAuth/API connections by tenant and system without storing secrets in ordinary app tables.

Suggested fields:

- `id`
- `tenant_id`
- `system_name`
- `provider`
- `connection_type`
- `status`
- `account_label`
- `external_account_id`
- `allowed_scopes_json`
- `blocked_scopes_json`
- `credential_reference`
- `last_verified_at`
- `last_error`
- `created_by`
- `created_at`
- `updated_at`
- `archived_at`

Rules:

- `credential_reference` points to a managed secret store/provider vault, not a raw secret.
- OAuth refresh tokens must never be exposed to clients.
- Writes require server-side authorization and audit events.

### `agent_tool_permissions`

Purpose: declare exactly what each agent/tool may do before a mini app can move to execution.

Suggested fields:

- `id`
- `tenant_id`
- `agent_key`
- `tool_key`
- `target_system`
- `permission_scope`
- `requires_human_approval`
- `max_estimated_cost`
- `allowed_actions_json`
- `blocked_actions_json`
- `risk_level`
- `active`
- `created_at`
- `updated_at`

Rules:

- Default `permission_scope` is `read_only`.
- Any send, spend, publish, submit, delete, export, account-change, or pricing/payment action requires approval.
- Tool permission changes are admin-only and audited.

### `agent_execution_attempts`

Purpose: make each execution attempt independently observable and retry-safe.

Suggested fields:

- `id`
- `execution_queue_id`
- `attempt_number`
- `status`
- `started_at`
- `completed_at`
- `actor_type`
- `tool_key`
- `idempotency_key`
- `request_summary`
- `response_summary`
- `screenshot_before_url`
- `screenshot_after_url`
- `log_json`
- `failure_reason`
- `created_at`

Rules:

- Store summaries and references, not private request payloads containing secrets.
- Use provider idempotency where available, especially payments and email/SMS sends.

### `external_action_intents`

Purpose: separate human-approved intent from vendor execution details.

Suggested fields:

- `id`
- `mini_app_id`
- `execution_queue_id`
- `tenant_id`
- `intent_type`
- `target_system`
- `target_identifier`
- `permission_scope`
- `approved_payload_json`
- `approval_event_id`
- `status`
- `provider_result_json`
- `created_at`
- `updated_at`

Rules:

- This becomes the durable "what was approved" record.
- Execution workers consume intents, not mutable mini app payloads.

## Execution Safety Contract

Every external write should satisfy this contract:

1. A mini app exists with original `payload_json`.
2. Any human edits are stored in `edited_payload_json`.
3. A human approval event exists in `agent_mini_app_events`.
4. An `external_action_intent` is created from the approved payload.
5. An `agent_execution_queue` row is created with the narrowest `permission_scope`.
6. A worker creates an `agent_execution_attempt`.
7. Provider result, screenshots, and logs are attached.
8. Status updates write immutable mini app events and activity logs.

## Priority Build Order

### Phase 1: Production QA and release gates

- Keep the new non-destructive CI workflow mandatory on pull requests.
- Add staging Supabase/Vercel secrets to GitHub.
- Run the authenticated E2E lane manually with a staging QA admin.
- Add screenshots/artifacts upload from E2E failures.

### Phase 2: Connector policy layer

- Add `integration_connections`, `agent_tool_permissions`, `agent_execution_attempts`, and `external_action_intents`.
- Add admin pages under Agent Mini Apps for connected systems, permission scopes, and execution history.
- Add RLS and admin-only service routes for connection/permission management.

### Phase 3: First production connectors

Recommended first integrations:

1. Gmail or Microsoft Graph draft-only email.
2. Twilio SMS draft/approval/send with compliance checks.
3. Stripe payment-status read and webhook reconciliation.
4. SAM.gov opportunity search/read.
5. Vercel/GitHub website build preparation.

These cover the highest-value workflows while keeping external writes strongly gated.

### Phase 4: Durable workers

- Move execution workers into Vercel Workflow or an equivalent durable queue.
- Add idempotency keys per external action.
- Add retry policies by risk level.
- Add manual takeover artifacts: screenshot before, screenshot after, current URL, last step, failure reason.

### Phase 5: Browser/computer-use lane

- Use `browser_session_registry` as documentation and policy metadata only.
- Launch browser jobs only from approved execution queue rows.
- Screenshot before/after every browser action.
- Require manual takeover when MFA, payment confirmation, bid submission, public posting, sensitive export, or account settings are encountered.

## Source Notes

- OpenAI Agents SDK: https://platform.openai.com/docs/guides/agents-sdk/
- OpenAI Responses tools and MCP approvals: https://platform.openai.com/docs/guides/tools?api-mode=responses
- Vercel Workflow: https://vercel.com/docs/workflow
- Vercel REST API: https://vercel.com/docs/rest-api
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Gmail API sending/drafts: https://developers.google.com/gmail/api/guides/sending
- Microsoft Graph mail API: https://learn.microsoft.com/en-us/graph/outlook-create-send-messages
- Twilio Compliance Toolkit: https://www.twilio.com/docs/messaging/features/compliance-toolkit
- Twilio Messaging Services: https://www.twilio.com/docs/messaging/services/
- Slack `chat.postMessage`: https://api.slack.com/methods/chat.postMessage
- Slack OAuth scopes: https://docs.slack.dev/reference/scopes
- Stripe API idempotency: https://docs.stripe.com/api-v2-overview
- Stripe webhooks: https://docs.stripe.com/webhooks
- SAM.gov Get Opportunities API: https://open.gsa.gov/api/get-opportunities-public-api/
- SAM.gov Entity Management API: https://open.gsa.gov/api/entity-api/
- SAM.gov Opportunity Management API: https://open.gsa.gov/api/opportunities-api/
- Mailgun Messages API: https://mailgun-docs.redoc.ly/docs/mailgun/api-reference/openapi-final/tag/Messages/
- Mailgun webhooks: https://help.mailgun.com/hc/en-us/articles/202236504-Webhooks
- Google Business Profile APIs: https://developers.google.com/my-business/reference/rest
- GoDaddy Domains API: https://developer.godaddy.com/doc/endpoint/domains
- GitHub Actions REST API: https://docs.github.com/en/rest/reference/actions

