-- Operations Copilot supplier price intelligence
-- Additive only: creates an isolated opcopilot_* table, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.opcopilot_price_snapshots;

create table if not exists public.opcopilot_price_snapshots (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users(id) on delete cascade,
  industry_id text not null,
  region text not null default 'Akron / Northeast Ohio',
  zip_code text not null default '44309',
  sku text not null,
  item_name text not null,
  category text not null,
  supplier_name text not null,
  source_type text not null default 'public_web',
  source_label text not null default 'Public benchmark',
  source_url text,
  unit text not null,
  observed_price_cents integer,
  normalized_unit_price_cents integer,
  landed_price_cents integer,
  available_quantity numeric(12,2),
  in_stock boolean,
  lead_time_days integer,
  captured_at timestamptz not null default now(),
  valid_until date,
  confidence text not null default 'medium',
  price_basis text not null default 'observed shelf price',
  notes text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opcopilot_price_snapshots_user_industry_sku_idx
  on public.opcopilot_price_snapshots (user_id, industry_id, sku);

create index if not exists opcopilot_price_snapshots_supplier_idx
  on public.opcopilot_price_snapshots (supplier_name);

create index if not exists opcopilot_price_snapshots_captured_idx
  on public.opcopilot_price_snapshots (captured_at);

alter table public.opcopilot_price_snapshots enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opcopilot_price_snapshots'
      and policyname = 'opcopilot_price_snapshots_authenticated_public_select'
  ) then
    create policy opcopilot_price_snapshots_authenticated_public_select
      on public.opcopilot_price_snapshots
      for select
      using (auth.role() = 'authenticated' and user_id is null);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opcopilot_price_snapshots'
      and policyname = 'opcopilot_price_snapshots_owner_select'
  ) then
    create policy opcopilot_price_snapshots_owner_select
      on public.opcopilot_price_snapshots
      for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'opcopilot_price_snapshots'
      and policyname = 'opcopilot_price_snapshots_owner_write'
  ) then
    create policy opcopilot_price_snapshots_owner_write
      on public.opcopilot_price_snapshots
      for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
