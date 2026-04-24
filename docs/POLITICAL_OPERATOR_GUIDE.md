# HomeReach — Political Command Center: Operator Runbook

Practical end-to-end guide for running the Political Command Center inside
HomeReach. Written for the founder/owner and any future sales hire. Not for
engineers — no code lives here beyond copy-pasteable SQL.

Companion: the spec + build reports under this repo's session history describe
the architecture. This file is what you actually use day-to-day.

---

## 0. Hard rules (memorize these)

HomeReach **does not** and will **not**:

- Infer political beliefs, ideology, or partisan leanings
- Score individual voters or predict turnout
- Build persuasion or voter-targeting models
- Segment people by political behavior
- Identify or label "swing voters"
- Track or record phone calls
- Store voter-file data

HomeReach **does**:

- Direct mail execution (print, presort, delivery)
- Geographic logistics (county / city / district / ZIP aggregates only)
- Campaign CRM for the candidates and staff we sell to
- Quote → proposal → payment → contract → fulfillment

If a prospect asks for something on the "does not" list, it's a polite no.
Contract clause 5 (Data & Privacy) is the written commitment the client signs.

---

## 1. Access + environment

### Who sees what

| Role | Can view | Can write |
| --- | --- | --- |
| `admin` | Everything in `/admin/political` | Everything |
| `sales_agent` | All candidates + campaigns (read) | Campaigns they own; outreach on any candidate |
| `client` | Nothing in admin | Their own `/p/[token]` proposal + `/c/[token]` contract |
| unauthenticated | `/p/[token]` and `/c/[token]` when they have the token | Approve / decline / sign / pay |

Role is stored in `profiles.role` and mirrored to JWT claim `user_role` via
the signup trigger. Middleware enforces `/admin/*` role gating.

### Feature flag

The entire Political Command Center is gated behind `ENABLE_POLITICAL`. The
first time you ship this to production, set the flag in Vercel:

```
Vercel → Project → Settings → Environment Variables
  Key:   ENABLE_POLITICAL
  Value: true
  Scope: Production
Redeploy.
```

When the flag is **off**:
- `/admin/political*` routes return 404
- The admin nav hides the "Political" entry
- `/p/[token]` and `/c/[token]` return 404
- Outreach / proposal / contract actions throw

When the flag is **on**, everything in this guide works.

### Migrations to apply (in order)

Apply these via the Supabase SQL editor. Already applied to prod as of
go-live; re-running is safe (all idempotent).

Note: these files were originally numbered 059–064 in development. They were
renumbered to 061–066 after merging with main (which already had SEO
migrations at 059–060). The SQL content and the tables in production are
unchanged; only the file numbering shifted.

```
061_political_core.sql              -- core tables + RLS
062_political_core_align.sql        -- enum + spec alignment (additive)
063_political_proposals_orders.sql  -- proposals + orders
064_political_contracts.sql         -- contracts + e-sign
065_political_scripts.sql           -- script library + 9 seeded scripts
066_political_priority_runs.sql     -- rescore audit log
```

---

## 2. Daily loop — what you do each morning

1. Open `/admin/political` — the dashboard
2. Click **Rescore now** if priorities look stale (updates in < 1s)
3. Work the **Follow-ups due** queue first (these have `next_follow_up_at ≤ now`)
4. Then the **Hot priority** queue (score ≥ 70)
5. For each, open the candidate and pick the right outreach channel
6. After each outreach, either:
   - Schedule the next follow-up (sets `next_follow_up_at`)
   - Mark `do_not_contact=true` if they declined politely
7. Check **Upcoming elections (90d)** weekly — these are your highest urgency

The dashboard KPIs tell you pipeline health at a glance: candidates / hot /
follow-ups / proposals sent / close rate / revenue / avg deal / 90-day
elections.

---

## 3. Bootstrapping a candidate (SQL only for now)

Adding a brand-new candidate requires SQL. A future admin UI will surface
this; for now, paste into the Supabase SQL editor:

