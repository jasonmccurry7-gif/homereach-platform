# DESIGN_PIPELINE_GAP.md

> Investigation: how much of the postcard design pipeline is automated, what's missing, and the smallest-first build plan to close the loop.
> Generated 2026-04-30, after Migration 075 hotfix shipped.

---

## TL;DR

**HomeReach is ~30% automated, ~70% manual** for the design step today. Customers can pay and get to "intake submitted" automatically; everything from there to "postcard goes in the mail" is manual or doesn't exist. The good news: the ad-engine itself works — it's the **plumbing around it** that's missing. Closing the loop is a series of small, well-bounded changes, not a rebuild.

---

## What runs automatically today

### After payment (`apps/web/app/api/webhooks/stripe/route.ts`)
1. Spot marked active in `spot_assignments` (line 278-318)
2. Business marked active in `businesses`
3. `intake_submissions` row created with unique `access_token` (line 341-361)
4. `marketing_campaigns` row auto-created with `status='upcoming'`, `nextDropDate=+14 days`, `renewalDate=+30 days` (line 196-223)
5. Customer emailed two things: Supabase invite (lands on `/intake/<token>`) + a separate "Welcome — complete setup" email with the intake link

### When admin opens the ad-designer (`apps/web/app/(admin)/admin/ad-designer/`)
The `ad-engine` (`apps/web/lib/ad-engine/`) generates real ad copy and layout in milliseconds:
- `CopyGenerator.generate()` (`copy-generator.ts:58-100`) — picks headline, subheadline, offer, CTA, tagline, badge from category templates (plumbing, HVAC, roofing, etc.)
- `LayoutEngine` (`layout-engine.ts:27-91`) — builds the visual schema (positioning, spacing, typography) for anchor / front / back spots
- `DesignEngine.generate()` (`design-engine.ts:39-61`) — combines copy + layout into a `GeneratedAd`
- `generateVariants()` produces 3 A/B variants per business in one call

**Important:** the engine is **deterministic** — pure templates. It does NOT use AI today, despite `lib/ai/llm.ts` existing.

---

## What's manual or unbuilt

### Manual today
1. Admin reviews submitted intake at `/admin/intake` — sees customer's `serviceArea`, `targetCustomer`, `keyOffer`, `differentiators`. Clicks "Mark Reviewed."
2. Admin opens `/admin/ad-designer` **separately** — a totally disconnected tool. Has to **re-type** the customer's name, category, offer.
3. Admin generates 3 variants, edits copy, picks one, clicks "Approve."
4. The approved design lives **only in browser state**. There is no database record of any approved ad. Closing the tab loses it.
5. Admin presumably screenshots / exports manually, then... does what? (No print pipeline exists.)

### Not built at all
- **No `design_status` / `design_assets_jsonb` / `design_url` columns** on `marketing_campaigns` (schema confirmed at `packages/db/src/schema/marketing.ts:36-69`)
- **No trigger** when intake → `status='submitted'` to auto-generate ad variants
- **No save endpoint** from `/admin/ad-designer` to persist approved designs
- **No PDF generation** (puppeteer / canvas / etc.)
- **No print vendor integration** — no USPS EDDM API, no print-on-demand vendor wired up
- **No "approved → sent to print → printed → mailed" status progression**
- **No campaign metrics ingestion** beyond manual entry — `/admin/campaigns/[id]/metrics-entry-form.tsx` is admin typing in homes-reached / scans / leads by hand
- **`roi-preview/page.tsx`** has a `TODO: Replace with real query` — ROI dashboard is mocked

---

## Build plan, prioritized smallest-first

### Phase 1 — Save approved designs to the database
**Why first:** smallest blast radius, biggest leverage. You stop losing design work the moment someone closes a tab.

- Migration `076_marketing_campaigns_design_fields.sql`:
  ```sql
  ALTER TABLE marketing_campaigns
    ADD COLUMN IF NOT EXISTS design_status text DEFAULT 'pending'
    CHECK (design_status IN ('pending', 'auto_generated', 'in_review', 'approved', 'rejected', 'sent_to_print', 'printed', 'mailed'));
  ALTER TABLE marketing_campaigns
    ADD COLUMN IF NOT EXISTS design_payload_json jsonb;
  ALTER TABLE marketing_campaigns
    ADD COLUMN IF NOT EXISTS design_approved_at timestamptz;
  ALTER TABLE marketing_campaigns
    ADD COLUMN IF NOT EXISTS design_approved_by uuid REFERENCES users(id);
  ```
- Update Drizzle schema in `packages/db/src/schema/marketing.ts` to match
- Update `/admin/ad-designer` to:
  - Accept `?campaignId=...` query param → load `design_payload_json` if present
  - On "Approve," POST to `/api/admin/campaigns/[id]/design` to save + set `design_status='approved'`
- New route: `apps/web/app/api/admin/campaigns/[id]/design/route.ts` (POST + GET)

**Effort:** 2-4 hours. **Risk:** very low. **Value:** approved designs become persistent and queryable; you can list "approved but not yet sent to print" campaigns.

---

### Phase 2 — Auto-generate variants when intake is submitted
**Why second:** removes the manual re-typing step. Admin opens an intake, the design is already pre-populated.

