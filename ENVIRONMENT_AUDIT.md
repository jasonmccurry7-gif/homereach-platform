# Environment Audit

Generated: 2026-05-09

Scope: name-only audit. Secret values were not exposed.

## Files Inspected

- .env
- .env.example
- apps/web/.env.local
- apps/web/.env.production.template
- apps/web/lib/env.ts
- turbo.json
- source references found by rg

## Summary

Core Supabase, DB, Stripe, Twilio, Resend, Mailgun, and app URL vars are present in some env files. However, the code references many more variables than .env.example or the production template document. turbo.json also contains several names that do not match the code.

## Required / Core Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | .env, .env.example, apps/web/.env.local, prod template | Supabase auth/client/server | Public |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | .env, .env.example, apps/web/.env.local, prod template | Supabase auth/client/server | Public but RLS-critical |
| SUPABASE_SERVICE_ROLE_KEY | .env, .env.example, apps/web/.env.local, prod template | Admin/server service-role writes | Secret |
| DATABASE_URL | .env, .env.example, apps/web/.env.local, prod template | Drizzle migrations | Secret |
| DATABASE_URL_POOLED | .env, .env.example, apps/web/.env.local, prod template | Runtime Drizzle DB | Secret |
| NEXT_PUBLIC_APP_URL | .env, .env.example, apps/web/.env.local, prod template | Redirects, webhooks, metadata | Public |
| NEXT_PUBLIC_APP_NAME | .env, .env.example, apps/web/.env.local, prod template | Branding | Public |
| USE_MOCK_DB | apps/web/.env.local only | env validation / DB factory | Server config |

## Stripe Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| STRIPE_SECRET_KEY | .env, .env.example, apps/web/.env.local, prod template | Checkout/session creation | Secret |
| NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY | .env, .env.example, apps/web/.env.local, prod template | Stripe client use | Public |
| STRIPE_WEBHOOK_SECRET | .env, .env.example, apps/web/.env.local, prod template | /api/webhooks/stripe | Secret |

If missing, checkout and webhook reconciliation break. Local validation must use Stripe test keys only.

## Twilio / SMS Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| TWILIO_ACCOUNT_SID | .env, .env.example, apps/web/.env.local, prod template | SMS send/status | Secret-ish ID |
| TWILIO_AUTH_TOKEN | .env, .env.example, apps/web/.env.local, prod template | SMS send/status signature | Secret |
| TWILIO_PHONE_NUMBER | .env, .env.example, apps/web/.env.local, prod template | SMS sender fallback | Sensitive operational |
| TWILIO_MESSAGING_SERVICE_SID | .env.example only | Preferred SMS sender | Sensitive operational |
| ENABLE_TWILIO_STATUS_WEBHOOK | code only | Twilio status callback | Server flag |
| ALERT_PHONE_NUMBER | code only | Internal alerts | Sensitive operational |
| NEXT_PUBLIC_ALERT_PHONE_NUMBER | code only | Client-visible contact/alert | Public |
| ADMIN_PHONE | code only | Admin/operator alerts | Sensitive operational |

## Email Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| RESEND_API_KEY | .env, apps/web/.env.local | packages/services/outreach sendEmail | Secret |
| RESEND_FROM_EMAIL | .env, apps/web/.env.local | Resend sender | Operational |
| RESEND_FROM_NAME | .env, apps/web/.env.local | Resend sender | Low |
| MAILGUN_API_KEY | apps/web/.env.local, prod template | sales/event email, health | Secret |
| MAILGUN_DOMAIN | apps/web/.env.local, prod template | sales/event email, health | Sensitive operational |
| MAILGUN_FROM_EMAIL | apps/web/.env.local, prod template | sales/event email | Operational |
| MAILGUN_FROM_NAME | code only | sales/event email | Low |
| POSTMARK_API_TOKEN | code only | Postmark provider | Secret |
| POSTMARK_FROM_EMAIL | code only | Postmark provider | Operational |
| POSTMARK_FROM_NAME | code only | Postmark provider | Low |
| POSTMARK_MESSAGE_STREAM | code only | Postmark provider | Low |
| POSTMARK_WEBHOOK_USER | code only | Postmark webhook auth | Secret |
| POSTMARK_WEBHOOK_PASSWORD | code only | Postmark webhook auth | Secret |
| ENABLE_POSTMARK_WEBHOOK | code only | Postmark webhook flag | Server flag |
| EMAIL_PROVIDER | code only | Future provider routing | Server config |

