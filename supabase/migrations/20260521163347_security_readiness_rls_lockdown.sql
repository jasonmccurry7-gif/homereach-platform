-- Security readiness RLS lockdown for the 2026-05-21 ecosystem audit.
--
-- Scope:
-- - No table/data drops, truncates, backfills, or destructive cleanup.
-- - Enable RLS on sensitive public tables called out by the audit.
-- - Add service_role access for trusted server/webhook/cron code paths.
-- - Add admin-only access using the existing app_metadata.user_role claim.
-- - Do not add anon/customer policies until each table has an explicit owner
--   model and endpoint tests.
--
-- TODO (DB console): after applying to a reviewed environment, run Supabase
-- Security Advisor/RLS tests and confirm any NOTICE-skipped tables are truly
-- absent or remote-only drift, not missed local migrations.
-- TODO (access design): before broadening access for any table below, document
-- the row ownership predicate and verify anon/authenticated/service behavior.

do $$
declare
  table_name text;
  admin_all_tables text[] := array[
    -- RLS disabled in the audit and sensitive enough to fail closed.
    'campaigns',
    'email_warmup_state',
    'leads',
    'nonprofit_applications',
    'order_items',
    'outreach_contacts',
    'outreach_messages',
    'spot_assignments',
    'targeted_route_campaigns',
    'waitlist_entries',

    -- RLS enabled/no-policy in the audit; admin curation is expected.
    'discount_rules',
    'growth_activity_logs',
    'intake_submissions',
    'pricing_profiles',
    'public_nonprofit_applications'
  ];
  admin_read_tables text[] := array[
    -- Append-only or diagnostic/system records: service writes, admin reads.
    'conversations',
    'email_warmup_log',
    'qa_integrity_unresolved_legacy',
    'stripe_webhook_events'
  ];
begin
  foreach table_name in array admin_all_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'security readiness RLS skipped missing table: public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists security_readiness_service_all on public.%I', table_name);
    execute format('drop policy if exists security_readiness_admin_all on public.%I', table_name);
    execute format('drop policy if exists security_readiness_admin_read on public.%I', table_name);

    execute format(
      'create policy security_readiness_service_all on public.%I for all to service_role using (auth.role() = %L) with check (auth.role() = %L)',
      table_name,
      'service_role',
      'service_role'
    );
    execute format(
      'comment on policy security_readiness_service_all on public.%I is %L',
      table_name,
      'Security readiness: trusted server/service-role access only; keep service key server-side.'
    );

    execute format(
      'create policy security_readiness_admin_all on public.%I for all to authenticated using (coalesce(auth.jwt() -> %L ->> %L, %L) = %L) with check (coalesce(auth.jwt() -> %L ->> %L, %L) = %L)',
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
    execute format(
      'comment on policy security_readiness_admin_all on public.%I is %L',
      table_name,
      'Security readiness: admin-only via app_metadata.user_role. TODO: do not add customer/anon policies without table-specific ownership tests.'
    );
  end loop;

  foreach table_name in array admin_read_tables
  loop
    if to_regclass(format('public.%I', table_name)) is null then
      raise notice 'security readiness RLS skipped missing table: public.%', table_name;
      continue;
    end if;

    execute format('alter table public.%I enable row level security', table_name);

    execute format('drop policy if exists security_readiness_service_all on public.%I', table_name);
    execute format('drop policy if exists security_readiness_admin_all on public.%I', table_name);
    execute format('drop policy if exists security_readiness_admin_read on public.%I', table_name);

    execute format(
      'create policy security_readiness_service_all on public.%I for all to service_role using (auth.role() = %L) with check (auth.role() = %L)',
      table_name,
      'service_role',
      'service_role'
    );
    execute format(
      'comment on policy security_readiness_service_all on public.%I is %L',
      table_name,
      'Security readiness: trusted server/service-role access only; keep service key server-side.'
    );

    execute format(
      'create policy security_readiness_admin_read on public.%I for select to authenticated using (coalesce(auth.jwt() -> %L ->> %L, %L) = %L)',
      table_name,
      'app_metadata',
      'user_role',
      '',
      'admin'
    );
    execute format(
      'comment on policy security_readiness_admin_read on public.%I is %L',
      table_name,
      'Security readiness: admin read-only via app_metadata.user_role. TODO: keep writes behind service routes unless a reviewed admin mutation path exists.'
    );
  end loop;
end $$;;
