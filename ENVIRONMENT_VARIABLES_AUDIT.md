# Environment Variables Audit

Audit date: 2026-05-10

Secret values were not read into this report. Presence is based on variable names in `.env`, `.env.example`, `apps/web/.env.local`, and `apps/web/.env.production.template`, plus source references.

## Required Core

| Variable | Purpose | Present by name | Sensitivity |
| --- | --- | --- | --- |
| `DATABASE_URL` | Direct database/migrations | yes | secret |
| `DATABASE_URL_POOLED` | Runtime pooled DB | yes | secret |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser/server Supabase URL | yes | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser/server Supabase anon key | yes | public but environment-specific |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role admin/webhook/cron writes | yes | highly secret |
| `NEXT_PUBLIC_APP_URL` | Public app URL, Stripe redirects | yes | public |
| `USE_MOCK_DB` | Mock/live data switch | yes in app env files | production-sensitive |
| `ADMIN_DEV_BYPASS` | Admin bypass | yes in app env files | dangerous if true in production |

## Stripe

| Variable | Purpose | Present by name | Sensitivity |
| --- | --- | --- | --- |
| `STRIPE_SECRET_KEY` | Server checkout/webhook API | yes | highly secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser Stripe key | yes | public |
| `STRIPE_WEBHOOK_SECRET` | Stripe signature verification | yes | highly secret |

Production rule: never validate production checkout until test-mode flow and webhook are proven.

## Twilio

| Variable | Purpose | Present by name | Sensitivity |
| --- | --- | --- | --- |
| `TWILIO_ACCOUNT_SID` | Twilio API | yes | sensitive |
| `TWILIO_AUTH_TOKEN` | Twilio API auth | yes | highly secret |
| `TWILIO_PHONE_NUMBER` | Sender number | yes | sensitive |
| `TWILIO_MESSAGING_SERVICE_SID` | Preferred sender service | `.env.example` only | sensitive |
| `ENABLE_TWILIO_STATUS_WEBHOOK` | Status callback feature flag | referenced, not in env files | config |
| `ALERT_PHONE_NUMBER` | Hot lead SMS alerts | referenced, not in env files | sensitive |
| `NEXT_PUBLIC_ALERT_PHONE_NUMBER` | Client-safe display fallback | referenced, not in env files | public only if safe |

Observed build warning in validated copy: `ALERT_PHONE_NUMBER` missing disables hot lead SMS alerts.

## Email

| Variable | Purpose | Present by name | Sensitivity |
| --- | --- | --- | --- |
| `MAILGUN_API_KEY` | Mailgun send/import | yes in app env templates | highly secret |
| `MAILGUN_DOMAIN` | Mailgun domain | yes in app env templates | sensitive |
| `MAILGUN_FROM_EMAIL` | Sender email | yes in app env templates | public-ish |
| `MAILGUN_FROM_NAME` | Sender name | referenced, missing | public |
| `RESEND_API_KEY` | Resend send provider | yes in root env/example | highly secret |
| `RESEND_FROM_EMAIL` | Resend sender email | yes in root env/example | public-ish |
| `RESEND_FROM_NAME` | Resend sender name | yes in root env/example | public |
| `POSTMARK_API_TOKEN` | Postmark send helper | referenced, missing | highly secret |
| `POSTMARK_FROM_EMAIL` | Postmark sender | referenced, missing | public-ish |
| `POSTMARK_FROM_NAME` | Postmark sender | referenced, missing | public |
| `POSTMARK_MESSAGE_STREAM` | Postmark stream | referenced, missing | sensitive |
| `POSTMARK_WEBHOOK_USER` | Postmark webhook Basic Auth | referenced, missing | secret |
| `POSTMARK_WEBHOOK_PASSWORD` | Postmark webhook Basic Auth | referenced, missing | highly secret |
| `ENABLE_POSTMARK_WEBHOOK` | Feature flag | referenced, missing | config |
| `EMAIL_PROVIDER` | Intended provider switch | referenced, missing | config |

