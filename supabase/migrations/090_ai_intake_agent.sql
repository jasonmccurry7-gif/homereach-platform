-- Migration 090 - AI conversational shared-postcard intake agent
--
-- Additive only. This does not alter the protected get-started funnel,
-- category exclusivity index, Stripe tables, auth, webhooks, or existing
-- dashboards. The feature remains dormant unless ENABLE_AI_INTAKE_AGENT=true.

create table if not exists public.ai_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  status text not null default 'draft'
    check (status in (
      'draft',
      'collecting',
      'review',
      'confirmed',
      'checkout_created',
      'paid',
      'cancelled',
      'needs_admin_review'
    )),
  current_step text not null default 'cities',
  selected_city_ids uuid[] not null default '{}'::uuid[],
  selected_category_ids uuid[] not null default '{}'::uuid[],
  business_name text,
  contact_name text,
  phone text,
  email text,
  website_url text,
  facebook_url text,
  logo_url text,
  logo_file_name text,
  offer_headline text,
  ai_generate_offer boolean not null default false,
  military_discount_requested boolean not null default false,
  military_discount_eligible boolean not null default false,
  military_discount_note text,
  founding_pricing_seen boolean not null default true,
  subtotal_cents integer not null default 0,
  discount_cents integer not null default 0,
  total_monthly_cents integer not null default 0,
  term_months integer not null default 3,
  total_contract_value_cents integer not null default 0,
  stripe_checkout_session_id text,
  stripe_customer_id text,
  checkout_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_intake_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_intake_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  step_key text,
  structured_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_intake_cart_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_intake_sessions(id) on delete cascade,
  city_id uuid not null references public.cities(id) on delete restrict,
  category_id uuid not null references public.categories(id) on delete restrict,
  placement_type text not null
    check (placement_type in ('front', 'back', 'multiple', 'full_card_exclusivity')),
  spot_position integer,
  quantity integer not null default 1 check (quantity > 0),
  pricing_tier text not null default 'standard',
  discount_code text,
  monthly_price_cents integer not null default 0,
  term_months integer not null default 3,
  subtotal_cents integer not null default 0,
  availability_status text not null default 'available'
    check (availability_status in (
      'available',
      'unavailable',
      'reserved',
      'paid',
      'needs_admin_override'
    )),
  availability_source text,
  availability_message text,
  city_name_snapshot text not null,
  category_name_snapshot text not null,
  placement_label text not null,
  bundle_id uuid references public.bundles(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  spot_assignment_id uuid references public.spot_assignments(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_intake_confirmations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.ai_intake_sessions(id) on delete cascade,
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  confirmation_status text not null default 'confirmed'
    check (confirmation_status in ('confirmed', 'checkout_created', 'paid', 'cancelled')),
  cart_snapshot jsonb not null default '[]'::jsonb,
  business_snapshot jsonb not null default '{}'::jsonb,
  total_monthly_cents integer not null default 0,
  total_contract_value_cents integer not null default 0,
  admin_status text not null default 'pending'
    check (admin_status in ('pending', 'approved', 'edited', 'override', 'rejected')),
  admin_notes text,
  override_reason text,
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.spot_assignments
  add column if not exists ai_intake_session_id uuid references public.ai_intake_sessions(id) on delete set null,
  add column if not exists ai_intake_cart_item_id uuid references public.ai_intake_cart_items(id) on delete set null,
  add column if not exists ai_reserved_spot_count integer not null default 1;

create index if not exists ai_intake_sessions_status_idx
  on public.ai_intake_sessions(status, created_at desc);
create index if not exists ai_intake_sessions_user_idx
  on public.ai_intake_sessions(user_id, created_at desc);
create index if not exists ai_intake_messages_session_idx
  on public.ai_intake_messages(session_id, created_at);
create index if not exists ai_intake_cart_items_session_idx
  on public.ai_intake_cart_items(session_id, created_at);
create index if not exists ai_intake_cart_items_city_category_idx
  on public.ai_intake_cart_items(city_id, category_id, availability_status);
create index if not exists ai_intake_confirmations_session_idx
  on public.ai_intake_confirmations(session_id, created_at desc);
create index if not exists spot_assignments_ai_intake_session_idx
  on public.spot_assignments(ai_intake_session_id)
  where ai_intake_session_id is not null;

create or replace function public.tg_ai_intake_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ai_intake_sessions_touch_updated_at on public.ai_intake_sessions;
create trigger ai_intake_sessions_touch_updated_at
before update on public.ai_intake_sessions
for each row execute function public.tg_ai_intake_touch_updated_at();

drop trigger if exists ai_intake_cart_items_touch_updated_at on public.ai_intake_cart_items;
create trigger ai_intake_cart_items_touch_updated_at
before update on public.ai_intake_cart_items
for each row execute function public.tg_ai_intake_touch_updated_at();

drop trigger if exists ai_intake_confirmations_touch_updated_at on public.ai_intake_confirmations;
create trigger ai_intake_confirmations_touch_updated_at
before update on public.ai_intake_confirmations
for each row execute function public.tg_ai_intake_touch_updated_at();

alter table public.ai_intake_sessions enable row level security;
alter table public.ai_intake_messages enable row level security;
alter table public.ai_intake_cart_items enable row level security;
alter table public.ai_intake_confirmations enable row level security;

drop policy if exists "ai_intake_sessions_owner_read" on public.ai_intake_sessions;
create policy "ai_intake_sessions_owner_read"
on public.ai_intake_sessions
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "ai_intake_messages_owner_read" on public.ai_intake_messages;
create policy "ai_intake_messages_owner_read"
on public.ai_intake_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_intake_sessions s
    where s.id = ai_intake_messages.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "ai_intake_cart_items_owner_read" on public.ai_intake_cart_items;
create policy "ai_intake_cart_items_owner_read"
on public.ai_intake_cart_items
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_intake_sessions s
    where s.id = ai_intake_cart_items.session_id
      and s.user_id = auth.uid()
  )
);

drop policy if exists "ai_intake_confirmations_owner_read" on public.ai_intake_confirmations;
create policy "ai_intake_confirmations_owner_read"
on public.ai_intake_confirmations
for select
to authenticated
using (
  exists (
    select 1
    from public.ai_intake_sessions s
    where s.id = ai_intake_confirmations.session_id
      and s.user_id = auth.uid()
  )
);

comment on table public.ai_intake_sessions is
  'Feature-flagged conversational shared-postcard intake sessions. Additive only.';
comment on table public.ai_intake_cart_items is
  'Structured cart line items for multi-city, multi-category shared-postcard intake.';
comment on column public.spot_assignments.ai_reserved_spot_count is
  'Optional AI intake layout quantity. Does not change the city/category exclusivity index.';
