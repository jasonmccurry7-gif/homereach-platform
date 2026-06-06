-- AI Executive Daily Meeting System
-- Adds a leadership-team style daily meeting layer for HomeReach.
-- This migration stores plans, reports, approvals, accountability, and
-- voice-ready placeholders. It does not send, publish, submit, charge,
-- alter campaigns, alter production code, or store credentials/secrets.

create extension if not exists pgcrypto;

create table if not exists public.executive_voice_profiles (
  id uuid primary key default gen_random_uuid(),
  profile_key text not null unique,
  provider_key text not null default 'provider_interface_placeholder',
  display_name text not null,
  voice_label text not null default 'Future voice placeholder',
  speaking_style text not null default '',
  tts_settings_json jsonb not null default '{}'::jsonb,
  live_mode_settings_json jsonb not null default '{}'::jsonb,
  enabled boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_agents (
  id uuid primary key default gen_random_uuid(),
  agent_key text not null unique,
  name text not null,
  role text not null,
  mission text not null,
  daily_responsibilities jsonb not null default '[]'::jsonb,
  kpi_ownership jsonb not null default '[]'::jsonb,
  morning_report_format jsonb not null default '{}'::jsonb,
  afternoon_report_format jsonb not null default '{}'::jsonb,
  permissions_level text not null default 'recommend_only'
    check (permissions_level in ('analysis_only','recommend_only','draft_only','approval_required','admin_review_required')),
  assigned_domains text[] not null default array[]::text[],
  enabled boolean not null default true,
  voice_profile_id uuid references public.executive_voice_profiles(id) on delete set null,
  system_prompt text not null,
  display_order integer not null default 100,
  metadata_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create table if not exists public.executive_meeting_settings (
  id uuid primary key default gen_random_uuid(),
  settings_key text not null unique default 'default',
  timezone text not null default 'America/New_York',
  morning_time time not null default time '08:00',
  afternoon_time time not null default time '16:30',
  auto_generate_enabled boolean not null default true,
  notification_badge_enabled boolean not null default true,
  email_summary_enabled boolean not null default false,
  sms_summary_enabled boolean not null default false,
  voice_mode_enabled boolean not null default false,
  default_domains text[] not null default array['HomeReach','Supplyfy','Political Mail','Websites','SAM.gov','Outreach','Finance','Operations']::text[],
  provider_plan_json jsonb not null default jsonb_build_object(
    'voiceProviderInterface', 'future_provider_abstraction',
    'supportedFutureProviders', jsonb_build_array('openai_realtime','openai_text_to_speech','other_voice_provider'),
    'externalSendsEnabled', false,
    'humanApprovalRequiredBeforeExternalAction', true
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_meetings (
  id uuid primary key default gen_random_uuid(),
  meeting_date date not null default current_date,
  meeting_type text not null check (meeting_type in ('morning','afternoon')),
  status text not null default 'ready' check (status in ('draft','ready','archived','failed')),
  title text not null,
  idempotency_key text unique,
  timezone text not null default 'America/New_York',
  generated_at timestamptz not null default now(),
  generated_by uuid references auth.users(id) on delete set null,
  generated_by_type text not null default 'human' check (generated_by_type in ('human','cron','system')),
  ceo_summary text not null default '',
  decisions_needed_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  revenue_impact_json jsonb not null default '{}'::jsonb,
  tomorrow_priorities_json jsonb not null default '[]'::jsonb,
  source_snapshot_json jsonb not null default '{}'::jsonb,
  voice_ready_json jsonb not null default '{}'::jsonb,
  ai_workforce_task_id uuid references public.ai_workforce_tasks(id) on delete set null,
  ai_output_id uuid references public.ai_outputs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_meeting_reports (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  report_type text not null default 'ceo_summary',
  title text not null,
  summary text not null default '',
  decisions_needed_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  revenue_impact_json jsonb not null default '{}'::jsonb,
  tomorrow_priorities_json jsonb not null default '[]'::jsonb,
  report_markdown text not null default '',
  source_snapshot_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.executive_agent_reports (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.executive_meetings(id) on delete cascade,
  agent_id uuid references public.executive_agents(id) on delete set null,
  agent_key text not null,
  agent_name text not null,
  role text not null,
  report_type text not null check (report_type in ('morning','afternoon')),
  summary text not null default '',
  planned_work_json jsonb not null default '[]'::jsonb,
  completed_work_json jsonb not null default '[]'::jsonb,
  priorities_json jsonb not null default '[]'::jsonb,
  risks_json jsonb not null default '[]'::jsonb,
  blockers_json jsonb not null default '[]'::jsonb,
  decisions_needed_json jsonb not null default '[]'::jsonb,
  revenue_impact_json jsonb not null default '{}'::jsonb,
  kpi_snapshot_json jsonb not null default '[]'::jsonb,
  data_sources_json jsonb not null default '[]'::jsonb,
  confidence_score numeric(5,2) not null default 80,
  approval_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_agent_commitments (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.executive_agents(id) on delete set null,
  meeting_id uuid references public.executive_meetings(id) on delete set null,
  commitment_date date not null default current_date,
  commitment_text text not null,
  domain text not null default 'HomeReach',
  status text not null default 'planned' check (status in ('planned','completed','missed','deferred','blocked')),
  evidence_json jsonb not null default '{}'::jsonb,
  revenue_impact numeric(12,2) not null default 0,
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  follow_up_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.executive_agent_kpis (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references public.executive_agents(id) on delete set null,
  kpi_date date not null default current_date,
  kpi_key text not null,
  kpi_label text not null,
  value_numeric numeric(14,2),
  value_text text,
  trend text not null default 'unknown' check (trend in ('up','down','flat','unknown')),
  source text not null default 'executive_meeting_snapshot',
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.executive_action_approvals (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid references public.executive_meetings(id) on delete cascade,
  agent_id uuid references public.executive_agents(id) on delete set null,
  pending_action text not null,
  business_reason text not null default '',
  risk_level text not null default 'medium' check (risk_level in ('low','medium','high','critical')),
  approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','edited','archived')),
  edited_action text,
  decision_reason text,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  audit_payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists executive_agents_enabled_idx on public.executive_agents (enabled, display_order, role);
create index if not exists executive_agents_domains_idx on public.executive_agents using gin (assigned_domains);
create index if not exists executive_meetings_latest_idx on public.executive_meetings (meeting_date desc, meeting_type, generated_at desc);
create index if not exists executive_meetings_status_idx on public.executive_meetings (status, generated_at desc);
create index if not exists executive_meeting_reports_meeting_idx on public.executive_meeting_reports (meeting_id, created_at desc);
create index if not exists executive_agent_reports_meeting_idx on public.executive_agent_reports (meeting_id, agent_key);
create index if not exists executive_agent_reports_agent_idx on public.executive_agent_reports (agent_key, created_at desc);
create index if not exists executive_agent_commitments_accountability_idx on public.executive_agent_commitments (commitment_date desc, status, domain);
create index if not exists executive_agent_commitments_agent_idx on public.executive_agent_commitments (agent_id, commitment_date desc);
create index if not exists executive_agent_kpis_agent_idx on public.executive_agent_kpis (agent_id, kpi_date desc, kpi_key);
create index if not exists executive_action_approvals_queue_idx on public.executive_action_approvals (approval_status, risk_level, created_at desc);
create index if not exists executive_action_approvals_meeting_idx on public.executive_action_approvals (meeting_id, created_at desc);

create or replace function public.tg_executive_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists executive_voice_profiles_touch_updated_at on public.executive_voice_profiles;
create trigger executive_voice_profiles_touch_updated_at
before update on public.executive_voice_profiles
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_agents_touch_updated_at on public.executive_agents;
create trigger executive_agents_touch_updated_at
before update on public.executive_agents
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_meeting_settings_touch_updated_at on public.executive_meeting_settings;
create trigger executive_meeting_settings_touch_updated_at
before update on public.executive_meeting_settings
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_meetings_touch_updated_at on public.executive_meetings;
create trigger executive_meetings_touch_updated_at
before update on public.executive_meetings
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_agent_reports_touch_updated_at on public.executive_agent_reports;
create trigger executive_agent_reports_touch_updated_at
before update on public.executive_agent_reports
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_agent_commitments_touch_updated_at on public.executive_agent_commitments;
create trigger executive_agent_commitments_touch_updated_at
before update on public.executive_agent_commitments
for each row execute function public.tg_executive_touch_updated_at();

drop trigger if exists executive_action_approvals_touch_updated_at on public.executive_action_approvals;
create trigger executive_action_approvals_touch_updated_at
before update on public.executive_action_approvals
for each row execute function public.tg_executive_touch_updated_at();

create or replace function public.executive_prevent_secret_like_storage()
returns trigger
language plpgsql
as $$
declare
  row_json jsonb;
  text_field text;
  json_field text;
begin
  row_json := to_jsonb(new);

  foreach text_field in array array[
    'name','role','mission','system_prompt','title','ceo_summary','summary',
    'report_markdown','commitment_text','value_text','source','pending_action',
    'business_reason','edited_action','decision_reason','notes','display_name',
    'voice_label','speaking_style'
  ] loop
    if row_json ? text_field then
      perform public.agent_assert_text_has_no_secret_like_value(row_json->>text_field, tg_table_name || '.' || text_field);
    end if;
  end loop;

  foreach json_field in array array[
    'daily_responsibilities','kpi_ownership','morning_report_format',
    'afternoon_report_format','metadata_json','tts_settings_json',
    'live_mode_settings_json','provider_plan_json','decisions_needed_json',
    'blockers_json','revenue_impact_json','tomorrow_priorities_json',
    'source_snapshot_json','voice_ready_json','planned_work_json',
    'completed_work_json','priorities_json','risks_json','kpi_snapshot_json',
    'data_sources_json','evidence_json','audit_payload_json'
  ] loop
    if row_json ? json_field then
      perform public.agent_assert_jsonb_has_no_secret_like_value(row_json->json_field, tg_table_name || '.' || json_field);
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists executive_voice_profiles_prevent_secret_like_storage on public.executive_voice_profiles;
create trigger executive_voice_profiles_prevent_secret_like_storage
before insert or update on public.executive_voice_profiles
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_agents_prevent_secret_like_storage on public.executive_agents;
create trigger executive_agents_prevent_secret_like_storage
before insert or update on public.executive_agents
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_meeting_settings_prevent_secret_like_storage on public.executive_meeting_settings;
create trigger executive_meeting_settings_prevent_secret_like_storage
before insert or update on public.executive_meeting_settings
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_meetings_prevent_secret_like_storage on public.executive_meetings;
create trigger executive_meetings_prevent_secret_like_storage
before insert or update on public.executive_meetings
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_meeting_reports_prevent_secret_like_storage on public.executive_meeting_reports;
create trigger executive_meeting_reports_prevent_secret_like_storage
before insert or update on public.executive_meeting_reports
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_agent_reports_prevent_secret_like_storage on public.executive_agent_reports;
create trigger executive_agent_reports_prevent_secret_like_storage
before insert or update on public.executive_agent_reports
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_agent_commitments_prevent_secret_like_storage on public.executive_agent_commitments;
create trigger executive_agent_commitments_prevent_secret_like_storage
before insert or update on public.executive_agent_commitments
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_agent_kpis_prevent_secret_like_storage on public.executive_agent_kpis;
create trigger executive_agent_kpis_prevent_secret_like_storage
before insert or update on public.executive_agent_kpis
for each row execute function public.executive_prevent_secret_like_storage();

drop trigger if exists executive_action_approvals_prevent_secret_like_storage on public.executive_action_approvals;
create trigger executive_action_approvals_prevent_secret_like_storage
before insert or update on public.executive_action_approvals
for each row execute function public.executive_prevent_secret_like_storage();

insert into public.executive_meeting_settings (
  id,
  settings_key,
  timezone,
  morning_time,
  afternoon_time,
  auto_generate_enabled,
  notification_badge_enabled,
  email_summary_enabled,
  sms_summary_enabled,
  voice_mode_enabled
) values (
  '00000000-0000-0000-0000-000000000801',
  'default',
  'America/New_York',
  time '08:00',
  time '16:30',
  true,
  true,
  false,
  false,
  false
) on conflict (settings_key) do update set
  timezone = excluded.timezone,
  morning_time = excluded.morning_time,
  afternoon_time = excluded.afternoon_time,
  updated_at = now();

insert into public.executive_voice_profiles (
  profile_key,
  display_name,
  voice_label,
  speaking_style,
  notes
) values
  ('ceo-neutral', 'CEO executive voice placeholder', 'Executive calm', 'Concise, decisive, operational, and plain-spoken.', 'Future voice provider assignment only.'),
  ('cto-neutral', 'CTO systems voice placeholder', 'Systems lead', 'Precise, risk-aware, architecture-focused, and direct.', 'Future voice provider assignment only.'),
  ('growth-neutral', 'Growth leadership voice placeholder', 'Growth lead', 'Commercial, practical, opportunity-focused, and clear.', 'Future voice provider assignment only.'),
  ('risk-neutral', 'Risk leadership voice placeholder', 'Risk lead', 'Sober, evidence-first, and concise.', 'Future voice provider assignment only.')
on conflict (profile_key) do update set
  display_name = excluded.display_name,
  voice_label = excluded.voice_label,
  speaking_style = excluded.speaking_style,
  notes = excluded.notes,
  updated_at = now();

insert into public.executive_agents (
  agent_key,
  name,
  role,
  mission,
  daily_responsibilities,
  kpi_ownership,
  morning_report_format,
  afternoon_report_format,
  permissions_level,
  assigned_domains,
  voice_profile_id,
  system_prompt,
  display_order,
  metadata_json
) values
  (
    'ceo',
    'Ari Vale',
    'CEO Agent',
    'Keep HomeReach focused on the highest-value outcomes, owner decisions, operating priorities, and accountability across the AI workforce.',
    '["Set daily executive priorities","Summarize cross-functional decisions","Identify blockers requiring Jason","Track strategic momentum","Escalate risks before they become expensive"]'::jsonb,
    '["Daily focus clarity","Decision cycle time","Revenue moved forward","Cross-agent accountability","Strategic blocker removal"]'::jsonb,
    '{"sections":["Today focus","Top decisions","Revenue leverage","Risks","What Jason should approve"]}'::jsonb,
    '{"sections":["Completed outcomes","Revenue moved","Misses","Blockers","Tomorrow priorities"]}'::jsonb,
    'recommend_only',
    array['HomeReach','Finance','Operations','Outreach']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'ceo-neutral'),
    'You are the CEO Agent for HomeReach. Run the daily executive meeting with discipline. Be practical, revenue-focused, and honest about blockers. Never approve or execute outbound, payment, political, legal, production-code, or data-destructive actions. Recommend decisions clearly and preserve human approval gates.',
    10,
    '{"phase":"default_seed","approvalBoundary":"recommendations_only"}'::jsonb
  ),
  (
    'cto',
    'Morgan Stack',
    'CTO Agent',
    'Protect and advance the HomeReach platform architecture, production readiness, integrations, automation safety, and technical delivery.',
    '["Review platform health","Track production risks","Prioritize technical hardening","Identify integration gaps","Keep AI execution safe and observable"]'::jsonb,
    '["Build health","Open system risks","Integration readiness","Auth and RLS safety","Technical debt blocking revenue"]'::jsonb,
    '{"sections":["System health","Engineering priorities","Integration blockers","Risk controls","Approval needs"]}'::jsonb,
    '{"sections":["Shipped today","Verified today","Failures","Residual risk","Tomorrow engineering focus"]}'::jsonb,
    'draft_only',
    array['HomeReach','Websites','Operations']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'cto-neutral'),
    'You are the CTO Agent for HomeReach. Evaluate architecture, routes, cron, auth, Supabase, CI, provider integrations, and operational safety. Draft technical recommendations only. Do not edit production code, secrets, billing, data deletion, campaign settings, or external systems without explicit human approval.',
    20,
    '{"phase":"default_seed","approvalBoundary":"draft_recommendations_only"}'::jsonb
  ),
  (
    'cmo',
    'Mara Signal',
    'Chief Marketing Officer Agent',
    'Turn HomeReach positioning, local growth, political mail, procurement, website, and content opportunities into focused marketing action.',
    '["Review demand signals","Shape campaign messaging","Identify content opportunities","Align offers with approved positioning","Flag brand or claim risk"]'::jsonb,
    '["Qualified demand signals","Campaign ideas ready for review","Content opportunities","Brand risk","Conversion opportunities"]'::jsonb,
    '{"sections":["Market signal","Messaging priority","Creative needs","Risk notes","Decision needed"]}'::jsonb,
    '{"sections":["Marketing output","Revenue influence","Missed opportunities","Content backlog","Tomorrow focus"]}'::jsonb,
    'draft_only',
    array['HomeReach','Political Mail','Websites','Outreach']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'growth-neutral'),
    'You are the CMO Agent for HomeReach. Build practical, emotionally credible, approval-ready marketing strategy. Use relief, protection, growth, confidence, clarity, control, and operational superiority when earned by context. Do not publish, send, or make unsupported guarantees.',
    30,
    '{"phase":"default_seed","approvalBoundary":"draft_marketing_only"}'::jsonb
  ),
  (
    'chief_outreach_officer',
    'Cal Reid',
    'Chief Outreach Officer Agent',
    'Coordinate approval-safe outreach strategy across Jason, Josh, Chelsi, and Heather without spam patterns or repeated sender voice.',
    '["Prioritize follow-ups","Review outreach drafts","Protect sender reputation","Rotate sender personas","Escalate high-value replies"]'::jsonb,
    '["Follow-ups due","Drafts awaiting approval","Reply quality","Sender diversity","High-value opportunities"]'::jsonb,
    '{"sections":["Outreach queue","Recommended sends for approval","Persona rotation","Reputation risk","Blockers"]}'::jsonb,
    '{"sections":["Outreach prepared","Replies or signals","Approvals still pending","Risks","Tomorrow follow-ups"]}'::jsonb,
    'approval_required',
    array['Outreach','HomeReach','Political Mail']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'growth-neutral'),
    'You are the Chief Outreach Officer Agent for HomeReach. Draft and prioritize outreach, but never send SMS, email, Facebook DMs, social posts, or political messaging without human approval. Protect reputation and avoid duplicate copy, cadence, CTA, and sender patterns.',
    40,
    '{"phase":"default_seed","approvalBoundary":"human_approval_required_before_outbound"}'::jsonb
  ),
  (
    'continuous_improvement',
    'Ivy Kaizen',
    'Continuous Improvement Officer Agent',
    'Find daily process improvements, automation opportunities, repeated misses, and operating-system upgrades that compound execution quality.',
    '["Review repeated blockers","Find workflow friction","Recommend SOP improvements","Track missed commitments","Suggest automation only behind approval gates"]'::jsonb,
    '["Repeated blockers","Process improvements found","Missed commitments","Automation candidates","SOP gaps"]'::jsonb,
    '{"sections":["Improvement target","Friction observed","Suggested fix","Risk","Owner decision"]}'::jsonb,
    '{"sections":["Improvements completed","Friction removed","Misses repeated","Next fix","Tomorrow experiment"]}'::jsonb,
    'recommend_only',
    array['Operations','HomeReach','Outreach']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'cto-neutral'),
    'You are the Continuous Improvement Officer Agent for HomeReach. Identify practical operating improvements and repeated misses. Recommend changes but do not alter production automation, pricing, campaigns, sends, or data without human approval.',
    50,
    '{"phase":"default_seed","approvalBoundary":"recommendations_only"}'::jsonb
  ),
  (
    'cro',
    'Rowan Ledger',
    'Chief Revenue Officer Agent',
    'Drive revenue focus across pipeline, mini apps, quotes, proposals, follow-ups, campaigns, and approvals waiting on owner decisions.',
    '["Review revenue opportunities","Prioritize approvals by money impact","Identify stuck deals","Connect tasks to pipeline","Flag quote/proposal needs"]'::jsonb,
    '["Estimated revenue awaiting approval","High-value stuck items","Completed revenue actions","Pipeline risks","Proposal or quote backlog"]'::jsonb,
    '{"sections":["Revenue priority","High-value approvals","Pipeline risk","Recommended owner action","Expected impact"]}'::jsonb,
    '{"sections":["Revenue moved","Approvals cleared","Deals still stuck","Follow-up needs","Tomorrow revenue focus"]}'::jsonb,
    'recommend_only',
    array['HomeReach','Finance','Outreach','Websites','Political Mail']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'growth-neutral'),
    'You are the Chief Revenue Officer Agent for HomeReach. Keep the system focused on revenue, conversion, and owner decisions. Do not change prices, charge customers, mark deals won, or send proposals/outreach without approval.',
    60,
    '{"phase":"default_seed","approvalBoundary":"recommendations_only"}'::jsonb
  ),
  (
    'cfo',
    'Fin Brooks',
    'Chief Financial Officer Agent',
    'Watch cash, payments, spend risk, margin, procurement savings, Stripe/payment readiness, and revenue quality.',
    '["Review payment and revenue signals","Track estimated savings","Flag spend commitments","Watch pricing and margin risk","Escalate failed payment indicators"]'::jsonb,
    '["Revenue signal quality","Estimated savings awaiting approval","Failed payment risk","Spend approvals needed","Margin protection"]'::jsonb,
    '{"sections":["Financial focus","Savings/revenue watch","Spend risk","Pricing risk","Decision needed"]}'::jsonb,
    '{"sections":["Financial outcomes","Savings advanced","Spend avoided","Payment risks","Tomorrow financial priority"]}'::jsonb,
    'recommend_only',
    array['Finance','Supplyfy','HomeReach']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'risk-neutral'),
    'You are the CFO Agent for HomeReach. Analyze revenue, savings, payment readiness, margin, and spend risk. Never charge customers, approve purchases, switch vendors, alter pricing, or commit spend without human approval.',
    70,
    '{"phase":"default_seed","approvalBoundary":"financial_actions_require_approval"}'::jsonb
  ),
  (
    'operations',
    'Ops Lane',
    'Operations Officer Agent',
    'Keep fulfillment, client onboarding, campaigns, website builds, procurement tasks, and execution queues moving with low friction.',
    '["Review campaign and project status","Spot onboarding blockers","Track execution queue health","Coordinate operations follow-ups","Escalate manual takeover needs"]'::jsonb,
    '["Open operational blockers","Manual takeover items","Completed fulfillment tasks","Onboarding progress","Queue failures"]'::jsonb,
    '{"sections":["Operational queue","Fulfillment risks","Manual takeover needs","Client blockers","Owner decisions"]}'::jsonb,
    '{"sections":["Ops completed","Client progress","Queue failures","Blockers","Tomorrow ops focus"]}'::jsonb,
    'recommend_only',
    array['Operations','Websites','Supplyfy','SAM.gov','Political Mail']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'cto-neutral'),
    'You are the Operations Officer Agent for HomeReach. Track projects, handoffs, campaigns, website builds, procurement reviews, SAM.gov support, and manual takeovers. Do not modify client campaigns, place orders, submit bids, or change external systems without approval.',
    80,
    '{"phase":"default_seed","approvalBoundary":"operations_changes_require_approval"}'::jsonb
  ),
  (
    'qa_risk',
    'Quinn Shield',
    'QA / Risk Officer Agent',
    'Find production, compliance, approval, sender, political, procurement, SAM.gov, security, and customer-experience risks before action.',
    '["Inspect failed tasks","Review approval boundaries","Flag compliance risk","Check unsafe automation","Prioritize QA blockers"]'::jsonb,
    '["Critical risks","Failed tasks","Approval gate integrity","Compliance blockers","Manual takeover count"]'::jsonb,
    '{"sections":["Critical risk","Approval concerns","Failed systems","Compliance review","Decision needed"]}'::jsonb,
    '{"sections":["Risks closed","Risks still open","Failures observed","Approval gaps","Tomorrow QA target"]}'::jsonb,
    'analysis_only',
    array['Operations','Outreach','Political Mail','SAM.gov','Finance','HomeReach']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'risk-neutral'),
    'You are the QA / Risk Officer Agent for HomeReach. Be direct about risk, failed workflows, unsafe actions, and approval gaps. Never waive human approval. Political, SAM.gov, procurement, payments, data deletion, public posting, campaign changes, and outbound messages require human approval.',
    90,
    '{"phase":"default_seed","approvalBoundary":"risk_review_only"}'::jsonb
  ),
  (
    'customer_success',
    'Cora Hart',
    'Customer Success Agent',
    'Protect customer momentum through onboarding clarity, follow-up quality, missing asset detection, client communication readiness, and retention risk awareness.',
    '["Review client onboarding needs","Find missing assets","Draft customer-safe follow-up recommendations","Spot retention risk","Escalate support blockers"]'::jsonb,
    '["Client blockers","Missing assets","Follow-ups needed","Customer risk","Onboarding progress"]'::jsonb,
    '{"sections":["Client priority","Missing info","Support blocker","Recommended touch","Risk"]}'::jsonb,
    '{"sections":["Client progress","Follow-ups prepared","Assets still missing","Risks","Tomorrow customer focus"]}'::jsonb,
    'draft_only',
    array['HomeReach','Websites','Outreach','Operations']::text[],
    (select id from public.executive_voice_profiles where profile_key = 'growth-neutral'),
    'You are the Customer Success Agent for HomeReach. Keep client work moving with clarity and care. Draft follow-up recommendations only. Do not send messages, change campaigns, publish websites, adjust pricing, or alter customer records without approval.',
    100,
    '{"phase":"default_seed","approvalBoundary":"draft_customer_success_only"}'::jsonb
  )
on conflict (agent_key) do update set
  name = excluded.name,
  role = excluded.role,
  mission = excluded.mission,
  daily_responsibilities = excluded.daily_responsibilities,
  kpi_ownership = excluded.kpi_ownership,
  morning_report_format = excluded.morning_report_format,
  afternoon_report_format = excluded.afternoon_report_format,
  permissions_level = excluded.permissions_level,
  assigned_domains = excluded.assigned_domains,
  voice_profile_id = excluded.voice_profile_id,
  system_prompt = excluded.system_prompt,
  display_order = excluded.display_order,
  metadata_json = executive_agents.metadata_json || excluded.metadata_json,
  updated_at = now(),
  archived_at = null;

alter table public.executive_voice_profiles enable row level security;
alter table public.executive_agents enable row level security;
alter table public.executive_meeting_settings enable row level security;
alter table public.executive_meetings enable row level security;
alter table public.executive_meeting_reports enable row level security;
alter table public.executive_agent_reports enable row level security;
alter table public.executive_agent_commitments enable row level security;
alter table public.executive_agent_kpis enable row level security;
alter table public.executive_action_approvals enable row level security;

grant select, insert, update, delete on public.executive_voice_profiles to authenticated;
grant select, insert, update, delete on public.executive_agents to authenticated;
grant select, insert, update, delete on public.executive_meeting_settings to authenticated;
grant select, insert, update, delete on public.executive_meetings to authenticated;
grant select, insert, update, delete on public.executive_meeting_reports to authenticated;
grant select, insert, update, delete on public.executive_agent_reports to authenticated;
grant select, insert, update, delete on public.executive_agent_commitments to authenticated;
grant select, insert, update, delete on public.executive_agent_kpis to authenticated;
grant select, insert, update, delete on public.executive_action_approvals to authenticated;

grant all on public.executive_voice_profiles to service_role;
grant all on public.executive_agents to service_role;
grant all on public.executive_meeting_settings to service_role;
grant all on public.executive_meetings to service_role;
grant all on public.executive_meeting_reports to service_role;
grant all on public.executive_agent_reports to service_role;
grant all on public.executive_agent_commitments to service_role;
grant all on public.executive_agent_kpis to service_role;
grant all on public.executive_action_approvals to service_role;

drop policy if exists "Admins can read executive voice profiles" on public.executive_voice_profiles;
create policy "Admins can read executive voice profiles"
  on public.executive_voice_profiles
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive voice profiles" on public.executive_voice_profiles;
create policy "Admins can write executive voice profiles"
  on public.executive_voice_profiles
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive agents" on public.executive_agents;
create policy "Admins can read executive agents"
  on public.executive_agents
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive agents" on public.executive_agents;
create policy "Admins can write executive agents"
  on public.executive_agents
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive meeting settings" on public.executive_meeting_settings;
create policy "Admins can read executive meeting settings"
  on public.executive_meeting_settings
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meeting settings" on public.executive_meeting_settings;
create policy "Admins can write executive meeting settings"
  on public.executive_meeting_settings
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive meetings" on public.executive_meetings;
create policy "Admins can read executive meetings"
  on public.executive_meetings
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meetings" on public.executive_meetings;
create policy "Admins can write executive meetings"
  on public.executive_meetings
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive meeting reports" on public.executive_meeting_reports;
create policy "Admins can read executive meeting reports"
  on public.executive_meeting_reports
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive meeting reports" on public.executive_meeting_reports;
create policy "Admins can write executive meeting reports"
  on public.executive_meeting_reports
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive agent reports" on public.executive_agent_reports;
create policy "Admins can read executive agent reports"
  on public.executive_agent_reports
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive agent reports" on public.executive_agent_reports;
create policy "Admins can write executive agent reports"
  on public.executive_agent_reports
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive commitments" on public.executive_agent_commitments;
create policy "Admins can read executive commitments"
  on public.executive_agent_commitments
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive commitments" on public.executive_agent_commitments;
create policy "Admins can write executive commitments"
  on public.executive_agent_commitments
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive kpis" on public.executive_agent_kpis;
create policy "Admins can read executive kpis"
  on public.executive_agent_kpis
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive kpis" on public.executive_agent_kpis;
create policy "Admins can write executive kpis"
  on public.executive_agent_kpis
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can read executive approvals" on public.executive_action_approvals;
create policy "Admins can read executive approvals"
  on public.executive_action_approvals
  for select
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

drop policy if exists "Admins can write executive approvals" on public.executive_action_approvals;
create policy "Admins can write executive approvals"
  on public.executive_action_approvals
  for all
  to authenticated
  using ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'user_role') = 'admin');

revoke execute on function public.executive_prevent_secret_like_storage() from public, anon, authenticated;
revoke execute on function public.tg_executive_touch_updated_at() from public, anon, authenticated;
