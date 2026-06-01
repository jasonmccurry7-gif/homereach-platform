-- HomeReach Autonomous Content Engine
-- Canonical asset library, publication ledger, metrics, and learning events.
-- Additive only. Existing Daily Content, AI Assets, Canva, Growth Engine, and
-- revenue messaging tables remain the source systems they already are.

create extension if not exists pgcrypto;
create table if not exists public.content_assets (
  id uuid primary key default gen_random_uuid(),
  asset_type text not null check (
    asset_type in (
      'short_form_video',
      'caption',
      'hook',
      'script',
      'thumbnail',
      'template',
      'visual',
      'voiceover',
      'post',
      'campaign_packet'
    )
  ),
  title text not null,
  vertical text,
  category text,
  status text not null default 'draft' check (status in ('draft','active','archived','needs_review')),
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  source_workflow text,
  source_table text,
  source_id uuid,
  owner_user_id uuid references public.profiles(id) on delete set null,
  source_context jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.content_asset_versions (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.content_assets(id) on delete cascade,
  version_number integer not null default 1 check (version_number > 0),
  title text,
  body text not null default '',
  content_hash text not null,
  ai_output_id uuid references public.ai_outputs(id) on delete set null,
  daily_video_id uuid references public.daily_video_content(id) on delete set null,
  canva_design_job_id uuid,
  canva_export_job_id uuid,
  platform_payload jsonb not null default '{}'::jsonb,
  media_urls text[] not null default '{}',
  created_by_agent text,
  approval_status text not null default 'needs_review' check (approval_status in ('draft','needs_review','approved','rejected','revision_needed','archived')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed','needs_review')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (asset_id, version_number),
  unique (asset_id, content_hash)
);
create table if not exists public.content_asset_sources (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.content_assets(id) on delete cascade,
  source_type text not null,
  source_id uuid,
  source_url text,
  source_label text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.social_publication_records (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.content_assets(id) on delete set null,
  version_id uuid references public.content_asset_versions(id) on delete set null,
  daily_video_id uuid references public.daily_video_content(id) on delete set null,
  platform_post_id uuid references public.daily_video_platform_posts(id) on delete set null,
  ai_output_id uuid references public.ai_outputs(id) on delete set null,
  provider text not null default 'manual',
  platform text not null,
  account_id text,
  page_id text,
  status text not null default 'draft' check (status in ('draft','manual_publish_ready','scheduled','published','failed','cancelled','blocked')),
  approval_status text not null default 'needs_review' check (approval_status in ('needs_review','approved','rejected','revision_needed','not_required')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','failed','needs_review','not_required')),
  content_hash text,
  caption text,
  media_urls text[] not null default '{}',
  external_post_id text,
  external_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  raw_provider_payload jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.social_post_metrics_daily (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.social_publication_records(id) on delete cascade,
  metric_date date not null default current_date,
  views integer not null default 0,
  reach integer not null default 0,
  impressions integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  watch_time_seconds integer not null default 0,
  average_watch_time_seconds numeric(10,2),
  retention_rate numeric(5,2),
  completion_rate numeric(5,2),
  clicks integer not null default 0,
  dms_generated integer not null default 0,
  leads_generated integer not null default 0,
  conversions_generated integer not null default 0,
  estimated_revenue numeric(12,2),
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, metric_date)
);
create table if not exists public.content_learning_events (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.content_assets(id) on delete set null,
  version_id uuid references public.content_asset_versions(id) on delete set null,
  publication_id uuid references public.social_publication_records(id) on delete set null,
  daily_video_id uuid references public.daily_video_content(id) on delete set null,
  ai_output_id uuid references public.ai_outputs(id) on delete set null,
  event_type text not null,
  signal text not null,
  platform text,
  score numeric(8,2),
  occurred_at timestamptz not null default now(),
  source_table text,
  source_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create unique index if not exists content_assets_source_unique
  on public.content_assets (source_table, source_id)
  where source_table is not null and source_id is not null;
create index if not exists content_assets_status_idx
  on public.content_assets (status, approval_status, updated_at desc);
create index if not exists content_asset_versions_hash_idx
  on public.content_asset_versions (content_hash);
create index if not exists content_asset_sources_asset_idx
  on public.content_asset_sources (asset_id, source_type);
create unique index if not exists social_publication_platform_post_unique
  on public.social_publication_records (platform_post_id)
  where platform_post_id is not null;
create index if not exists social_publication_records_status_idx
  on public.social_publication_records (status, platform, updated_at desc);
create index if not exists social_publication_records_external_idx
  on public.social_publication_records (provider, external_post_id)
  where external_post_id is not null;
create index if not exists social_post_metrics_daily_date_idx
  on public.social_post_metrics_daily (metric_date desc);
create index if not exists content_learning_events_signal_idx
  on public.content_learning_events (event_type, platform, occurred_at desc);
create or replace function public.tg_content_engine_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists content_assets_touch_updated_at on public.content_assets;
create trigger content_assets_touch_updated_at
before update on public.content_assets
for each row execute function public.tg_content_engine_touch_updated_at();
drop trigger if exists social_publication_records_touch_updated_at on public.social_publication_records;
create trigger social_publication_records_touch_updated_at
before update on public.social_publication_records
for each row execute function public.tg_content_engine_touch_updated_at();
drop trigger if exists social_post_metrics_daily_touch_updated_at on public.social_post_metrics_daily;
create trigger social_post_metrics_daily_touch_updated_at
before update on public.social_post_metrics_daily
for each row execute function public.tg_content_engine_touch_updated_at();
alter table public.content_assets enable row level security;
alter table public.content_asset_versions enable row level security;
alter table public.content_asset_sources enable row level security;
alter table public.social_publication_records enable row level security;
alter table public.social_post_metrics_daily enable row level security;
alter table public.content_learning_events enable row level security;
grant select, insert, update, delete on
  public.content_assets,
  public.content_asset_versions,
  public.content_asset_sources,
  public.social_publication_records,
  public.social_post_metrics_daily,
  public.content_learning_events
to authenticated;
grant select, insert, update, delete on
  public.content_assets,
  public.content_asset_versions,
  public.content_asset_sources,
  public.social_publication_records,
  public.social_post_metrics_daily,
  public.content_learning_events
to service_role;
do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'content_assets',
    'content_asset_versions',
    'content_asset_sources',
    'social_publication_records',
    'social_post_metrics_daily',
    'content_learning_events'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', tbl || '_admin_all', tbl);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'') with check ((auth.jwt() -> ''app_metadata'' ->> ''user_role'') = ''admin'')',
      tbl || '_admin_all',
      tbl
    );
  end loop;
end $$;
