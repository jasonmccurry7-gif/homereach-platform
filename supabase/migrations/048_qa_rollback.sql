-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Rollback — Q&A V1a (migrations 048, 049, 050)
--
-- Drops every table, index, enum, and policy created by the Q&A V1a
-- migrations. Safe to run even if only some migrations were applied.
--
-- USAGE:
--   psql "$DATABASE_URL" -f 048_qa_rollback.sql
-- Or from Supabase SQL editor: paste and run.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop tables in dependency order (children first).
drop table if exists qa_usage_logs            cascade;
drop table if exists qa_lead_attachments      cascade;
drop table if exists qa_scripts_generated     cascade;
drop table if exists qa_reply_votes           cascade;
drop table if exists qa_thread_replies        cascade;
drop table if exists qa_knowledge_entries     cascade;
drop table if exists qa_answers               cascade;
drop table if exists qa_questions             cascade;

-- Drop enums.
drop type if exists qa_usage_event;
drop type if exists qa_channel;
drop type if exists qa_reply_role;
drop type if exists qa_answer_source;
drop type if exists qa_status;
drop type if exists qa_visibility;

-- pgcrypto and vector extensions are left in place in case other parts of the
-- schema use them.

-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback complete.
-- ─────────────────────────────────────────────────────────────────────────────
