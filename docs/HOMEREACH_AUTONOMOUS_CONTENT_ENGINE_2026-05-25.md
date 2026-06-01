# HomeReach Autonomous Content Engine Audit and Implementation Report

Date: 2026-05-25

## Executive Summary

HomeReach already has a strong foundation for an AI-assisted social content operating system. The safest path is not a duplicate dashboard or a blind rebuild. The existing Daily AI Video Content Engine, Content Intel, AI Assets, AI Workforce, Canva orchestration, Growth Engine, and revenue approval systems should be preserved and connected into one approval-gated content production loop.

This pass implemented a focused, modular upgrade to the existing Daily Content Center:

- Added an Autonomous Content OS command layer for trend/script/video/publish visibility.
- Added a mobile-first publish kit with one-tap copy actions for export briefs, captions, hashtags, and CTAs.
- Added per-platform publishing cards with status, platform launch links, live URL/post ID capture, and manual posting actions.
- Added server-side approval enforcement before daily content can be scheduled or marked published.
- Added a per-platform update API so Facebook, Instagram, TikTok, LinkedIn, and YouTube can move independently through the manual queue.
- Preserved human approval, manual publishing, protected flows, and existing backend systems.

No live auto-publishing was added. The system remains review-first.

## Pass 1 - Content Operations Audit

What exists:

- Daily video generation, platform captions, storyboard preview, Canva prompt prep, approval states, metrics table, and activity log.
- Content Intel ingestion, pattern learning, competitor/source tracking, and outcome feedback tables.
- AI Assets and AI Workforce tables for reusable outputs, reviews, verification, tasks, and activity.
- Canva dry-run/review-first orchestration.
- Growth Engine and Blotato integration foundations.
- Revenue messaging approval patterns that are stricter than some older social routes.

Key risks found:

- Cron ownership is split between root and app-level Vercel config.
- Some older Facebook/social paths do not consistently require persisted per-output approval.
- Blotato scheduling should not trust caller-supplied approval booleans.
- Daily content metrics exist but are not yet hydrated by platform performance imports.
- There is no canonical reusable content asset library table yet.
- Approval status vocabulary is fragmented across Daily Content, AI Assets, AI Workforce, SEO, Content Intel, Revenue Ops, and social routes.

## Pass 2 - Implemented Improvements

Implemented files:

- `apps/web/components/daily-content/daily-content-center.tsx`
- `apps/web/lib/daily-content/repository.ts`
- `apps/web/lib/daily-content/types.ts`
- `apps/web/app/api/admin/daily-content/[videoId]/platform-posts/[postId]/route.ts`

Implemented capabilities:

- Autonomous Content OS overview for concepts, hooks, scenes, readiness, quality governance, and content library loop.
- Mobile publish kit with one-tap copy for export brief, caption, hashtags, and CTA.
- Platform-specific manual publishing cards with:
  - platform status
  - recommended posting time
  - copy caption
  - copy hashtags
  - copy CTA
  - open platform link
  - live post URL field
  - external post ID field
  - mark ready
  - mark scheduled
  - mark posted with proof
  - reset
- Confirmation prompts for approve/revise/reject.
- Server-side block on scheduling unless the video is approved.
- Server-side block on video-level mark-published shortcut.
- Per-platform mark-published requires a public URL or platform post ID.
- Activity log entries for blocked and successful platform actions.
- Platform rollup updates video status to scheduled/published when platform rows support it.

Continuation implemented:

- Added canonical content engine migration for `content_assets`, `content_asset_versions`, `content_asset_sources`, `social_publication_records`, `social_post_metrics_daily`, and `content_learning_events`.
- Added shared social publishing guard for Daily Content, AI Outputs, Facebook messages, manual posting, and Blotato scheduling.
- Hardened Blotato live scheduling so live mode requires persisted approved source content instead of caller-supplied approval booleans.
- Hardened Facebook draft sending so draft sends require persisted approval and no longer self-approve as a side effect of sending.
- Added canonical publication record sync for Daily Content platform posts.
- Added social metrics import API for platform metrics, daily video metrics, publication metrics, and learning events.
- Added `/admin/content-review` as a mobile-first unified review queue inside the existing admin ecosystem.
- Added Content Review to admin navigation and mobile quick-access navigation.

Continuation 2 implemented:

- Growth Engine now loads approved Daily Content platform posts and verified AI Outputs as selectable Blotato scheduling sources.
- Growth Engine Blotato dry-runs now send source IDs instead of a disconnected sample payload.
- Facebook webhook replies now queue approval-required drafts first; auto-send attempts are blocked unless the exact draft has persisted approval.
- Facebook comment reply/DM automation now creates approval-required drafts instead of sending directly from the webhook.
- Facebook follow-up cron now queues deduped approval-required drafts instead of directly sending follow-up DMs.
- Added provider metrics sync scaffold at `/api/admin/social-content/metrics/sync` for future Meta/TikTok/LinkedIn/YouTube/Blotato importers.

