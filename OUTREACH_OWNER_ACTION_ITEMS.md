# HomeReach Outreach Owner Action Items

This is Jason's operator checklist for turning on real outbound outreach safely.

## Current Revenue Operations Finalization Tracker

Updated 2026-05-25 after the outreach identity, Postmark webhook, and draft-only social outreach repair pass.

These are the current owner-controlled items that must be finalized before moving the outreach system beyond read-only visibility and human-review mode.

| Item | Status | Jason action |
| --- | --- | --- |
| Revenue Messaging migration 093 | Done / verify only | Tables are present in the current app path. Only re-check in Supabase if production starts showing source warnings. |
| Outreach safety migration 086 | Done | `system_controls` is live and controls are editable. |
| Email provider credentials | Done | Postmark is configured as the active production email provider. |
| Postmark webhook credentials | Done | Webhook auth has been configured and rotated in Vercel. |
| Postmark sender/domain verification | Jason/provider-side confirmation | Confirm in Postmark UI that `Jason@home-reach.com` and `home-reach.com` sender/domain status are fully verified. I can audit via API if an Account API token is available. |
| Hot lead alert phone | Optional | I can wire this if you want legacy hot-lead SMS alerts, but keep live SMS disabled until Twilio/A2P is ready. |
| Twilio A2P/10DLC | Required before live prospecting SMS | Confirm brand/campaign approval before enabling `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=true`. |
| Twilio sender number | Required before live SMS | Twilio must own or host `+13302069639`, or you must choose an approved Twilio sender. I cannot make Twilio send from a number it does not control. |
| Twilio inbound/status webhooks | I can do after sender is ready | Point inbound SMS to `/api/webhooks/outreach/sms` and status callbacks to `/api/webhooks/twilio/status` once the approved sender/campaign exists. |
| Political outreach legal review | Required before sends | Approve templates, disclaimer language, and manual handoff rules before live political outbound. |
| SerpAPI discovery | Paused by request | No action unless you explicitly ask to restart with quotas and a narrow target list. |

## Completed By Codex

- Centralized Jason owner identity into outbound sender, persona, unsubscribe, and Postmark compliance surfaces.
- Repaired the prospect queue screenshot issue: if a prospect has no Facebook/Messenger URL, `AI Draft` now queues a manual review draft instead of failing.
- Preserved human approval gates: no email, SMS, Facebook DM, social post, payment, pricing, campaign, or legal-sensitive action sends automatically.
- Verified narrow checks: web TypeScript passes, services TypeScript passes, and services tests pass.

The in-app tracker now appears at `/admin/revenue-operations`.

## Required Before Live SMS

- Confirm Twilio can legally send from `+13302069639`, either by hosting/porting the number or selecting an approved Twilio sender.
- Complete or verify Twilio A2P/10DLC brand and campaign approval.
- Configure the Twilio inbound SMS webhook for STOP/START replies. I can do this after the sender/campaign is ready.
- Configure the Twilio status callback webhook for delivery failures. I can do this after the sender/campaign is ready.
- Keep `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=false` until approval is confirmed.
- Use test mode or manual review mode until the first live SMS checks pass.

## Required Before Email Rotation

- Verify `Jason@home-reach.com` in the chosen email provider.
- Verify `Jasonmccurry7@gmail.com` in the chosen email provider only if it will send directly. It can stay reply/fallback-only otherwise.
- Verify `Livetogivemarketing@gmail.com` in the chosen email provider only if it will send directly. It can stay support/marketing identity otherwise.
- Confirm SPF, DKIM, DMARC, and Postmark Return-Path for `home-reach.com`.
- Start with `OUTREACH_EMAIL_ROTATION_ENABLED=false`.
- Enable rotation only after all sender identities are verified and bounce tracking is working.

## Production Environment Variables

Set these in Vercel or the production host:

```env
OWNER_NAME=Jason McCurry
OWNER_CELL_PHONE=+13302069639
OWNER_PERSONAL_EMAIL=Jasonmccurry7@gmail.com
OWNER_SECONDARY_EMAIL=Livetogivemarketing@gmail.com
OWNER_DOMAIN_EMAIL=Jason@home-reach.com
DEFAULT_FROM_EMAIL=Jason@home-reach.com
DEFAULT_REPLY_TO_EMAIL=Jason@home-reach.com
SYSTEM_ALERT_PHONE=+13302069639
ALERT_PHONE_NUMBER=+13302069639
OUTREACH_SMS_FROM_NUMBER=+13302069639
EMAIL_PROVIDER=resend
OUTREACH_TEST_MODE=false
OUTREACH_MANUAL_APPROVAL_MODE=false
OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=false
OUTREACH_DEFAULT_TIME_ZONE=America/New_York
OUTREACH_WEEKDAY_ONLY=true
OUTREACH_BUSINESS_START_MINUTES=510
OUTREACH_BUSINESS_END_MINUTES=1050
OUTREACH_DAILY_SMS_CAP=30
OUTREACH_DAILY_EMAIL_CAP_PER_SENDER=30
OUTREACH_EMAIL_ROTATION_ENABLED=false
OUTREACH_AUTOMATION_BATCH_LIMIT=10
```

## Database And Deployment

- Apply `supabase/migrations/086_outreach_owner_controls.sql` to production.
- Confirm `system_controls` has one row with `id=1`.
- Confirm `outreach_owner_settings` has one row with Jason's identity.
- Confirm `check_and_increment_send_count` returns conservative `30/day` caps.
- Redeploy the web app after the migration is applied.

## Daily Operating Checks

- Open `/api/admin/outreach/health` while logged in as admin.
- Check global pause, channel pause, test mode, and manual approval mode.
- Review sender health before enabling daily automation.
- Watch bounce, unsubscribe, complaint, failed SMS, and blocked-number signals.
- Pause SMS or email immediately if failures spike.

## Emergency Controls

- Global pause: `POST /api/admin/system/pause` with `{"scope":"system","paused":true}`.
- Pause SMS only: `POST /api/admin/system/pause` with `{"scope":"channel","id":"sms","paused":true}`.
- Pause email only: `POST /api/admin/system/pause` with `{"scope":"channel","id":"email","paused":true}`.
- Enable test mode: `POST /api/admin/system/pause` with `{"scope":"control","id":"test_mode","enabled":true}`.
- Enable manual review mode: `POST /api/admin/system/pause` with `{"scope":"control","id":"manual_approval","enabled":true}`.
- Enable live SMS only after approval: `POST /api/admin/system/pause` with `{"scope":"control","id":"sms_live","enabled":true}`.

## Compliance Checks

- Confirm message copy includes clear identity and opt-out language.
- Confirm SMS flows honor STOP and START.
- Confirm email unsubscribe links are live before scaling.
- Confirm bounced, complained, unsubscribed, and quarantined leads are suppressed.
- Keep outreach one-to-one and prospect-specific; do not batch blast.
