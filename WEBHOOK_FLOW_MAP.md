# Webhook Flow Map

Audit date: 2026-05-10

## Stripe Webhook

| Route | File | Methods |
| --- | --- | --- |
| `/api/webhooks/stripe` | `apps/web/app/api/webhooks/stripe/route.ts` | POST |

Flow:

1. Reads raw request body.
2. Requires `stripe-signature`.
3. Verifies using `STRIPE_WEBHOOK_SECRET` through `constructWebhookEvent`.
4. Handles:
   - `checkout.session.completed`
   - `payment_intent.payment_failed`
   - `charge.refunded`
5. Updates `orders`.
6. Activates `businesses`.
7. Creates `marketing_campaigns` with `onConflictDoNothing`.

Risks:

- No explicit webhook event ledger.
- Political payments are not reconciled here.
- Stripe API versions differ between service and route code.

## Twilio Inbound SMS

| Route | File | Methods |
| --- | --- | --- |
| `/api/webhooks/outreach/sms` | `apps/web/app/api/webhooks/outreach/sms/route.ts` | POST |

Flow:

1. Reads form data from Twilio.
2. Handles STOP/UNSUBSCRIBE/CANCEL/END/QUIT opt-out.
3. Handles START/YES/UNSTOP opt-in.
4. Finds `outreach_contacts` by phone.
5. Inserts `outreach_replies`.
6. Returns empty TwiML.

Risk:

- Signature validation is not visible in this route. Twilio inbound webhooks should validate `X-Twilio-Signature`.

## Twilio Status Callback

| Route | File | Methods |
| --- | --- | --- |
| `/api/webhooks/twilio/status` | `apps/web/app/api/webhooks/twilio/status/route.ts` | GET, POST |

Flow:

1. Optional disable with `ENABLE_TWILIO_STATUS_WEBHOOK=false`.
2. Validates Twilio signature when auth token is configured.
3. Fails closed in production if token is missing.
4. Inserts append-only row into `twilio_message_status`.
5. Returns 200/TwiML even on DB insert failure to avoid retry storms.

## Postmark Webhook

| Route | File | Methods |
| --- | --- | --- |
| `/api/webhooks/postmark` | `apps/web/app/api/webhooks/postmark/route.ts` | GET, POST |

Flow:

1. Optional disable with `ENABLE_POSTMARK_WEBHOOK=false`.
2. Validates Basic Auth using `POSTMARK_WEBHOOK_USER/PASSWORD`.
3. Logs events to `email_events`.
4. Updates `sales_leads.email_status` for terminal events.

Risk:

- Production must set Basic Auth credentials. Missing credentials fail closed only in production.

## Facebook Webhooks

| Route | File | Notes |
| --- | --- | --- |
| `/api/facebook/webhook` | `apps/web/app/api/facebook/webhook/route.ts` | Messenger/page closing engine. |
| `/api/webhooks/facebook` | `apps/web/app/api/webhooks/facebook/route.ts` | Graph API event receiver and alert router. |

Risks:

- Two Facebook webhook routes overlap conceptually.
- Verify token env naming differs: `FACEBOOK_WEBHOOK_VERIFY_TOKEN` and `FACEBOOK_VERIFY_TOKEN`.
- Alert route uses internal fetch with `x-cron-secret`.

## Webhook Production Rules

- Stripe: require event ledger before high-volume production.
- Twilio inbound: add signature validation.
- Twilio status: keep append-only; do not mutate send state blindly.
- Postmark: require Basic Auth in production.
- Facebook: choose canonical route, retire or guard duplicate route.

