# Food Service Growth OS - Phase 3 Report

Phase 3 scope completed: Apply + Baseline Capture.

## Files Created

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\supabase\migrations\080_fsgos_phase3_applied_recommendations.sql` - additive `fsgos_applied_recommendations` table, RLS, active-lever uniqueness, and rollback note.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\baseline.ts` - 4-week rolling baseline calculation with profile fallback for cold-start users.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\apply.ts` - apply flow that persists the recommendation, captures baseline metrics, and creates the active lever.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\recommendations\apply\route.ts` - authenticated apply endpoint.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\apply-recommendation-button.tsx` - client apply button.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\active-lever-card.tsx` - active lever display with captured baseline.

## Files Modified

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\packages\db\src\schema\fsgos.ts` - added Drizzle schema for `fsgos_applied_recommendations` and baseline metric JSON type.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\types.ts` - added baseline metrics type.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\queries.ts` - added active applied recommendation lookup and included it in Growth OS dashboard data.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\validators.ts` - added apply request validation.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\recommendation-card.tsx` - added apply/active lever controls.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\growth-os\dashboard\page.tsx` - surfaces the active lever and disables other apply controls while one is active.

## Migrations Run

None. Migration file was created only.

Rollback SQL:

```sql
drop table if exists public.fsgos_applied_recommendations;
```

## Manual Test Steps

1. Ensure Phase 1 and Phase 2 migrations have been applied, then apply Phase 3:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach"
   supabase db push
   ```

2. Enable Growth OS:
   ```powershell
   $env:ENABLE_FOOD_SERVICE_GROWTH_OS="true"
   ```

3. Run type-check:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
   ..\..\_codex_runtime\bin\pnpm.cmd type-check
   ```

4. Start the app:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
   pnpm dev
   ```

5. Log in and visit:
   ```text
   http://localhost:3000/growth-os/dashboard
   ```

6. Click `Apply lever` on a recommendation.

7. Verify `public.fsgos_recommendations` contains the selected recommendation with `status = 'applied'`.

8. Verify `public.fsgos_applied_recommendations` contains one row with `status = 'active'`, `baseline_metrics`, `date_applied`, `lever_category`, `fast_win`, and `confidence`.

9. Verify the dashboard shows the active lever card with revenue, AOV, food cost, labor, and waste baselines.

10. Try applying another recommendation and verify the UI locks it; direct API calls should return `409` while an active lever exists.

## Verification

- Passed:
  ```powershell
  cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
  ..\..\_codex_runtime\bin\pnpm.cmd type-check
  ```

- Not run: Supabase migration, database insert smoke test, browser smoke test. The migration was intentionally not run at this checkpoint.

## Open Questions / Decisions Deferred

- Completing or abandoning an active lever is deferred until Phase 4 impact tracking and Win Log work.
- Baseline captures actual submitted weeks when available and falls back to profile metrics for cold-start users with no weekly inputs.
- `final_impact_cents` remains empty in Phase 3. Final impact calculation belongs to Phase 4.
- The active lever card intentionally does not show impact progress yet; dashboard impact expansion belongs to Phase 4.

## Acceptance Criteria Status

1. Profile completes in under 3 minutes - checked in Phase 1, unchanged.
2. Weekly input completes in under 60 seconds - checked in Phase 1, unchanged.
3. Recommendations engine produces at least 1 rec from week 1 and at least 3 by week 4 - checked in Phase 2, unchanged.
4. First Win Accelerator delivers a tagged fast-win recommendation to every new user in week 1 - checked in Phase 2, unchanged.
5. Lever activation captures 4-week rolling baseline - checked in Phase 3.
6. Impact tracking splits revenue delta into AOV-driven vs volume-driven - unchecked, Phase 4.
7. Impact shown with confidence level + reasoning + disclaimer - unchecked for impact tracking, Phase 4.
8. Win Log visible, scrollable, and shareable - unchecked, Phase 4.
9. AI chat references user's actual data, recent wins, impact history - unchecked, Phase 5.
10. Action generator produces at least 1 downloadable artifact per lever - unchecked, Phase 5.

## Stop Point

Phase 3 is complete. Stop here and wait for human approval before Phase 4.
