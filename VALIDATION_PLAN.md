# Validation Plan

Generated: 2026-05-09

Principle: validate from lowest-risk local checks to highest-risk live integrations. Use test/local envs first. Do not touch production providers without approval.

## Preconditions

- Move/copy repo out of OneDrive.
- Hydrate all files before copy.
- Install normal system Node LTS 20/22 and pnpm 9.15.0.
- Use local/test env values.
- Keep outbound SMS/email/agent automation disabled or shadowed.
- Do not run DB migrations or provider sends until approved.

## 1. Install Dependencies

```powershell
node -v
pnpm -v
pnpm install --frozen-lockfile
```

Success: pnpm completes without lockfile mutation.

Stop if: lockfile wants unexpected changes, network errors occur, or OneDrive/cloud errors appear.

## 2. Run Lint / Typecheck

```powershell
pnpm turbo run type-check --filter=@homereach/web...
pnpm turbo run lint --filter=@homereach/web...
```

Success: TypeScript passes. Lint behavior is documented separately if Next lint tooling needs adjustment.

## 3. Run Dev Server

```powershell
pnpm --filter @homereach/web dev
```

Success: server starts, env validation does not crash, no module resolution/schema export failure.

## 4. Test Homepage

Open http://localhost:3000.

Check: page renders, CTA goes to /get-started, no server/console errors.

## 5. Test Intake / Funnel

Using test data only:

- /get-started renders cities.
- City page renders categories.
- Category page renders bundles/spots.
- Checkout handles unauthenticated redirect.
- Signup/login return path is checked.
- /intake/[token] renders with seeded test token.
- POST /api/intake/[token] updates only test row.

## 6. Test Supabase

Approval required before remote checks.

Safe order:

1. Confirm env points to intended test/local project.
2. Check CLI version.
3. List migrations read-only.
4. Run narrow read-only table/schema checks.
5. Run local health route only against test env.

Commands after approval:

```powershell
supabase --version
supabase migration list
```

## 7. Test Auth

Use test Supabase user/project.

Check:

- Signup creates auth user and profile.
- Login honors redirect.
- Dashboard blocks anonymous users.
- Admin blocks non-admin users.
- Admin user has app_metadata.user_role === "admin".

## 8. Test Stripe In Test Mode Only

Approval required.

Test separately:

- /api/stripe/checkout shared postcard path.
- /api/spots/checkout subscription path.
- /api/stripe/targeted-checkout targeted path.
- /api/webhooks/stripe with Stripe test webhook forwarding.

Success:

- Pending rows created once.
- Webhook updates correct records idempotently.
- Targeted campaign payment status behavior is confirmed/fixed.
- Subscription lifecycle behavior is confirmed/fixed.

## 9. Test Twilio / Email Without Mass Sending

Approval required.

SMS:

- One approved internal test phone only.
- Verify pause controls and opt-out checks.
- Verify STOP language.
- Verify status callback logging.

Email:

- One approved internal test email only.
- Decide provider path: Resend, Mailgun, or Postmark.
- Verify webhook/bounce behavior only in sandbox/test where possible.

## 10. Test Dashboards

Admin:

- Core dashboard.
- Businesses, orders, products, bundles, cities, campaigns.
- Intake queue.
- Sales/CRM read-only pages first.

Client:

- No campaign state.
- One campaign state.
- Multiple business/campaign state.
- Billing/orders.

## 11. Test Political Module

Use ENABLE_POLITICAL in local/test only.

Check:

- /political feature gate.
- Dummy plan intent creates test row.
- Admin political pages load.
- Proposal/contract token pages work with dummy data.
- Route CSV import uses test files only.

Do not send political outreach or process real payment in this phase.

## 12. Test Deployment Readiness

After local typecheck/dev validation:

```powershell
pnpm turbo run build --filter=@homereach/web...
```

After approval:

```powershell
vercel build
vercel env ls
```

Production checklist:

- Vercel env matches ENVIRONMENT_AUDIT.md.
- Stripe webhook URL/secret match deployment.
- Supabase migration history reconciled.
- Cron routes protected by secrets.
- Live-send features intentionally enabled or shadowed.
- Rollback plan exists.