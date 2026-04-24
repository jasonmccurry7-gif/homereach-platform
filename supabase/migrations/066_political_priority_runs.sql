-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 064 — Political Command Center: Priority Run Audit
--
-- Adds `political_priority_runs` — a tiny audit log written once per batch
-- by the priority-scoring rescorer. Each row captures who ran the rescore,
-- how many rows were touched, the elapsed time, and a small JSON summary
-- (per-tier counts + any errors).
--
-- Strictly additive:
--   • No existing tables touched.
--   • No existing RLS altered.
--   • No new columns on existing tables. The rescorer writes priority_score
--     and completeness_score to campaign_candidates — those columns were
--     added in migration 059 so nothing schema-level is needed here.
--
-- Why:
--   • Operators wonder why the dashboard "shifted" — the audit log gives
--     an auditable trail of when a rescore ran + who ran it.
--   • Future scheduled-rescore jobs can write to this same table so we
--     never have to guess whether last night's rescore actually ran.
--
-- Compliance:
--   • Scoring and this audit log are OPERATIONAL ONLY (completeness,
--     recency, election proximity, response history). No voter scoring
--     or ideology inputs anywhere.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


create table if not exists public.political_priority_runs (
  id                     uuid primary key default gen_random_uuid(),

  -- Who ran it. Null when triggered by a scheduled/system job.
  ran_by_user_id         uuid references public.profiles(id) on delete set null,

  -- Optional label to differentiate manual runs from scheduled ones,
  -- e.g. 'manual', 'cron:nightly'.
  source                 text not null default 'manual',

  -- Lifecycle timestamps.
  started_at             timestamptz not null default now(),
  completed_at           timestamptz,

  -- Counters
  candidates_scanned     integer not null default 0,
  candidates_updated     integer not null default 0,

  -- Final outcome — 'ok' on success, 'error' when the rescorer aborted.
  status                 text not null default 'running'
                          check (status in ('running', 'ok', 'error')),

  -- Free-form structured summary. Kept deliberately open (jsonb) so the
  -- rescorer can evolve without schema migrations. Typical shape:
  --   { "tier_counts": { "hot": N, "warm": N, "cold": N },
  --     "errors": ["…"], "duration_ms": 512 }
  summary                jsonb not null default '{}'::jsonb,

  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists political_priority_runs_started_at_idx
  on public.political_priority_runs (started_at desc);
create index if not exists political_priority_runs_source_idx
  on public.political_priority_runs (source);
create index if not exists political_priority_runs_status_idx
  on public.political_priority_runs (status);
create index if not exists political_priority_runs_ran_by_idx
  on public.political_priority_runs (ran_by_user_id)
  where ran_by_user_id is not null;


-- ── RLS ──────────────────────────────────────────────────────────────────────

alter table public.political_priority_runs enable row level security;

drop policy if exists "political_priority_runs_service" on public.political_priority_runs;
create policy "political_priority_runs_service"
  on public.political_priority_runs for all to service_role using (true) with check (true);

drop policy if exists "political_priority_runs_admin" on public.political_priority_runs;
create policy "political_priority_runs_admin"
  on public.political_priority_runs for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_priority_runs_agent_read" on public.political_priority_runs;
create policy "political_priority_runs_agent_read"
  on public.political_priority_runs for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));


-- ── updated_at trigger (reuse 059 function) ─────────────────────────────────

drop trigger if exists trg_political_priority_runs_updated_at on public.political_priority_runs;
create trigger trg_political_priority_runs_updated_at
  before update on public.political_priority_runs
  for each row execute function public.tg_political_touch_updated_at();
