# Agent Mini Apps Authenticated E2E

This is the production-grade authenticated workflow QA gate for Today's Agent Stack.

It is intentionally mutating and should run against local, preview, or staging environments only unless a human explicitly approves a production test run.

## Command

```bash
pnpm e2e:agent-mini-apps
```

## Bootstrap QA Admin

Use this only for a staging/preview QA account. It creates or updates a Supabase Auth user, sets `app_metadata.user_role = "admin"`, ensures a matching `public.profiles` row, and verifies the password through Supabase Auth.

```bash
AGENT_MINI_APPS_E2E_BOOTSTRAP=1
AGENT_MINI_APPS_E2E_EMAIL=<staging qa admin email>
AGENT_MINI_APPS_E2E_PASSWORD=<staging qa admin password>
pnpm bootstrap:e2e-agent-mini-apps
```

To reset an existing QA user's password:

```bash
AGENT_MINI_APPS_E2E_RESET_PASSWORD=1
```

Safety gates:

- The script refuses to run without `AGENT_MINI_APPS_E2E_BOOTSTRAP=1`.
- The email must look like a QA/E2E/test account unless `AGENT_MINI_APPS_E2E_ALLOW_ANY_EMAIL=1` is set.
- It never prints the password or service-role key.
- Use `AGENT_MINI_APPS_E2E_ALLOW_ANY_EMAIL=1` only on an isolated staging project.

## Required Environment

```bash
AGENT_MINI_APPS_E2E_MUTATE=1
AGENT_MINI_APPS_E2E_EMAIL=<staging admin email>
AGENT_MINI_APPS_E2E_PASSWORD=<staging admin password>
AGENT_MINI_APPS_BASE_URL=http://localhost:3000
```

For remote preview/staging URLs:

```bash
AGENT_MINI_APPS_E2E_ALLOW_REMOTE=1
AGENT_MINI_APPS_BASE_URL=https://your-preview-or-staging-url
```

On Windows the runner defaults to installed Google Chrome:

```bash
AGENT_MINI_APPS_E2E_BROWSER_CHANNEL=chrome
```

For CI with bundled Playwright browsers:

```bash
pnpm exec playwright install chromium
AGENT_MINI_APPS_E2E_BROWSER_CHANNEL=
```

If needed, provide an explicit browser executable:

```bash
AGENT_MINI_APPS_E2E_BROWSER_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
```

## What It Tests

The runner seeds isolated `E2E-*` mini apps, logs in through the real UI, and verifies:

- outreach approval -> approved send review queue
- political plan payload edit -> approve -> proposal queue
- route density approve -> generate quote queue
- procurement failed item -> manual takeover -> archive
- SAM.gov bid/no-bid -> reject
- website build -> approve -> schedule -> mark complete
- generic task -> archive

The database assertions verify:

- expected final status for each fixture
- immutable audit events for every action
- edited payload stored separately from original payload
- execution queue rows remain `queued`
- `human_approval_required=true`
- approval-gated send scope is `send_after_approval`
- proposal/quote scopes are `prepare_only`
- no queued execution task is auto-approved

## Safety Rules

The runner refuses to start unless `AGENT_MINI_APPS_E2E_MUTATE=1`.

The runner refuses remote URLs unless `AGENT_MINI_APPS_E2E_ALLOW_REMOTE=1`.

It does not send emails, send SMS, post publicly, place orders, submit bids, change pricing, charge customers, export sensitive data, or change external account settings.

It writes immutable audit events and execution queue rows, so use a staging QA admin user and staging database whenever possible.

## Recommended CI Placement

Run in this order before deploy promotion:

```bash
pnpm --filter @homereach/web type-check
pnpm --filter @homereach/web build
pnpm smoke:agent-mini-apps
pnpm preflight:agent-mini-apps-db
pnpm smoke:agent-mini-apps-db
pnpm qa:agent-mini-apps
pnpm e2e:agent-mini-apps
```

The non-destructive `qa:agent-mini-apps` gate is safe for every preview build. The authenticated E2E gate should run only where fixture mutation is acceptable.

## GitHub Actions

Workflow: `.github/workflows/agent-mini-apps.yml`

Required secrets for non-destructive gates:

```text
AGENT_MINI_APPS_SUPABASE_URL
AGENT_MINI_APPS_SUPABASE_ANON_KEY
AGENT_MINI_APPS_SUPABASE_SERVICE_ROLE_KEY
AGENT_MINI_APPS_DATABASE_URL
```

Additional secrets for authenticated E2E:

```text
AGENT_MINI_APPS_E2E_EMAIL
AGENT_MINI_APPS_E2E_PASSWORD
```

The workflow has two lanes:

- `non-destructive-gates`: runs automatically on relevant pull requests and pushes to `main`.
- `authenticated-e2e`: runs only from manual `workflow_dispatch` when `run_authenticated_e2e=true`.

The manual workflow also supports optional QA admin bootstrap:

- `bootstrap_qa_admin=true`
- `reset_qa_password=true`

Use staging Supabase credentials for these secrets. Do not point the authenticated E2E lane at production unless there is an explicit production test window and human approval.
