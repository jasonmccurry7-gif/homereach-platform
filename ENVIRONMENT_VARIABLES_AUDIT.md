# Environment Variables Audit

Date: 2026-05-25

Scope: local checkout plus Vercel project metadata for `homereach-platform-web`. This audit inspected names, targets, branch scope, and code references only. No secret values were printed, copied, or written to disk.

## Current Status

- Local secret files are absent in this checkout: `.env`, `.env.local`, `.env.production.local`, `apps/web/.env.local`, and related local variants are not present.
- Tracked templates exist: `.env.example` and `apps/web/.env.production.template`.
- Vercel production has 80 environment variable names.
- Vercel preview has 70 environment variable names.
- Vercel development has 40 environment variable names.
- Static startup-required variables from `apps/web/lib/env.ts` are present by name in production, preview, and development.
- `TARGETED_CHECKOUT_SIGNING_SECRET` is present as a sensitive variable in production and as a branch-scoped sensitive preview variable for `codex/current-main-audit-20260524`.
- Branch preview and GitHub Actions have already passed with the current env hardening branch, but provider-live validation remains pending.
- Follow-up compatibility repair added after this audit: internal agent calls now fall back through `NEXT_PUBLIC_APP_URL` before localhost, Apex accepts both approved-sender env names, SerpAPI/Hunter readers accept the legacy Vercel aliases, and Twilio messaging-service validation accepts both naming conventions.

## Sources Inspected

- `apps/web/lib/env.ts`
- `.env.example`
- `apps/web/.env.production.template`
- `turbo.json`
- Vercel CLI metadata: `vercel env ls production --format json`, `preview`, and `development`
- Code references under `apps/**` and `packages/**`

## Local Env File Status

| File | Status | Notes |
| --- | --- | --- |
| `.env` | absent | No tracked root defaults in this checkout. |
| `.env.local` | absent | Normal local dev will need `vercel env pull .env.local` or `vercel env run`. |
| `.env.development.local` | absent | No local development overrides. |
| `.env.production.local` | absent | Good: no local production secrets parked in the repo. |
| `apps/web/.env.local` | absent | Web app has no app-local secrets. |
| `.env.example` | present | Broad example file; includes many optional systems. |
| `apps/web/.env.production.template` | present | Narrower production template; missing several newer optional systems. |

## Startup-Required Variables

These variables are required by `apps/web/lib/env.ts` either in all environments or in production builds.

| Variable | Production | Preview | Development | Main dependency |
| --- | --- | --- | --- | --- |
| `DATABASE_URL_POOLED` | present | present | present | pooled Postgres runtime connection |
| `DATABASE_URL` | present | present | present | Drizzle, migrations, direct DB scripts |
| `NEXT_PUBLIC_SUPABASE_URL` | present | present | present | Supabase client/auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | present | present | present | Supabase browser/server anon client |
| `SUPABASE_SERVICE_ROLE_KEY` | present | present | present | webhook/admin service-role operations |
| `STRIPE_SECRET_KEY` | present | present | present | Stripe Checkout/API routes |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | present | present | present | future/client Stripe integration and validator |
| `STRIPE_WEBHOOK_SECRET` | present | present | present | Stripe webhook signature verification |
| `TARGETED_CHECKOUT_SIGNING_SECRET` | present | branch-preview present | not listed | signed targeted checkout links |
| `TWILIO_ACCOUNT_SID` | present | present | present | Twilio SMS and webhook validation |
| `TWILIO_AUTH_TOKEN` | present | present | present | Twilio SMS and webhook validation |
| `USE_MOCK_DB` | present | present | present | production safety guard |
| `OWNER_NAME` | present | present | not listed | outbound identity |
| `OWNER_CELL_PHONE` | present | present | not listed | outbound identity |
| `OWNER_PERSONAL_EMAIL` | present | present | not listed | outbound identity |
| `OWNER_SECONDARY_EMAIL` | present | present | not listed | outbound identity |
| `OWNER_DOMAIN_EMAIL` | present | present | not listed | outbound identity |
| `DEFAULT_FROM_EMAIL` | present | present | not listed | email identity |
| `DEFAULT_REPLY_TO_EMAIL` | present | present | not listed | email identity |
| `ADMIN_NOTIFICATION_EMAIL` | present | present | present | admin alerts and lead intake notifications |
| `NEXT_PUBLIC_APP_URL` | present | present | present | public URL generation, callbacks, SEO |

