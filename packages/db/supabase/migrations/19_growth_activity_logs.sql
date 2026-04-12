-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 19: Growth Activity Logs
--
-- Tracks daily outbound sales activity across all channels.
-- Enables expected vs actual performance analysis.
-- Required for the /admin/growth dashboard.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Channel enum ──────────────────────────────────────────────────────────────

do $$ begin
  create type growth_channel as enum (
    'email',
    'sms',
    'facebook_dm',
    'facebook_post',
    'facebook_ads'
  );
exception
  when duplicate_object then null;
end $$;

-- ── Growth activity logs table ────────────────────────────────────────────────

create table if not exists growth_activity_logs (
  id                    uuid primary key default gen_random_uuid(),

  -- When this activity happened
  date                  date not null,

  -- Which outreach channel
  channel               growth_channel not null,

  -- Inputs: what was sent / published / spent
  -- For email/sms/facebook_dm: number of messages sent
  -- For facebook_post: number of posts made
  -- For facebook_ads: set to 1; use ad_spend_cents for the actual metric
  volume_sent           integer not null default 0,

  -- Ad spend in cents (only meaningful for facebook_ads)
  ad_spend_cents        integer not null default 0,

  -- Outputs: what came back
  -- For email/sms/facebook_dm: replies received
  -- For facebook_post/facebook_ads: inbound leads generated
  responses             integer not null default 0,

  -- Funnel: qualified conversations that progressed from this channel/day
  conversations_started integer not null default 0,

  -- Revenue: deals closed attributed to this channel/day
  -- NOTE: a deal can be attributed to a single channel for simplicity.
  -- If a lead came from multiple touches, attribute to the closing channel.
  deals_closed          integer not null default 0,

  -- Free-form notes about the day's activity
  notes                 text,

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  -- One row per day per channel — prevents duplicate entries
  unique (date, channel)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Range queries: "last 30 days", "this week", etc.
create index if not exists growth_activity_logs_date_idx
  on growth_activity_logs (date desc);

-- Channel-specific analysis
create index if not exists growth_activity_logs_channel_idx
  on growth_activity_logs (channel);

-- ── RLS ───────────────────────────────────────────────────────────────────────
-- Admin-only. No public or authenticated user access.

alter table growth_activity_logs enable row level security;

-- Admin write + read (service role bypasses RLS — this covers API routes)
-- If you add per-user admin access, add a policy here.
-- For now, all access goes through the service role key (server-side only).
