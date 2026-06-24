-- Storm Reach production hardening.
--
-- Adds heat-wave event support, fixes provider warning status compatibility,
-- and exposes compatibility views for the required Storm Reach architecture
-- names without duplicating canonical StormReach data.

alter table public.storm_events
  drop constraint if exists storm_events_event_type_check;

alter table public.storm_events
  add constraint storm_events_event_type_check check (event_type in (
    'hail',
    'tornado',
    'high_wind',
    'hurricane_tropical_storm',
    'flooding',
    'winter_storm_ice',
    'heat_wave',
    'wildfire_smoke',
    'severe_thunderstorm',
    'derecho',
    'unknown'
  ));

alter table public.storm_provider_runs
  drop constraint if exists storm_provider_runs_status_check;

alter table public.storm_provider_runs
  add constraint storm_provider_runs_status_check check (status in (
    'started',
    'completed',
    'warning',
    'failed',
    'skipped'
  ));

create or replace view public.storm_event_sources
with (security_invoker = true) as
select
  id,
  started_at as created_at,
  coalesce(completed_at, started_at) as updated_at,
  status,
  provider_key as source,
  run_type,
  events_seen,
  events_upserted,
  errors,
  metadata
from public.storm_provider_runs;

create or replace view public.storm_impact_zones
with (security_invoker = true) as
select
  id,
  created_at,
  updated_at,
  'active'::text as status,
  storm_event_id,
  geography_type,
  label,
  state,
  county,
  city,
  zip_code,
  polygon_geojson,
  estimated_households,
  estimated_homeowners,
  metadata
from public.storm_event_geographies
union all
select
  id,
  created_at,
  updated_at,
  'active'::text as status,
  storm_event_id,
  'zip_code'::text as geography_type,
  zip_code as label,
  state,
  county,
  city,
  zip_code,
  '{}'::jsonb as polygon_geojson,
  estimated_households,
  estimated_homeowners,
  metadata
from public.storm_event_zip_codes;

create or replace view public.storm_opportunities
with (security_invoker = true) as
select
  m.id,
  m.created_at,
  m.updated_at,
  m.status,
  m.storm_event_id,
  e.event_type,
  e.severity_level,
  e.severity_score,
  e.impacted_state,
  m.industry,
  m.match_score,
  m.reason,
  m.metadata
from public.storm_event_industry_matches m
join public.storm_events e on e.id = m.storm_event_id;

create or replace view public.storm_business_matches
with (security_invoker = true) as
select
  id,
  created_at,
  updated_at,
  crm_status as status,
  storm_event_id,
  business_name,
  owner_name,
  email,
  phone,
  website,
  city,
  state,
  category,
  source,
  confidence_score,
  distance_to_event,
  suppression_status,
  metadata
from public.storm_business_prospects;

create or replace view public.storm_outreach_drafts
with (security_invoker = true) as
select
  id,
  created_at,
  updated_at,
  status,
  storm_event_id,
  outreach_campaign_id,
  prospect_id,
  channel,
  sender_key,
  recipient_email,
  subject,
  body,
  variant_key,
  approval_status,
  suppression_status,
  metadata
from public.storm_outreach_messages
where status = 'draft' or approval_status in ('draft', 'needs_review', 'revision_needed');

create or replace view public.storm_outreach_sends
with (security_invoker = true) as
select
  id,
  created_at,
  updated_at,
  status,
  storm_event_id,
  outreach_campaign_id,
  prospect_id,
  channel,
  sender_key,
  recipient_email,
  provider_message_id,
  opened_at,
  clicked_at,
  replied_at,
  sent_at,
  approval_status,
  suppression_status,
  metadata
from public.storm_outreach_messages
where sent_at is not null or status in ('scheduled', 'sending', 'sent', 'failed');

create or replace view public.storm_agent_recommendations
with (security_invoker = true) as
select
  id,
  created_at,
  updated_at,
  status,
  storm_event_id,
  recommendation_type,
  title,
  description,
  priority,
  source,
  confidence_score,
  approval_status,
  recommended_by,
  metadata
from public.storm_agent_improvements;

grant select on
  public.storm_event_sources,
  public.storm_impact_zones,
  public.storm_opportunities,
  public.storm_business_matches,
  public.storm_outreach_drafts,
  public.storm_outreach_sends,
  public.storm_agent_recommendations
to authenticated, service_role;

comment on view public.storm_event_sources is
  'Compatibility view over Storm Reach provider runs and event source metadata.';

comment on view public.storm_impact_zones is
  'Compatibility view over Storm Reach geographies and ZIP-level impact zones.';

comment on view public.storm_opportunities is
  'Compatibility view over Storm Reach event-to-industry opportunity matches.';

comment on view public.storm_business_matches is
  'Compatibility view over Storm Reach business prospects matched to events.';

comment on view public.storm_outreach_drafts is
  'Compatibility view over approval-gated Storm Reach outreach drafts.';

comment on view public.storm_outreach_sends is
  'Compatibility view over Storm Reach outreach send records once sending is approved and enabled.';

comment on view public.storm_agent_recommendations is
  'Compatibility view over Storm Reach Strategist recommendations.';
