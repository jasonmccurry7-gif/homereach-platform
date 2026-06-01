# Food Service Growth OS - Phase 7 Report

Phase 7 scope completed after explicit post-MVP approval: Lever Library UI and Risk Alert Engine.

## Files Created

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\supabase\migrations\083_fsgos_phase7_risk_alerts.sql` - additive `fsgos_risk_alerts` table, indexes, RLS policies, and rollback note.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\risk-alerts.ts` - risk alert engine with 6-clean-week gate for revenue drop, profit decline, and labor spike.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\api\growth-os\risk-alerts\route.ts` - authenticated risk alert inspect/refresh endpoint.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\risk-alerts-panel.tsx` - dashboard risk alert panel.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\lever-library.tsx` - completed lever library UI.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\growth-os\levers\page.tsx` - `/growth-os/levers` route.

## Files Modified

- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\packages\db\src\schema\fsgos.ts` - added Drizzle schema for `fsgos_risk_alerts`.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\types.ts` - added risk alert types.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\lib\growth-os\queries.ts` - added active risk alert lookup and included alerts in Growth OS dashboard data.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\components\growth-os\growth-os-shell.tsx` - added Lever Library nav item.
- `C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web\app\growth-os\dashboard\page.tsx` - refreshes risk alerts and renders the risk alert panel.

## Migrations Run

None. Migration file was created only.

Rollback SQL:

```sql
drop table if exists public.fsgos_risk_alerts;
```

## Manual Test Steps

1. Ensure Phases 1-6 migrations have been applied, then apply Phase 7:
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

5. Visit:
   ```text
   http://localhost:3000/growth-os/levers
   ```
   Verify completed levers render from existing completed applied recommendations and impact tracking.

6. Visit:
   ```text
   http://localhost:3000/growth-os/dashboard
   ```
   Verify the Risk Alerts panel appears.

7. With fewer than 6 clean weekly inputs, verify the panel says risk alerts require 6 clean weekly inputs.

8. With 6+ clean weekly inputs and declining revenue/profit or rising labor percentage, call:
   ```text
   POST /api/growth-os/risk-alerts
   ```
   Verify active rows are upserted in `public.fsgos_risk_alerts`.

9. Correct the risk trend and refresh alerts again. Verify active alerts resolve when no longer present.

## Verification

- Passed:
  ```powershell
  cd "C:\Users\jason\OneDrive\Documents\Claude\Projects\HomeReach Platform Rebuild\homereach\apps\web"
  ..\..\_codex_runtime\bin\pnpm.cmd type-check
  ```

- Not run: Supabase migration, browser smoke test, live database risk-alert refresh.

- Note: a later nonessential status/grep pass failed because Windows PowerShell could not load CLR due to paging-file pressure. The type-check completed successfully before that failure.

## Open Questions / Decisions Deferred

- Re-running a completed lever is not implemented in Phase 7. The library is browse/share/reference only to avoid colliding with the one-active-lever rule.
- Risk alerts intentionally ignore weeks with bad weather, equipment, or staffing context flags.
- Risk alert types are limited to revenue drop, profit decline, and labor spike as specified.
- Phase 8 Light A/B Testing remains unbuilt and should be started only after approval.

## Phase 7 Acceptance Status

- Lever Library UI visible under `/growth-os/levers` - checked.
- Completed levers browsable from applied recommendation history - checked.
- Risk Alert Engine requires 6+ clean weekly inputs - checked.
- Risk alerts cover profit decline, labor spike, and revenue drop - checked.
- All changes additive and namespaced under `fsgos_*`, `/growth-os/*`, and `/api/growth-os/*` - checked.

## Stop Point

Phase 7 is complete. Stop here and wait for human approval before Phase 8.