Risk: Resend, Mailgun, and Postmark all exist, but the provider router is not fully unified.

## Admin / Auth / Cron / Operator Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| ADMIN_EMAILS | .env.example, apps/web/.env.local | Admin identity/notifications | Sensitive operational |
| ADMIN_EMAIL | code only | Admin fallback/notifications | Sensitive operational |
| ADMIN_NOTIFICATION_EMAIL | code/env validation only | Intake/admin notification | Sensitive operational |
| ADMIN_DEV_BYPASS | apps/web/.env.local | Dev bypass | Dangerous in production |
| ADMIN_SYSTEM_USER_ID | apps/web/.env.local | System/admin automation | Sensitive internal |
| CRON_SECRET | apps/web/.env.local | Cron protection | Secret |
| NEXTAUTH_URL | code only | Legacy URL/auth references | Public/server |
| NEXT_PUBLIC_SITE_URL | code only | Public URL fallback | Public |
| NEXT_PUBLIC_BASE_URL | code only | Public URL fallback | Public |
| ENABLE_INTERNAL_ALERTS | code only | Internal alerts | Server flag |
| ALERT_SHADOW_MODE | code only | Send safety/shadow mode | Server flag |
| ENABLE_OPERATOR_DASHBOARD | code only | Operator UI | Server flag |
| ENABLE_AGENT_MOBILE | code only | Agent mobile UI | Server flag |
| JASON_AGENT_ID | code only | Agent/operator identity | Sensitive internal |

## AI / Content / QA / SEO / Lead Intel Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| OPENAI_API_KEY | code only | Automation/AI | Secret |
| ANTHROPIC_API_KEY | code only | QA/content/SEO AI | Secret |
| ENABLE_QA_SYSTEM | code only | QA feature gate | Server flag |
| DISABLE_QA_AI | code only | QA AI safety | Server flag |
| QA_DAILY_CAP_PER_AGENT | code only | QA cap | Server config |
| QA_ANSWER_MODEL | code only | QA model | Server config |
| QA_INGESTION_MODEL | code only | QA ingestion | Server config |
| QA_EMBEDDING_OPENAI_KEY | code only | QA embeddings | Secret |
| ENABLE_CONTENT_INTEL | code only | Content intel gate | Server flag |
| DISABLE_CONTENT_INTEL_AI | code only | Content intel safety | Server flag |
| CONTENT_INTEL_CRON_SECRET | code only | Content intel cron | Secret |
| CONTENT_INTEL_DAILY_CAP | code only | Content intel cap | Server config |
| CONTENT_INTEL_EXTRACTOR_MODEL | code only | Content intel AI | Server config |
| CONTENT_INTEL_TRANSLATOR_MODEL | code only | Content intel AI | Server config |
| CONTENT_INTEL_TRANSCRIPT_BASE | code only | Transcript provider | Server config |
| YOUTUBE_API_KEY | code only | Content ingestion | Secret |
| YT_TRANSCRIPT_API_KEY | code only | Transcript provider | Secret |
| ENABLE_SEO_ENGINE | code only | SEO feature gate | Server flag |
| ENABLE_SEO_DRAFT_GENERATION | code only | SEO drafts | Server flag |
| ENABLE_SEO_LEGACY_REDIRECT | code only | SEO redirects | Server flag |
| SEO_PUBLISHED_CAP | code only | SEO cap | Server config |
| SEO_PUBLISH_RATE_LIMIT | code only | SEO rate limit | Server config |
| SEO_PREVIEW_TOKEN_SECRET | code only | SEO preview | Secret |
| SEO_DRAFT_MODEL | code only | SEO AI | Server config |
| ENABLE_LEAD_INTEL | code only | Lead intel gate | Server flag |
| LEAD_INTEL_BATCH_CAP | code only | Lead intel cap | Server config |