```sql
insert into public.campaign_candidates (
  candidate_name, office_sought, race_level, election_date, election_year,
  state, geography_type, geography_value, district_type, candidate_status,
  campaign_website, campaign_email, campaign_phone,
  campaign_manager_name, campaign_manager_email,
  facebook_url, messenger_url,
  party_optional_public,        -- OPTIONAL: public record only, never used for scoring
  source_url, source_type, notes
) values (
  'Maria Ortiz',                             -- candidate_name
  'City Council District 4',                 -- office_sought
  'local',                                   -- race_level  (legacy column; 059)
  '2026-11-03',                              -- election_date
  2026,                                      -- election_year
  'OH',                                      -- state
  'city',                                    -- geography_type (060)
  'Columbus',                                -- geography_value (060)
  'local',                                   -- district_type (060)
  'active',                                  -- candidate_status (060)
  'https://ortizforcouncil.com',
  'maria@ortizforcouncil.com',
  '+16145550100',
  'Jamie Chen',
  'jamie@ortizforcouncil.com',
  'https://facebook.com/ortizforcouncil',
  'https://m.me/ortizforcouncil',
  null,                                      -- party_optional_public (keep null unless publicly declared)
  'https://candidate-directory.example/ortiz', -- source_url
  'candidate_directory',                     -- source_type
  'Initial outreach via campaign website.'
);
```

**Column semantics (most important):**

- `state` — always a 2-letter code, uppercase (`OH`, `TX`, `CA`).
- `geography_type` + `geography_value` — normalized pair. Pick the most
  specific granularity you have:
  - `state` + `OH` — state-level campaign
  - `county` + `Franklin`
  - `city` + `Columbus`
  - `district` + `OH-3` (congressional district)
- `district_type` — `federal`, `state`, or `local`. Drives pricing tier.
- `candidate_status` — starts as `active`. Flip to `won`, `lost`, or
  `inactive` as the engagement resolves. Drives the dashboard's "active"
  count.
- `election_date` — `YYYY-MM-DD`. Drives urgency scoring and the election
  countdown UI.
- `do_not_contact`, `do_not_email`, `do_not_text` — all default `false`.
  Flip to `true` when a candidate asks you to stop. The outreach service
  refuses sends for opted-out rows.

After insert, refresh `/admin/political` — the candidate shows up in the
list.

### Adding contacts for a candidate

A candidate usually has multiple people you talk to: the candidate themselves,
campaign manager, finance director, comms lead.

```sql
insert into public.political_campaign_contacts (
  campaign_candidate_id, name, role, email, phone,
  is_primary, preferred_contact_method
) values (
  '<candidate-uuid>',
  'Jamie Chen',
  'Campaign Manager',
  'jamie@ortizforcouncil.com',
  '+16145551234',
  true,
  'email'
);
```

- `is_primary=true` means this is the default contact the outreach form
  picks. Only one row per candidate can be `is_primary=true` (enforced by
  a partial unique index).
- `preferred_contact_method` is one of `email`, `sms`, `call`, `facebook_dm`.
  Surfaced in the outreach UI as a hint.

Refresh the candidate's **Contacts** tab to see them.

---

## 4. Creating a campaign (UI)

A *candidate* can have multiple *campaigns* (e.g. "Ortiz — Primary 2026" and
"Ortiz — General 2026"). Every quote / proposal / order attaches to a
specific campaign.

1. Open `/admin/political/[candidateId]`
2. In the header, click **"+ New campaign"**
3. The modal pre-fills from the candidate. Edit as needed:
   - **Campaign name** — free text. Recommended format: `"{Candidate} — {Race Phase}"`
   - **Office** — what they're running for
   - **Election date** — if different from the candidate's top-level date
   - **District type**, **Geography type/value** — if different from candidate
   - **Pipeline status** — `prospect` by default
   - **Budget estimate** — optional, in USD
4. Click **Create campaign**
5. You're redirected to the Quote tab with the new campaign selected

The campaign's `owner_id` is set to your user id. `sales_agent`s can
edit only campaigns they own; `admin`s can edit any.

---

