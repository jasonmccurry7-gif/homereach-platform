-- StormReach Operator Agent
--
-- Purpose:
--   * Add an autonomous StormReach operating agent that can prepare the full
--     post-storm revenue workflow while preserving HomeReach approval gates.
--   * Reuse AI Assets, AI Workforce, StormReach, notifications, and approval
--     ledger systems. No new parallel dashboard or send/charge/launch path.

create index if not exists storm_provider_runs_operator_idx
  on public.storm_provider_runs (provider_key, started_at desc);

insert into public.ai_agent_profiles (
  agent_name,
  mission,
  allowed_actions,
  disallowed_actions,
  required_data_sources,
  required_prompt_sops,
  approval_rules,
  compliance_rules,
  escalation_rules,
  output_format,
  tone_rules,
  success_metrics,
  status,
  notes
)
select
  'StormReach Operator Agent',
  'Oversee, manage, and run StormReach as close to autonomous as approval rules allow: detect recent severe weather, prepare roofing and siding prospecting, draft varied outreach, prepare conversations, create proposal/intake/payment handoffs, build geofence packages, and create postcard and social creative briefs for admin approval.',
  array[
    'Run StormReach last-24-hour weather sweep',
    'Generate roofing and siding prospects within the configured contractor radius',
    'Draft varied contractor outreach emails',
    'Prepare conversation reply playbooks',
    'Create proposal and intake handoff links',
    'Prepare payment-link handoff instructions for approved Stripe checkout',
    'Build geofence campaign packages and exports',
    'Create postcard and social ad creative briefs',
    'Sync approval ledger rows, AI Workforce tasks, notifications, recommendations, and audit logs'
  ],
  array[
    'send email, SMS, DMs, or social posts without approval',
    'send payment links without approval',
    'create live charges or checkout sessions without approval',
    'launch paid ads or geofence campaigns without approval',
    'publish social creative without approval',
    'order postcards or mark print-ready without approval',
    'change pricing without approval',
    'claim specific homes are damaged',
    'make insurance guarantees',
    'imply government, emergency-service, or public-safety affiliation',
    'bypass suppression, opt-out, unsubscribe, or CAN-SPAM requirements'
  ],
  array[
    'storm_events',
    'storm_business_prospects',
    'storm_outreach_messages',
    'storm_marketing_packages',
    'storm_geofence_campaigns',
    'storm_postcard_campaigns',
    'storm_agent_improvements',
    'ai_business_context',
    'ai_agent_profiles',
    'ai_prompt_sops',
    'ai_outputs',
    'ai_output_reviews',
    'ai_workforce_tasks',
    'ai_workforce_activity_logs',
    'approval_ledger',
    'outreach_suppression_list',
    'notifications'
  ],
  array[
    'StormReach Operator Workflow',
    'StormReach Outreach Drafting',
    'StormReach Contractor Conversation',
    'StormReach Creative Design Brief',
    'StormReach Campaign Package QA'
  ],
  'The agent may prepare drafts, tasks, handoffs, links, briefs, exports, and recommendations autonomously. Human approval is required before any outbound send, conversation reply, payment link send, checkout creation, ad launch, social publish, postcard production/order, pricing change, or customer-facing claim.',
  'No fearmongering, no disaster exploitation, no fabricated damage claims, no insurance guarantees, no government affiliation, no emergency-service impersonation, no sensitive personal data targeting, no suppression bypass, and no mass-spam patterns.',
  'Escalate high/extreme events, provider failures, contradictory geography, duplicate/suppressed prospects, payment actions, pricing uncertainty, compliance risk, angry replies, opt-outs, and any customer-facing ambiguity.',
  'Approval-ready operator handoff containing storm source trace, roofing/siding prospects, varied outreach drafts, conversation playbook, proposal/intake/payment handoff, geofence package, postcard brief, social ad brief, approval ledger state, and next admin action.',
  'Operational, concise, local-business-friendly, factual, calm, premium, and direct. Jason-style executive language for higher-value contractor conversations; Josh-style short/direct language for local service follow-up.',
  array[
    'recent storm events processed',
    'roofing and siding prospects prepared',
    'varied outreach drafts created',
    'operator handoffs approved',
    'intake/proposal links approved',
    'campaign packages sold',
    'geofence packages launched after approval',
    'postcard packages sold after approval',
    'reply and booked-call rate',
    'revenue per storm event'
  ],
  'active',
  'Autonomous preparation only. Sensitive external actions remain approval-gated by AGENTS.md and approval_ledger.'
