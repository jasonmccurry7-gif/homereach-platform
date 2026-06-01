# HomeReach AI Creative Production Studio

## What Was Added

AI Creative Production Studio is an additive admin module at `/admin/creative-studio`.

It creates review-ready creative drafts for:

- Shared postcard campaigns
- Targeted mail campaigns
- Political mail campaigns
- Inventory and procurement promotions
- Government contract workflow promotions
- Facebook group posts
- DM follow-up assets
- Short-form video ads
- UGC-style ads
- Local business promo videos
- Candidate and campaign explainer videos
- Before/after home-service concepts

The module does not replace AI Assets, Daily Content, Canva, campaign dashboards, outreach, payment, auth, or fulfillment systems. It links conceptually to those systems and keeps all generated creative in a human approval queue.

## Route

- Admin UI: `/admin/creative-studio`
- Admin API: `/api/admin/creative-studio`

Both use the existing admin auth model. The API requires the user role to be `admin`.

## Feature Flag

Runtime flag:

```env
CREATIVE_STUDIO_ENABLED=true
```

Database safety registry flag:

```text
creative_studio_enabled
```

The migration inserts the flag into `platform_feature_flags` when that table exists. If `CREATIVE_STUDIO_ENABLED=false`, the API blocks generation even if the route is visible.

## Database Tables

Migration:

```text
supabase/migrations/20260526083000_ai_creative_production_studio.sql
```

Tables:

- `creative_brand_kits`
- `creative_prompt_templates`
- `creative_assets`
- `creative_asset_reviews`
- `creative_generation_logs`
- `creative_automation_rules`

All tables have RLS enabled with service-role access and admin-only authenticated access.

## Approval Model

Generated assets are stored with:

- `status = awaiting_review`
- `approval_status = needs_review`
- `compliance_review_status = needs_review` for political/candidate creative
- `saved_to_campaign = false`
- `winning_asset = false`

Human approval is required before:

- Posting
- Sending
- Publishing
- Attaching to outreach
- Using in paid ads
- Using political creative
- Using government contract claims
- Using procurement savings claims

Approval inside Creative Studio only approves the creative record. Destination workflows still enforce their own rules.

## Provider Adapter

Provider abstraction:

```text
apps/web/lib/creative-studio/provider-adapter.ts
```

Interface:

```ts
interface CreativeProviderAdapter {
  providerKey: string;
  displayName: string;
  connectionStatus(): CreativeProviderStatus;
  generate(request: CreativeProviderRequest): Promise<CreativeProviderResult>;
}
```

Default provider:

```env
CREATIVE_PROVIDER=mock
```

The mock provider creates structured scripts, scenes, captions, quality review metadata, and database records without calling external services.

## Connecting Higgsfield MCP Later

Do not put MCP credentials or API keys in frontend code.

Suggested server-side environment variables:

```env
CREATIVE_PROVIDER=higgsfield_mcp
HIGGSFIELD_MCP_COMMAND=
CREATIVE_PROVIDER_MCP_WORKDIR=
```

Implementation steps:

1. Add a new adapter class that implements `CreativeProviderAdapter`.
2. Execute the MCP/CLI only on the server from `provider-adapter.ts`.
3. Pass structured fields from `CreativeProviderRequest`: prompt, script, storyboard, platform, asset type, and brand kit metadata.
4. Store only safe response metadata in `creative_generation_logs.response_payload`.
5. Store provider job IDs, file URLs, and thumbnails in `creative_assets`.
6. Keep failed provider runs in `creative_generation_logs` with `status = failure`.
7. Never return provider secrets to the client.
8. Keep all outputs in `approval_status = needs_review` until a human approves.

## Political Safeguards

Political templates and generated assets must:

- Use geography, public race context, campaign-provided data, cost, timing, logistics, and route planning only.
- Avoid inferred voter beliefs.
- Avoid persuasion scoring.
- Avoid ideology-based segmentation.
- Avoid unsupported claims.
- Require compliance review before use.

## Rollback

To disable without removing code:

```env
CREATIVE_STUDIO_ENABLED=false
```

Or update `platform_feature_flags.creative_studio_enabled` to disabled/paused.

To remove persistence, rollback the migration by dropping:

- `creative_generation_logs`
- `creative_asset_reviews`
- `creative_assets`
- `creative_automation_rules`
- `creative_prompt_templates`
- `creative_brand_kits`

This module is additive and does not alter payment, auth, campaign, outreach, webhook, or procurement fulfillment tables.

