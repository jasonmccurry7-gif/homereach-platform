# Food Service Growth OS - Phase 2 Report

Phase 2 scope completed: Recommendations Engine, First Win Accelerator, and cold-start recommendation logic.

## Files Created

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\supabase\migrations\079_fsgos_phase2_recommendations.sql` - additive `fsgos_recommendations` table, indexes, RLS policies, and rollback note.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\recommendations.ts` - deterministic recommendation engine, ranking, cold-start handling, first-14-days fast-win pinning, and recommendation persistence helper.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\claude.ts` - optional Claude language refinement hook gated behind `FSGOS_RECOMMENDATIONS_AI_ENABLED=true` and `FSGOS_ANTHROPIC_API_KEY`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\recommendations\route.ts` - authenticated Growth OS recommendations API with read-only `GET` and persistence-enabled `POST`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\first-win-banner.tsx` - First Win Accelerator banner.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\recommendation-card.tsx` - recommendation display card with problem, action, impact, confidence, and fast-win tags.

## Files Modified

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\packages\db\src\schema\fsgos.ts` - added Drizzle schema for `fsgos_recommendations`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\types.ts` - added recommendation, confidence, source, and lever category types.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\growth-os\dashboard\page.tsx` - added recommendations section and first-win banner while leaving existing Phase 1 dashboard metrics intact.

## Migrations Run

None. Migration file was created only.

Rollback SQL:

```sql
drop table if exists public.fsgos_recommendations;
```

## Manual Test Steps

1. Enable the feature flag:
   ```powershell
   $env:ENABLE_FOOD_SERVICE_GROWTH_OS="true"
   ```

2. Run type-check from the web workspace:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
   ..\..\_codex_runtime\bin\pnpm.cmd type-check
   ```

3. Apply the new migration using the existing Supabase migration workflow:
   ```powershell
   cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach"
   supabase db push
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

6. With only a completed profile and no weekly input, verify the dashboard still shows at least one recommendation.

7. Submit weekly inputs with high food cost or low AOV and verify the dashboard ranks specific recommendations with estimated monthly impact and confidence.

8. For a user created within the last 14 days, verify a fast-win recommendation is pinned and the banner says `Fastest way to make money this week`.

9. In an authenticated browser session, open:
   ```text
   http://localhost:3000/api/growth-os/recommendations
   ```
   Verify JSON includes `recommendations`.

10. Send an authenticated `POST` to `/api/growth-os/recommendations` after applying the migration and verify rows are upserted into `public.fsgos_recommendations`.

## Verification

- Passed:
  ```powershell
  cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
  ..\..\_codex_runtime\bin\pnpm.cmd type-check
  ```

- Not run: Supabase migration, browser smoke test, live Claude API refinement. The Claude path is intentionally disabled unless `FSGOS_RECOMMENDATIONS_AI_ENABLED=true` and `FSGOS_ANTHROPIC_API_KEY` are configured.

## Open Questions / Decisions Deferred

- Weak weekend performance and single-SKU revenue triggers are deferred because Phase 1 input does not capture weekday/weekend splits or SKU mix.
- Baseline-comparison recommendation features remain deferred until Phase 3/4 because no lever activation or impact baseline exists yet.
- Regional benchmarks are static heuristics in Phase 2. The `fsgos_benchmarks` table and aggregated benchmark fallback belong to Phase 6.
- No Apply button was added. One active lever, baseline capture, and applied recommendation status transitions belong to Phase 3.

## Acceptance Criteria Status

1. Profile completes in under 3 minutes - checked in Phase 1, unchanged.
2. Weekly input completes in under 60 seconds - checked in Phase 1, unchanged.
3. Recommendations engine produces at least 1 rec from week 1 and at least 3 by week 4 - checked for Phase 2 engine logic.
4. First Win Accelerator delivers a tagged fast-win recommendation to every new user in week 1 - checked for Phase 2 engine logic and dashboard banner.
5. Lever activation captures 4-week rolling baseline - unchecked, Phase 3.
6. Impact tracking splits revenue delta into AOV-driven vs volume-driven - unchecked, Phase 4.
7. Impact shown with confidence level + reasoning + disclaimer - unchecked for impact tracking, Phase 4. Phase 2 recommendations show confidence and reasoning.
8. Win Log visible, scrollable, and shareable - unchecked, Phase 4.
9. AI chat references user's actual data, recent wins, impact history - unchecked, Phase 5.
10. Action generator produces at least 1 downloadable artifact per lever - unchecked, Phase 5.

## Stop Point

Phase 2 is complete. Stop here and wait for human approval before Phase 3.
