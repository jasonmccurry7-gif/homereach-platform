# Food Service Growth OS - Phase 8 Report

Phase 8 scope completed after explicit post-MVP approval: Light A/B Testing.

## Files Created

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\supabase\migrations\084_fsgos_phase8_ab_tests.sql` - additive `fsgos_ab_tests` table, indexes, RLS policies, and rollback note.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\ab-tests.ts` - A/B test creation, active-test lookup, and directional weekly evaluation.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\ab-tests\route.ts` - authenticated A/B test list/create endpoint.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\ab-tests\evaluate\route.ts` - authenticated active-test evaluation endpoint.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\growth-os\experiments\page.tsx` - `/growth-os/experiments` route.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\ab-test-form.tsx` - pricing/bundle test creation form.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\ab-test-list.tsx` - A/B test history and result display.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\evaluate-ab-test-button.tsx` - client evaluation trigger.

## Files Modified

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\packages\db\src\schema\fsgos.ts` - added Drizzle schema for `fsgos_ab_tests`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\types.ts` - added A/B test metric/result types.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\validators.ts` - added A/B test request schema.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\queries.ts` - added A/B test query helper.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\growth-os-shell.tsx` - added Tests navigation item.

## Migrations Run

None. Migration file was created only.

Rollback SQL:

```sql
drop table if exists public.fsgos_ab_tests;
```

## Manual Test Steps

1. Ensure Phases 1-7 migrations have been applied, then apply Phase 8:
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

5. Ensure the user has an active lever from Phase 3.

6. Visit:
   ```text
   http://localhost:3000/growth-os/experiments
   ```

7. Create a pricing or bundle test with Variant A and Variant B.

8. Verify a row is created in `public.fsgos_ab_tests` with `status = 'active'`.

9. Add at least two weekly inputs after the test start date.

10. Click `Evaluate` and verify the test updates with result summary, winning variant, confidence, and completed status when enough data exists.

11. Verify a second test cannot be created while one is active.

## Verification

- Passed:
  ```powershell
  cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
  ..\..\_codex_runtime\bin\pnpm.cmd type-check
  ```

- Not run: Supabase migration, browser smoke test, live database A/B test creation/evaluation.

## Open Questions / Decisions Deferred

- Weekly-input granularity means this is a directional A/B comparison, not a statistically rigorous traffic-split test.
- Tests alternate variants by submitted week: week 1 = A, week 2 = B, week 3 = A, week 4 = B.
- Only one active A/B test is allowed per user to reduce attribution collisions.
- Tests require an active lever first so experiments stay tied to a current business action.

## Phase 8 Acceptance Status

- Pricing and bundle variation tests supported - checked.
- A/B tests namespaced under `fsgos_*`, `/growth-os/*`, and `/api/growth-os/*` - checked.
- One active A/B test at a time - checked.
- Directional result summary with winning variant and confidence - checked.
- Type-check passed - checked.

## Stop Point

Phase 8 is complete. Post-MVP phases 7-8 are now implemented.
