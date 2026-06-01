-- Social Meta Connected Publishing
-- Additive foundation for client-authorized Facebook Page / Instagram posting.
-- Tokens are stored encrypted by the application layer. Publishing remains
-- approval-gated and can be disabled by feature flags or SOCIAL_PUBLISHING_MODE.

create extension if not exists pgcrypto;

create table if not exists public.social_meta_connections (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.profiles(id) on delete set null,
  client_email text,
  business_name text,
  provider text not null default 'meta' check (provider in ('meta')),
  connection_type text not null default 'facebook_login' check (connection_type in ('facebook_login', 'instagram_login')),
  meta_user_id text,
  meta_user_name text,
  page_id text,
  page_name text,
  page_access_token_encrypted text,
  user_access_token_encrypted text,
  instagram_business_account_id text,
  instagram_username text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status text not null default 'connected' check (status in ('connected', 'needs_reconnect', 'revoked', 'disabled', 'error')),
  last_verified_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_publish_attempts (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid references public.social_publication_records(id) on delete cascade,
  connection_id uuid references public.social_meta_connections(id) on delete set null,
  provider text not null default 'meta',
  platform text not null,
  action text not null default 'publish_now' check (action in ('publish_now', 'publish_due', 'schedule', 'manual_mark')),
  status text not null default 'queued' check (status in ('queued', 'blocked', 'published', 'failed', 'skipped')),
  attempted_by uuid references public.profiles(id) on delete set null,
  attempted_at timestamptz not null default now(),
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  external_post_id text,
  external_url text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.social_publication_records
  add column if not exists meta_connection_id uuid references public.social_meta_connections(id) on delete set null,
  add column if not exists publish_mode text not null default 'manual' check (publish_mode in ('manual', 'meta_auto')),
  add column if not exists publish_after_approval boolean not null default false,
  add column if not exists last_publish_attempt_at timestamptz,
  add column if not exists last_publish_error text;

create unique index if not exists social_meta_connections_page_unique
  on public.social_meta_connections (provider, page_id);

create unique index if not exists social_meta_connections_instagram_unique
  on public.social_meta_connections (provider, instagram_business_account_id);

create index if not exists social_meta_connections_owner_idx
  on public.social_meta_connections (owner_user_id, status, updated_at desc);

create index if not exists social_meta_connections_client_idx
  on public.social_meta_connections (client_id, status, updated_at desc);

create index if not exists social_publish_attempts_publication_idx
  on public.social_publish_attempts (publication_id, attempted_at desc);

create index if not exists social_publish_attempts_status_idx
  on public.social_publish_attempts (provider, platform, status, attempted_at desc);

create index if not exists social_publication_records_meta_queue_idx
  on public.social_publication_records (provider, status, scheduled_at, approval_status, verification_status)
  where provider = 'meta';

create or replace function public.tg_social_meta_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists social_meta_connections_touch_updated_at on public.social_meta_connections;
create trigger social_meta_connections_touch_updated_at
before update on public.social_meta_connections
for each row execute function public.tg_social_meta_touch_updated_at();

alter table public.social_meta_connections enable row level security;
alter table public.social_publish_attempts enable row level security;

grant select, insert, update, delete on
  public.social_meta_connections,
  public.social_publish_attempts
to authenticated;

grant select, insert, update, delete on
  public.social_meta_connections,
  public.social_publish_attempts
to service_role;

drop policy if exists social_meta_connections_admin_all on public.social_meta_connections;
create policy social_meta_connections_admin_all
on public.social_meta_connections
for all
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');

drop policy if exists social_meta_connections_owner_select on public.social_meta_connections;
create policy social_meta_connections_owner_select
on public.social_meta_connections
for select
to authenticated
using (owner_user_id = auth.uid() or client_id = auth.uid());

drop policy if exists social_meta_connections_owner_insert on public.social_meta_connections;
create policy social_meta_connections_owner_insert
on public.social_meta_connections
for insert
to authenticated
with check (owner_user_id = auth.uid() or client_id = auth.uid());

drop policy if exists social_meta_connections_owner_update on public.social_meta_connections;
create policy social_meta_connections_owner_update
on public.social_meta_connections
for update
to authenticated
using (owner_user_id = auth.uid() or client_id = auth.uid())
with check (owner_user_id = auth.uid() or client_id = auth.uid());

drop policy if exists social_publish_attempts_admin_all on public.social_publish_attempts;
create policy social_publish_attempts_admin_all
on public.social_publish_attempts
for all
to authenticated
using (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin')
with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') = 'admin');

drop policy if exists social_publish_attempts_owner_select on public.social_publish_attempts;
create policy social_publish_attempts_owner_select
on public.social_publish_attempts
for select
to authenticated
using (
  exists (
    select 1
    from public.social_meta_connections c
    where c.id = social_publish_attempts.connection_id
      and (c.owner_user_id = auth.uid() or c.client_id = auth.uid())
  )
);
