with required_relations as (
  select *
  from (
    values
      ('public', 'profiles', 'table'),
      ('public', 'businesses', 'table'),
      ('public', 'outreach_contacts', 'table'),
      ('public', 'agent_execution_queue', 'table'),
      ('public', 'agent_browser_session_registry', 'table'),
      ('public', 'agent_execution_audit_log', 'table'),
      ('public', 'agent_mini_apps', 'table'),
      ('public', 'agent_mini_app_events', 'table'),
      ('public', 'integration_connections', 'table'),
      ('public', 'agent_tool_permissions', 'table'),
      ('public', 'external_action_intents', 'table'),
      ('public', 'agent_execution_attempts', 'table'),
      ('public', 'browser_session_registry', 'view')
  ) as required(schema_name, relation_name, relation_kind)
),
relation_status as (
  select
    required.schema_name,
    required.relation_name,
    required.relation_kind,
    pg_class.oid is not null as exists,
    coalesce(pg_class.relrowsecurity, false) as rls_enabled,
    pg_class.reloptions
  from required_relations required
  left join pg_namespace on pg_namespace.nspname = required.schema_name
  left join pg_class
    on pg_class.relnamespace = pg_namespace.oid
   and pg_class.relname = required.relation_name
),
required_columns as (
  select *
  from (
    values
      ('agent_mini_apps', 'id'),
      ('agent_mini_apps', 'tenant_id'),
      ('agent_mini_apps', 'mini_app_type'),
      ('agent_mini_apps', 'status'),
      ('agent_mini_apps', 'priority'),
      ('agent_mini_apps', 'risk_level'),
      ('agent_mini_apps', 'payload_json'),
      ('agent_mini_apps', 'edited_payload_json'),
      ('agent_mini_apps', 'decision'),
      ('agent_mini_apps', 'assigned_user_id'),
      ('agent_mini_app_events', 'mini_app_id'),
      ('agent_mini_app_events', 'event_type'),
      ('agent_mini_app_events', 'previous_status'),
      ('agent_mini_app_events', 'new_status'),
      ('agent_mini_app_events', 'event_payload_json'),
      ('agent_execution_queue', 'permission_scope'),
      ('agent_execution_queue', 'execution_log_json'),
      ('agent_execution_queue', 'manual_takeover_required'),
      ('agent_browser_session_registry', 'allowed_actions_json'),
      ('agent_browser_session_registry', 'blocked_actions_json'),
      ('integration_connections', 'provider'),
      ('integration_connections', 'connection_type'),
      ('integration_connections', 'status'),
      ('integration_connections', 'credential_reference'),
      ('agent_tool_permissions', 'tool_key'),
      ('agent_tool_permissions', 'permission_scope'),
      ('agent_tool_permissions', 'requires_human_approval'),
      ('external_action_intents', 'permission_scope'),
      ('external_action_intents', 'approval_event_id'),
      ('external_action_intents', 'approved_payload_json'),
      ('agent_execution_attempts', 'execution_queue_id'),
      ('agent_execution_attempts', 'attempt_number'),
      ('agent_execution_attempts', 'log_json')
  ) as required(table_name, column_name)
),
column_status as (
  select
    required.table_name,
    required.column_name,
    columns.column_name is not null as exists
  from required_columns required
  left join information_schema.columns columns
    on columns.table_schema = 'public'
   and columns.table_name = required.table_name
   and columns.column_name = required.column_name
),
policy_status as (
  select
    schemaname,
    tablename,
    count(*)::int as policy_count
  from pg_policies
  where schemaname = 'public'
    and tablename in (
      'agent_mini_apps',
      'agent_mini_app_events',
      'integration_connections',
      'agent_tool_permissions',
      'external_action_intents',
      'agent_execution_attempts'
    )
  group by schemaname, tablename
),
trigger_status as (
  select exists (
    select 1
    from pg_trigger
    join pg_class on pg_class.oid = pg_trigger.tgrelid
    join pg_namespace on pg_namespace.oid = pg_class.relnamespace
    where pg_namespace.nspname = 'public'
      and pg_class.relname = 'agent_mini_app_events'
      and pg_trigger.tgname = 'prevent_agent_mini_app_events_mutation_trigger'
      and not pg_trigger.tgisinternal
      and pg_trigger.tgenabled <> 'D'
  ) as immutable_event_trigger_enabled
),
secret_column_status as (
  select
    table_name,
    column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in ('browser_session_registry', 'agent_browser_session_registry')
    and lower(column_name) ~ '(password|secret|token|api_key|apikey|mfa_code|credential)'
),
connector_secret_column_status as (
  select
    table_name,
    column_name
  from information_schema.columns
  where table_schema = 'public'
    and table_name in (
      'integration_connections',
      'agent_tool_permissions',
      'external_action_intents',
      'agent_execution_attempts'
    )
    and lower(column_name) ~ '(password|secret|token|api_key|apikey|mfa_code)'
),
seed_status as (
  select
    coalesce((
      select greatest(pg_class.reltuples::int, 0)
      from pg_class
      join pg_namespace on pg_namespace.oid = pg_class.relnamespace
      where pg_namespace.nspname = 'public'
        and pg_class.relname = 'agent_mini_apps'
    ), 0) as mini_app_estimated_count
)
select jsonb_pretty(jsonb_build_object(
  'relations', (
    select jsonb_agg(to_jsonb(relation_status) order by schema_name, relation_name)
    from relation_status
  ),
  'missing_relations', (
    select coalesce(jsonb_agg(relation_name order by relation_name), '[]'::jsonb)
    from relation_status
    where not exists
  ),
  'missing_columns', (
    select coalesce(jsonb_agg(table_name || '.' || column_name order by table_name, column_name), '[]'::jsonb)
    from column_status
    where not exists
  ),
  'rls', (
    select jsonb_build_object(
      'agent_mini_apps', coalesce((select rls_enabled from relation_status where relation_name = 'agent_mini_apps'), false),
      'agent_mini_app_events', coalesce((select rls_enabled from relation_status where relation_name = 'agent_mini_app_events'), false),
      'integration_connections', coalesce((select rls_enabled from relation_status where relation_name = 'integration_connections'), false),
      'agent_tool_permissions', coalesce((select rls_enabled from relation_status where relation_name = 'agent_tool_permissions'), false),
      'external_action_intents', coalesce((select rls_enabled from relation_status where relation_name = 'external_action_intents'), false),
      'agent_execution_attempts', coalesce((select rls_enabled from relation_status where relation_name = 'agent_execution_attempts'), false)
    )
  ),
  'policy_counts', (
    select coalesce(jsonb_object_agg(tablename, policy_count), '{}'::jsonb)
    from policy_status
  ),
  'browser_session_registry_security_invoker', coalesce((
    select reloptions::text like '%security_invoker=true%'
    from relation_status
    where relation_name = 'browser_session_registry'
  ), false),
  'immutable_event_trigger_enabled', (
    select immutable_event_trigger_enabled
    from trigger_status
  ),
  'secret_like_registry_columns', (
    select coalesce(jsonb_agg(table_name || '.' || column_name order by table_name, column_name), '[]'::jsonb)
    from secret_column_status
  ),
  'secret_like_connector_columns', (
    select coalesce(jsonb_agg(table_name || '.' || column_name order by table_name, column_name), '[]'::jsonb)
    from connector_secret_column_status
  ),
  'seed_count', (
    select mini_app_estimated_count
    from seed_status
  )
)) as preflight_report;
