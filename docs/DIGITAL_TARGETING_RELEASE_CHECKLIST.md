# Neighborhood Digital Targeting Release Notes

## Product

- Public name: Neighborhood Digital Targeting
- Admin name: Digital Targeting Campaign
- Price: $499/month management fee
- Media budget: client-funded ad spend, tracked separately
- Launch posture: manual launch mode by default; API launch remains gated

## Feature Flags

- `ENABLE_DIGITAL_TARGETING=true`
- `ENABLE_GEOFENCE_INTAKE=true`
- `ENABLE_MANUAL_AD_LAUNCH_MODE=true`
- `ENABLE_AD_API_LAUNCH=false` for MVP
- `ENABLE_CLIENT_GEOFENCE_DASHBOARD=true`

If Stripe or ad API credentials are missing, intake and admin fulfillment still work. Checkout degrades into a manual payment-required admin task when `STRIPE_SECRET_KEY` is unavailable.

## Optional API Credentials

- Meta: `META_MARKETING_API_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_BUSINESS_ID`
- Google Ads: `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID`
- Maps/geocoding: `GOOGLE_MAPS_API_KEY`

Authoritative references accounted for:

- Meta Marketing API overview: https://developers.facebook.com/docs/marketing-api/
- Google Ads campaign creation: https://developers.google.com/google-ads/api/docs/campaigns/create-campaigns
- Google Ads location targeting: https://developers.google.com/google-ads/api/docs/targeting/location-targeting
- Google Maps Geocoding API: https://developers.google.com/maps/documentation/geocoding/overview

## Manual Launch Workflow

1. Intake creates `digital_targeting_campaigns`.
2. Locations, assets, checklist tasks, AI drafts, and AI Workforce audit rows are generated.
3. Stripe checkout creates a recurring management subscription when configured.
4. Missing Stripe keys create a manual payment task instead of breaking intake.
5. Admin reviews target areas, ad spend, creative, tracking URL, compliance, and approval state.
6. Admin manually launches Meta/Google/DSP campaigns or marks launch complete.
7. Admin enters metrics manually until API reporting is enabled.
8. Client dashboard shows simple status, target summary, assets, reports, and next steps.

## Production Smoke Test Checklist

- [ ] Existing homepage CTAs still load and route correctly.
- [ ] Existing targeted-mail intake still submits.
- [ ] Existing Stripe checkout flows still work.
- [ ] Existing admin auth still gates `/admin`.
- [ ] `/digital-targeting` loads on mobile and desktop.
- [ ] `/digital-targeting/intake` submits a campaign.
- [ ] Intake creates lead, campaign, locations, tasks, drafts, and asset rows.
- [ ] Missing ad API keys show manual launch mode, not an error.
- [ ] Missing Stripe secret creates a manual payment task, not a failed intake.
- [ ] `/admin/digital-targeting` shows campaign metrics and pipeline.
- [ ] `/admin/digital-targeting/[campaignId]` shows detail, checklist, map preview, drafts, launch plan, assets, and metrics.
- [ ] Checklist checkboxes persist.
- [ ] Draft copy buttons work.
- [ ] Manual metrics entry persists.
- [ ] Stripe webhook marks digital campaigns paid and moves them to target area review.
- [ ] `/dashboard/digital-targeting` loads for the client email/user.
- [ ] Mobile layouts do not overlap or hide CTA controls.

## Compliance Notes

- No individual private identity display.
- No implied surveillance.
- No sensitive-trait targeting.
- No political ideology inference or voter persuasion scoring.
- No lead, sales, visit, ranking, ROI, or savings guarantees.
- No paid ad launch without admin approval.