Risk: production email provider routing is fragmented across Resend, Mailgun, and Postmark.

## AI And Data Acquisition

| Variable | Purpose | Present by name |
| --- | --- | --- |
| `OPENAI_API_KEY` | OpenAI classification/LLM fallback | referenced, missing from env templates |
| `OPENAI_DEFAULT_MODEL` | Default model | referenced, missing |
| `ANTHROPIC_API_KEY` | QA/content/political/SEO Claude calls | referenced, missing |
| `QA_ANSWER_MODEL` | QA model | referenced, missing |
| `QA_INGESTION_MODEL` | QA ingestion model | referenced, missing |
| `QA_EMBEDDING_OPENAI_KEY` | QA embedding fallback | referenced, missing |
| `CONTENT_INTEL_EXTRACTOR_MODEL` | Content intel model | referenced, missing |
| `CONTENT_INTEL_TRANSLATOR_MODEL` | Content intel model | referenced, missing |
| `SEO_DRAFT_MODEL` | SEO draft model | referenced, missing |
| `POLITICAL_ASSISTANT_MODEL` | Political assistant model | referenced, missing |
| `FEC_API_KEY` | OpenFEC ingestion | referenced, missing |
| `YOUTUBE_API_KEY` | YouTube data | referenced, missing |
| `YT_TRANSCRIPT_API_KEY` | Transcript source | referenced, missing |
| `SERPAPI_KEY` | Search/scraping agent | present in app env |
| `HUNTER_API_KEY` | Lead enrichment | present in app env |

## Facebook/Meta

| Variable | Purpose | Present by name |
| --- | --- | --- |
| `FACEBOOK_APP_ID` | App ID | present but not referenced |
| `FACEBOOK_APP_SECRET` | Signature validation | present and referenced |
| `FACEBOOK_PAGE_ACCESS_TOKEN` | Messenger/page API | present and referenced |
| `FACEBOOK_PAGE_ID` | Page ID | present but not referenced |
| `FACEBOOK_WEBHOOK_VERIFY_TOKEN` | Webhook verification | present and referenced |
| `FACEBOOK_VERIFY_TOKEN` | Alternate verify token | referenced, missing |

## Cron And Feature Flags

| Variable | Purpose | Present by name |
| --- | --- | --- |
| `CRON_SECRET` | Vercel/internal cron auth | present in app env |
| `CONTENT_INTEL_CRON_SECRET` | Content/lead intel cron | referenced, missing |
| `POLITICAL_CRON_SECRET` | Political cron | referenced, missing |
| `FSGOS_CRON_SECRET` | Growth OS reminders | referenced, missing |
| `ENABLE_POLITICAL` | Political module gate | referenced, missing |
| `ENABLE_QA_SYSTEM` | QA gate | referenced, missing |
| `ENABLE_CONTENT_INTEL` | Content intel gate | referenced, missing |
| `ENABLE_LEAD_INTEL` | Lead intel gate | referenced, missing |
| `ENABLE_SEO_ENGINE` | SEO engine gate | referenced, missing |
| `ENABLE_SEO_DRAFT_GENERATION` | SEO AI gate | referenced, missing |
| `ENABLE_OPERATOR_DASHBOARD` | Operator dashboard gate | turbo env only |
| `ENABLE_AGENT_MOBILE` | Agent mobile gate | turbo env only |
| `ENABLE_INTERNAL_ALERTS` | Internal alerts | referenced, missing |
| `ALERT_SHADOW_MODE` | Alert dry-run | referenced, missing |

## Immediate Env Risks

- Missing `ALERT_PHONE_NUMBER` disables hot lead SMS alerts.
- Missing Postmark webhook credentials in production should fail closed.
- Missing feature flags may hide entire modules.
- `ADMIN_DEV_BYPASS=true` or `USE_MOCK_DB=true` in production is a launch blocker.
- Env templates do not cover all variables actually referenced in code.

