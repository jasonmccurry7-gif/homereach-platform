-- Operations Copilot Savings OS
-- Additive only: extends the existing opcopilot_* architecture with
-- savings, landed-cost, delivery, receiving, invoice, score, and alert records.

create table if not exists public.opcopilot_savings_recommendations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'ai_savings_engine',
  title text not null,
  summary text not null,
  category text not null default 'savings',
  projected_monthly_savings_cents integer not null default 0,
  projected_annual_savings_cents integer not null default 0,
  difficulty text not null default 'easy',
  operational_impact text not null default 'low',
  confidence text not null default 'medium',
  status text not null default 'pending_approval',
  approval_required boolean not null default true,
  related_supplier_id uuid references public.opcopilot_suppliers(id) on delete set null,
  related_inventory_item_id uuid references public.opcopilot_inventory_items(id) on delete set null,
  recommendation_payload jsonb not null default '{}'::jsonb,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_savings_recommendations_user_status_idx
  on public.opcopilot_savings_recommendations (user_id, status, created_at desc);

create table if not exists public.opcopilot_landed_cost_models (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.opcopilot_suppliers(id) on delete set null,
  inventory_item_id uuid references public.opcopilot_inventory_items(id) on delete set null,
  model_source text not null default 'estimated',
  product_cost_cents integer not null default 0,
  delivery_fee_cents integer not null default 0,
  fuel_surcharge_cents integer not null default 0,
  rush_fee_cents integer not null default 0,
  spoilage_risk_cents integer not null default 0,
  substitution_risk_cents integer not null default 0,
  receiving_burden_cents integer not null default 0,
  ordering_frequency_burden_cents integer not null default 0,
  true_landed_cost_cents integer not null default 0,
  reliability_adjustment_cents integer not null default 0,
  assumptions jsonb not null default '{}'::jsonb,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_landed_cost_models_user_item_idx
  on public.opcopilot_landed_cost_models (user_id, inventory_item_id, created_at desc);

create table if not exists public.opcopilot_deliveries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.opcopilot_suppliers(id) on delete set null,
  delivery_reference text,
  supplier_name text not null,
  status text not null default 'scheduled',
  eta_at timestamptz,
  delivery_window text,
  item_summary text not null default 'Supply delivery',
  expected_item_count integer not null default 0,
  received_item_count integer not null default 0,
  missing_item_count integer not null default 0,
  estimated_delivery_cost_cents integer not null default 0,
  savings_context jsonb not null default '{}'::jsonb,
  issue_summary text,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_deliveries_user_status_eta_idx
  on public.opcopilot_deliveries (user_id, status, eta_at);

create table if not exists public.opcopilot_delivery_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid references public.opcopilot_deliveries(id) on delete cascade,
  event_type text not null,
  title text not null,
  detail text,
  actor text not null default 'system',
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists opcopilot_delivery_events_delivery_idx
  on public.opcopilot_delivery_events (delivery_id, created_at desc);

create table if not exists public.opcopilot_receiving_records (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delivery_id uuid references public.opcopilot_deliveries(id) on delete set null,
  status text not null default 'draft',
  received_by text,
  received_at timestamptz,
  checked_item_count integer not null default 0,
  damaged_item_count integer not null default 0,
  missing_item_count integer not null default 0,
  invoice_mismatch_count integer not null default 0,
  photos jsonb not null default '[]'::jsonb,
  notes text,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_receiving_records_user_status_idx
  on public.opcopilot_receiving_records (user_id, status, created_at desc);

create table if not exists public.opcopilot_invoice_audits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.opcopilot_suppliers(id) on delete set null,
  delivery_id uuid references public.opcopilot_deliveries(id) on delete set null,
  invoice_reference text,
  status text not null default 'needs_review',
  invoice_total_cents integer not null default 0,
  expected_total_cents integer not null default 0,
  variance_cents integer not null default 0,
  issue_type text not null default 'price_check',
  issue_summary text not null,
  recommended_action text not null,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_invoice_audits_user_status_idx
  on public.opcopilot_invoice_audits (user_id, status, created_at desc);

create table if not exists public.opcopilot_vendor_scorecards (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  supplier_id uuid references public.opcopilot_suppliers(id) on delete cascade,
  supplier_name text not null,
  on_time_rate integer not null default 0,
  fill_rate integer not null default 0,
  substitution_rate integer not null default 0,
  invoice_accuracy_rate integer not null default 0,
  responsiveness_score integer not null default 0,
  pricing_stability_score integer not null default 0,
  reliability_score integer not null default 0,
  savings_potential_cents integer not null default 0,
  risk_label text not null default 'watch',
  ai_summary text,
  score_payload jsonb not null default '{}'::jsonb
);

create unique index if not exists opcopilot_vendor_scorecards_user_supplier_key
  on public.opcopilot_vendor_scorecards (user_id, supplier_name);

create table if not exists public.opcopilot_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null,
  title text not null,
  detail text not null,
  severity text not null default 'medium',
  status text not null default 'open',
  recommended_action text not null,
  estimated_impact_cents integer not null default 0,
  related_record_type text,
  related_record_id uuid,
  audit_log jsonb not null default '[]'::jsonb
);

create index if not exists opcopilot_operational_alerts_user_status_idx
  on public.opcopilot_operational_alerts (user_id, status, severity, created_at desc);

create table if not exists public.opcopilot_procurement_efficiency_scores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  score_date date not null default current_date,
  savings_score integer not null default 0,
  procurement_efficiency_score integer not null default 0,
  vendor_optimization_score integer not null default 0,
  delivery_efficiency_score integer not null default 0,
  waste_reduction_score integer not null default 0,
  summary text,
  weak_spots jsonb not null default '[]'::jsonb,
  recommended_actions jsonb not null default '[]'::jsonb
);

