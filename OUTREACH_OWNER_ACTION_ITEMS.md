# HomeReach Outreach Owner Action Items

This is Jason's operator checklist for turning on real outbound outreach safely.

## Current Revenue Operations Finalization Tracker

These are the current owner-controlled items that must be finalized before moving the outreach system beyond read-only visibility and human-review mode.

| Item | Status | Jason action |
| --- | --- | --- |
| Revenue Messaging migration 093 | Verify | Confirm `supabase/migrations/093_revenue_messaging_engine.sql` is applied in Supabase production. |
| Outreach safety migration 086 | Verify | Confirm `system_controls` has one row with `id=1` and that global/channel pause controls are editable. |
| Email provider credentials | Required | Set the active email provider key in Vercel. If `EMAIL_PROVIDER=resend`, set `RESEND_API_KEY`. |
| Postmark webhook credentials | Required if webhook enabled | Set `POSTMARK_WEBHOOK_USER` and `POSTMARK_WEBHOOK_PASSWORD`, or disable `ENABLE_POSTMARK_WEBHOOK`. |
| Hot lead alert phone | Required for legacy hot-lead SMS alerts | Set `ALERT_PHONE_NUMBER=+13302069639` in Vercel if you want hot-lead alerts enabled. |
| Twilio A2P/10DLC | Required before live prospecting SMS | Confirm brand/campaign approval before enabling `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=true`. |
| Twilio inbound SMS webhook | Required before live SMS | Point Twilio inbound SMS to `/api/webhooks/outreach/sms`. |
| Twilio status callback webhook | Required before live SMS | Point Twilio message status callbacks to `/api/webhooks/twilio/status`. |
| Political outreach legal review | Required before sends | Approve templates, disclaimer language, and manual handoff rules. |
| SerpAPI discovery | Paused by request | No action unless you explicitly ask to restart with quotas and a narrow target list. |

The in-app tracker now appears at `/admin/revenue-operations`.

## Required Before Live SMS

- Confirm Twilio can legally send from `+13302069639`.
- Complete or verify Twilio A2P/10DLC brand and campaign approval.
- Configure the Twilio inbound SMS webhook for STOP/START replies.
- Configure the Twilio status callback webhook for delivery failures.
- Keep `OUTREACH_SMS_PROSPECTING_LIVE_ENABLED=false` until approval is confirmed.
- Use test mode or manual review mode until the first live SMS checks pass.

## Required Before Email Rotation

- Verify `Jason@home-reach.com` in the chosen email provider.
- Verify `Jasonmccurry7@gmail.com` in the chosen email provider if it will send directly.
- Verify `Livetogivemarketing@gmail.com` in the chosen email provider if it will send directly.
- Confirm SPF, DKIM, and DMARC for `home-reach.com`.
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