Development does not require production-only vars at startup, but local end-to-end provider validation will still need them supplied through `vercel env pull`, `vercel env run`, or a test-only env file.

## Conditional Runtime Requirements

| Condition | Required variables | Current name status | Risk |
| --- | --- | --- | --- |
| `EMAIL_PROVIDER=resend` | `RESEND_API_KEY` | not listed in production/preview/development | High if provider value is `resend`; startup validation would fail in production. |
| `EMAIL_PROVIDER=mailgun` | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN` | present in production/preview/development | Name coverage exists; value/test validation still required. |
| `EMAIL_PROVIDER=postmark` | `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL` | present in production/preview; Postmark token/from not listed in development | Name coverage exists for deployed envs; local provider validation needs dev/test values. |
| Postmark webhook enabled | `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD` | present in production/preview; not listed in development | Deployed webhook auth can start; local testing needs dev/test values. |
| Twilio send without a messaging service | `TWILIO_PHONE_NUMBER` or `OUTREACH_SMS_FROM_NUMBER` | both production/preview have sender coverage; development has `TWILIO_PHONE_NUMBER` | Startup is covered by sender number. |
| Twilio send with messaging service | `TWILIO_MESSAGING_SERVICE_SID` or `OUTREACH_TWILIO_MESSAGING_SERVICE_SID` | neither listed in Vercel | Not a blocker while using phone number, but A2P/messaging-service routing is not configured by name. |

## Public Client Variables

The following names are safe to expose by design because they use the `NEXT_PUBLIC_` prefix, but they still need correct values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_BASE_URL` is referenced in code but not listed in Vercel.
- `NEXT_PUBLIC_SITE_URL` is referenced in code but not listed in Vercel.
- `NEXT_PUBLIC_ENABLE_AI_INTAKE_AGENT` is referenced in code but not listed in Vercel.

Do not place secrets in any `NEXT_PUBLIC_` variable.

## Production-Sensitive Server Variables

Treat these as sensitive or operationally dangerous if wrong:

