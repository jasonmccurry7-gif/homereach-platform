-- AI Operations Copilot core
-- Additive only: creates isolated opcopilot_* tables, indexes, and RLS policies.
--
-- Rollback reference only:
-- drop table if exists public.opcopilot_action_requests;
-- drop table if exists public.opcopilot_ai_events;
-- drop table if exists public.opcopilot_supplier_quotes;
-- drop table if exists public.opcopilot_suppliers;
-- drop table if exists public.opcopilot_inventory_items;
-- drop table if exists public.opcopilot_business_contexts;

create table if not exists public.opcopilot_business_contexts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null default 'Operations Command',
  business_type text not null default 'home_services',
  operating_model text not null default 'field_service',
  service_geography text not null default 'local',
  seasonal_patterns jsonb not null default '[]'::jsonb,
  approval_policy jsonb not null default '{"autonomyLevel":1,"autoApproveUnderCents":0}'::jsonb,
  preference_memory jsonb not null default '{}'::jsonb
);

create unique index if not exists opcopilot_business_contexts_user_id_key
  on public.opcopilot_business_contexts (user_id);

create table if not exists public.opcopilot_inventory_items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sku text not null,
  item_name text not null,
  category text not null,
  preferred_brand text,
  unit text not null default 'unit',
  on_hand_quantity numeric(12,2) not null default 0,
  reorder_point_quantity numeric(12,2) not null default 0,
  target_stock_quantity numeric(12,2) not null default 0,
  average_daily_use numeric(12,2) not null default 0,
  unit_cost_cents integer not null default 0,
  gross_margin_impact_cents integer not null default 0,
  last_purchased_at date,
  expires_at date,
  substitute_tolerance text not null default 'medium',
  active boolean not null default true
);

create unique index if not exists opcopilot_inventory_items_user_sku_key
  on public.opcopilot_inventory_items (user_id, sku);

create index if not exists opcopilot_inventory_items_user_category_idx
  on public.opcopilot_inventory_items (user_id, category);

create table if not exists public.opcopilot_suppliers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_name text not null,
  category_coverage jsonb not null default '[]'::jsonb,
  reliability_score integer not null default 80,
  average_lead_time_days integer not null default 3,
  minimum_order_cents integer not null default 0,
  delivery_fee_cents integer not null default 0,
  payment_terms text not null default 'standard',
  active boolean not null default true
);

create unique index if not exists opcopilot_suppliers_user_name_key
  on public.opcopilot_suppliers (user_id, supplier_name);

create index if not exists opcopilot_suppliers_user_active_idx
  on public.opcopilot_suppliers (user_id, active);

create table if not exists public.opcopilot_supplier_quotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid not null references public.opcopilot_suppliers(id) on delete cascade,
  inventory_item_id uuid not null references public.opcopilot_inventory_items(id) on delete cascade,
  quoted_unit_cost_cents integer not null default 0,
  quoted_at timestamptz not null default now(),
  valid_until date,
  available_quantity numeric(12,2),
  lead_time_days integer not null default 3,
  landed_cost_cents integer not null default 0
);

create index if not exists opcopilot_supplier_quotes_user_item_idx
  on public.opcopilot_supplier_quotes (user_id, inventory_item_id);

create index if not exists opcopilot_supplier_quotes_supplier_idx
  on public.opcopilot_supplier_quotes (supplier_id);

create table if not exists public.opcopilot_ai_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  title text not null,
  summary text not null,
  urgency text not null default 'medium',
  confidence text not null default 'medium',
  estimated_impact_cents integer not null default 0,
  risk_score integer not null default 50,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open'
);

create index if not exists opcopilot_ai_events_user_status_idx
  on public.opcopilot_ai_events (user_id, status);

create index if not exists opcopilot_ai_events_user_urgency_idx
  on public.opcopilot_ai_events (user_id, urgency);

create table if not exists public.opcopilot_action_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.opcopilot_ai_events(id) on delete set null,
  action_type text not null,
  title text not null,
  proposed_by text not null default 'ai',
  autonomy_level integer not null default 1,
  status text not null default 'draft',
  estimated_spend_cents integer not null default 0,
  estimated_savings_cents integer not null default 0,
  confidence text not null default 'medium',
  risk_score integer not null default 50,
  approval_required boolean not null default true,
  request_payload jsonb not null default '{}'::jsonb,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_action_requests_user_status_idx
  on public.opcopilot_action_requests (user_id, status);

alter table public.opcopilot_business_contexts enable row level security;
alter table public.opcopilot_inventory_items enable row level security;
alter table public.opcopilot_suppliers enable row level security;
alter table public.opcopilot_supplier_quotes enable row level security;
alter table public.opcopilot_ai_events enable row level security;
alter table public.opcopilot_action_requests enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'opcopilot_business_contexts',
    'opcopilot_inventory_items',
    'opcopilot_suppliers',
    'opcopilot_supplier_quotes',
    'opcopilot_ai_events',
    'opcopilot_action_requests'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_owner_select'
    ) then
      execute format(
        'create policy %I on public.%I for select using (auth.uid() = user_id)',
        table_name || '_owner_select',
        table_name
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_owner_write'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name || '_owner_write',
        table_name
      );
    end if;
  end loop;
end $$;
