# HomeReach Running User Action List

This file tracks items that require Jason/admin/vendor action. Engineering can continue unless an item is marked as a direct blocker for the current build phase.

## Current Required Actions

1. Apply Supabase migrations `097` through `102`.
   - Blocks: AI Workforce OS go-live and safe autonomy.
   - Does not block: continued local engineering work.

2. Confirm Vercel environment variables for the Learning Engine.
   - `ENABLE_CONTENT_INTEL`
   - `DISABLE_CONTENT_INTEL_AI`
   - `YOUTUBE_API_KEY`
   - `YT_TRANSCRIPT_API_KEY`
   - `CONTENT_INTEL_CRON_SECRET`
   - Optional: `ANTHROPIC_API_KEY`, `CONTENT_INTEL_DAILY_CAP`
   - Blocks: production Learning Engine ingestion.

3. Keep Learning Engine in review-only mode until credentials and review flow are verified.
   - Recommended launch posture:
     - `ENABLE_CONTENT_INTEL=true`
     - `DISABLE_CONTENT_INTEL_AI=true`
   - Then enable AI extraction only after admin QA.

4. Finish Twilio A2P approval.
   - Blocks: SMS prospecting and higher-volume SMS automation.
   - Does not block: Postmark email workflows, admin dashboards, Action Center, Learning Engine, or Gov Contracts work.

5. Verify Postmark sender identities for inventory/procurement email.
   - Intended senders:
     - Heather
     - Josh
     - Chelsi
     - jason@home-reach.com
   - Confirm Chelsi has replaced Chris anywhere sender lists are configured.

6. Confirm political outreach policy before enabling any production political messaging.
   - Current safe posture: draft-only or human approval.
   - Political replies should notify Jason and pause automation.

7. Confirm Canva/API path when ready.
   - Blocks: Canva as primary design engine.
   - Does not block: current AI Workforce OS foundation.

8. Confirm SAM.gov production sync cadence and alert recipients.
   - Current focus: home services categories like HVAC, landscaping, roofing.
   - SAM.gov key and alert phone were provided, but production behavior should remain monitored.

## App Surface Added

The same class of items now appears inside:

- `/admin/agents` under **Jason Action Required**
- `/admin/agents` under **AI Workforce Go-Live Readiness**
- `/admin/agents` under **Unified AI Command State**
- `/api/admin/ai-orchestration/user-actions`
- `/api/admin/ai-orchestration/go-live`
- `/api/admin/ai-orchestration/command-center`

These panels are generated from agent readiness, missing environment variables, manual blockers, source freshness,
smoke checks, command-state health, and known go-live prerequisites.

## Current Safe Launch Posture

- Public production behavior should remain unchanged until migrations and env setup are confirmed.
- Learning Engine should launch in review-only mode first.
- Political messaging should remain draft-only or human-approved.
- SMS automation should wait for Twilio A2P approval.
- Gov Contracts should remain monitor/review only; no autonomous bids, pricing, certifications, or subcontractor commitments.
- External execution permissions remain disabled by default in the Agent Permission Matrix.
