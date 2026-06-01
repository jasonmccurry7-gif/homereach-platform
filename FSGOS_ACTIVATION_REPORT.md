# Food Service Growth OS Activation Report

Date: 2026-05-10

## Database Migrations Applied

Applied successfully:

- `supabase/migrations/078_fsgos_phase1.sql`
- `supabase/migrations/079_fsgos_phase2_recommendations.sql`
- `supabase/migrations/080_fsgos_phase3_applied_recommendations.sql`
- `supabase/migrations/081_fsgos_phase4_impact_tracking.sql`
- `supabase/migrations/082_fsgos_phase6_benchmarks.sql`
- `supabase/migrations/083_fsgos_phase7_risk_alerts.sql`
- `supabase/migrations/084_fsgos_phase8_ab_tests.sql`

## Database Verification

Verified through both `DATABASE_URL` and `DATABASE_URL_POOLED` that all Growth OS tables exist.

Tables with RLS enabled:

- `fsgos_ab_tests`
- `fsgos_applied_recommendations`
- `fsgos_benchmarks`
- `fsgos_business_profiles`
- `fsgos_impact_tracking`
- `fsgos_recommendations`
- `fsgos_risk_alerts`
- `fsgos_user_state`
- `fsgos_weekly_inputs`

Policy counts:

- `fsgos_benchmarks`: 3
- All other `fsgos_*` tables: 2 each

## Local Smoke Checks

Local dev server:

- `http://127.0.0.1:3000`
- Growth OS feature flag enabled in `apps/web/.env.local`

Unauthenticated route checks:

- `/growth-os` -> `307 /login?redirect=/growth-os`
- `/growth-os/dashboard` -> `307 /login?redirect=/growth-os`
- `/growth-os/onboarding` -> `307 /login?redirect=/growth-os`
- `/growth-os/weekly` -> `307 /login?redirect=/growth-os`
- `/growth-os/levers` -> `307 /login?redirect=/growth-os`
- `/growth-os/experiments` -> `307 /login?redirect=/growth-os`
- `/login?redirect=/growth-os` -> `200`

Unauthenticated API checks:

- `GET /api/growth-os/profile` -> `401`
- `GET /api/growth-os/weekly-input` -> `401`
- `GET /api/growth-os/recommendations` -> `401`
- `GET /api/growth-os/benchmarks` -> `401`
- `GET /api/growth-os/risk-alerts` -> `401`
- `GET /api/growth-os/ab-tests` -> `401`
- `GET /api/growth-os/chat` -> `405`
- `GET /api/growth-os/actions` -> `405`

## Browser State

The in-app browser is currently at:

`http://127.0.0.1:3000/login?redirect=/growth-os`

Visible state: HomeReach login form.

## Remaining Manual Smoke Test

Requires a signed-in HomeReach user:

1. Sign in at `/login?redirect=/growth-os`.
2. Complete Growth OS onboarding.
3. Submit a weekly input.
4. Confirm dashboard metrics render.
5. Confirm recommendations generate.
6. Apply one recommendation.
7. Complete the lever and confirm impact tracking / Win Log.
8. Check chat and action artifact generation.
9. Check benchmarks, risk alerts, lever library, and experiments screens.

## Rollback SQL

```sql
drop table if exists public.fsgos_ab_tests;
drop table if exists public.fsgos_risk_alerts;
drop table if exists public.fsgos_benchmarks;
drop table if exists public.fsgos_impact_tracking;
drop table if exists public.fsgos_applied_recommendations;
drop table if exists public.fsgos_recommendations;
drop table if exists public.fsgos_user_state;
drop table if exists public.fsgos_weekly_inputs;
drop table if exists public.fsgos_business_profiles;
```
