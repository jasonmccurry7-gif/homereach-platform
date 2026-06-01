-- HomeReach AI Workforce Operating System
-- Additive task manifest and activity log layer. Reuses AI Assets tables for
-- context, SOPs, data sources, agent profiles, prompt chains, outputs, and reviews.

create table if not exists public.ai_workforce_tasks (
  id uuid primary key default gen_random_uuid(),
  task_id text not null,
  workflow_name text not null,
  requestor text not null default 'HomeReach Admin',
  assigned_agent text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  status text not null default 'new' check (
    status in (
      'new',
      'assigned',
      'in_progress',
      'blocked',
      'awaiting_approval',
      'approved',
      'rejected',
      'needs_revision',
      'completed',
      'failed'
    )
  ),
  input_path text,
  input_data jsonb not null default '{}'::jsonb,
  expected_output text not null default '',
  dependencies text[] not null default '{}',
  due_date timestamptz,
  approval_required boolean not null default true,
  completion_notes text,
  error_notes text,
  related_campaign text,
  related_client text,
  related_opportunity text,
  output_id uuid references public.ai_outputs(id) on delete set null,
  owner_user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_workforce_activity_logs (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.ai_workforce_tasks(id) on delete set null,
  task_public_id text,
  agent_name text,
  event_type text not null default 'activity',
  status text not null default 'logged',
  summary text not null default '',
  details jsonb not null default '{}'::jsonb,
  approval_status text not null default 'not_required' check (
    approval_status in ('not_required','needs_review','approved','rejected','needs_revision')
  ),
  related_output_id uuid references public.ai_outputs(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists ai_workforce_tasks_status_idx
  on public.ai_workforce_tasks (status, priority, updated_at desc);
create unique index if not exists ai_workforce_tasks_task_id_idx
  on public.ai_workforce_tasks (task_id);
create index if not exists ai_workforce_tasks_agent_idx
  on public.ai_workforce_tasks (assigned_agent, status, updated_at desc);
create index if not exists ai_workforce_tasks_workflow_idx
  on public.ai_workforce_tasks (workflow_name, status);
create index if not exists ai_workforce_activity_logs_task_idx
  on public.ai_workforce_activity_logs (task_id, created_at desc);
create index if not exists ai_workforce_activity_logs_agent_idx
  on public.ai_workforce_activity_logs (agent_name, created_at desc);

alter table public.ai_workforce_tasks enable row level security;
alter table public.ai_workforce_activity_logs enable row level security;

grant select, insert, update, delete on
  public.ai_workforce_tasks,
  public.ai_workforce_activity_logs
to authenticated;

grant all on
  public.ai_workforce_tasks,
  public.ai_workforce_activity_logs
to service_role;

drop policy if exists "ai_workforce_tasks_service" on public.ai_workforce_tasks;
create policy "ai_workforce_tasks_service"
  on public.ai_workforce_tasks for all to service_role
  using (true) with check (true);

drop policy if exists "ai_workforce_tasks_admin_select" on public.ai_workforce_tasks;
create policy "ai_workforce_tasks_admin_select"
  on public.ai_workforce_tasks for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "ai_workforce_tasks_admin_write" on public.ai_workforce_tasks;
create policy "ai_workforce_tasks_admin_write"
  on public.ai_workforce_tasks for all to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

drop policy if exists "ai_workforce_activity_logs_service" on public.ai_workforce_activity_logs;
create policy "ai_workforce_activity_logs_service"
  on public.ai_workforce_activity_logs for all to service_role
  using (true) with check (true);

drop policy if exists "ai_workforce_activity_logs_admin_select" on public.ai_workforce_activity_logs;
create policy "ai_workforce_activity_logs_admin_select"
  on public.ai_workforce_activity_logs for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists "ai_workforce_activity_logs_admin_write" on public.ai_workforce_activity_logs;
create policy "ai_workforce_activity_logs_admin_write"
  on public.ai_workforce_activity_logs for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

insert into public.ai_workforce_tasks (
  task_id,
  workflow_name,
  requestor,
  assigned_agent,
  priority,
  status,
  input_path,
  input_data,
  expected_output,
  dependencies,
  approval_required,
  related_campaign,
  related_client,
  related_opportunity,
  completion_notes
)
values
  (
    'WF-SHARED-POSTCARD-001',
    'Shared Postcard Chain',
    'HomeReach Admin',
    'Shared Postcard Agent',
    'high',
    'assigned',
    'ai-workforce/outputs/outreach',
    '{"chain":"City/category research -> offer angle -> Facebook post -> DM follow-up -> intake link -> close sequence -> revenue report"}'::jsonb,
    'Local Facebook post, DM follow-up, intake CTA, and revenue report outline.',
    array['AI Assets business context','Facebook Group Post - Local Visibility','Facebook DM - Warm Lead Follow-Up']::text[],
    true,
    'Shared postcard campaigns',
    null,
    null,
    'Starter manifest item for reusable shared postcard execution.'
  ),
  (
    'WF-TARGETED-001',
    'Targeted Campaign Chain',
    'HomeReach Admin',
    'Targeted Campaign Agent',
    'high',
    'assigned',
    'ai-workforce/outputs/content-strategy',
    '{"chain":"Business research -> neighborhood/route strategy -> offer -> proposal -> email/SMS draft -> follow-up -> campaign summary"}'::jsonb,
    'Targeted route strategy, proposal outline, outreach draft, and follow-up plan.',
    array['AI Assets business context','Postcard Creative Brief','Proposal Generation']::text[],
    true,
    'Targeted mailing campaigns',
    null,
    null,
    'Starter manifest item for targeted campaign execution.'
  ),
  (
    'WF-POLITICAL-001',
    'Political Campaign Chain',
    'HomeReach Admin',
    'Political Campaign Agent',
    'critical',
    'awaiting_approval',
    'ai-workforce/outputs/political',
    '{"chain":"Candidate/race research -> geographic mail plan -> campaign options -> postcard creative brief -> proposal -> approval -> follow-up"}'::jsonb,
    'Neutral political mail plan, creative brief, proposal, and compliance notes.',
    array['Political Campaign Planning Brief','Candidate Research Summary','Postcard Creative Brief']::text[],
    true,
    'Political mail campaigns',
    null,
    null,
    'Political outputs are approval-gated by default.'
  ),
  (
    'WF-PROCUREMENT-001',
    'Procurement Chain',
    'HomeReach Admin',
    'Procurement Agent',
    'high',
    'assigned',
    'ai-workforce/outputs/procurement',
    '{"chain":"Business intake -> spend analysis -> savings angle -> pitch -> demo script -> follow-up -> close report"}'::jsonb,
    'Owner-friendly savings insight, procurement pitch, and follow-up sequence.',
    array['Inventory Savings Audit','Procurement Pitch','Procurement Examples']::text[],
    true,
    null,
    'Procurement dashboard prospects',
    null,
    'AI may recommend but never commit spend.'
  ),
  (
    'WF-SAM-001',
    'SAM.gov Chain',
    'HomeReach Admin',
    'SAM.gov Contract Agent',
    'critical',
    'awaiting_approval',
    'ai-workforce/outputs/sam-gov',
    '{"chain":"Opportunity scan -> fit analysis -> bid/no-bid -> subcontractor needs -> proposal draft -> approval checklist -> submission package"}'::jsonb,
    'Bid/no-bid summary, compliance checklist, subcontractor needs, proposal package outline.',
    array['SAM.gov Opportunity Review','Proposal Generation']::text[],
    true,
    null,
    null,
    'SAM.gov opportunities',
    'Government contract work is human-review only.'
  ),
  (
    'WF-QA-001',
    'QA Chain',
    'HomeReach Admin',
    'QA / System Health Agent',
    'high',
    'assigned',
    'ai-workforce/outputs/qa',
    '{"chain":"Route audit -> form test -> CTA test -> payment test -> automation test -> mobile test -> issue report"}'::jsonb,
    'Issue report with severity, reproduction steps, affected routes, and recommended fixes.',
    array['Dashboard QA','System Health Check']::text[],
    false,
    'Platform-wide',
    null,
    null,
    'QA findings do not execute changes automatically.'
  ),
  (
    'WF-REVENUE-001',
    'Revenue Integrity Chain',
    'HomeReach Admin',
    'Revenue Integrity Agent',
    'critical',
    'assigned',
    'ai-workforce/outputs/revenue-integrity',
    '{"chain":"Lead review -> quote review -> payment review -> follow-up review -> stuck opportunity report -> recommended actions"}'::jsonb,
    'Daily revenue risk report and action list.',
    array['Daily Revenue Integrity Audit','Lead Follow-Up - Stale Proposal']::text[],
    true,
    'Revenue operations',
    null,
    null,
    'Customer-facing recovery outreach requires approval.'
  )
on conflict (task_id) do nothing;

insert into public.ai_workforce_activity_logs (
  task_public_id,
  agent_name,
  event_type,
  status,
  summary,
  details,
  approval_status
)
select
  'WF-BOOTSTRAP-001',
  'Orchestrator Agent',
  'system_bootstrap',
  'completed',
  'AI Workforce Operating System initialized with AGENTS.md, skills, task manifest, approval gates, and AI Assets integration.',
  '{"source":"migration","human_approval_required":true}'::jsonb,
  'not_required'
where not exists (
  select 1
  from public.ai_workforce_activity_logs
  where task_public_id = 'WF-BOOTSTRAP-001'
);;
