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
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_owner_write', table_name);

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = table_name
        and policyname = table_name || '_owner_access'
    ) then
      execute format(
        'create policy %I on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name || '_owner_access',
        table_name
      );
    end if;
  end loop;
end $$;;