- Database/Supabase: `DATABASE_URL`, `DATABASE_URL_POOLED`, `SUPABASE_SERVICE_ROLE_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `TARGETED_CHECKOUT_SIGNING_SECRET`
- Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OUTREACH_SMS_FROM_NUMBER`
- Email: `EMAIL_PROVIDER`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `POSTMARK_API_TOKEN`, `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD`, `RESEND_API_KEY`
- Admin/auth/cron: `ADMIN_SYSTEM_USER_ID`, `ADMIN_NOTIFICATION_EMAIL`, `ADMIN_DEV_BYPASS`, `CRON_SECRET`, `CONTENT_INTEL_CRON_SECRET`, `POLITICAL_CRON_SECRET`
- AI/providers: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `FEC_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `SAM_GOV_API_KEY`, `SERPAPI_KEY`, `HUNTER_API_KEY`
- Social integrations: `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_WEBHOOK_VERIFY_TOKEN`

## Integration Dependency Map

| Integration | Key variables | Current posture |
| --- | --- | --- |
| Supabase DB/Auth/Storage | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `DATABASE_URL_POOLED` | Required names present in Vercel. Connection and RLS behavior still require test-mode validation. |
| Stripe checkout/webhooks | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `TARGETED_CHECKOUT_SIGNING_SECRET`, `NEXT_PUBLIC_APP_URL` | Required names present. Stripe CLI is installed but unauthenticated; no provider test-mode events have been run yet. |
| Twilio SMS/webhooks | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`, `OUTREACH_SMS_FROM_NUMBER`, `ENABLE_TWILIO_STATUS_WEBHOOK` | Core names present. Messaging-service SID is not configured by name. No live SMS validation performed. |
| Postmark | `EMAIL_PROVIDER`, `POSTMARK_API_TOKEN`, `POSTMARK_FROM_EMAIL`, `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD`, `ENABLE_POSTMARK_WEBHOOK` | Production/preview names present. Local development lacks Postmark names. |
| Mailgun | `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL`, `MAILGUN_FROM_NAME` | Core Mailgun names present. `MAILGUN_FROM_NAME` is referenced/tracked but not in production Vercel. |
| Resend | `EMAIL_PROVIDER`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME` | `RESEND_API_KEY` is not listed in Vercel. Safe only if `EMAIL_PROVIDER` is not `resend`. |
| AI orchestration | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `ENABLE_AGENT_MOBILE`, `ENABLE_QA_SYSTEM`, `ENABLE_LEAD_INTEL` | Anthropic and feature flags are present; `OPENAI_API_KEY` is not listed in production Vercel. OpenAI-backed features will no-op or fail depending on path. |
| Political intelligence | `ENABLE_POLITICAL`, `FEC_API_KEY`, `GOOGLE_CIVIC_API_KEY`, `SERPAPI_KEY`, `BALLOTPEDIA_API_KEY`, `DEMOCRACY_WORKS_API_KEY` | Some core keys present, but `SERPAPI_KEY`, Ballotpedia, Democracy Works, and configured feed vars are absent by name. |
| SAM.gov | `SAM_GOV_API_KEY`, `SAM_GOV_OPPORTUNITIES_URL` | Production has `SAM_GOV_API_KEY`; `SAM_GOV_OPPORTUNITIES_URL` is not listed but code falls back to the public endpoint. |
| Facebook | `FACEBOOK_WEBHOOK_VERIFY_TOKEN`, `FACEBOOK_APP_SECRET`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `FACEBOOK_PAGE_ID` | Names present in deployed envs. Some routes also reference `FACEBOOK_VERIFY_TOKEN`, which is absent and falls back to `FACEBOOK_WEBHOOK_VERIFY_TOKEN`. |
| Content intelligence | `ENABLE_CONTENT_INTEL`, `CONTENT_INTEL_CRON_SECRET`, `YOUTUBE_API_KEY`, `YT_TRANSCRIPT_API_KEY`, `CONTENT_INTEL_TRANSCRIPT_BASE` | Core enable/cron/provider keys present; transcript base/model/cap variables are absent and use defaults where coded. |

## Name Drift And Unclear Areas

### HIGH: Email Provider Value Cannot Be Proved From Name Metadata

Vercel has `EMAIL_PROVIDER`, `MAILGUN_API_KEY`, and Postmark names, but not `RESEND_API_KEY`. Because Vercel CLI metadata does not reveal values, this audit cannot prove whether production `EMAIL_PROVIDER` is `mailgun`, `postmark`, or `resend`.

Impact: if production `EMAIL_PROVIDER=resend`, the production env validator requires `RESEND_API_KEY` and the app should fail fast.

Safest fix: verify the provider value in the Vercel dashboard or with a value-safe local runtime check. If the active provider is Resend, add `RESEND_API_KEY`; otherwise document the intended provider.

### HIGH: Internal Agent Routes May Fall Back To Localhost

`apps/web/app/api/admin/agents/run/route.ts` uses `NEXTAUTH_URL || "http://localhost:3000"` for internal calls. `NEXTAUTH_URL` is tracked in `turbo.json` and referenced in multiple agent routes, but is not listed in production Vercel.

Impact: production agent orchestration can call `localhost` inside a Vercel function instead of the deployed app URL.

Repair status: code now uses `getInternalAppBaseUrl()` for the run/closer/anchor agent event calls that had the localhost-only fallback.

Safest remaining fix: add `NEXTAUTH_URL` to Vercel production/preview with the canonical deployed origin so every route and future script has an explicit internal origin.

### HIGH: Prospecting API Aliases Are Split

Production Vercel has `SERP_API` and `HUNTER`, while code expects `SERPAPI_KEY` and `HUNTER_API_KEY` in the scraper and candidate-intelligence paths.

Impact: prospecting/candidate search can appear configured in Vercel while runtime code treats the providers as missing.

Repair status: scraper and political candidate SerpAPI readers now accept `SERP_API` as a compatibility alias, and the scraper accepts `HUNTER` as a compatibility alias.

Safest remaining fix: add canonical `SERPAPI_KEY` and `HUNTER_API_KEY` if those providers are approved for use, then leave legacy aliases in place until confirmed unused.

### MEDIUM: Twilio Messaging Service Alias Is Split

`turbo.json` tracks `OUTREACH_TWILIO_MESSAGING_SERVICE_SID`, `.env.example` documents `TWILIO_MESSAGING_SERVICE_SID`, `apps/web/lib/env.ts` validates `TWILIO_MESSAGING_SERVICE_SID`, and `packages/services/src/outreach/identity.ts` accepts either.

Impact: not a current startup blocker because `TWILIO_PHONE_NUMBER` and `OUTREACH_SMS_FROM_NUMBER` are present, but messaging-service/A2P routing is not configured by name.

Repair status: production env validation now accepts both `OUTREACH_TWILIO_MESSAGING_SERVICE_SID` and `TWILIO_MESSAGING_SERVICE_SID`.

Safest remaining fix: choose one canonical name operationally, keep the compatibility alias, and only configure a real messaging-service SID after Twilio/A2P validation.

### MEDIUM: Apex Approved Sender Name Drift

Vercel/turbo list `APEX_APPROVED_SENDER`, while `apps/web/app/api/command/route.ts` reads `APEX_APPROVED_SENDERS`.

Impact: command sender allowlisting may not use the intended Vercel value.

Repair status: `/api/command` now accepts both `APEX_APPROVED_SENDERS` and `APEX_APPROVED_SENDER`.

Safest remaining fix: configure the plural canonical name in Vercel, then keep the singular name until history is confirmed.

### MEDIUM: URL Alias Drift

Several paths reference `NEXT_PUBLIC_SITE_URL` or `NEXT_PUBLIC_BASE_URL`, but Vercel is configured around `NEXT_PUBLIC_APP_URL`.

Impact: most code has a fallback, but some callbacks and generated links may use hardcoded defaults instead of the exact deployed URL.

Safest fix: standardize on `NEXT_PUBLIC_APP_URL`, preserving compatibility readers for older names.

### LOW: Possible Stale Vercel Variables

Names present in Vercel but not directly referenced by the current code scan include `CHECKOUT_TOKEN_SECRET`, `SERP_API`, `HUNTER`, `APEX_APPROVED_SENDER`, `OUTREACH_AUTOMATION_HUMAN_APPROVED`, and `OUTREACH_AUTOMATION_LIVE_SEND_ENABLED`.

Impact: not immediately harmful, but stale names create operator confusion and can lead to false confidence.

Safest fix: keep them until an owner confirms history, then retire through a documented Vercel cleanup pass.

## New Laptop Setup Notes

- Do not run provider validation from this checkout without a local env source.
- Safest local bootstrap command, when ready: `vercel env pull .env.local --environment=development --yes`.
- Safer no-write alternative for quick commands: `vercel env run -- pnpm --filter @homereach/web dev`.
- Do not pull production secrets into `.env.local` unless the session is explicitly for production incident debugging.
- If any local env file is created, keep it untracked and do not paste values into reports.

## Recommended Next Actions

1. Add or confirm `NEXTAUTH_URL` before relying on production agent orchestration.
2. Verify the hidden `EMAIL_PROVIDER` value and align the active provider with the corresponding API key.
3. Add canonical `SERPAPI_KEY` and `HUNTER_API_KEY` only if prospecting/candidate intelligence should be active.
4. Standardize Twilio messaging-service naming before enabling messaging-service based SMS flows.
5. Keep `TARGETED_CHECKOUT_SIGNING_SECRET` production and preview values separate unless cross-environment checkout links are explicitly required.
6. Run provider validation from `PROVIDER_TEST_MODE_RUNBOOK.md` only with test/sandbox credentials and isolated data.