Continuation 3 implemented:

- Added explicit Facebook draft approve/reject actions with platform audit logging.
- Updated the Facebook admin inbox so pending drafts can be approved or rejected, and only approved drafts expose the send action.
- Added Facebook drafts to `/admin/content-review` so social replies appear in the unified mobile review queue.
- Connected Daily Content generation to approved Content Intel and verified AI Assets as source context.

Continuation 4 implemented:

- Added inline mobile action controls to `/admin/content-review` for Daily Content approvals, revision requests, Facebook draft approval/rejection, and approved Facebook DM send handoff.
- Kept external sends behind the same persisted approval and shared social publish guard.
- Added Blotato account/page destination selection and explicit schedule mode/time controls to Growth Engine.
- Updated Blotato dry-run payload preparation to include approved source IDs, destination account/page, and either next-free-slot or a specific scheduled time.

Continuation 5 implemented:

- Added AI Assets inline controls to `/admin/content-review` using the existing AI Assets action API.
- AI artifact approval remains artifact-scoped only and explicitly does not approve sending, publishing, submitting, charging, pricing changes, campaign changes, or spend commitments.
- Added AI artifact revise/reject and approved+verified "Mark Winner" actions to the unified mobile review queue.
- Added revenue-message draft copy and approved-email send controls to `/admin/content-review`.
- Revenue email sending still uses the existing guarded route with approval status, global/channel pause, deliverability, reputation, sender identity, daily limit, outbound ledger, and audit-log checks.

Continuation 6 implemented:

- Added a normalized revenue-message approve/reject API at `/api/admin/revenue-messaging/approvals/[approvalId]`.
- Revenue draft approval is now an explicit human review action that does not send email, SMS, Facebook DMs, social posts, change pricing, charge customers, change campaigns, or commit spend.
- Rejections now record review metadata and platform audit events without triggering outbound systems.
- `/admin/content-review` can now approve/reject pending revenue drafts inline, then expose send only after the existing approved-email guard allows it.
- `/admin/revenue-operations` now reuses the same approve/reject route so the canonical revenue dashboard and unified review queue behave consistently.

Go-live continuation implemented:

- Applied the additive remote Supabase migrations:
  - `20260525032951_content_engine_library_publication_learning.sql`
  - `20260525041000_waitlist_product_intent.sql`
- Verified remote presence of `content_assets`, `content_asset_versions`, `social_publication_records`, `social_post_metrics_daily`, `content_learning_events`, and `waitlist_entries.product_intent`.
- Deployed and smoke-tested a Vercel preview deployment:
  - `https://homereach-platform-bmrzwuelj-jason-mccurrys-projects.vercel.app`
- Deployed production:
  - Deployment id `dpl_FzjWqTFgyVYMcVEjxytNDJbc1Mg4`
  - Production alias `https://www.home-reach.com`
- Live smoke tests passed for public product pages, admin redirects, and protected admin APIs.

Post-go-live continuation implemented:

- Added a compact provider-readiness panel to `/admin/content-review`.
- The review queue now surfaces Arvow, Blotato, and RSS/CMS readiness, including mode, API readiness, publish gating, and missing configuration notes without exposing secret values.
- This gives operators go-live execution visibility from the daily approval queue instead of requiring a separate Growth Engine check.
- Deployed the provider-readiness continuation from validated preview to production:
  - Preview deployment `dpl_5GiyFD9TW1cCJu2fMRdE9Ud2yuVV`
  - Production deployment `dpl_BxHWf7RV5AC9FsA6kp6RsAtwKnRH`
  - Production alias `https://www.home-reach.com`
- Re-ran live smoke checks after promotion; public product pages, admin redirects, and protected admin APIs passed.
- Final cleanup deployment removed the temporary local `any` type warnings introduced during the React type compatibility fix:
  - Preview deployment `dpl_GxwfFdfo6ziQ7DKR19Qd6EAjnaom`
  - Current production deployment `dpl_81JLxNcVEpSyHx3GMpASHKmaVMca`
  - Production alias `https://www.home-reach.com`
- The final live smoke check passed after production moved to `dpl_81JLxNcVEpSyHx3GMpASHKmaVMca`.

Enhancement continuation implemented:

- Added a mobile-first command priority layer to `/admin/content-review`.
- The unified review queue now groups work into operational lanes:
  - blocked
  - needs approval
  - ready to send
  - ready to publish
  - learning signals
