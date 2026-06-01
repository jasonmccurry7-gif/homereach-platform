-- Daily AI Video Content Engine
-- Additive social/video draft system for HomeReach admin.

create extension if not exists pgcrypto;

create table if not exists public.daily_video_content (
  id uuid primary key default gen_random_uuid(),
  content_date date not null,
  vertical text not null check (vertical in ('procurement', 'targeted_postcard', 'political')),
  title text not null,
  angle text not null,
  video_hook text not null,
  full_script text not null,
  voiceover_script text not null,
  primary_cta text not null,
  emotional_tone text not null,
  status text not null default 'draft' check (
    status in (
      'draft',
      'awaiting_approval',
      'approved',
      'scheduled',
      'published',
      'rejected',
      'needs_revision'
    )
  ),
  approval_required boolean not null default true,
  approval_status text not null default 'pending' check (
    approval_status in ('pending', 'approved', 'rejected', 'needs_revision')
  ),
  storyboard jsonb not null default '[]'::jsonb,
  canva_prompt text not null,
  canva_fields jsonb not null default '{}'::jsonb,
  canva_job jsonb not null default '{}'::jsonb,
  captions text[] not null default '{}',
  alternate_hooks text[] not null default '{}',
  dashboard_screenshots text[] not null default '{}',
  thumbnail_concept text not null,
  platform_posts jsonb not null default '{}'::jsonb,
  hashtags text[] not null default '{}',
  suggested_music_vibe text not null,
  ai_image_prompts text[] not null default '{}',
  motion_graphics text[] not null default '{}',
  camera_movements text[] not null default '{}',
  transition_instructions text[] not null default '{}',
  emotional_guidance text not null,
  suggested_posting_times jsonb not null default '{}'::jsonb,
  engagement_strategy text[] not null default '{}',
  logo_outro_spec jsonb not null default '{}'::jsonb,
  manual_publish_checklist text[] not null default '{}',
  scheduled_at timestamptz,
  published_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  rejected_reason text,
  generated_by text not null default 'daily_ai_video_content_engine',
  source_context jsonb not null default '{}'::jsonb,
  optimization_notes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (content_date, vertical)
);

create table if not exists public.daily_video_platform_posts (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.daily_video_content(id) on delete cascade,
  platform text not null check (
    platform in ('facebook_reels', 'instagram_reels', 'tiktok', 'linkedin', 'youtube_shorts')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'awaiting_approval', 'approved', 'scheduled', 'published', 'manual_publish_ready', 'failed')
  ),
  caption text not null,
  hashtags text[] not null default '{}',
  thumbnail_concept text not null default '',
  recommended_posting_time text not null default '',
  checklist text[] not null default '{}',
  external_post_id text,
  external_url text,
  scheduled_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, platform)
);

create table if not exists public.daily_video_metrics (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.daily_video_content(id) on delete cascade,
  platform text not null check (
    platform in ('facebook_reels', 'instagram_reels', 'tiktok', 'linkedin', 'youtube_shorts', 'aggregate')
  ),
  metric_date date not null default current_date,
  views integer not null default 0,
  likes integer not null default 0,
  comments integer not null default 0,
  shares integer not null default 0,
  saves integer not null default 0,
  watch_time_seconds integer not null default 0,
  dms_generated integer not null default 0,
  leads_generated integer not null default 0,
  conversions_generated integer not null default 0,
  raw_metrics jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, platform, metric_date)
);

create table if not exists public.daily_video_activity_log (
  id uuid primary key default gen_random_uuid(),
  video_id uuid references public.daily_video_content(id) on delete set null,
  actor_type text not null default 'system' check (actor_type in ('system', 'admin', 'ai_agent')),
  actor_id uuid,
  action_type text not null,
  result_status text not null default 'success' check (result_status in ('success', 'failed', 'blocked', 'skipped')),
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists daily_video_content_date_status_idx
  on public.daily_video_content (content_date desc, status, vertical);

create index if not exists daily_video_content_vertical_idx
  on public.daily_video_content (vertical, content_date desc);

create index if not exists daily_video_platform_posts_video_idx
  on public.daily_video_platform_posts (video_id, platform);

create index if not exists daily_video_metrics_video_date_idx
  on public.daily_video_metrics (video_id, metric_date desc);

create index if not exists daily_video_activity_log_video_created_idx
  on public.daily_video_activity_log (video_id, created_at desc);

alter table public.daily_video_content enable row level security;
alter table public.daily_video_platform_posts enable row level security;
alter table public.daily_video_metrics enable row level security;
alter table public.daily_video_activity_log enable row level security;

drop policy if exists daily_video_content_admin_all on public.daily_video_content;
create policy daily_video_content_admin_all
on public.daily_video_content
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists daily_video_platform_posts_admin_all on public.daily_video_platform_posts;
create policy daily_video_platform_posts_admin_all
on public.daily_video_platform_posts
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists daily_video_metrics_admin_all on public.daily_video_metrics;
create policy daily_video_metrics_admin_all
on public.daily_video_metrics
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists daily_video_activity_log_admin_all on public.daily_video_activity_log;
create policy daily_video_activity_log_admin_all
on public.daily_video_activity_log
for all
to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

create or replace function public.tg_daily_video_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists daily_video_content_touch_updated_at on public.daily_video_content;
create trigger daily_video_content_touch_updated_at
before update on public.daily_video_content
for each row execute function public.tg_daily_video_touch_updated_at();

drop trigger if exists daily_video_platform_posts_touch_updated_at on public.daily_video_platform_posts;
create trigger daily_video_platform_posts_touch_updated_at
before update on public.daily_video_platform_posts
for each row execute function public.tg_daily_video_touch_updated_at();

drop trigger if exists daily_video_metrics_touch_updated_at on public.daily_video_metrics;
create trigger daily_video_metrics_touch_updated_at
before update on public.daily_video_metrics
for each row execute function public.tg_daily_video_touch_updated_at();
;