create unique index if not exists opcopilot_procurement_efficiency_scores_user_date_key
  on public.opcopilot_procurement_efficiency_scores (user_id, score_date);

create table if not exists public.opcopilot_inventory_forecasts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_item_id uuid references public.opcopilot_inventory_items(id) on delete cascade,
  item_name text not null,
  forecast_date date not null default current_date,
  days_until_stockout integer,
  expected_daily_use numeric(12,2),
  reorder_recommendation text not null,
  waste_risk text not null default 'low',
  shortage_risk text not null default 'low',
  confidence text not null default 'medium',
  forecast_payload jsonb not null default '{}'::jsonb
);

create unique index if not exists opcopilot_inventory_forecasts_user_item_date_key
  on public.opcopilot_inventory_forecasts (user_id, inventory_item_id, forecast_date);

alter table public.opcopilot_savings_recommendations enable row level security;
alter table public.opcopilot_landed_cost_models enable row level security;
alter table public.opcopilot_deliveries enable row level security;
alter table public.opcopilot_delivery_events enable row level security;
alter table public.opcopilot_receiving_records enable row level security;
alter table public.opcopilot_invoice_audits enable row level security;
alter table public.opcopilot_vendor_scorecards enable row level security;
alter table public.opcopilot_operational_alerts enable row level security;
alter table public.opcopilot_procurement_efficiency_scores enable row level security;
alter table public.opcopilot_inventory_forecasts enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'opcopilot_savings_recommendations',
    'opcopilot_landed_cost_models',
    'opcopilot_deliveries',
    'opcopilot_delivery_events',
    'opcopilot_receiving_records',
    'opcopilot_invoice_audits',
    'opcopilot_vendor_scorecards',
    'opcopilot_operational_alerts',
    'opcopilot_procurement_efficiency_scores',
    'opcopilot_inventory_forecasts'
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

comment on table public.opcopilot_savings_recommendations is
  'Owner-safe AI savings opportunities. Approval required before vendor switching, ordering, or spend commitment.';
comment on table public.opcopilot_landed_cost_models is
  'True landed cost models including delivery, fuel, risk, receiving burden, and ordering frequency burden.';
comment on table public.opcopilot_deliveries is
  'Delivery intelligence records for arriving, delayed, partial, completed, and problem deliveries.';
comment on table public.opcopilot_receiving_records is
  'Mobile-first receiving checks with shortage, damage, invoice mismatch, photo, and audit support.';
comment on table public.opcopilot_invoice_audits is
  'Invoice and price audit findings for surcharge, quantity, duplicate, mismatch, and price increase review.';;