- Added next-action and guardrail copy to each queue item so operators can move faster without confusing approval with outbound execution.
- Added a sticky mobile command bar for the queue, provider readiness, and Daily Content shortcuts.
- Added a Vercel cron entry for `/api/admin/social-content/metrics/sync`.
- The social metrics sync route now supports GET and POST so it can run from Vercel Cron or manual admin/API execution.
- This remains analytics-only: no social posts, DMs, emails, payments, pricing changes, or campaign changes are triggered by the sync.
- Deployed this enhancement continuation from validated preview to production:
  - Preview deployment `dpl_EVsVMG3okG2XkTFnuPDJPCPqupo9`
  - Current production deployment `dpl_F3mBnxUbyxSjcdeaPRA4oqDfMr3W`
  - Production alias `https://www.home-reach.com`

## Pass 3 - Executive Superiority Review

Kept because superior:

- Existing Daily Content Center as the command surface.
- Existing AI Assets, AI Workforce, Content Intel, Canva, and Growth Engine foundations.
- Existing human approval requirement.
- Existing manual fallback publishing model.

Rejected for this pass:

- Fully autonomous publishing.
- New duplicate dashboard.
- New external video dependencies.
- Broad Facebook/Blotato rewrites without a shared approval contract.
- Heavy animations or production-risk UI complexity.

Why the change is superior:

- Faster mobile posting without weakening approval gates.
- More operational visibility without moving users out of the existing admin system.
- Platform-specific workflow instead of forcing TikTok, Facebook, Instagram, LinkedIn, and YouTube through one shared state.
- Better auditability through platform post proof fields and activity logs.
- Safer publishing posture because video-level shortcuts are blocked.

## Recommended Target Architecture

Layer 1 - Discovery and Trend Intelligence:
Use Content Intel patterns, market signals, competitor sources, local business topics, and AI Assets context to inform daily drafts.

Layer 2 - Script and Hook Generation:
Keep generated hooks, voiceover, scripts, CTAs, emotional tone, and platform variants in Daily Content and AI Outputs.

Layer 3 - Visual Asset and Video Generation:
Use Canva jobs/export records, AI image prompts, storyboard metadata, and dashboard screenshots. Keep production review-first.

Layer 4 - Video Assembly and Editing:
Use 9:16 storyboard, captions, transitions, outro spec, and export package as the production handoff.

Layer 5 - Voiceover and Audio:
Add ElevenLabs or similar only after voice approvals, identity rules, and asset storage are clear.

Layer 6 - Virality and Optimization:
Feed watch time, completion, DMs, leads, comments, saves, shares, and CTA performance into a learning event layer.

Layer 7 - Publishing and Distribution:
Use a shared approval guard before any live scheduler. Default mode should remain review-only until persisted approvals, content hashes, account selection, and audit logging are centralized.

## Remaining Risks

Critical:

- Keep live Facebook auto-send disabled until account ownership, Meta rate limits, send windows, and approval handoff are validated in staging.
- Blotato now requires persisted source content for live scheduling, and Growth Engine dry-runs pass source IDs plus selected destination/timing. The remaining work is live credential validation and staging account tests.

High:

- New canonical content/publication/metrics tables are applied and remotely verified; staging data QA and Supabase advisors are still pending.
- Metrics import API exists, but platform provider polling jobs still need to be connected.
- Provider metrics sync is now cron-owned, but actual provider-specific metric importers still need API credentials, rate-limit policy, and mapping.
- Cron scheduling ownership is partially centralized in `apps/web/vercel.json`; remaining review should reconcile any legacy external scheduler ownership.

Medium:

- Daily Content now stores approved Content Intel and verified AI Assets as generation context, but performance-learning feedback still needs weighting rules before it influences future drafts.
- AI Workforce approval discipline should match AI Assets verification discipline.
- `/admin/content-review` now has inline controls for Daily Content, Facebook drafts, AI Assets, pending revenue drafts, and already approved revenue emails.

## Rollback Documentation

Rollback is contained:

- Remove the new platform post API route.
- Remove the social metrics import API route.
- Remove the Content Review admin route and nav link.
- Revert Daily Content Center UI additions.
- Revert repository approval guard additions only if an emergency requires restoring old status behavior.
- Revert the `external_post_id` TypeScript field addition if schema typings are regenerated differently.
- Revert new content engine schema only with a forward migration because the additive tables have been applied to the shared remote environment.

Two additive database migrations were added and applied in the continuation pass.
No protected payment, auth, intake, campaign, procurement, webhook, Stripe, Twilio, or email flow was changed.

## Verification

- TypeScript app build check passed:
  - `node ..\..\node_modules\typescript\bin\tsc --noEmit -p tsconfig.app-build.json`
