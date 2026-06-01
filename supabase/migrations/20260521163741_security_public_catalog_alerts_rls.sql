-- Security Advisor RLS policies for public catalog and alert tables.
--
-- Scope:
-- - Public catalog tables keep public read access required by marketing and
--   checkout surfaces.
-- - Internal alert tables are restricted to service_role plus admin/sales-agent
--   roles already enforced at the application route layer.

do $$
declare
  table_name text;
  catalog_tables text[] := array[
    'bundle_products',
    'products',
    'categories',
    'sponsorships',
    'cities',
    'bundles'
  ];
  alert_admin_tables text[] := array[
    'internal_alerts',
    'agent_alert_log'
  ];
  alert_agent_tables text[] := array[
    'agent_alert_preferences'
  ];
begin
  foreach table_name in array catalog_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'catalog RLS skipped missing table: public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists security_catalog_public_read on public.%I', table_name);
    execute format('drop policy if exists security_catalog_service_all on public.%I', table_name);
    execute format('drop policy if exists security_catalog_admin_all on public.%I', table_name);

    execute format(
      'create policy security_catalog_public_read on public.%I for select to anon, authenticated using (true)',
      table_name
    );
    execute format(
      'create policy security_catalog_service_all on public.%I for all to service_role using (auth.role() = %L) with check (auth.role() = %L)',
      table_name,
      'service_role',
      'service_role'
    );
    execute format(
      'create policy security_catalog_admin_all on public.%I for all to authenticated using (coalesce(auth.jwt() -> %L ->> %L, %L) = %L) with check (coalesce(auth.jwt() -> %L ->> %L, %L) = %L)',
      table_name,
      'app_metadata',
      'user_role',
      '',
      'admin',
      'app_metadata',
      'user_role',
      '',
      'admin'
    );
  end loop;

  foreach table_name in array alert_admin_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'alert RLS skipped missing table: public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists security_alerts_service_all on public.%I', table_name);
    execute format('drop policy if exists security_alerts_admin_all on public.%I', table_name);
    execute format('drop policy if exists security_alerts_agent_all on public.%I', table_name);

    execute format(
      'create policy security_alerts_service_all on public.%I for all to service_role using (auth.role() = %L) with check (auth.role() = %L)',
      table_name,
      'service_role',
      'service_role'
    );
    execute format(
      'create policy security_alerts_admin_all on public.%I for all to authenticated using (coalesce(auth.jwt() -> %L ->> %L, %L) = %L) with check (coalesce(auth.jwt() -> %L ->> %L, %L) = %L)',
      table_name,
      'app_metadata',
      'user_role',
      '',
      'admin',
      'app_metadata',
      'user_role',
      '',
      'admin'
    );
  end loop;

  foreach table_name in array alert_agent_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'alert preference RLS skipped missing table: public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists security_alerts_service_all on public.%I', table_name);
    execute format('drop policy if exists security_alerts_admin_all on public.%I', table_name);
    execute format('drop policy if exists security_alerts_agent_all on public.%I', table_name);

    execute format(
      'create policy security_alerts_service_all on public.%I for all to service_role using (auth.role() = %L) with check (auth.role() = %L)',
      table_name,
      'service_role',
      'service_role'
    );
    execute format(
      'create policy security_alerts_agent_all on public.%I for all to authenticated using (coalesce(auth.jwt() -> %L ->> %L, %L) in (%L, %L)) with check (coalesce(auth.jwt() -> %L ->> %L, %L) in (%L, %L))',
      table_name,
      'app_metadata',
      'user_role',
      '',
      'admin',
      'sales_agent',
      'app_metadata',
      'user_role',
      '',
      'admin',
      'sales_agent'
    );
  end loop;
end $$;;
