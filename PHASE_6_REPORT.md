# Food Service Growth OS - Phase 6 Report

Phase 6 scope completed: Benchmark Layer.

## Files Created

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\supabase\migrations\082_fsgos_phase6_benchmarks.sql` - additive `fsgos_benchmarks` table, indexes, RLS policies, and rollback note.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\benchmarks.ts` - benchmark lookup, public fallback values, revenue tiering, region bucketing, and aggregated recompute logic.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\benchmarks\route.ts` - authenticated benchmark lookup endpoint for the current user's profile.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\benchmarks\recompute\route.ts` - protected cron endpoint for weekly anonymized benchmark recomputation.

## Files Modified

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\packages\db\src\schema\fsgos.ts` - added Drizzle schema for `fsgos_benchmarks`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\feature-flag.ts` - added `FSGOS_BENCHMARK_SYSTEM_USER_ID` accessor.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\recommendations.ts` - replaced static AOV/food/labor benchmark targets with benchmark lookup and fallback source labeling.

## Migrations Run

None. Migration file was created only.

Rollback SQL:

```sql
drop table if exists public.fsgos_benchmarks;
```

## Manual Test Steps

1. Ensure Phases 1-5 migrations have been applied, then apply Phase 6:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach"
   supabase db push
   ```

2. Enable Growth OS:
   ```powershell
   $env:ENABLE_FOOD_SERVICE_GROWTH_OS="true"
   ```

3. Configure benchmark recompute:
   ```powershell
   $env:FSGOS_CRON_SECRET="your-cron-secret"
   $env:FSGOS_BENCHMARK_SYSTEM_USER_ID="admin-or-system-user-uuid"
   ```

4. Run type-check:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
   ..\..\_codex_runtime\bin\pnpm.cmd type-check
   ```

5. Start the app:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
   pnpm dev
   ```

6. As an authenticated Growth OS user with a profile, request:
   ```text
   GET http://localhost:3000/api/growth-os/benchmarks
   ```
   Verify the response includes AOV, food cost, labor, and waste benchmarks.

7. With fewer than 10 comparable samples, verify benchmark metric sources are `public_industry_fallback`.

8. Recompute benchmarks with the cron secret:
   ```powershell
   Invoke-RestMethod `
     -Method Post `
     -Uri "http://localhost:3000/api/growth-os/benchmarks/recompute" `
     -Headers @{ "x-fsgos-cron-secret" = $env:FSGOS_CRON_SECRET }
   ```

9. With 10+ comparable samples in a cohort, verify rows are upserted into `public.fsgos_benchmarks` with `source = 'aggregated_user_data'`.

10. Reload the Growth OS dashboard and verify recommendations still appear. If a benchmark is used, recommendation text should identify the benchmark source.

## Verification

- Passed:
  ```powershell
  cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
  ..\..\_codex_runtime\bin\pnpm.cmd type-check
  ```

- Not run: Supabase migration, benchmark recompute against a live database, browser smoke test.

## Open Questions / Decisions Deferred

- `fsgos_benchmarks.user_id` is required by the protected-core table rule. Recompute uses `FSGOS_BENCHMARK_SYSTEM_USER_ID` so aggregate rows are attributable to a system/admin user.
- Benchmark rows are aggregate data, so RLS allows authenticated reads while preserving owner/admin write controls.
- Region bucketing currently uses ZIP first digit. This is intentionally coarse for MVP privacy and cohort size.
- Cohorts under 10 samples fall back to public industry values and are flagged as `public_industry_fallback`.
- Post-MVP Modules 14, 15, and 16 were not built.

## Acceptance Criteria Status

1. Profile completes in under 3 minutes - checked in Phase 1, unchanged.
2. Weekly input completes in under 60 seconds - checked in Phase 1, unchanged.
3. Recommendations engine produces at least 1 rec from week 1 and at least 3 by week 4 - checked in Phase 2, unchanged.
4. First Win Accelerator delivers a tagged fast-win recommendation to every new user in week 1 - checked in Phase 2, unchanged.
5. Lever activation captures 4-week rolling baseline - checked in Phase 3, unchanged.
6. Impact tracking splits revenue delta into AOV-driven vs volume-driven - checked in Phase 4, unchanged.
7. Impact shown with confidence level + reasoning + disclaimer - checked in Phase 4, unchanged.
8. Win Log visible, scrollable, and shareable - checked in Phase 4, unchanged.
9. AI chat references user's actual data, recent wins, impact history - checked in Phase 5, unchanged.
10. Action generator produces at least 1 downloadable artifact per lever - checked in Phase 5, unchanged.

## Stop Point

Phase 6 is complete. MVP phases 1-6 are now implemented. Stop here before any post-MVP work.