- Modify `POST /api/intake/[token]` (`apps/web/app/api/intake/[token]/route.ts`):
  - After setting `status='submitted'`, look up the related `marketing_campaigns` row
  - If `design_status='pending'`, call `DesignEngine.generateVariants(business)` with the intake fields fed in as context
  - Save 3 variants to `design_payload_json` and set `design_status='auto_generated'`
- Update `/admin/intake/intake-queue-client.tsx` to show a "Review design" button next to each submitted intake, linking to `/admin/ad-designer?campaignId=...`
- Update `/admin/ad-designer` to load Phase 1's saved variants on entry

**Effort:** 3-5 hours. **Risk:** low (intake POST is already a hot path; adding a non-blocking generate is safe). **Value:** removes the worst piece of manual re-typing; admin sees pre-populated design ready to review.

---

### Phase 3 — Use intake answers to drive AI-assisted copy (optional)
**Why third:** the Phase 1+2 result still uses category templates, which won't reference the customer's specific offer or differentiators. AI-assist would produce copy that mentions their actual service area, offer, USP.

- Replace `CopyGenerator.generate()` with a call to `lib/ai/llm.ts` that takes `{ businessName, category, serviceArea, targetCustomer, keyOffer, differentiators }` and returns headline/offer/CTA/badge
- Keep the template engine as a fallback (if AI fails or is rate-limited)
- Add a feature flag: `ENABLE_AI_COPY_GENERATION` so you can roll back instantly

**Effort:** 4-6 hours. **Risk:** medium (AI quality varies; needs human review every time). **Value:** copy that's actually personalized to the customer, instead of generic category templates. Often the difference between "looks templated" and "feels custom."

**Cost:** OpenAI calls per design. With `gpt-4o-mini` or similar, ~$0.001-0.005 per ad — negligible.

---

### Phase 4 — Print vendor integration
**Why fourth:** the biggest unknown. Picking a vendor depends on your volume, geography, EDDM eligibility, and who your printer is today.

Steps:
1. Decide vendor. Options:
   - **USPS EDDM Online** — direct, but limited automation
   - **Print Services Inc / 4OVER** — wholesale, has APIs
   - **Vistaprint API** — easy, but margin is bad
   - **Local Akron print shop** — manual upload, lowest tech effort
2. Add migration columns: `design_pdf_url`, `vendor_order_id`, `printed_at`, `mailed_at`
3. Build a PDF generator (puppeteer rendering the design schema → PDF, stored in Supabase Storage or S3)
4. Build `/api/admin/campaigns/[id]/send-to-print` route
5. Wire vendor's webhook to update `printed_at` and `mailed_at`

**Effort:** 8-20 hours, mostly vendor-dependent. **Risk:** high — every vendor has different file specs (CMYK vs RGB, bleed margins, DPI). **Value:** closes the loop entirely. You stop manually wrangling files.

---

### Phase 5 — Operator dashboard
**Why last:** nice-to-have, makes the operations scalable.

- New page: `/admin/design-queue` showing campaigns grouped by `design_status`
- Bulk actions: "approve N at once," "send batch to print," etc.
- ROI dashboard fix: replace the `TODO` in `roi-preview/page.tsx` with a real query against `campaign_metrics`

**Effort:** 3-4 hours. **Value:** helps when you're running 50+ campaigns simultaneously. Skip until you're past 20.

---

## Quick-win order (do these in this sequence)

1. **Phase 1** (save designs) — ship this first, alone. Even with everything else manual, you stop losing design work.
2. **Phase 2** (auto-generate on intake) — ship next. Admin's daily workflow gets dramatically faster.
3. **Pause and use the system for a week.** See where the actual operational pain is.
4. Then either Phase 3 (AI copy) or Phase 4 (print vendor) — depending on which is hurting more.
5. Phase 5 last, when scale demands it.

---

## What I'm NOT recommending

- **Don't replace the ad-engine.** It works. The templates are fine for now. The plumbing is the problem, not the engine.
- **Don't build a custom design tool.** `/admin/ad-designer` is good enough; just connect it to the database.
- **Don't pick a print vendor today.** Phase 4 is at least a month of operational learning away. Phase 1+2 give you the data you need to pick a vendor smartly.

---

## Risks to flag

- **Brand consistency:** template-based design means all postcards look similar. Phase 3 (AI copy) helps differentiate. Visual variety would require more layout templates per category.
- **Compliance:** every category has industry-specific claims rules (medical, legal, financial, real estate). The current copy templates don't gate by category. Worth a separate audit before scaling.
- **Missing schema drift:** we found 3 instances of code-vs-prod schema drift while shipping the intake/checkout hotfix. Before building any of Phase 1, do a full Drizzle-vs-prod schema audit so the new columns + tables actually land where the code expects them.

---

## Pointers (file:line) for engineering when starting Phase 1

- Marketing schema: `packages/db/src/schema/marketing.ts:36-69`
- Ad designer entry point: `apps/web/app/(admin)/admin/ad-designer/ad-designer-client.tsx`
- Design engine public API: `apps/web/lib/ad-engine/index.ts`
- Existing intake review page: `apps/web/app/(admin)/admin/intake/page.tsx`
- Webhook campaign creation: `apps/web/app/api/webhooks/stripe/route.ts:196-223`
- Type definitions: `apps/web/lib/ad-engine/types.ts:159-184` (already has `AdExportSchema`)