## Political / Data Acquisition Variables

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| ENABLE_POLITICAL | code only | Political module gate | Server flag |
| DISABLE_POLITICAL_AI | code only | Political AI safety | Server flag |
| POLITICAL_ASSISTANT_MODEL | code only | Political AI | Server config |
| POLITICAL_DASHBOARD_ROW_CAP | code only | Political admin limits | Server config |
| POLITICAL_CRON_SECRET | code only | Political cron | Secret |
| FEC_API_KEY | code only | FEC acquisition | API key |

## Prospecting / Facebook / Reviews

| Variable | Observed | Depends On It | Sensitivity |
|---|---|---|---|
| SERPAPI_KEY | apps/web/.env.local | Prospecting/search | Secret |
| HUNTER_API_KEY | apps/web/.env.local placeholder | Email enrichment | Secret |
| FACEBOOK_APP_ID | apps/web/.env.local | Facebook | Sensitive operational |
| FACEBOOK_APP_SECRET | apps/web/.env.local | Facebook | Secret |
| FACEBOOK_PAGE_ACCESS_TOKEN | apps/web/.env.local | Facebook page actions | Secret |
| FACEBOOK_PAGE_ID | apps/web/.env.local | Facebook page actions | Sensitive operational |
| FACEBOOK_WEBHOOK_VERIFY_TOKEN | apps/web/.env.local | Facebook webhook | Secret |
| FACEBOOK_VERIFY_TOKEN | code only | Facebook webhook | Secret |
| GOOGLE_REVIEW_URL | code only | Review flow | Public/operational |

## Turbo Env Mismatches

- turbo.json has SERP_API, but code/env use SERPAPI_KEY.
- turbo.json has HUNTER, but code/env use HUNTER_API_KEY.
- turbo.json has APEX_APPROVED_SENDER, while env/code appear to use APEX_APPROVED_SENDERS.
- Many feature/provider vars used by code are not in turbo globalEnv.

## Public Client Variables

Generally safe to expose when correct for the environment and RLS is correct:

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
- NEXT_PUBLIC_APP_URL
- NEXT_PUBLIC_APP_NAME
- NEXT_PUBLIC_ALERT_PHONE_NUMBER
- NEXT_PUBLIC_SITE_URL
- NEXT_PUBLIC_BASE_URL

## Production-Sensitive Variables

Never print values for:

- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL / DATABASE_URL_POOLED
- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET
- TWILIO_AUTH_TOKEN and sender identifiers
- MAILGUN, RESEND, POSTMARK secrets
- CRON_SECRET and feature cron secrets
- Facebook tokens/secrets
- OPENAI, ANTHROPIC, QA embedding keys
- Hunter, SerpAPI, YouTube/transcript, FEC keys

## Likely Breakage If Missing

- Supabase auth/db: Supabase public vars or DB URLs missing.
- Admin/server writes: SUPABASE_SERVICE_ROLE_KEY missing.
- Checkout/webhook: Stripe secret/webhook secret missing.
- SMS: Twilio vars missing.
- Health route: Stripe/Twilio/Mailgun/Supabase vars missing.
- Intake emails: admin email plus email provider missing.
- Sales email: Mailgun missing.
- Shared outreach email: Resend missing.
- Postmark observability: Postmark vars missing.
- Political/content/QA/SEO/lead-intel: feature flags, model vars, provider keys, cron secrets missing.