# Ad-Tech Integration Layer Service Kit

## Status

The Ad-Tech Integration Layer is production-hardened as an internal operations layer. It supports Market Capture and digital campaign fulfillment by preparing launch packages, draft structures, target validation, approval records, and reporting imports.

It is not sold standalone and it must not launch paid ads automatically.

## Live Surfaces

- Client launch status: `/dashboard/campaign-launch`
- Admin integration health: `/admin/ad-tech`
- Launch package feed: `/api/ad-tech/launch-packages`
- Admin sync: `/api/admin/ad-tech/sync`
- Admin reporting import: `/api/admin/ad-tech/reporting-imports`
- Approval/action route: `/api/ad-tech/actions`
- Live smoke: `pnpm smoke:ad-tech`

## Database Tables

- `campaign_drafts`
- `campaign_geocodes`
- `campaign_target_validation`
- `campaign_launch_packages`
- `campaign_approvals`
- `campaign_launch_history`
- `campaign_reporting_imports`
- `campaign_attribution`
- `integration_health`

All tables are additive, RLS-enabled, and service-role/admin/client scoped through policy and guarded server routes.

## Operating Workflow

1. Market Capture campaign exists.
2. Admin sync prepares campaign drafts, target validation, approval rows, integration health, and launch packages.
3. Client reviews simple launch status and approval items.
4. Admin reviews target area, creative, budget, tracking, client approval, and launch readiness.
5. Admin records manual launch completion only after human review.
6. Admin enters manual reporting metrics until future API imports are enabled.
7. AI COO and Business Memory can use reports and launch history for future recommendations.

## Safety Rules

- No automatic paid campaign launch.
- No automatic ad spend.
- No automatic creative publishing.
- No platform submission without explicit admin approval.
- No attribution certainty unless source data proves it.
- Missing Meta, Google, or Maps credentials degrade to manual mode.
- Client actions cannot mark a package ready or record a manual launch.

## Feature Flags

- `ENABLE_META_DRAFTS`
- `ENABLE_GOOGLE_DRAFTS`
- `ENABLE_GEOCODING`
- `ENABLE_TARGET_VALIDATION`
- `ENABLE_REPORTING_IMPORTS`
- `ENABLE_ATTRIBUTION_LAYER`
- `ENABLE_LAUNCH_PACKAGES`
- `ENABLE_INTEGRATION_HEALTH`
- `ENABLE_AD_API_LAUNCH`
- `ENABLE_MANUAL_AD_LAUNCH_MODE`

Recommended production posture:

- `ENABLE_MANUAL_AD_LAUNCH_MODE=true`
- `ENABLE_AD_API_LAUNCH=false`

## Optional Credentials

- `META_ACCESS_TOKEN` or `META_MARKETING_API_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `GOOGLE_ADS_CUSTOMER_ID`
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID`
- `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_MAPS_API_KEY`

These credentials are optional for the MVP. The system should keep working in manual mode when they are absent.

## Result Tracking

Track:

- Drafts created
- Target validation status
- Launch packages created
- Launch package readiness score
- Client approvals
- Admin approvals
- Manual launch records
- Reporting imports
- Impressions, reach, clicks, spend, leads, calls, forms, landing page visits, QR scans
- Cost per click and cost per lead when available
- Attribution notes and confidence

## Rollback

If the layer causes production issues:

1. Disable the affected feature flags.
2. Keep Market Capture running in manual fulfillment mode.
3. Remove `/api/ad-tech/launch-packages` from service catalog smoke expectations if needed.
4. Do not drop tables in production. Use a reviewed forward migration if schema rollback is required.
5. Previous Vercel production deployment can be promoted or rolled back through Vercel if route behavior regresses.

## Known Boundaries

- This is an operations layer, not a direct API launch system.
- Meta and Google API launch remains future work.
- Reporting import is manual/API-ready, but API imports are not enabled in this production-hardening pass.
- Geocoding currently validates existing location data and manual geography quality; it does not auto-call external geocoding by default.
