-- AI COO MVP
-- Phase 2 adds a deterministic recommendation layer over existing HomeReach
-- records. It does not add Business Memory, ad API launch, predictive scoring,
-- autonomous outreach, or autonomous payment/vendor/campaign actions.

create table if not exists public.opportunity_categories (
  category text primary key check (category in (
    'revenue',
    'cost_savings',
    'reputation',
    'growth',
    'risk',
    'renewal',
    'upsell'
  )),
  display_name text not null,
  description text not null,
  sort_order integer not null default 100,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.opportunity_categories (category, display_name, description, sort_order)
values
  ('revenue', 'Revenue Opportunities', 'Actions designed to create new customer demand or protect existing revenue.', 10),
  ('cost_savings', 'Cost Savings Opportunities', 'Actions designed to reduce recurring operating cost without committing spend automatically.', 20),
  ('reputation', 'Reputation Opportunities', 'Actions designed to improve trust, reviews, testimonials, and customer follow-up.', 30),
  ('growth', 'Growth Opportunities', 'Actions designed to expand into better neighborhoods, geographies, events, or service areas.', 40),
  ('risk', 'Risk Alerts', 'Items that may block revenue, fulfillment, reporting, payment, or renewal.', 50),
  ('renewal', 'Renewal Opportunities', 'Actions designed to protect recurring revenue and improve retention.', 60),
  ('upsell', 'Upsell Opportunities', 'Actions designed to add useful approved services when the timing is right.', 70)
on conflict (category) do update set
  display_name = excluded.display_name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  updated_at = now();

create table if not exists public.ai_coo_recommendations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  client_name text,
  business_name text,
  category text not null references public.opportunity_categories(category),
  opportunity_type text not null,
  title text not null,
  estimated_value_cents integer not null default 0,
  estimated_savings_cents integer not null default 0,
  estimated_impact_label text,
  why_it_matters text not null,
  recommended_action text not null,
  priority_score integer not null default 50 check (priority_score >= 0 and priority_score <= 100),
  value_score integer not null default 50 check (value_score >= 0 and value_score <= 100),
  confidence_score integer not null default 50 check (confidence_score >= 0 and confidence_score <= 100),
  urgency_score integer not null default 50 check (urgency_score >= 0 and urgency_score <= 100),
  confidence_level text not null default 'medium' check (confidence_level in ('low','medium','high')),
  risk_level text check (risk_level in ('low','medium','high','critical')),
  status text not null default 'new' check (status in (
    'new',
    'reviewed',
    'approved',
    'in_progress',
    'completed',
    'dismissed',
    'expired'
  )),
  source text not null default 'ai_coo_mvp',
  related_entity_type text,
  related_entity_id text,
  owner text not null default 'ai_coo',
  action_labels jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  dismissal_reason text,
  due_at timestamptz,
  expires_at timestamptz,
  completed_at timestamptz,
  created_by text not null default 'ai_coo_recommendation_engine',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_coo_recommendations_client_idx
  on public.ai_coo_recommendations (client_id, status, priority_score desc, created_at desc);
create index if not exists ai_coo_recommendations_email_idx
  on public.ai_coo_recommendations (lower(client_email), status, priority_score desc, created_at desc);
create index if not exists ai_coo_recommendations_admin_queue_idx
  on public.ai_coo_recommendations (status, category, priority_score desc, created_at desc);
create index if not exists ai_coo_recommendations_related_idx
  on public.ai_coo_recommendations (related_entity_type, related_entity_id);
create unique index if not exists ai_coo_recommendations_active_source_key
  on public.ai_coo_recommendations (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    category,
    opportunity_type,
    coalesce(related_entity_type, ''),
    coalesce(related_entity_id, '')
  )
  where status in ('new','reviewed','approved','in_progress');

create table if not exists public.ai_coo_actions (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.ai_coo_recommendations(id) on delete cascade,
  action_type text not null,
  label text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  status text not null default 'recorded' check (status in (
    'recorded',
    'requires_approval',
    'queued',
    'in_progress',
    'completed',
    'dismissed'
  )),
  approval_required boolean not null default true,
  no_autonomous_action boolean not null default true,
  related_task_id uuid,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_coo_actions_recommendation_idx
  on public.ai_coo_actions (recommendation_id, created_at desc);
create index if not exists ai_coo_actions_status_idx
  on public.ai_coo_actions (status, action_type, created_at desc);

create table if not exists public.ai_coo_drafts (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.ai_coo_recommendations(id) on delete cascade,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  draft_type text not null,
  label text not null,
  content text not null,
  approval_status text not null default 'draft' check (approval_status in (
    'draft',
    'needs_review',
    'approved',
    'rejected'
  )),
  copy_count integer not null default 0,
  last_copied_at timestamptz,
  created_by text not null default 'ai_coo_draft_generator',
  created_at timestamptz not null default now()
);

create index if not exists ai_coo_drafts_recommendation_idx
  on public.ai_coo_drafts (recommendation_id, draft_type, created_at desc);
create index if not exists ai_coo_drafts_client_idx
  on public.ai_coo_drafts (client_id, draft_type, created_at desc);

create table if not exists public.ai_coo_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  score_type text not null default 'scoreboard',
  score integer not null default 0 check (score >= 0 and score <= 100),
  color text not null default 'yellow' check (color in ('green','yellow','red')),
  recommended_next_action text not null default 'Review today''s top recommendation',
  components jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists ai_coo_scores_client_score_type_key
  on public.ai_coo_scores (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, '')),
    score_type
  );

