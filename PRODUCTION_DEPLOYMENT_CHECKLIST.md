# HomeReach Production Deployment Checklist

Date: 2026-05-09

Use this checklist before promoting the repaired validation copy toward production.

## 1. Workspace Safety

- Move active development out of OneDrive before continued installs/builds.
- Use a folder with normal local disk semantics, such as `C:\Dev\homereach`.
- Ensure the target working copy includes `.git` before committing or deploying.
- Keep the OneDrive copy as a backup until the local copy is verified.

## 2. Environment Review

- Confirm required runtime variables are present in the intended deployment environment.
- Do not paste or expose secret values in docs, tickets, commits, or chat.
- Verify public variables use the `NEXT_PUBLIC_` prefix only when safe for browser exposure.
- Confirm `ALERT_PHONE_NUMBER` if hot lead SMS alerts are expected.
- Confirm all Stripe variables are test-mode values before any checkout validation.

## 3. Database And Supabase

- Validate Supabase connection using read-only checks first.
- Confirm migrations/schema are aligned with the live database before applying changes.
- Review RLS policies before testing admin/client dashboards with real accounts.
- Confirm storage buckets and access policies before testing uploads.
- Resolve the nonprofit application schema mismatch before using that flow for live intake.

## 4. Local Validation

Run from the local working copy:

```powershell
$env:Path = 'C:\Dev\tools;C:\Program Files\nodejs;' + $env:Path
pnpm install --frozen-lockfile
pnpm --filter @homereach/web type-check
pnpm --filter @homereach/web lint
pnpm --filter @homereach/web build
pnpm --filter @homereach/web dev --hostname 127.0.0.1 --port 3000
```

Expected current results:

- Typecheck exits 0.
- Lint exits 0 with warnings.
- Build exits 0.
- Dev server starts at `http://127.0.0.1:3000`.

## 5. Browser Smoke Tests

Validate with GET-only navigation first:

- `/`
- `/get-started`
- `/get-started/cuyahoga-falls`
- `/get-started/cuyahoga-falls/hvac`
- `/spots/cuyahoga-falls/hvac`
- `/targeted/start`
- `/targeted/intake`
- `/intelligence`
- `/login`
- `/dashboard`
- `/admin`
- `/admin/political`

Expected protected-route behavior:

- `/dashboard` redirects to login.
- `/admin` and nested admin routes redirect to login.

## 6. Stripe

- Use Stripe test mode only.
- Confirm product, price, and webhook IDs match the test environment.
- Test checkout session creation with a disposable test account.
- Verify webhook handling using Stripe CLI or a staging webhook endpoint first.
- Do not point production webhooks at an unverified local/staging build.

## 7. Twilio And Email

- Use a test phone number and test recipient addresses only.
- Validate one-message sends before any batch or automation path.
- Confirm opt-out handling before live SMS.
- Confirm Postmark/Mailgun domain/authentication health before production email.
- Do not run cron/send-due/bulk automation endpoints against production contacts until reviewed.

## 8. Auth And Dashboards

- Test login with a known non-production or controlled admin account.
- Verify admin role gates.
- Verify client dashboard access with a controlled client account.
- Confirm redirects do not leak admin pages to unauthenticated users.

## 9. Political Mail And Route Mapping

- Validate read-only admin pages first.
- Verify route import/parsing with a small test file only.
- Confirm EDDM/geography assumptions against current data.
- Review proposal/payment handoff before using with real campaigns.

## 10. Deployment Readiness

- Commit changes from a git-backed local working copy.
- Confirm no secret values are staged.
- Confirm Vercel project environment variables are complete.
- Run a fresh production build from a clean install.
- Deploy to preview first.
- Smoke-test preview routes.
- Validate Stripe/Twilio/email in staging/test mode.
- Promote to production only after preview checks pass.

## 11. Post-Deploy Monitoring

- Watch Vercel function logs during first live traffic.
- Monitor Supabase errors and auth events.
- Monitor Stripe webhook delivery.
- Monitor Twilio/email delivery failures.
- Monitor intake, checkout, dashboard, and admin error rates.

