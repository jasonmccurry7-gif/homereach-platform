-- Property intelligence schema alignment
--
-- This migration captures the existing out-of-band property-intelligence tables
-- in version control and adds the Stripe checkout-session id needed by the
-- current webhook finalizer. It is intentionally additive:
-- - Existing tables are not dropped or recreated.
-- - No data is deleted or backfilled.
-- - The missing checkout-session column is nullable.

create table if not exists public.property_intelligence_tiers (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  tier text not null check (tier = any (array['t1'::text, 't2'::text, 't3'::text])),
  tier_name text not null,
  standard_price_cents integer not null,
  founding_price_cents integer not null,
  leads_per_month integer,
  market_size text,
  description text,
  features jsonb default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.founding_slots (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  category text,
  product text not null,
  tier text not null,
  total_slots integer not null default 1,
  slots_taken integer not null default 0,
  slots_remaining integer,
  founding_open boolean not null default true,
  standard_price_cents integer not null,
  founding_price_cents integer not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  unique (city, category, product, tier)
);

create table if not exists public.founding_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  business_name text,
  city text not null,
  category text,
  product text not null,
  tier text not null,
  locked_price_cents integer not null,
  standard_price_cents integer not null,
  founding_flag boolean not null default true,
  stripe_subscription_id text,
  stripe_customer_id text,
  stripe_checkout_session_id text,
  status text not null default 'active'::text check (
    status = any (array['active'::text, 'paused'::text, 'cancelled'::text])
  ),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table if exists public.founding_memberships
  add column if not exists stripe_checkout_session_id text;

comment on column public.founding_memberships.stripe_checkout_session_id is
  'Stripe Checkout Session id used to make property-intelligence founding membership finalization idempotent.';

create index if not exists idx_property_intelligence_tiers_category_tier
  on public.property_intelligence_tiers using btree (category, tier);

create index if not exists idx_property_intelligence_tiers_is_active
  on public.property_intelligence_tiers using btree (is_active);

create index if not exists idx_founding_slots_city_category
  on public.founding_slots using btree (city, category);

create index if not exists idx_founding_slots_product_tier
  on public.founding_slots using btree (product, tier);

create index if not exists idx_founding_memberships_city_product
  on public.founding_memberships using btree (city, product);

create index if not exists idx_founding_memberships_user_id
  on public.founding_memberships using btree (user_id);

create unique index if not exists idx_founding_memberships_checkout_session_id
  on public.founding_memberships using btree (stripe_checkout_session_id)
  where stripe_checkout_session_id is not null;

alter table public.property_intelligence_tiers enable row level security;
alter table public.founding_slots enable row level security;
alter table public.founding_memberships enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'property_intelligence_tiers'
      and policyname = 'property_intelligence_tiers_authenticated_read'
  ) then
    create policy property_intelligence_tiers_authenticated_read
      on public.property_intelligence_tiers
      for select
      using (auth.role() = 'authenticated'::text);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'property_intelligence_tiers'
      and policyname = 'property_intelligence_tiers_service_full'
  ) then
    create policy property_intelligence_tiers_service_full
      on public.property_intelligence_tiers
      for all
      using (auth.role() = 'service_role'::text)
      with check (auth.role() = 'service_role'::text);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'founding_slots'
      and policyname = 'founding_slots_authenticated_read'
  ) then
    create policy founding_slots_authenticated_read
      on public.founding_slots
      for select
      using (auth.role() = 'authenticated'::text);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'founding_slots'
      and policyname = 'founding_slots_service_full'
  ) then
    create policy founding_slots_service_full
      on public.founding_slots
      for all
      using (auth.role() = 'service_role'::text)
      with check (auth.role() = 'service_role'::text);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'founding_memberships'
      and policyname = 'founding_memberships_authenticated_read'
  ) then
    create policy founding_memberships_authenticated_read
      on public.founding_memberships
      for select
      using (
        auth.role() = 'authenticated'::text
        and user_id = auth.uid()
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'founding_memberships'
      and policyname = 'founding_memberships_service_full'
  ) then
    create policy founding_memberships_service_full
      on public.founding_memberships
      for all
      using (auth.role() = 'service_role'::text)
      with check (auth.role() = 'service_role'::text);
  end if;
end $$;