## 5. Generating a quote

From the candidate detail **Quote & Proposals** tab:

1. Pick the campaign from the dropdown (if only one, it's auto-selected)
2. Optional: override household count (otherwise the seeded estimator runs)
3. Set **Drops** (default 1 — how many physical mail touches)
4. Optional: **Days until election** — tightens the recommendation
5. Pick any **Add-ons**: setup, design, rush, targeting, yard signs qty,
   door hangers qty
6. Click **Preview quote** — runs the pricing engine, no DB write
7. Review the preview:
   - Client-facing fields: households / drops / total pieces / total investment
   - Internal-only (you see, client won't): cost / margin / profit margin %
8. Click **Create proposal & get link** to persist

On success the panel shows:
- Public URL (`https://home-reach.com/p/{token}`)
- **Copy link** button
- **Preview** button (opens the client-facing page in a new tab)

**Quote engine notes:**
- Minimum order: 2,500 pieces (below that it throws)
- Volume bands: 2,500–5k / 5k–15k / 15k–50k / 50k+
- Price per piece: `local > state > federal` at the same volume
- Recommendations are *timing-only* (calendar days until election), NEVER persuasion

**Known limitation:** the Ohio household estimator is seeded with ~16 major
counties and ~15 major cities + all 15 OH congressional districts — rough
approximations. **Before sending a quote to a real campaign, verify the
household count with Census ACS or the county board of elections.** Pass
the real count via "Override household count" rather than trusting the seed.

---

## 6. Sending a proposal (public flow)

Once the proposal is created, you have a public URL. Send it via:

- **Text** — paste the URL into the Outreach tab's Text channel
- **Email** — paste into the Email channel body
- **Facebook DM** — paste into the Facebook channel body
- **Copy to clipboard and send via another channel** — the URL is shareable

### What the client sees at `/p/[token]`

- Candidate name + office + geography + election date
- **Mail plan** block: households / drops / total pieces / delivery window
- **Total campaign investment** (no cost, margin, or profit breakdown)
- **Approve** / **Not right now** buttons
- After approve: "Services agreement — Review & sign" link + pay buttons

Every view is logged (`viewed_at` gets stamped on first view). Every
approve/decline/pay action redirects back to the same URL with a status
param so the page can show a banner.

### Proposal statuses (in `political_proposals.status`)

- `draft` — not sent yet (our UI doesn't currently create drafts; all
  are sent directly)
- `sent` — link generated, public URL is live
- `viewed` — customer opened the link at least once
- `approved` — customer clicked Approve
- `declined` — customer clicked Not right now
- `expired` — past `expires_at` (default +30 days from sent)

---

## 7. Approval → Contract → Payment

When the customer clicks **Approve this plan**:

1. Proposal status flips to `approved`
2. A `political_orders` row is auto-created (`payment_status=pending`,
   `total_cents` from the proposal)
3. A `political_contracts` row is auto-created with rendered terms text
   (scope / fees / schedule / cancellation / non-political privacy /
   IP / liability / Ohio governing law / UETA consent)
4. The public page now shows:
   - **Services agreement — Review & sign →** link to `/c/{contractToken}`
   - **Pay 50% deposit** + **Pay in full** buttons (Stripe Checkout)
5. Contract + payment are *parallel* — customer can do them in either order

### Contract signing at `/c/[token]`

- Terms text is displayed verbatim from the DB
- Form: full legal name + email + **consent checkbox**
- Submit records:
  - `signer_name`, `signer_email`, `signer_ip` (from request headers),
    `signed_at` (server clock)
  - `terms_text` is **never modified after signing** — that's the integrity
    evidence for UETA/E-SIGN
- After signing, the same page shows the signature block with all four
  fields + a "View signed agreement" link

### Payment flow

- Customer clicks **Pay 50% deposit** or **Pay in full**
- Goes to Stripe Checkout (card entry)
- Returns to `/p/[token]?paid=1&session_id=cs_...`
- The return page server-side verifies with Stripe and updates the
  political_orders row (`payment_status = deposit_paid` or `paid`,
  `amount_paid_cents` accumulated, `stripe_payment_intent_id` recorded)
- Customer sees "Payment received. Thank you."

**Known limitation:** if the customer closes the tab after paying but
before the success redirect lands, the order stays at `pending` until
manually reconciled. See §12 for how to fix.

---

## 8. Outreach (Call / Text / Email / Facebook)

From the candidate detail **Outreach** tab. Channel pills across the top.

### Universal rules

- Every send (or logged call / FB DM) writes to `sales_events` with
  `political_campaign_id` set, so the activity is auditable
- `do_not_contact` / `do_not_email` / `do_not_text` flags block sends at
  the server. The UI also shows a red banner before you try.
- Opt-outs refuse the send. There is no "send anyway" path.
- No call tracking. No call recording. Ever.

### Call

- Pick a contact (or "Candidate directly")
- Optionally pick a script (auto-fills the reference body)
- Click **Call now (tel:)** — opens your device dialer
- After the call, fill in the **Outcome** field (required) and click
  **Log call**
- Log row: `action_type=message_sent`, `channel=call`,
  `message="Call to {phone} — {outcome notes}"`

### Text

- Pick a contact. The contact's `phone` or the candidate's `campaign_phone`
  is the "to"
- Pick a script or type your own
- Char counter shows 160-limit warning (SMS multi-segment billing)
- Click **Send text** → Twilio sends → log row (`action_type=text_sent`,
  Twilio SID stored as `provider_external_id` in metadata)

### Email

- Same flow. Subject + body.
- Mailgun sends. Body is converted to simple HTML (newlines → `<br>`) and
  plain text
- Log row: `action_type=email_sent`, Mailgun id as `provider_external_id`

### Facebook DM

- HomeReach never auto-sends Facebook — the API is closed
- Click **Open Messenger/Facebook →** to open the candidate's URL in a new tab
- Click **Copy message** to grab the script body
- Paste and send manually in Facebook's own UI
- Come back to HomeReach and click **Log Facebook DM** to record what you sent
- Log row: `action_type=facebook_sent`

### Scripts

Seeded neutral scripts (from migration 063):

| Slug | Channel | Purpose |
| --- | --- | --- |
| `call_opener_v1` | call | Initial outreach |
| `call_has_vendor_v1` | call | "They already have a vendor" |
| `call_no_vendor_v1` | call | "No vendor in place" |
| `call_hesitant_v1` | call | Hesitant response |
| `sms_opener_v1` | sms | Initial outreach |
| `sms_quote_follow_up_v1` | sms | After sending a quote |
| `fb_dm_opener_v1` | facebook_dm | Initial FB outreach |
| `email_opener_v1` | email | Initial outreach email |
| `email_quote_follow_up_v1` | email | Quote follow-up email |

Template variables (rendered on script pick): `{{candidate_name}}`,
`{{office}}`, `{{district}}`, `{{state}}`, `{{rep_name}}`.

To **edit or add** scripts (no UI yet):

```sql
-- Edit
update public.political_scripts
set body = '...' , subject = '...'
where slug = 'email_opener_v1';

-- Add
insert into public.political_scripts
  (slug, channel, category, name, subject, body, sort_order)
values
  ('sms_deadline_reminder_v1', 'sms', 'deadline_reminder',
   'Text — Deadline reminder', null,
   'Hey {{candidate_name}} — mail window closing soon. Still want to lock in that {{office}} plan?',
   30);
```

Variables `{{candidate_name}}`, `{{office}}`, `{{state}}`, `{{district}}`,
`{{rep_name}}` will be interpolated automatically.

---

## 9. Dashboard + priority scoring

### The dashboard at `/admin/political`

- **KPI strip** (7 cells, mobile-responsive):
  - Candidates (total + active)
  - Hot priority (count with score ≥ 70)
  - Follow-ups due
  - Proposals sent (approved / declined breakdown)
  - Close rate
  - Revenue (sum of `amount_paid_cents`) + avg deal
  - Elections · 90d
- **Follow-ups due** list — top 15, soonest first
- **Hot priority** list — top 10 by score
- **Upcoming elections (90d)** — top 10 closest
- Full candidate list below — with filters (state, geography, district type, status)

### Priority scoring

Click **Rescore now** (top-right) to recompute. Takes < 1 second for
hundreds of candidates. Output (shown in the button label):
```
✓ Scanned 42 · updated 18 in 312ms (8 hot · 14 warm · 20 cold)
```

A `political_priority_runs` row is written each time for audit trail.

**Score factors (0–100 total):**

| Factor | Max | What it measures |
| --- | --- | --- |
| Completeness | 25 | email / phone / website / manager / FB / party-on-record |
| Recency | 20 | Days since last contacted (uncontacted = 20; 4–14d = 15) |
| Election proximity | 30 | Days to election (60–90d = 30; too close = 5; past = 0) |
| Engagement | 10 | Days since last activity in `sales_events` |
| Proposal activity | 15 | approved = 15, viewed = 10, sent = 8 |

**Tiers:** hot ≥ 70, warm 40–69, cold < 40.

**Compliance:** `do_not_contact=true` forces score to 0 and tier to cold,
regardless of other factors. No ideology / voter / persuasion inputs.

### When to rescore

- Daily in the morning (takes < 1s)
- After adding / editing a batch of candidates
- After logging a batch of outreach activity
- No harm in running it multiple times — it only UPDATEs rows whose score
  actually changed

---

## 10. Compliance checklist (before any new outreach)

- [ ] Candidate has `do_not_contact=false`
- [ ] The specific contact you're using has `do_not_contact=false`
- [ ] If email: both have `do_not_email=false`
- [ ] If SMS: both have `do_not_text=false`
- [ ] Your script / body doesn't include any voter-persuasion language
  (the seeded scripts are fine)
- [ ] If the rep is calling, **no recording software is running**
- [ ] For a new state (not OH), verify you're following that state's
  campaign-finance disclosure and A2P 10DLC SMS registration requirements

The UI enforces items 1–4 server-side — if you hit "Send" on a blocked
candidate, the server refuses and surfaces the reason. Items 5–7 are
operator discipline.

---

## 11. Troubleshooting

### "No political campaign on file for this candidate yet"

You haven't created a `political_campaigns` row. Click **+ New campaign**
in the candidate's header (see §4).

### Quote engine throws "below 2,500 minimum"

Your household count × drops is less than 2,500. Either:
- Increase drops (`drops × households ≥ 2,500`)
- Override household count with a larger real number
- Pick a broader geography

### Payment stuck at `pending` after customer says they paid

The customer probably closed the tab before the success redirect. Resolve:

```sql
-- 1. Find the order
select id, total_cents, amount_paid_cents, payment_status,
       stripe_checkout_session_id, stripe_payment_intent_id
from public.political_orders
where proposal_id = '<proposal-uuid>';
```

Cross-reference the `stripe_checkout_session_id` in the Stripe dashboard
(Payments → search the session id). If Stripe says it's paid, update
manually:

```sql
update public.political_orders
set payment_status = 'paid',
    amount_paid_cents = total_cents,
    paid_at = now(),
    stripe_payment_intent_id = '<from Stripe dashboard>'
where id = '<order-uuid>';
```

(A future follow-up will add an admin "Refresh payment status" button.)

### Contract didn't auto-create after approval

Rare but possible. Create manually:

```sql
-- Find the proposal
select id, campaign_id, candidate_id, status
from public.political_proposals
where public_token = '<token>';

-- Re-run the auto-create via a no-op UPDATE that triggers no logic —
-- instead use the server action: visit the public URL, which now calls
-- ensureContractForProposal idempotently. If that doesn't help, engineer
-- intervention.
```

### "Send text" / "Send email" errors

- Check Mailgun / Twilio env vars are set in Vercel
- Check the candidate's state is an A2P-registered state for your Twilio
  number (for SMS)
- Check the recipient number is E.164 (`+1...`)
- Check the "candidate marked do_not_*" banner hasn't appeared (opt-out
  enforcement)

### Priority scores look wrong

- Click **Rescore now** — usually fixes stale scores
- Check the candidate's `do_not_contact` field — if true, score is forced 0
- If a specific factor is wrong, look at the inputs:
  - Completeness: did you fill in email / phone / website / manager?
  - Recency: does `last_contacted_at` reflect reality?
  - Election proximity: is `election_date` set correctly?

---

## 12. SQL reference (useful queries)

### Morning triage — who needs attention?

```sql
-- Hot candidates not contacted in the last 14 days
select id, candidate_name, office_sought, state, priority_score,
       last_contacted_at, election_date
from public.campaign_candidates
where do_not_contact = false
  and priority_score >= 70
  and (last_contacted_at is null or last_contacted_at < now() - interval '14 days')
order by priority_score desc, election_date asc
limit 20;
```

### Follow-ups due this week

```sql
select id, candidate_name, next_follow_up_at, last_contacted_at
from public.campaign_candidates
where do_not_contact = false
  and next_follow_up_at <= now() + interval '7 days'
order by next_follow_up_at asc;
```

### Revenue month-to-date

```sql
select
  count(*) as orders,
  sum(amount_paid_cents) / 100.0 as revenue_usd,
  avg(total_cents) / 100.0 as avg_deal_usd
from public.political_orders
where payment_status in ('paid', 'deposit_paid')
  and paid_at >= date_trunc('month', now());
```

### Proposals that haven't been viewed in 48 hours

```sql
select p.id, c.candidate_name, p.sent_at, p.public_token
from public.political_proposals p
join public.campaign_candidates c on c.id = p.candidate_id
where p.status = 'sent'
  and p.sent_at < now() - interval '48 hours'
order by p.sent_at asc;
```

### Activity for a specific candidate (last 30 days)

```sql
select e.created_at, e.action_type, e.channel, e.message
from public.sales_events e
join public.political_campaigns pc on pc.id = e.political_campaign_id
where pc.candidate_id = '<candidate-uuid>'
  and e.created_at >= now() - interval '30 days'
order by e.created_at desc;
```

### Mark a contact as do_not_contact (opt-out)

```sql
update public.political_campaign_contacts
set do_not_contact = true
where id = '<contact-uuid>';

-- Or at the candidate level (applies to all channels)
update public.campaign_candidates
set do_not_contact = true
where id = '<candidate-uuid>';
```

### Schedule a follow-up

```sql
update public.campaign_candidates
set next_follow_up_at = now() + interval '7 days',
    notes = coalesce(notes, '') ||
            E'\n' || to_char(now(), 'YYYY-MM-DD') ||
            ' — queued follow-up after voicemail'
where id = '<candidate-uuid>';
```

---

## 13. What's NOT in the UI yet (known limitations)

Planned follow-ups that aren't in the current deploy:

- **Admin UI to create candidates** — use SQL per §3 until this lands
- **Admin UI to edit candidates** — same
- **Scheduled rescoring (cron)** — click "Rescore now" daily; automation is
  a separate follow-up
- **Activity timeline on the candidate detail page** — events land in
  `sales_events` correctly, but there's no "recent activity" panel yet
- **"Refresh payment status" admin button** — see §11 troubleshooting
- **Proposal re-send** — today a resend means copying the same URL; no
  counter or auto-email yet
- **Stripe webhook for political** — payment success is reconciled via the
  success-URL redirect; if the customer closes the tab, status stays pending
  until manual reconciliation

None of these block operating. They're on the shortlist.

---

## 14. What to do on cutover day (if you haven't already)

1. Set `ENABLE_POLITICAL=true` in Vercel production env
2. Verify migrations 059–064 have applied (quick SQL: see migration reports)
3. Log in as admin → `/admin/political` → sidebar shows "Political" entry
4. Bootstrap one real Ohio candidate via §3 SQL
5. Create a campaign via the button
6. Generate a quote — verify the household count makes sense for the
   geography (the seeded estimator is appro