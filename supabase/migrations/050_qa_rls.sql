-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 050 — Q&A Row-Level Security
--
-- RLS policies use the canonical HomeReach pattern found in
-- 20_sales_execution_system.sql and 21_crm_full_schema.sql:
--     EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
--
-- This avoids depending on a separate is_admin() helper function.
--
-- Service-role access (used by /api/admin/qa/* routes that call Supabase with
-- the service-role key) bypasses RLS entirely, so the policies below only
-- matter when queries are made under the authenticated user's JWT.
--
-- SAFE TO RE-RUN: uses `drop policy if exists` before each create.
-- ─────────────────────────────────────────────────────────────────────────────

alter table qa_questions          enable row level security;
alter table qa_answers            enable row level security;
alter table qa_thread_replies     enable row level security;
alter table qa_reply_votes        enable row level security;
alter table qa_scripts_generated  enable row level security;
alter table qa_lead_attachments   enable row level security;
alter table qa_knowledge_entries  enable row level security;
alter table qa_usage_logs         enable row level security;

-- ── qa_questions ─────────────────────────────────────────────────────────────

drop policy if exists qa_questions_select_policy on qa_questions;
create policy qa_questions_select_policy on qa_questions
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or visibility in ('team', 'public')
    or asked_by_agent_id = auth.uid()
  );

drop policy if exists qa_questions_insert_policy on qa_questions;
create policy qa_questions_insert_policy on qa_questions
  for insert with check (
    asked_by_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_questions_update_policy on qa_questions;
create policy qa_questions_update_policy on qa_questions
  for update using (
    asked_by_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_questions_delete_policy on qa_questions;
create policy qa_questions_delete_policy on qa_questions
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_answers ───────────────────────────────────────────────────────────────

drop policy if exists qa_answers_select_policy on qa_answers;
create policy qa_answers_select_policy on qa_answers
  for select using (
    exists (select 1 from qa_questions q where q.id = qa_answers.question_id)
  );

drop policy if exists qa_answers_insert_policy on qa_answers;
create policy qa_answers_insert_policy on qa_answers
  for insert with check (
    source = 'ai'
    or author_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_answers_update_policy on qa_answers;
create policy qa_answers_update_policy on qa_answers
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
    or (author_agent_id = auth.uid() and is_locked = false)
  );

-- ── qa_thread_replies ────────────────────────────────────────────────────────

drop policy if exists qa_thread_replies_select_policy on qa_thread_replies;
create policy qa_thread_replies_select_policy on qa_thread_replies
  for select using (
    exists (select 1 from qa_questions q where q.id = qa_thread_replies.question_id)
  );

drop policy if exists qa_thread_replies_insert_policy on qa_thread_replies;
create policy qa_thread_replies_insert_policy on qa_thread_replies
  for insert with check (
    author_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_thread_replies_update_policy on qa_thread_replies;
create policy qa_thread_replies_update_policy on qa_thread_replies
  for update using (
    author_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_thread_replies_delete_policy on qa_thread_replies;
create policy qa_thread_replies_delete_policy on qa_thread_replies
  for delete using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_reply_votes ───────────────────────────────────────────────────────────

drop policy if exists qa_reply_votes_select_policy on qa_reply_votes;
create policy qa_reply_votes_select_policy on qa_reply_votes
  for select using (true);

drop policy if exists qa_reply_votes_insert_policy on qa_reply_votes;
create policy qa_reply_votes_insert_policy on qa_reply_votes
  for insert with check (voter_agent_id = auth.uid());

drop policy if exists qa_reply_votes_delete_policy on qa_reply_votes;
create policy qa_reply_votes_delete_policy on qa_reply_votes
  for delete using (
    voter_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_scripts_generated ─────────────────────────────────────────────────────

drop policy if exists qa_scripts_select_policy on qa_scripts_generated;
create policy qa_scripts_select_policy on qa_scripts_generated
  for select using (
    exists (
      select 1 from qa_answers a
      where a.id = qa_scripts_generated.answer_id
    )
  );

drop policy if exists qa_scripts_insert_policy on qa_scripts_generated;
create policy qa_scripts_insert_policy on qa_scripts_generated
  for insert with check (
    copied_by_agent_id = auth.uid()
    or copied_by_agent_id is null
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_lead_attachments ──────────────────────────────────────────────────────

drop policy if exists qa_lead_attachments_select_policy on qa_lead_attachments;
create policy qa_lead_attachments_select_policy on qa_lead_attachments
  for select using (true);

drop policy if exists qa_lead_attachments_insert_policy on qa_lead_attachments;
create policy qa_lead_attachments_insert_policy on qa_lead_attachments
  for insert with check (
    attached_by_agent_id = auth.uid()
    or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_knowledge_entries ─────────────────────────────────────────────────────

drop policy if exists qa_knowledge_select_policy on qa_knowledge_entries;
create policy qa_knowledge_select_policy on qa_knowledge_entries
  for select using (true);

drop policy if exists qa_knowledge_insert_policy on qa_knowledge_entries;
create policy qa_knowledge_insert_policy on qa_knowledge_entries
  for insert with check (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

drop policy if exists qa_knowledge_update_policy on qa_knowledge_entries;
create policy qa_knowledge_update_policy on qa_knowledge_entries
  for update using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ── qa_usage_logs ────────────────────────────────────────────────────────────

drop policy if exists qa_usage_logs_select_policy on qa_usage_logs;
create policy qa_usage_logs_select_policy on qa_usage_logs
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- End of 050_qa_rls.sql
-- ─────────────────────────────────────────────────────────────────────────────
