-- Security Advisor hardening for views and function search paths.
--
-- Scope:
-- - No table/data drops or destructive data changes.
-- - Convert Advisor-flagged public views to security_invoker where available.
-- - Pin public function search_path to avoid role-mutable search path warnings.
-- - Do not revoke RPC execute grants here; several admin routes still call
--   reviewed RPCs through authenticated Supabase sessions and need an app-side
--   service-client refactor before grants can be tightened safely.

do $$
declare
  view_name text;
  function_record record;
  security_views text[] := array[
    'v_launch_readiness',
    'v_agent_lead_counts',
    'political_scenario_route_totals',
    'v_unassigned_cities',
    'political_import_summary',
    'political_route_active_holds',
    'v_agent_performance',
    'v_agent_real_activity',
    'candidate_intel_suggestions',
    'ci_outcome_rollup',
    'v_overdue_followups',
    'political_plan_scenario_comparison',
    'v_sender_health',
    'political_review_queue'
  ];
begin
  foreach view_name in array security_views
  loop
    if to_regclass(format('public.%I', view_name)) is null then
      raise notice 'security invoker skipped missing view: public.%', view_name;
      continue;
    end if;

    execute format('alter view public.%I set (security_invoker = true)', view_name);
  end loop;

  for function_record in
    select
      p.oid,
      p.proname,
      pg_get_function_identity_arguments(p.oid) as identity_arguments
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and not exists (
        select 1
        from pg_depend d
        where d.objid = p.oid
          and d.deptype = 'e'
      )
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, array[]::text[])) as config(setting)
        where config.setting like 'search_path=%'
      )
  loop
    execute format(
      'alter function public.%I(%s) set search_path = public, pg_temp',
      function_record.proname,
      function_record.identity_arguments
    );
  end loop;
end $$;;
