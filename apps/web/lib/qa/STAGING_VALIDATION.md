# Q&A V1a — Staging Validation Checklist

Run this checklist in the staging environment BEFORE flipping `ENABLE_QA_SYSTEM=true` in production. Every item must pass. Attach the filled-in version to your production cutover request.

Date run: __________________  Tester: __________________

---

## Phase 1 — Pre-flight with flag OFF (sanity)

The goal is to prove that the V1a merge, with the flag off, has zero effect on the existing platform.

- [ ] Deployed V1a branch to staging with `ENABLE_QA_SYSTEM=false` (or unset).
- [ ] `GET https://staging.home-reach.com/api/admin/health` returns 200 with `status=GREEN` and `9 total / 9 passed`.
- [ ] `POST https://staging.home-reach.com/api/admin/agents/sentinel` returns 200 (Sentinel `.catch()` fix has landed).
- [ ] `POST /api/admin/qa/questions` returns **HTTP 404** (proving the flag gate).
- [ ] `GET /admin/qa` returns **HTTP 404** (proving the page gate).
- [ ] `GET /agent/qa` returns **HTTP 404** (proving the agent page gate).
- [ ] The Sales Dashboard (existing) looks identical to the pre-V1a snapshot. No new Q&A tab visible.
- [ ] Run a Stripe test-mode checkout end-to-end. Confirm webhook received, order created, subscription active. Stripe is unaffected.
- [ ] Trigger the Apex orchestrator. Confirm all 10 agents complete (modulo the already-known `.catch()` bug status). No new errors.

**If any check fails:** STOP. Do not proceed. Investigate which new file is leaking behavior through the flag.

---

## Phase 2 — Apply migrations

- [ ] Run `supabase/migrations/048_qa_tables.sql`. Exit status 0.
- [ ] Run `supabase/migrations/049_qa_indexes.sql`. Exit status 0.
- [ ] Run `supabase/migrations/050_qa_rls.sql`. Exit status 0 (or documented partial if `is_admin()` helper needs defining).
- [ ] In Supabase, confirm 8 new tables exist: `qa_questions`, `qa_answers`, `qa_thread_replies`, `qa_reply_votes`, `qa_scripts_generated`, `qa_lead_attachments`, `qa_knowledge_entries`, `qa_usage_logs`.
- [ ] Confirm extensions `pgcrypto` and `vector` are present.
- [ ] Re-run all Phase 1 checks. Platform is still GREEN.

---

## Phase 3 — Flip flag ON

Set in staging Vercel: `ENABLE_QA_SYSTEM=true`, `ANTHROPIC_API_KEY=<real key>`. Redeploy.

### Input Layer + Intelligence Layer
- [ ] `/admin/qa` loads without errors.
- [ ] Posting a question via the UI returns an AI answer within 10 seconds (p95 target: 6s).
- [ ] The AI answer contains all 5 sections: Direct Answer, What To Say (with at least 1 channel), What To Do Next, Why This Works, Related Questions (empty if no retrieval hits).
- [ ] A row exists in `qa_questions` with the submitted text.
- [ ] A row exists in `qa_answers` with `source='ai'` and a non-null `model_name`.
- [ ] A row exists in `qa_usage_logs` with `event_type='answer_generated'`.

### Collaboration Layer
- [ ] Posting a reply to a thread returns within 500ms.
- [ ] A row exists in `qa_thread_replies` with the submitted body.
- [ ] Upvoting a reply increments its `upvote_count` (visible in UI).
- [ ] Upvoting the same reply twice with the same account does NOT create a second `qa_reply_votes` row (unique constraint).
- [ ] Admin account marking a reply as "Best" inserts a new `qa_answers` row with `is_best=true` and flips the question status to `resolved`.

### Knowledge Layer
- [ ] Admin clicks "Mark Official" on an AI answer. A row appears in `qa_knowledge_entries`.
- [ ] The new entry has non-null `tsv` (generated column populated).
- [ ] `GET /api/admin/qa/knowledge/search?q=<relevant term>` returns the new entry.
- [ ] The dedupe check (`/knowledge/dedupe-check`) returns the new entry when the draft matches semantically.

### Execution Layer (V1 subset)
- [ ] Clicking "Copy" on a channel script writes to the clipboard (verify in browser dev console or paste test) AND inserts a `qa_scripts_generated` row with `copied_by_agent_id` set.
- [ ] Clicking "Attach to Lead" (on a question that has `lead_id` set) inserts a `qa_lead_attachments` row.
- [ ] A corresponding `sales_events` row of type `qa_script_attached` appears in the existing lead timeline. (If not — `sales_events` event type enum may need a new value added; see rollback note in the Attach route.)
- [ ] `qa_usage_logs` has matching rows for `script_copied` and `attached_to_lead`.

### Admin Control Panel
- [ ] `/admin/qa` shows the "Admin queue" section.
- [ ] Unresolved threads older than 1h appear under "Unresolved".
- [ ] Threads with upvote_count >= 3 appear under "Popular".

### Cost cap
- [ ] Post 200 questions from the same test agent. The 201st returns with `aiStatus='skipped_capped'` and no `qa_answers` row.
- [ ] Daily cap resets at midnight UTC.

### Kill switch
- [ ] Set `DISABLE_QA_AI=true` and redeploy. Posting a question still creates the `qa_questions` row but `aiStatus='skipped_disabled'` and no AI call is made.
- [ ] Unset `DISABLE_QA_AI`. AI generation resumes.

---

## Phase 4 — Platform health (re-confirm nothing broke)

Run all Phase 1 checks AGAIN, now with the flag on:

- [ ] Sentinel health endpoint still GREEN 9/9.
- [ ] Stripe test-mode checkout still works end-to-end.
- [ ] Apex orchestrator still completes all 10 agents.
- [ ] `/admin/dashboard`, `/admin/crm`, `/admin/orders` — no regressions.

---

## Phase 5 — Load test (brief)

Optional but recommended before production:

- [ ] 100 questions fired in 60 seconds by a test script. Confirm:
  - No `500` responses.
  - No Supabase connection-pool exhaustion errors.
  - Anthropic rate-limit responses, if any, are logged but do not cascade-fail.

---

## Phase 6 — Report & cutover

- [ ] Fill in this checklist fully.
- [ ] Attach 3 screenshots to the cutover ticket: (a) /admin/qa after a completed thread, (b) a sales_events row with `qa_script_attached`, (c) the Sentinel health endpoint GREEN 9/9 after everything.
- [ ] Submit for Jason's sign-off.
- [ ] On sign-off: apply migrations in production, set env vars, flip flag, seed the first 20 official knowledge entries, notify agents.

---

**Rollback instructions** (emergency): Set `ENABLE_QA_SYSTEM=false` and redeploy — everything returns 404. For a complete DB rollback, run `supabase/migrations/048_qa_rollback.sql`.
