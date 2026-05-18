-- HomeReach Migration 091 - Political Multi-Candidate Creative Engine
--
-- Additive persistence layer for the existing Candidate Campaign Launch Agent.
-- This does not alter intake, Stripe, contracts, auth, Twilio/Postmark,
-- city/category exclusivity, or USPS route-selection tables.
--
-- Compliance boundary:
-- - Stores campaign creative, review comments, aggregate geography planning,
--   and human approval state only.
-- - Does not store individual voter persuasion scores, inferred ideology,
--   sensitive demographic targeting, or turnout-suppression data.
-- - Client-facing proposal/checkout remains locked until route counts,
--   pricing, source timestamps, and human approval are verified.

create table if not exists public.political_candidate_agent_targets (
  id uuid primary key default gen_random_uuid(),
  target_slug text not null unique,
  display_name text not null,
  office_sought text not null,
  state text not null default 'OH',
  party_or_committee text,
  campaign_frame text not null default '',
  source_status text not null default 'prebuilt_profile',
  source_urls jsonb not null default '[]'::jsonb,
  research_gaps jsonb not null default '[]'::jsonb,
  compliance_mode text not null default 'aggregate_geography_only',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_candidate_targeting_profiles (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references public.political_candidate_agent_targets(id) on delete cascade,
  target_slug text not null,
  geography_type text not null,
  geography_label text not null,
  objective text not null,
  rationale text not null,
  message_fit text not null,
  postcard_style text not null,
  phase_fit text not null,
  operational_complexity text not null default 'medium',
  estimated_mail_volume integer not null default 0,
  estimated_budget_low_cents bigint not null default 0,
  estimated_budget_high_cents bigint not null default 0,
  mail_efficiency_score integer not null default 0,
  route_density_score integer not null default 0,
  data_status text not null default 'needs_usps',
  source_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.political_candidate_creative_concepts (
  id uuid primary key default gen_random_uuid(),
  target_id uuid references public.political_candidate_agent_targets(id) on delete cascade,
  target_slug text not null,
  strategy_key text not null,
  phase_key text not null,
  category text not null,
  title text not null,
  headline text not null,
  subheadline text not null,
  front_body text not null,
  back_body text not null,
  cta text not null,
  suggested_imagery text not null,
  visual_direction text not null,
  color_style text not null,
  audience_fit text not null,
  geographic_fit text not null,
  emotional_strategy text not null,
  message_reinforcement_note text not null,
  ballot_window_note text not null,
  compliance_disclaimer text not null,
  editable_zones jsonb not null default '[]'::jsonb,
  internal_strategy_notes text not null default '',
  status text not null default 'draft',
  human_approved_at timestamptz,
  human_approved_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.political_candidate_creative_comments (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.political_candidate_creative_concepts(id) on delete cascade,
  target_slug text not null,
  comment_body text not null,
  revision_instruction text,
  revision_status text not null default 'requested',
  actor_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists political_candidate_agent_targets_slug_idx
  on public.political_candidate_agent_targets(target_slug);
create index if not exists political_candidate_targeting_profiles_slug_idx
  on public.political_candidate_targeting_profiles(target_slug);
create index if not exists political_candidate_creative_concepts_slug_idx
  on public.political_candidate_creative_concepts(target_slug, strategy_key, phase_key);
create index if not exists political_candidate_creative_comments_concept_idx
  on public.political_candidate_creative_comments(concept_id);

do $$
declare
  table_name text;
  table_names text[] := array[
    'political_candidate_agent_targets',
    'political_candidate_targeting_profiles',
    'political_candidate_creative_concepts',
    'political_candidate_creative_comments'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists %I on public.%I', table_name || '_admin_all', table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      table_name || '_admin_all',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_read', table_name);
    execute format(
      'create policy %I on public.%I for select to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_read',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_write', table_name);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_write',
      table_name
    );

    execute format('drop policy if exists %I on public.%I', table_name || '_sales_update', table_name);
    execute format(
      'create policy %I on public.%I for update to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent'')) with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') in (''admin'', ''sales_agent''))',
      table_name || '_sales_update',
      table_name
    );
  end loop;
end $$;

insert into public.political_candidate_agent_targets (
  target_slug,
  display_name,
  office_sought,
  state,
  party_or_committee,
  campaign_frame,
  source_urls,
  research_gaps
) values
  ('vivek-ramaswamy', 'Vivek Ramaswamy', 'Governor of Ohio', 'OH', 'Republican', 'Prebuilt statewide governor planning profile.', '["https://vivekforohio.com/"]'::jsonb, '["Verify official campaign contact", "Load USPS route counts"]'::jsonb),
  ('sherrod-brown', 'Sherrod Brown', 'U.S. Senate', 'OH', 'Democrat', 'Prebuilt federal statewide planning profile.', '["https://www.sherrodbrown.com/"]'::jsonb, '["Verify active 2026 committee", "Load USPS route counts"]'::jsonb),
  ('jon-husted', 'Jon Husted', 'U.S. Senate', 'OH', 'Republican', 'Prebuilt federal statewide planning profile.', '["https://www.jonhustedforsenate.com/"]'::jsonb, '["Verify official campaign contact", "Load USPS route counts"]'::jsonb),
  ('keith-faber', 'Keith Faber', 'Attorney General', 'OH', 'Republican', 'Prebuilt statewide Attorney General planning profile.', '["https://ohioauditor.gov/"]'::jsonb, '["Verify official campaign website", "Load USPS route counts"]'::jsonb),
  ('john-kulewicz', 'John Kulewicz', 'Attorney General', 'OH', 'Democrat', 'Prebuilt statewide Attorney General planning profile.', '["https://www.ohiosos.gov/elections/"]'::jsonb, '["Verify official campaign website", "Verify biography and platform", "Load USPS route counts"]'::jsonb),
  ('allison-russo', 'Allison Russo', 'Secretary of State', 'OH', 'Democrat', 'Prebuilt statewide Secretary of State planning profile.', '["https://www.allisonrusso.com/"]'::jsonb, '["Verify official campaign contact", "Load USPS route counts"]'::jsonb),
  ('robert-sprague', 'Robert Sprague', 'Secretary of State', 'OH', 'Republican', 'Prebuilt statewide Secretary of State planning profile.', '["https://www.spragueforohio.com/"]'::jsonb, '["Verify official campaign contact", "Load USPS route counts"]'::jsonb),
  ('ohio-democratic-party', 'Ohio Democratic Party', 'Coordinated Campaign / Party Mail Programs', 'OH', 'Democratic Party', 'Prebuilt party coordinated mail planning profile.', '["https://ohiodems.org/"]'::jsonb, '["Confirm approved slate and legal review", "Load USPS route counts"]'::jsonb),
  ('ohio-republican-party', 'Ohio Republican Party', 'Coordinated Campaign / Party Mail Programs', 'OH', 'Republican Party', 'Prebuilt party coordinated mail planning profile.', '["https://ohiogop.org/"]'::jsonb, '["Confirm approved slate and legal review", "Load USPS route counts"]'::jsonb)
on conflict (target_slug) do update set
  display_name = excluded.display_name,
  office_sought = excluded.office_sought,
  party_or_committee = excluded.party_or_committee,
  campaign_frame = excluded.campaign_frame,
  source_urls = excluded.source_urls,
  research_gaps = excluded.research_gaps,
  updated_at = now();