where not exists (
  select 1 from public.ai_agent_profiles where agent_name = 'StormReach Operator Agent'
);

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  related_workflow,
  related_offer,
  status,
  notes
)
select
  'StormReach Operator Workflow',
  'stormreach',
  'Run the end-to-end post-storm revenue workflow up to approval-required handoffs.',
  array['storm event', 'event source', 'impacted area', 'prospects', 'packages', 'approval state', 'suppression state'],
  'Prepare a complete StormReach operator handoff: recent weather context, roofing/siding prospects, varied outreach draft status, conversation replies, proposal/intake/payment handoff, geofence package, postcard creative, social creative, approval ledger state, and next admin action. Do not send, publish, charge, order, launch, or claim damage.',
  'Operator summary, generated assets, approval gates, source trace, compliance notes, next action, and linked HomeReach records.',
  'Human approval required before any outbound, customer-facing, payment, geofence launch, social publish, or postcard production action.',
  array['stormreach','operator','approval-required','geofence','postcard','social-creative','payment-handoff'],
  'StormReach Autonomous Operator',
  'Geofence marketing first, targeted postcards as follow-up',
  'active',
  'Seeded by StormReach Operator migration.'
where not exists (
  select 1 from public.ai_prompt_sops where prompt_name = 'StormReach Operator Workflow'
);

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  related_workflow,
  related_offer,
  status,
  notes
)
select
  'StormReach Contractor Conversation',
  'stormreach',
  'Prepare approval-required reply drafts for contractor conversations after storm-triggered outreach.',
  array['prospect', 'weather event', 'industry', 'package', 'proposal link', 'intake link', 'payment approval status'],
  'Draft short, human replies for interested contractors, pricing questions, map requests, intake-link requests, payment-link requests, damage-claim questions, and opt-outs. Keep claims source-backed and do not send without approval.',
  'Scenario, draft reply, source trace, risk notes, approval status, and next action.',
  'Human approval required before sending any reply or link.',
  array['stormreach','conversation','reply-draft','approval-required'],
  'StormReach Autonomous Operator',
  'StormReach contractor outreach',
  'active',
  'Conversation playbooks are preparation only.'
where not exists (
  select 1 from public.ai_prompt_sops where prompt_name = 'StormReach Contractor Conversation'
);

insert into public.ai_prompt_sops (
  prompt_name,
  category,
  purpose,
  required_inputs,
  prompt_text,
  output_format,
  approval_requirement,
  tags,
  related_workflow,
  related_offer,
  status,
  notes
)
select
  'StormReach Creative Design Brief',
  'stormreach',
  'Create postcard and social ad creative briefs for storm-triggered geofence and postcard campaigns.',
  array['storm event', 'industry', 'impacted area', 'campaign package', 'CTA URL', 'brand guardrails'],
  'Prepare helpful, calm postcard and social creative direction for the contractor package. Include headline, body, CTA, QR destination, image direction, geofence note, social post/story copy, creative prompt, formats, and compliance notes. Avoid fear tactics, disaster imagery, and damage certainty.',
  'Postcard brief, social ad brief, geofence setup note, CTA links, approval status, and compliance checklist.',
  'Human approval required before production, publishing, launch, export, or customer-facing use.',
  array['stormreach','creative','postcard','social-ad','geofence','approval-required'],
  'StormReach Autonomous Operator',
  'Geofence marketing plus targeted postcards',
  'active',
  'Creative briefs do not mark artwork print-ready or launch-ready.'
where not exists (
  select 1 from public.ai_prompt_sops where prompt_name = 'StormReach Creative Design Brief'
);

insert into public.ai_prompt_chains (
  chain_name,
  category,
  purpose,
  required_inputs,
  source_assets,
  approval_points,
  run_status,
  status,
  notes
)
select
  'StormReach Post-Storm Revenue Workflow',
  'stormreach',
  'Coordinate detection, prospecting, outreach drafts, conversation handoff, geofence package, postcard package, social creative, intake/payment handoff, and approval logging.',
  array['storm_events','storm_business_prospects','storm_outreach_messages','storm_marketing_packages','approval_ledger'],
  array['AGENTS.md','StormReach Operator Workflow','StormReach Outreach Drafting','StormReach Creative Design Brief','StormReach Campaign Package QA'],
  array[
    'outreach send approval',
    'conversation reply approval',
    'proposal send approval',
    'payment link approval',
    'geofence launch approval',
    'social publish approval',
    'postcard order approval',
    'pricing approval'
  ],
  'ready',
  'active',
  'Autonomous preparation chain only; external actions remain human approval-gated.'
