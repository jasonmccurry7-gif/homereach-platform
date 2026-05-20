-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 049 — Q&A Performance Indexes
--
-- Indexes on the tables created in 048_qa_tables.sql. Created CONCURRENTLY
-- where supported to avoid blocking the small volume of existing writes on
-- referenced tables (agent_identities, sales_leads, cities).
--
-- Supabase migration CLI runs each statement in a transaction block by default,
-- which does not allow CREATE INDEX CONCURRENTLY. Two options:
--   (a) Run this file with `supabase db push` after disabling the transaction
--       wrapper (psql -v ON_ERROR_STOP=1 -f 049_qa_indexes.sql), OR
--   (b) Remove the CONCURRENTLY keyword if running via the default CLI path.
-- For a brand-new empty table, CONCURRENTLY is not required. It is safe to
-- drop the keyword for V1a since all tables are empty on first apply.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── qa_questions ─────────────────────────────────────────────────────────────
create index if not exists qa_questions_asked_by_idx
  on qa_questions (asked_by_agent_id);

create index if not exists qa_questions_lead_idx
  on qa_questions (lead_id) where lead_id is not null;

create index if not exists qa_questions_city_idx
  on qa_questions (city_id) where city_id is not null;

create index if not exists qa_questions_status_idx
  on qa_questions (status);

create index if not exists qa_questions_open_idx
  on qa_questions (created_at desc) where status = 'open';

create index if not exists qa_questions_pinned_idx
  on qa_questions (created_at desc) where is_pinned = true;

-- Tag array lookup (fast "WHERE 'pricing' = ANY (category_tags)")
create index if not exists qa_questions_tags_gin_idx
  on qa_questions using gin (category_tags);

-- ── qa_answers ───────────────────────────────────────────────────────────────
create index if not exists qa_answers_question_idx
  on qa_answers (question_id);

create index if not exists qa_answers_official_idx
  on qa_answers (updated_at desc) where is_official = true;

create index if not exists qa_answers_source_idx
  on qa_answers (source);

-- ── qa_thread_replies ────────────────────────────────────────────────────────
create index if not exists qa_thread_replies_question_idx
  on qa_thread_replies (question_id);

create index if not exists qa_thread_replies_parent_idx
  on qa_thread_replies (parent_reply_id) where parent_reply_id is not null;

create index if not exists qa_thread_replies_author_idx
  on qa_thread_replies (author_agent_id);

-- ── qa_reply_votes ───────────────────────────────────────────────────────────
create index if not exists qa_reply_votes_reply_idx
  on qa_reply_votes (reply_id) where reply_id is not null;

create index if not exists qa_reply_votes_answer_idx
  on qa_reply_votes (answer_id) where answer_id is not null;

create index if not exists qa_reply_votes_voter_idx
  on qa_reply_votes (voter_agent_id);

-- ── qa_scripts_generated ─────────────────────────────────────────────────────
create index if not exists qa_scripts_answer_idx
  on qa_scripts_generated (answer_id);

create index if not exists qa_scripts_lead_idx
  on qa_scripts_generated (attached_to_lead_id) where attached_to_lead_id is not null;

-- ── qa_lead_attachments ──────────────────────────────────────────────────────
create index if not exists qa_lead_attachments_lead_idx
  on qa_lead_attachments (lead_id);

create index if not exists qa_lead_attachments_question_idx
  on qa_lead_attachments (question_id);

create index if not exists qa_lead_attachments_attached_by_idx
  on qa_lead_attachments (attached_by_agent_id);

-- ── qa_knowledge_entries ─────────────────────────────────────────────────────
create index if not exists qa_knowledge_tsv_idx
  on qa_knowledge_entries using gin (tsv);

create index if not exists qa_knowledge_tags_gin_idx
  on qa_knowledge_entries using gin (category_tags);

-- Semantic similarity search (HNSW for vector). Requires pgvector >= 0.5.0.
-- If older pgvector, use ivfflat instead (lists=100 is a reasonable start).
create index if not exists qa_knowledge_embedding_hnsw_idx
  on qa_knowledge_entries using hnsw (embedding vector_cosine_ops);

create index if not exists qa_knowledge_usage_idx
  on qa_knowledge_entries (usage_count desc);

-- ── qa_usage_logs ────────────────────────────────────────────────────────────
create index if not exists qa_usage_logs_agent_idx
  on qa_usage_logs (agent_id, created_at desc);

create index if not exists qa_usage_logs_event_type_idx
  on qa_usage_logs (event_type, created_at desc);

create index if not exists qa_usage_logs_question_idx
  on qa_usage_logs (question_id) where question_id is not null;

create index if not exists qa_usage_logs_answer_idx
  on qa_usage_logs (answer_id) where answer_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- End of 049_qa_indexes.sql
-- Next: 050_qa_rls.sql for row-level security policies.
-- ─────────────────────────────────────────────────────────────────────────────
