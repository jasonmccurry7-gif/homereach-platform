-- HomeReach Migration 078 - Political public planner snapshots
--
-- Additive storage for the public /political planner so an inbound lead can
-- preserve the exact recommendation, selected scenario, route coverage, and
-- proposal handoff state that produced it.

alter table public.political_outreach_leads
  add column if not exists planner_intent text not null default 'request_review'
  check (planner_intent in ('request_review', 'generate_proposal'));

alter table public.political_outreach_leads
  add column if not exists strategy_snapshot jsonb not null default '{}'::jsonb;

alter table public.political_outreach_leads
  add column if not exists selected_scenario_snapshot jsonb not null default '{}'::jsonb;

alter table public.political_outreach_leads
  add column if not exists scenario_comparison_snapshot jsonb not null default '[]'::jsonb;

alter table public.political_outreach_leads
  add column if not exists route_coverage_snapshot jsonb not null default '{}'::jsonb;

alter table public.political_outreach_leads
  add column if not exists selected_route_ids text[] not null default '{}'::text[];

alter table public.political_outreach_leads
  add column if not exists proposal_generated_at timestamptz;

alter table public.political_outreach_leads
  add column if not exists proposal_id uuid references public.political_proposals(id) on delete set null;

create index if not exists political_outreach_leads_planner_intent_idx
  on public.political_outreach_leads (planner_intent);

create index if not exists political_outreach_leads_proposal_idx
  on public.political_outreach_leads (proposal_id)
  where proposal_id is not null;