where not exists (
  select 1 from public.ai_prompt_chains where chain_name = 'StormReach Post-Storm Revenue Workflow'
);

insert into public.ai_prompt_chain_steps (
  chain_id,
  step_order,
  step_name,
  required_inputs,
  source_assets,
  output_summary,
  approval_required,
  run_status,
  notes
)
select chain_row.id, step_row.step_order, step_row.step_name, step_row.required_inputs, step_row.source_assets, step_row.output_summary, true, 'ready', step_row.notes
from public.ai_prompt_chains chain_row
cross join (
  values
    (1, 'Detect and score recent storm', array['NOAA/NWS/FEMA source payload']::text[], array['storm_events']::text[], 'Recent event source trace and severity/opportunity score.', 'No customer-facing use before review.'),
    (2, 'Find roofing and siding prospects', array['impacted area','contractor radius']::text[], array['storm_business_prospects','outreach_suppression_list']::text[], 'Deduped and suppression-aware contractor list.', 'Prospect list approval required before outbound use.'),
    (3, 'Draft varied outreach and replies', array['event','prospects','industry']::text[], array['storm_outreach_messages','StormReach Contractor Conversation']::text[], 'Email and reply drafts with varied phrasing and approval status.', 'No sending without approval.'),
    (4, 'Build geofence and postcard package', array['event','industry','package tier']::text[], array['storm_marketing_packages','storm_geofence_campaigns','storm_postcard_campaigns']::text[], 'Campaign package, geofence setup, postcard package, and proposal token.', 'No launch or order without approval.'),
    (5, 'Create social and postcard design brief', array['event','package','CTA URL']::text[], array['StormReach Creative Design Brief']::text[], 'Approval-ready postcard and social creative brief.', 'No publishing, printing, or production without approval.'),
    (6, 'Prepare intake and payment handoff', array['package','proposal token','Stripe/payment state']::text[], array['approval_ledger','ai_workforce_tasks']::text[], 'Proposal/intake links and payment-link action instructions.', 'No payment link or charge without approval.')
) as step_row(step_order, step_name, required_inputs, source_assets, output_summary, notes)
where chain_row.chain_name = 'StormReach Post-Storm Revenue Workflow'
  and not exists (
    select 1
    from public.ai_prompt_chain_steps existing
    where existing.chain_id = chain_row.id
      and existing.step_order = step_row.step_order
  );

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
  related_opportunity,
  completion_notes
)
select
  'WF-STORMREACH-OPERATOR-AUTONOMOUS',
  'StormReach Autonomous Operator',
  'StormReach System',
  'StormReach Operator Agent',
  'critical',
  'assigned',
  '/admin/stormreach?tab=agent',
  jsonb_build_object(
    'schedule', 'every 30 minutes by Vercel cron plus manual admin action',
    'route', '/api/cron/stormreach/operator',
    'admin_action', 'run_operator',
    'contractor_radius_miles', 50,
    'core_industries', jsonb_build_array('Roofing', 'Siding'),
    'approval_boundary', 'preparation only; no send, publish, charge, order, launch, or customer-facing claim without approval'
  ),
  'Run StormReach sweep, prepare roofing/siding outreach, conversation handoffs, intake/proposal/payment instructions, geofence packages, postcard/social creative briefs, approval ledger items, notifications, and audit logs.',
  array['storm_events','storm_business_prospects','storm_outreach_messages','storm_marketing_packages','approval_ledger','ai_outputs','ai_output_reviews','notifications'],
  true,
  'StormReach',
  'Severe Weather Opportunity Engine',
  'Standing operator task. External actions remain approval-gated.'
where not exists (
  select 1 from public.ai_workforce_tasks where task_id = 'WF-STORMREACH-OPERATOR-AUTONOMOUS'
);

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
  'WF-STORMREACH-OPERATOR-AUTONOMOUS',
  'StormReach Operator Agent',
  'agent_registered',
  'assigned',
  'StormReach Operator Agent registered for autonomous preparation with human approval gates.',
  jsonb_build_object(
    'allowed_autonomy', 'prepare and queue review-ready assets',
    'blocked_actions', jsonb_build_array('send','publish','charge','launch','order_postcards','change_pricing'),
    'approval_required', true
  ),
  'needs_review'
where not exists (
  select 1
  from public.ai_workforce_activity_logs
  where task_public_id = 'WF-STORMREACH-OPERATOR-AUTONOMOUS'
    and event_type = 'agent_registered'
);