create table if not exists public.client_success_scores (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  score integer not null default 0 check (score >= 0 and score <= 100),
  color text not null default 'yellow' check (color in ('green','yellow','red')),
  campaign_activity_score integer not null default 0 check (campaign_activity_score >= 0 and campaign_activity_score <= 100),
  opportunity_acceptance_score integer not null default 0 check (opportunity_acceptance_score >= 0 and opportunity_acceptance_score <= 100),
  task_completion_score integer not null default 0 check (task_completion_score >= 0 and task_completion_score <= 100),
  reporting_compliance_score integer not null default 0 check (reporting_compliance_score >= 0 and reporting_compliance_score <= 100),
  recommended_next_action text not null default 'Review today''s top recommendation',
  components jsonb not null default '{}'::jsonb,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists client_success_scores_client_key
  on public.client_success_scores (
    coalesce(client_id::text, ''),
    lower(coalesce(client_email, ''))
  );

create table if not exists public.recommendation_history (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.ai_coo_recommendations(id) on delete cascade,
  from_status text,
  to_status text,
  action text not null,
  actor_user_id uuid references public.profiles(id) on delete set null,
  actor_label text,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists recommendation_history_recommendation_idx
  on public.recommendation_history (recommendation_id, created_at desc);

alter table public.opportunity_categories enable row level security;
alter table public.ai_coo_recommendations enable row level security;
alter table public.ai_coo_actions enable row level security;
alter table public.ai_coo_drafts enable row level security;
alter table public.ai_coo_scores enable row level security;
alter table public.client_success_scores enable row level security;
alter table public.recommendation_history enable row level security;

grant select on public.opportunity_categories to anon, authenticated;
grant select, insert, update, delete on
  public.ai_coo_recommendations,
  public.ai_coo_actions,
  public.ai_coo_drafts,
  public.ai_coo_scores,
  public.client_success_scores,
  public.recommendation_history
to authenticated;

grant all on
  public.opportunity_categories,
  public.ai_coo_recommendations,
  public.ai_coo_actions,
  public.ai_coo_drafts,
  public.ai_coo_scores,
  public.client_success_scores,
  public.recommendation_history
to service_role;

drop policy if exists opportunity_categories_read on public.opportunity_categories;
create policy opportunity_categories_read
  on public.opportunity_categories for select
  using (active = true);

drop policy if exists opportunity_categories_service on public.opportunity_categories;
create policy opportunity_categories_service
  on public.opportunity_categories for all to service_role
  using (true) with check (true);

drop policy if exists ai_coo_recommendations_service on public.ai_coo_recommendations;
create policy ai_coo_recommendations_service
  on public.ai_coo_recommendations for all to service_role
  using (true) with check (true);

drop policy if exists ai_coo_recommendations_admin_all on public.ai_coo_recommendations;
create policy ai_coo_recommendations_admin_all
  on public.ai_coo_recommendations for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists ai_coo_recommendations_client_select on public.ai_coo_recommendations;
create policy ai_coo_recommendations_client_select
  on public.ai_coo_recommendations for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists ai_coo_actions_service on public.ai_coo_actions;
create policy ai_coo_actions_service
  on public.ai_coo_actions for all to service_role
  using (true) with check (true);

drop policy if exists ai_coo_actions_admin_all on public.ai_coo_actions;
create policy ai_coo_actions_admin_all
  on public.ai_coo_actions for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists ai_coo_actions_client_select on public.ai_coo_actions;
create policy ai_coo_actions_client_select
  on public.ai_coo_actions for select to authenticated
  using (exists (
    select 1 from public.ai_coo_recommendations r
    where r.id = recommendation_id
      and (r.client_id = auth.uid() or lower(r.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

drop policy if exists ai_coo_drafts_service on public.ai_coo_drafts;
create policy ai_coo_drafts_service
  on public.ai_coo_drafts for all to service_role
  using (true) with check (true);

drop policy if exists ai_coo_drafts_admin_all on public.ai_coo_drafts;
create policy ai_coo_drafts_admin_all
  on public.ai_coo_drafts for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists ai_coo_drafts_client_select on public.ai_coo_drafts;
create policy ai_coo_drafts_client_select
  on public.ai_coo_drafts for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists ai_coo_scores_service on public.ai_coo_scores;
create policy ai_coo_scores_service
  on public.ai_coo_scores for all to service_role
  using (true) with check (true);

drop policy if exists ai_coo_scores_admin_all on public.ai_coo_scores;
create policy ai_coo_scores_admin_all
  on public.ai_coo_scores for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists ai_coo_scores_client_select on public.ai_coo_scores;
create policy ai_coo_scores_client_select
  on public.ai_coo_scores for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists client_success_scores_service on public.client_success_scores;
create policy client_success_scores_service
  on public.client_success_scores for all to service_role
  using (true) with check (true);

drop policy if exists client_success_scores_admin_all on public.client_success_scores;
create policy client_success_scores_admin_all
  on public.client_success_scores for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists client_success_scores_client_select on public.client_success_scores;
create policy client_success_scores_client_select
  on public.client_success_scores for select to authenticated
  using (
    client_id = auth.uid()
    or lower(client_email) = lower(coalesce(auth.jwt()->>'email', ''))
  );

drop policy if exists recommendation_history_service on public.recommendation_history;
create policy recommendation_history_service
  on public.recommendation_history for all to service_role
  using (true) with check (true);

drop policy if exists recommendation_history_admin_all on public.recommendation_history;
create policy recommendation_history_admin_all
  on public.recommendation_history for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'))
  with check ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists recommendation_history_client_select on public.recommendation_history;
create policy recommendation_history_client_select
  on public.recommendation_history for select to authenticated
  using (exists (
    select 1 from public.ai_coo_recommendations r
    where r.id = recommendation_id
      and (r.client_id = auth.uid() or lower(r.client_email) = lower(coalesce(auth.jwt()->>'email', '')))
  ));

comment on table public.ai_coo_recommendations is
  'Phase 2 AI COO MVP recommendation feed. Recommendations are advisory only and require human/client approval before execution.';
comment on table public.ai_coo_actions is
  'Approval-gated action records for AI COO recommendations. No row in this table executes paid ads, outreach, payments, or vendor spend.';
comment on table public.ai_coo_drafts is
  'Copyable AI COO draft messages tied to recommendation records. Drafts require human approval before outbound use.';
comment on table public.client_success_scores is
  'Phase 2 simple 0-100 client success score from campaign activity, opportunity acceptance, task completion, and reporting compliance.';
