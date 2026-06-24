alter table public.outreach_prospects
  add column if not exists vertical text,
  add column if not exists outreach_priority_score integer;

alter table public.daily_outreach_tasks
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists vertical text,
  add column if not exists recommended_offer text,
  add column if not exists outreach_priority_score integer,
  add column if not exists score_label text,
  add column if not exists today_suggested_action text,
  add column if not exists call_script text,
  add column if not exists outcome_status text,
  add column if not exists last_action_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'outreach_prospects_priority_score_check'
      and conrelid = 'public.outreach_prospects'::regclass
  ) then
    alter table public.outreach_prospects
      add constraint outreach_prospects_priority_score_check
      check (outreach_priority_score is null or (outreach_priority_score >= 0 and outreach_priority_score <= 100));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'daily_outreach_tasks_priority_score_check'
      and conrelid = 'public.daily_outreach_tasks'::regclass
  ) then
    alter table public.daily_outreach_tasks
      add constraint daily_outreach_tasks_priority_score_check
      check (outreach_priority_score is null or (outreach_priority_score >= 0 and outreach_priority_score <= 100));
  end if;
end $$;

create index if not exists outreach_prospects_targeted_vertical_idx
  on public.outreach_prospects (category, vertical, status, updated_at desc)
  where category = 'Targeted Campaign';

create index if not exists daily_outreach_tasks_targeted_vertical_idx
  on public.daily_outreach_tasks (outreach_date, category, vertical, outreach_priority_score desc)
  where category = 'Targeted Campaign';
