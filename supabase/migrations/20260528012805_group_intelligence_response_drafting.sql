-- Group Intelligence & Response Drafting.
--
-- Additive, admin-supervised Facebook/local group research layer.
-- This supports manual/import-assisted review, pain-point extraction, response
-- drafting, follow-up tracking, and optional conversion into existing
-- sales_leads. It does not auto-post, auto-DM, bypass platform rules, or send
-- outbound messages.

create table if not exists public.group_intelligence_sources (
  id uuid primary key default gen_random_uuid(),
  group_name text not null,
  group_url text,
  group_type text not null default 'local_small_business'
    check (group_type in (
      'local_small_business',
      'restaurant_owner',
      'bakery',
      'real_estate',
      'contractor',
      'lawncare',
      'dealership',
      'chamber_community',
      'political_campaign',
      'other'
    )),
  access_basis text not null default 'member_authorized'
    check (access_basis in ('member_authorized','public','manual_import','unknown')),
  status text not null default 'active'
    check (status in ('active','paused','archived')),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.group_intelligence_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.group_intelligence_sources(id) on delete set null,
  group_name text not null,
  post_author_name text,
  business_name text,
  business_type text,
  post_url text,
  observed_at timestamptz not null default now(),
  source_text text not null,
  pain_point_summary text not null,
  urgency_level text not null default 'medium'
    check (urgency_level in ('low','medium','high','urgent')),
  opportunity_category text not null default 'General small business advice opportunity'
    check (opportunity_category in (
      'Supplyfy opportunity',
      'HomeReach postcard opportunity',
      'Sunshine Cupcakes partnership opportunity',
      'Catering / corporate order opportunity',
      'Restaurant dessert partnership opportunity',
      'Realtor gifting opportunity',
      'Political outreach opportunity',
      'General small business advice opportunity',
      'Not relevant'
    )),
  opportunity_score integer not null default 0
    check (opportunity_score >= 0 and opportunity_score <= 100),
  recommended_response_angle text not null default '',
  suggested_service_fit text not null default '',
  follow_up_suggestion text not null default '',
  status text not null default 'New'
    check (status in (
      'New',
      'Reviewed',
      'Comment Drafted',
      'DM Drafted',
      'Responded',
      'Follow-Up Due',
      'Converted to Lead',
      'Not Relevant',
      'Archived'
    )),
  notes text,
  copied_public_comment_at timestamptz,
  copied_dm_at timestamptz,
  responded_at timestamptz,
  follow_up_due_at timestamptz,
  converted_lead_id uuid references public.sales_leads(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.group_response_drafts (
  id uuid primary key default gen_random_uuid(),
  observation_id uuid not null references public.group_intelligence_observations(id) on delete cascade,
  draft_type text not null
    check (draft_type in ('public_comment','private_dm','follow_up','facebook_post_idea')),
  title text,
  content text not null,
  tone text not null default 'helpful_local_human',
  approval_status text not null default 'needs_review'
    check (approval_status in ('draft','needs_review','approved','rejected','archived')),
  copied_at timestamptz,
  copied_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists group_intelligence_sources_status_idx
  on public.group_intelligence_sources (status, updated_at desc);

create index if not exists group_intelligence_observations_score_idx
  on public.group_intelligence_observations (opportunity_score desc, created_at desc);

create index if not exists group_intelligence_observations_status_idx
  on public.group_intelligence_observations (status, updated_at desc);

create index if not exists group_intelligence_observations_category_idx
  on public.group_intelligence_observations (opportunity_category, opportunity_score desc);

create index if not exists group_response_drafts_observation_idx
  on public.group_response_drafts (observation_id, draft_type);

alter table public.group_intelligence_sources enable row level security;
alter table public.group_intelligence_observations enable row level security;
alter table public.group_response_drafts enable row level security;

drop policy if exists "group_intelligence_sources_admin_all" on public.group_intelligence_sources;
create policy "group_intelligence_sources_admin_all"
  on public.group_intelligence_sources for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "group_intelligence_observations_admin_all" on public.group_intelligence_observations;
create policy "group_intelligence_observations_admin_all"
  on public.group_intelligence_observations for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "group_response_drafts_admin_all" on public.group_response_drafts;
create policy "group_response_drafts_admin_all"
  on public.group_response_drafts for all
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

grant select, insert, update, delete on public.group_intelligence_sources to authenticated;
grant select, insert, update, delete on public.group_intelligence_observations to authenticated;
grant select, insert, update, delete on public.group_response_drafts to authenticated;

grant all on public.group_intelligence_sources to service_role;
grant all on public.group_intelligence_observations to service_role;
grant all on public.group_response_drafts to service_role;

comment on table public.group_intelligence_sources is
  'Authorized local/Facebook group sources for manual Group Intelligence review. No scraping or posting automation.';

comment on table public.group_intelligence_observations is
  'Manual/import-assisted group pain-point observations with supervised opportunity scoring and lead conversion.';

comment on table public.group_response_drafts is
  'Human-review-first public comment, DM, follow-up, and post idea drafts generated from group observations.';
