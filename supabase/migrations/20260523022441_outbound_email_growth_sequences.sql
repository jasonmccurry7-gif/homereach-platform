-- HomeReach outbound email growth sequences
--
-- Adds metadata-driven personalization for automation leads and seeds the two
-- email-first growth motions requested for the current Postmark rollout:
--   1. Political campaign outreach handled by Jason/Josh.
--   2. Procurement savings outreach handled by Heather/Chelsi.
--
-- Human approval, throttling, opt-out checks, sender caps, and the guarded
-- /api/admin/automation/send-due route remain the enforcement layer.

alter table public.sales_leads
  add column if not exists outreach_metadata jsonb not null default '{}'::jsonb;

create index if not exists sales_leads_outreach_metadata_gin_idx
  on public.sales_leads using gin (outreach_metadata);

comment on column public.sales_leads.outreach_metadata is
  'Optional structured outreach variables used by approved automation templates, such as candidate_slug, candidate_name, office_sought, plan URLs, procurement intake URLs, and source notes.';

do $$
declare
  v_sequence_id uuid;
begin
  select id into v_sequence_id
  from public.auto_sequences
  where name = 'Political Campaign Email Outreach'
  order by created_at asc
  limit 1;

  if v_sequence_id is null then
    insert into public.auto_sequences (
      name,
      channel,
      category,
      city,
      status,
      stop_on_reply,
      description
    )
    values (
      'Political Campaign Email Outreach',
      'email',
      'Political Campaign',
      null,
      'active',
      true,
      'Low-volume, approval-gated email sequence for campaign contacts. Jason/Josh sender identities are intended for this sequence. Candidate-specific option images are rendered from outreach_metadata.candidate_slug.'
    )
    returning id into v_sequence_id;
  else
    update public.auto_sequences
    set
      channel = 'email',
      category = 'Political Campaign',
      status = 'active',
      stop_on_reply = true,
      description = 'Low-volume, approval-gated email sequence for campaign contacts. Jason/Josh sender identities are intended for this sequence. Candidate-specific option images are rendered from outreach_metadata.candidate_slug.',
      updated_at = now()
    where id = v_sequence_id;
  end if;

  insert into public.auto_sequence_steps (
    sequence_id,
    step_number,
    delay_hours,
    subject,
    body
  )
  values
    (
      v_sequence_id,
      1,
      0,
      '{{candidate_name}} mail plan - four options ready for review',
      E'Hi {{contact_name}},\n\nI am reaching out from HomeReach because campaign mail works best when the team can compare clear options quickly: geography, timing, quantity, cost, and execution risk in one place.\n\nWe prepared four mail plan options for {{candidate_name}}:\n\nA. {{option_a_title}}\nB. {{option_b_title}}\nC. {{option_c_title}}\nD. {{option_d_title}}\n\n[[image:{{political_options_image_url}}|Four HomeReach campaign mail plan options for {{candidate_name}}]]\n\nThe practical goal is simple: give the campaign a mail plan that is visible, organized, priced clearly, and executable without campaign staff having to rebuild the planning work from scratch.\n\nYou can review the live plan here:\n{{political_plan_url}}\n\nWould it be useful if I sent the route/pricing summary for {{office_sought}}?\n\n{{sender_name}}\nHomeReach Political Mail'
    ),
    (
      v_sequence_id,
      2,
      72,
      'Quick follow-up on {{candidate_name}} campaign mail options',
      E'Hi {{contact_name}},\n\nQuick follow-up on the HomeReach mail plan for {{candidate_name}}.\n\nThe four-option view is meant to make the decision easier: one foundation plan, one geography-concentrated plan, one balanced plan, and one final-window turnout plan.\n\n[[image:{{political_options_image_url}}|HomeReach political mail options for {{candidate_name}}]]\n\nIf helpful, I can send the simple next step: recommended option, estimated mail quantity, production timeline, and the approval path.\n\n{{political_plan_url}}\n\n{{sender_name}}\nHomeReach Political Mail'
    ),
    (
      v_sequence_id,
      3,
      144,
      'Should I close out the {{candidate_name}} mail plan?',
      E'Hi {{contact_name}},\n\nI do not want to clutter your inbox if mail planning is not a priority right now.\n\nShould I close this out, or would a concise campaign-mail summary for {{candidate_name}} be useful before the next planning meeting?\n\nThe plan is here if you want to review it:\n{{political_plan_url}}\n\n{{sender_name}}\nHomeReach Political Mail'
    )
  on conflict (sequence_id, step_number)
  do update set
    delay_hours = excluded.delay_hours,
    subject = excluded.subject,
    body = excluded.body;