- Production build passed:
  - `pnpm build`
- Vercel preview deployment passed hosted smoke checks:
  - `/`, `/shared-postcards`, `/targeted`, `/political`, `/inventory-purchasing`, `/property-intelligence`, `/login` returned `200`.
  - `/admin/content-review`, `/admin/revenue-operations`, `/admin/growth-engine`, `/admin/facebook` returned `307` unauthenticated.
  - Admin APIs returned `401` unauthenticated, including the new revenue approve/reject route.
- Provider-readiness preview deployment passed hosted smoke checks:
  - Deployment `dpl_5GiyFD9TW1cCJu2fMRdE9Ud2yuVV`
  - `https://homereach-platform-ogyw75d3q-jason-mccurrys-projects.vercel.app`
  - Same public, admin redirect, and protected API checks passed.
- Final cleanup preview deployment passed hosted smoke checks:
  - Deployment `dpl_GxwfFdfo6ziQ7DKR19Qd6EAjnaom`
  - `https://homereach-platform-f124lk8zs-jason-mccurrys-projects.vercel.app`
  - Same public, admin redirect, and protected API checks passed.
- Enhancement continuation local checks passed:
  - `node ..\..\node_modules\typescript\bin\tsc --noEmit -p tsconfig.app-build.json`
  - `pnpm build`
  - Build warnings remained pre-existing/non-blocking.
- Enhancement continuation preview and live checks passed:
  - Preview deployment `dpl_EVsVMG3okG2XkTFnuPDJPCPqupo9`
  - Production deployment `dpl_F3mBnxUbyxSjcdeaPRA4oqDfMr3W`
  - Public product pages returned `200`.
  - Admin pages returned `307` unauthenticated.
  - Protected admin APIs returned `401` unauthenticated, including GET and POST for `/api/admin/social-content/metrics/sync`.
  - Browser check confirmed `/admin/content-review` redirects unauthenticated users to `/login?redirect=%2Fadmin%2Fcontent-review`.
- Production deployment passed live smoke checks on `https://www.home-reach.com`:
  - Current production deployment `dpl_F3mBnxUbyxSjcdeaPRA4oqDfMr3W`
  - `/`, `/shared-postcards`, `/targeted`, `/political`, `/inventory-purchasing`, `/property-intelligence`, `/login` returned `200`.
  - `/admin/content-review`, `/admin/revenue-operations`, `/admin/growth-engine`, `/admin/facebook` returned `307` unauthenticated.
  - Admin APIs returned `401` unauthenticated, including the new revenue approve/reject route.
- Local dev server route smoke passed:
  - `/admin/daily-content` returned `307` to `/login?redirect=%2Fadmin%2Fdaily-content` when unauthenticated.
  - `/admin/content-review` returned `307` to `/login?redirect=%2Fadmin%2Fcontent-review` when unauthenticated.
  - `/api/admin/social-content/metrics` returned `401` when unauthenticated.
  - `/admin/growth-engine` returned `307` to `/login?redirect=%2Fadmin%2Fgrowth-engine` when unauthenticated.
  - `/api/admin/social-content/metrics/sync` returned `401` when unauthenticated.
  - `/admin/facebook` returned `307` when unauthenticated.
  - `/api/admin/facebook?view=execution` returned `401` when unauthenticated.
  - `/api/admin/growth-engine/integrations/status` returned `401` when unauthenticated.
- Remote Supabase migration verification completed via CLI:
  - `20260525032951_content_engine_library_publication_learning.sql`
  - `20260525041000_waitlist_product_intent.sql`
  - Verified remote tables/columns: `content_assets`, `content_asset_versions`, `social_publication_records`, `social_post_metrics_daily`, `content_learning_events`, and `waitlist_entries.product_intent`.
- Local Supabase migration verification was attempted:
  - `supabase migration list --local`
  - Result: local Postgres was not running on `127.0.0.1:54322`, so database-level migration verification could not complete.
- Authenticated visual QA was not completed because no admin browser session/test account was available in the local run.

## Next Phase

1. Run Supabase advisors and authenticated staging/data QA against the applied content-library migrations.
2. Run Blotato staging account tests with real connected accounts while keeping `SOCIAL_PUBLISHING_MODE` review-only or staging-only.
3. Add provider-specific polling/import implementations for TikTok, Meta, LinkedIn, YouTube, and Blotato metrics.
4. Add authenticated browser QA for the Content Review queue, Revenue Operations queue, and Growth Engine integration panel with a production admin session.
5. Connect performance-learning feedback to content generation with strict approved-signal weighting.
6. Reconcile remaining cron ownership against any legacy external scheduled tasks and document the owner for each job.
