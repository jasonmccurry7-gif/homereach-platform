-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 048 — Sales Intelligence Q&A (V1a) — Tables
--
-- Creates the foundational tables for the Sales Intelligence + Q&A Operating
-- Layer. All tables are NEW. This migration is entirely ADDITIVE — no existing
-- tables are altered. Safe to rollback via 048_qa_rollback.sql.
--
-- SAFE TO RE-RUN: this file uses `create ... if not exists` for tables, enums,
-- and extensions, and `drop constraint if exists` before adding foreign keys.
--
-- FK target decisions (canonical HomeReach pattern):
--   - User/agent identity:  profiles(id)    — matches sales_events.agent_id
--   - Leads:                sales_leads(id)
--   - Geography:            cities(id)
-- agent_identities.agent_id is itself a FK to profiles(id), so pointing to
-- profiles(id) works for any authed user (including reps without an explicit
-- agent_identities row). This also matches the error-free pattern used by
-- the existing sales_events table.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists "pgcrypto";
create extension if not exists "vector";

-- ── Enums ────────────────────────────────────────────────────────────────────

do $$ begin
  create type qa_visibility as enum ('private', 'team', 'public');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qa_status as enum ('open', 'answered', 'resolved', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qa_answer_source as enum ('ai', 'team', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qa_reply_role as enum ('agent', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qa_channel as enum ('sms', 'email', 'call', 'dm');
exception when duplicate_object then null; end $$;

do $$ begin
  create type qa_usage_event as enum (
    'question_asked',
    'answer_generated',
    'answer_generation_failed',
    'reply_added',
    'script_copied',
    'attached_to_lead',
    'marked_best',
    'marked_official',
    'knowledge_searched',
    'dedupe_checked'
  );
exception when duplicate_object then null; end $$;

-- ── qa_questions ─────────────────────────────────────────────────────────────

create table if not exists qa_questions (
  id                     uuid primary key default gen_random_uuid(),
  asked_by_agent_id      uuid not null,
  question_text          text not null,
  category_tags          text[] not null default '{}',
  visibility             qa_visibility not null default 'team',
  lead_id                uuid,
  city_id                uuid,
  category_id            uuid,
  last_interaction_id    uuid,
  status                 qa_status not null default 'open',
  is_pinned              boolean not null default false,
  upvote_count           integer not null default 0,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table qa_questions drop constraint if exists qa_questions_asked_by_fk;
alter table qa_questions
  add constraint qa_questions_asked_by_fk
  foreign key (asked_by_agent_id) references profiles(id) on delete cascade;

alter table qa_questions drop constraint if exists qa_questions_lead_fk;
alter table qa_questions
  add constraint qa_questions_lead_fk
  foreign key (lead_id) references sales_leads(id) on delete set null;

alter table qa_questions drop constraint if exists qa_questions_city_fk;
alter table qa_questions
  add constraint qa_questions_city_fk
  foreign key (city_id) references cities(id) on delete set null;

comment on table qa_questions is
  'Sales Intelligence Q&A — top-level question records. Each row is a thread.';


-- ── qa_answers ───────────────────────────────────────────────────────────────

create table if not exists qa_answers (
  id                     uuid primary key default gen_random_uuid(),
  question_id            uuid not null,
  source                 qa_answer_source not null,
  author_agent_id        uuid,
  direct_answer          text not null,
  what_to_say            jsonb not null default '{}'::jsonb,
  what_to_do_next        text not null default '',
  why_this_works         text not null default '',
  related_question_ids   uuid[] not null default '{}',
  is_official            boolean not null default false,
  is_best                boolean not null default false,
  is_locked              boolean not null default false,
  model_name             text,
  model_tokens_input     integer,
  model_tokens_output    integer,
  generation_latency_ms  integer,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table qa_answers drop constraint if exists qa_answers_question_fk;
alter table qa_answers
  add constraint qa_answers_question_fk
  foreign key (question_id) references qa_questions(id) on delete cascade;

alter table qa_answers drop constraint if exists qa_answers_author_fk;
alter table qa_answers
  add constraint qa_answers_author_fk
  foreign key (author_agent_id) references profiles(id) on delete set null;

comment on table qa_answers is
  'Structured answers attached to Q&A questions. AI responses follow the 5-section contract.';


-- ── qa_thread_replies ────────────────────────────────────────────────────────

create table if not exists qa_thread_replies (
  id                     uuid primary key default gen_random_uuid(),
  question_id            uuid not null,
  parent_reply_id        uuid,
  author_agent_id        uuid not null,
  author_role            qa_reply_role not null,
  body                   text not null,
  upvote_count           integer not null default 0,
  is_admin_override      boolean not null default false,
  created_at             timestamptz not null default now()
);

alter table qa_thread_replies drop constraint if exists qa_thread_replies_question_fk;
alter table qa_thread_replies
  add constraint qa_thread_replies_question_fk
  foreign key (question_id) references qa_questions(id) on delete cascade;

alter table qa_thread_replies drop constraint if exists qa_thread_replies_parent_fk;
alter table qa_thread_replies
  add constraint qa_thread_replies_parent_fk
  foreign key (parent_reply_id) references qa_thread_replies(id) on delete cascade;

alter table qa_thread_replies drop constraint if exists qa_thread_replies_author_fk;
alter table qa_thread_replies
  add constraint qa_thread_replies_author_fk
  foreign key (author_agent_id) references profiles(id) on delete cascade;


-- ── qa_reply_votes ───────────────────────────────────────────────────────────

create table if not exists qa_reply_votes (
  id                     uuid primary key default gen_random_uuid(),
  reply_id               uuid,
  answer_id              uuid,
  voter_agent_id         uuid not null,
  vote                   smallint not null default 1,
  created_at             timestamptz not null default now(),

  constraint qa_reply_votes_exactly_one_target
    check ((reply_id is null) <> (answer_id is null)),

  constraint qa_reply_votes_unique_reply
    unique nulls not distinct (voter_agent_id, reply_id),
  constraint qa_reply_votes_unique_answer
    unique nulls not distinct (voter_agent_id, answer_id)
);

alter table qa_reply_votes drop constraint if exists qa_reply_votes_reply_fk;
alter table qa_reply_votes
  add constraint qa_reply_votes_reply_fk
  foreign key (reply_id) references qa_thread_replies(id) on delete cascade;

alter table qa_reply_votes drop constraint if exists qa_reply_votes_answer_fk;
alter table qa_reply_votes
  add constraint qa_reply_votes_answer_fk
  foreign key (answer_id) references qa_answers(id) on delete cascade;

alter table qa_reply_votes drop constraint if exists qa_reply_votes_voter_fk;
alter table qa_reply_votes
  add constraint qa_reply_votes_voter_fk
  foreign key (voter_agent_id) references profiles(id) on delete cascade;


-- ── qa_scripts_generated ─────────────────────────────────────────────────────

create table if not exists qa_scripts_generated (
  id                     uuid primary key default gen_random_uuid(),
  answer_id              uuid not null,
  channel                qa_channel not null,
  content                text not null,
  copied_by_agent_id     uuid,
  attached_to_lead_id    uuid,
  used_in_send_id        uuid,
  created_at             timestamptz not null default now()
);

alter table qa_scripts_generated drop constraint if exists qa_scripts_generated_answer_fk;
alter table qa_scripts_generated
  add constraint qa_scripts_generated_answer_fk
  foreign key (answer_id) references qa_answers(id) on delete cascade;

alter table qa_scripts_generated drop constraint if exists qa_scripts_generated_copied_by_fk;
alter table qa_scripts_generated
  add constraint qa_scripts_generated_copied_by_fk
  foreign key (copied_by_agent_id) references profiles(id) on delete set null;

alter table qa_scripts_generated drop constraint if exists qa_scripts_generated_lead_fk;
alter table qa_scripts_generated
  add constraint qa_scripts_generated_lead_fk
  foreign key (attached_to_lead_id) references sales_leads(id) on delete set null;


-- ── qa_lead_attachments ──────────────────────────────────────────────────────

create table if not exists qa_lead_attachments (
  id                     uuid primary key default gen_random_uuid(),
  lead_id                uuid not null,
  question_id            uuid not null,
  answer_id              uuid not null,
  script_id              uuid,
  attached_by_agent_id   uuid not null,
  note                   text,
  created_at             timestamptz not null default now()
);

alter table qa_lead_attachments drop constraint if exists qa_lead_attachments_lead_fk;
alter table qa_lead_attachments
  add constraint qa_lead_attachments_lead_fk
  foreign key (lead_id) references sales_leads(id) on delete cascade;

alter table qa_lead_attachments drop constraint if exists qa_lead_attachments_question_fk;
alter table qa_lead_attachments
  add constraint qa_lead_attachments_question_fk
  foreign key (question_id) references qa_questions(id) on delete cascade;

alter table qa_lead_attachments drop constraint if exists qa_lead_attachments_answer_fk;
alter table qa_lead_attachments
  add constraint qa_lead_attachments_answer_fk
  foreign key (answer_id) references qa_answers(id) on delete cascade;

alter table qa_lead_attachments drop constraint if exists qa_lead_attachments_script_fk;
alter table qa_lead_attachments
  add constraint qa_lead_attachments_script_fk
  foreign key (script_id) references qa_scripts_generated(id) on delete set null;

alter table qa_lead_attachments drop constraint if exists qa_lead_attachments_attached_by_fk;
alter table qa_lead_attachments
  add constraint qa_lead_attachments_attached_by_fk
  foreign key (attached_by_agent_id) references profiles(id) on delete cascade;


-- ── qa_knowledge_entries ─────────────────────────────────────────────────────

create table if not exists qa_knowledge_entries (
  id                       uuid primary key default gen_random_uuid(),
  source_question_id       uuid not null,
  source_answer_id         uuid not null,
  title                    text not null,
  body                     text not null,
  category_tags            text[] not null default '{}',
  city_scope               uuid[],
  promoted_by_admin_id     uuid not null,
  tsv                      tsvector generated always as (
    to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored,
  embedding                vector(1536),
  usage_count              integer not null default 0,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table qa_knowledge_entries drop constraint if exists qa_knowledge_source_question_fk;
alter table qa_knowledge_entries
  add constraint qa_knowledge_source_question_fk
  foreign key (source_question_id) references qa_questions(id) on delete cascade;

alter table qa_knowledge_entries drop constraint if exists qa_knowledge_source_answer_fk;
alter table qa_knowledge_entries
  add constraint qa_knowledge_source_answer_fk
  foreign key (source_answer_id) references qa_answers(id) on delete cascade;

alter table qa_knowledge_entries drop constraint if exists qa_knowledge_promoted_by_fk;
alter table qa_knowledge_entries
  add constraint qa_knowledge_promoted_by_fk
  foreign key (promoted_by_admin_id) references profiles(id) on delete set null;


-- ── qa_usage_logs ────────────────────────────────────────────────────────────

create table if not exists qa_usage_logs (
  id                     uuid primary key default gen_random_uuid(),
  event_type             qa_usage_event not null,
  question_id            uuid,
  answer_id              uuid,
  reply_id               uuid,
  script_id              uuid,
  agent_id               uuid not null,
  lead_id                uuid,
  metadata               jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now()
);

alter table qa_usage_logs drop constraint if exists qa_usage_logs_agent_fk;
alter table qa_usage_logs
  add constraint qa_usage_logs_agent_fk
  foreign key (agent_id) references profiles(id) on delete cascade;

-- ─────────────────────────────────────────────────────────────────────────────
-- End of 048_qa_tables.sql
-- Next: 049_qa_indexes.sql for performance indexes.
-- ─────────────────────────────────────────────────────────────────────────────