end;
$$;

do $$
declare
  v_sequence_id uuid;
begin
  select id into v_sequence_id
  from public.auto_sequences
  where name = 'Inventory Procurement Email Outreach'
  order by created_at asc
  limit 1;

  if v_sequence_id is null then
    insert into public.auto_sequences (
      name,
      channel,
      category,
      city,
      status,
      stop_on_reply,
      description
    )
    values (
      'Inventory Procurement Email Outreach',
      'email',
      'Inventory Procurement',
      null,
      'active',
      true,
      'Low-volume, approval-gated procurement savings outreach for businesses that may be overspending on recurring supplies.'
    )
    returning id into v_sequence_id;
  else
    update public.auto_sequences
    set
      channel = 'email',
      category = 'Inventory Procurement',
      status = 'active',
      stop_on_reply = true,
      description = 'Low-volume, approval-gated procurement savings outreach for businesses that may be overspending on recurring supplies.',
      updated_at = now()
    where id = v_sequence_id;
  end if;

  insert into public.auto_sequence_steps (
    sequence_id,
    step_number,
    delay_hours,
    subject,
    body
  )
  values
    (
      v_sequence_id,
      1,
      0,
      'Hidden supply overspending at {{business_name}}',
      E'Hi {{contact_name}},\n\nI am reaching out from HomeReach about a very practical problem: supply costs keep moving, invoices pile up, and most owners do not have time to compare vendors every week.\n\nHomeReach helps businesses find hidden supply overspending without turning it into another job for the owner.\n\nWe can review receipts, invoices, inventory sheets, and supplier pricing, then turn it into a simple savings rollup: where money may be leaking, what changed, what to approve, and what can wait.\n\nNo spreadsheet rebuilding. No procurement training. Just a clear view of potential savings and the next best action.\n\nWould you be open to a done-for-you supply savings review for {{business_name}}?\n\n{{procurement_intake_url}}\n\nHomeReach Procurement Team'
    ),
    (
      v_sequence_id,
      2,
      72,
      'Most supply waste is quiet',
      E'Hi {{contact_name}},\n\nQuick follow-up from HomeReach.\n\nThe costly part of supplies is usually not one big mistake. It is quiet price drift, fuel fees, duplicate buying, delivery friction, vendor substitutions, and invoices that stop matching what the owner thought they were paying.\n\nOur procurement dashboard is designed to surface that in plain language:\n\n- potential monthly savings\n- items above benchmark\n- delivery costs that may be avoidable\n- vendor reliability issues\n- invoice mismatches\n- simple approvals when action is worth it\n\nThe owner should not have to hunt for this. HomeReach does the comparison work and shows the savings opportunity clearly.\n\nWant me to send the short intake?\n\n{{procurement_intake_url}}\n\nHomeReach Procurement Team'
    ),
    (
      v_sequence_id,
      3,
      144,
      'Should I close this out for {{business_name}}?',
      E'Hi {{contact_name}},\n\nI do not want to keep chasing you if supply savings is not a priority right now.\n\nShould I close this out, or would it be useful for HomeReach to look for hidden overspending in your recurring supplies?\n\nThe simple promise is: you send what you already have, and we turn it into a savings view with clear recommendations. No extra operational burden on your side.\n\n{{procurement_intake_url}}\n\nHomeReach Procurement Team'
    )
  on conflict (sequence_id, step_number)
  do update set
    delay_hours = excluded.delay_hours,
    subject = excluded.subject,
    body = excluded.body;
end;
$$;;
