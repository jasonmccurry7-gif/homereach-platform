-- HomeReach Migration 095 - Inventory/procurement email automation routing
--
-- Purpose:
--   * Add a business-line marker to existing automation sequences.
--   * Create a safe inventory/procurement email sequence.
--   * Enable procurement email automation without using city/territory sender
--     routing. This leaves existing local-business territory logic intact.

create extension if not exists pgcrypto;

alter table public.auto_sequences
  add column if not exists business_line text not null default 'targeted_mailing';

do $$
begin
  alter table public.auto_sequences
    add constraint auto_sequences_business_line_check
    check (business_line in ('targeted_mailing', 'inventory_procurement', 'political', 'unknown'));
exception
  when duplicate_object then null;
end $$;

create index if not exists auto_sequences_business_line_status_idx
  on public.auto_sequences (business_line, status);

alter table public.system_controls
  add column if not exists procurement_email_automation_enabled boolean not null default false;

insert into public.revenue_business_line_settings (
  business_line,
  default_automation_mode,
  allow_autopilot,
  pause_on_inbound,
  notify_owner_on_inbound,
  owner_handoff_required,
  notes
) values (
  'inventory_procurement',
  'assisted_autopilot',
  true,
  false,
  true,
  false,
  'Inventory/procurement email automation may send approved savings-audit outreach through the central procurement sender path.'
)
on conflict (business_line) do update set
  default_automation_mode = excluded.default_automation_mode,
  allow_autopilot = excluded.allow_autopilot,
  pause_on_inbound = excluded.pause_on_inbound,
  notify_owner_on_inbound = excluded.notify_owner_on_inbound,
  owner_handoff_required = excluded.owner_handoff_required,
  notes = excluded.notes,
  updated_at = now();

do $$
declare
  v_seq_id uuid;
begin
  select id
    into v_seq_id
  from public.auto_sequences
  where name = 'Inventory Procurement Email Outreach'
  limit 1;

  if v_seq_id is null then
    insert into public.auto_sequences (
      name,
      channel,
      business_line,
      category,
      city,
      status,
      stop_on_reply,
      description
    ) values (
      'Inventory Procurement Email Outreach',
      'email',
      'inventory_procurement',
      'Inventory Procurement',
      null,
      'active',
      true,
      'Automated email sequence for Inventory & Purchasing Intelligence prospects. Uses central procurement sender, not city/territory routing.'
    )
    returning id into v_seq_id;
  else
    update public.auto_sequences
    set
      channel = 'email',
      business_line = 'inventory_procurement',
      category = 'Inventory Procurement',
      city = null,
      status = 'active',
      stop_on_reply = true,
      description = 'Automated email sequence for Inventory & Purchasing Intelligence prospects. Uses central procurement sender, not city/territory routing.',
      updated_at = now()
    where id = v_seq_id;
  end if;

  insert into public.auto_sequence_steps (sequence_id, step_number, delay_hours, subject, body)
  values
    (
      v_seq_id,
      1,
      0,
      'Can HomeReach find savings in {{business_name}}''s supply spend?',
      'Hi {{contact_name}},

I''m reaching out from HomeReach about our Inventory & Purchasing Intelligence dashboard.

It helps businesses like {{business_name}} track recurring supplies, spot vendor price increases, and find lower-cost supplier options before the next order.

Would you be open to a quick savings review? We can start with the vendors and supply categories you already buy from.

Best,
HomeReach Procurement Team'
    ),
    (
      v_seq_id,
      2,
      72,
      'Quick follow-up on supply savings for {{business_name}}',
      'Hi {{contact_name}},

Following up on the HomeReach procurement note.

The simple version: we look for vendor price drift, duplicate buying, reorder risk, and lower delivered-cost options so {{business_name}} does not have to manually chase every supplier.

If useful, I can send over the short intake for a savings review:
{{savings_audit_url}}

Best,
HomeReach Procurement Team'
    ),
    (
      v_seq_id,
      3,
      144,
      'Should I close this out?',
      'Hi {{contact_name}},

I do not want to keep chasing you if this is not relevant.

Should I close this out, or would a quick supply-spend review be useful for {{business_name}}?

You can also see the product here:
{{dashboard_url}}

Best,
HomeReach Procurement Team'
    )
  on conflict (sequence_id, step_number) do update set
    delay_hours = excluded.delay_hours,
    subject = excluded.subject,
    body = excluded.body;
end $$;

update public.system_controls
set
  procurement_email_automation_enabled = true,
  updated_at = now()
where id = 1;
