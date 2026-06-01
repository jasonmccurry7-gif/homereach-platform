-- Sender identity repair for HomeReach outbound workflows.
-- Ensures live From identities are HomeReach-domain senders only.
-- Personal Gmail/secondary addresses remain fallback contact identities, not From senders.

create extension if not exists pgcrypto;

update public.outreach_owner_settings
set
  owner_name = 'Jason McCurry',
  owner_cell_phone = '+13302069639',
  owner_personal_email = 'Jasonmccurry7@gmail.com',
  owner_secondary_email = 'Livetogivemarketing@gmail.com',
  owner_domain_email = 'Jason@home-reach.com',
  default_from_email = 'jason@home-reach.com',
  default_reply_to_email = 'jason@home-reach.com',
  fallback_reply_to_email = 'Jasonmccurry7@gmail.com',
  updated_at = now()
where id = 1;

insert into public.outreach_owner_settings (
  id,
  owner_name,
  owner_cell_phone,
  owner_personal_email,
  owner_secondary_email,
  owner_domain_email,
  default_from_email,
  default_reply_to_email,
  fallback_reply_to_email
)
values (
  1,
  'Jason McCurry',
  '+13302069639',
  'Jasonmccurry7@gmail.com',
  'Livetogivemarketing@gmail.com',
  'Jason@home-reach.com',
  'jason@home-reach.com',
  'jason@home-reach.com',
  'Jasonmccurry7@gmail.com'
)
on conflict (id) do nothing;

update public.agent_identities
set
  from_name = 'Jason McCurry',
  from_email = 'jason@home-reach.com',
  reply_to_email = 'jason@home-reach.com',
  email_daily_limit = least(greatest(coalesce(email_daily_limit, 5), 5), 30),
  is_active = true,
  updated_at = now()
where lower(coalesce(from_email, '')) in ('jasonmccurry7@gmail.com', 'jason@home-reach.com')
   or lower(coalesce(from_name, '')) in ('jason', 'jason mccurry');

insert into public.agent_identities (
  agent_id,
  from_name,
  from_email,
  reply_to_email,
  email_daily_limit,
  sms_daily_limit,
  email_ramp_day,
  email_ramp_started,
  is_active
)
select
  'a1111111-1111-4111-8111-111111111111'::uuid,
  'Jason McCurry',
  'jason@home-reach.com',
  'jason@home-reach.com',
  5,
  30,
  1,
  current_date,
  true
where not exists (
  select 1 from public.agent_identities where lower(coalesce(from_email, '')) = 'jason@home-reach.com'
);

with sender_rows(agent_id, from_name, from_email, reply_to_email, business_limit) as (
  values
    ('a2222222-2222-4222-8222-222222222222'::uuid, 'Heather HomeReach', 'heather@home-reach.com', 'heather@home-reach.com', 5),
    ('a3333333-3333-4333-8333-333333333333'::uuid, 'Josh HomeReach', 'josh@home-reach.com', 'josh@home-reach.com', 5),
    ('a4444444-4444-4444-8444-444444444444'::uuid, 'Chelsi HomeReach', 'chelsi@home-reach.com', 'chelsi@home-reach.com', 5)
)
insert into public.agent_identities (
  agent_id,
  from_name,
  from_email,
  reply_to_email,
  email_daily_limit,
  sms_daily_limit,
  email_ramp_day,
  email_ramp_started,
  is_active
)
select
  sender_rows.agent_id,
  sender_rows.from_name,
  sender_rows.from_email,
  sender_rows.reply_to_email,
  sender_rows.business_limit,
  30,
  1,
  current_date,
  true
from sender_rows
where not exists (
  select 1
  from public.agent_identities existing
  where lower(coalesce(existing.from_email, '')) = sender_rows.from_email
);

update public.agent_identities
set
  from_name = case lower(from_email)
    when 'heather@home-reach.com' then 'Heather HomeReach'
    when 'josh@home-reach.com' then 'Josh HomeReach'
    when 'chelsi@home-reach.com' then 'Chelsi HomeReach'
    else from_name
  end,
  reply_to_email = lower(from_email),
  email_daily_limit = least(greatest(coalesce(email_daily_limit, 5), 5), 30),
  is_active = true,
  updated_at = now()
where lower(coalesce(from_email, '')) in (
  'heather@home-reach.com',
  'josh@home-reach.com',
  'chelsi@home-reach.com'
);

insert into public.daily_outreach_sender_controls (
  sender_key,
  sender_name,
  sender_email,
  business_line,
  daily_cap,
  paused,
  manual_approval_required,
  min_spacing_minutes,
  business_start_minutes,
  business_end_minutes,
  timezone,
  metadata
)
values
  ('jason', 'Jason McCurry', 'jason@home-reach.com', 'political', 5, false, true, 45, 510, 990, 'America/New_York', '{"persona":"executive campaign operations strategist","audience":"political candidates and campaign staff"}'::jsonb),
  ('heather', 'Heather HomeReach', 'heather@home-reach.com', 'inventory_procurement', 5, false, true, 45, 510, 990, 'America/New_York', '{"persona":"polished premium procurement and operational-efficiency advisor","audience":"Supplify restaurants, bakeries, cafes, pizza shops, and food-service operators"}'::jsonb),
  ('josh', 'Josh HomeReach', 'josh@home-reach.com', 'targeted_mailing', 5, false, true, 45, 510, 990, 'America/New_York', '{"persona":"practical local business shared postcard advisor","audience":"targeted postcard campaign leads"}'::jsonb),
  ('chelsi', 'Chelsi HomeReach', 'chelsi@home-reach.com', 'inventory_procurement', 5, false, true, 45, 510, 990, 'America/New_York', '{"persona":"helpful small business savings consultant","audience":"Supplify small business leads"}'::jsonb)
on conflict (sender_key) do update
set
  sender_name = excluded.sender_name,
  sender_email = excluded.sender_email,
  business_line = excluded.business_line,
  daily_cap = least(greatest(public.daily_outreach_sender_controls.daily_cap, 0), 5),
  updated_at = now();

update public.daily_outreach_tasks
set
  sender_key = 'jason',
  sender_name = 'Jason McCurry',
  sender_email = 'jason@home-reach.com',
  updated_at = now()
where (campaign_type = 'political' or category = 'Political Outreach')
  and lower(coalesce(sender_email, '')) <> 'jason@home-reach.com'
  and send_status in ('draft', 'queued_for_review', 'approved_pending_send', 'failed');

update public.revenue_message_approval_queue
set
  metadata = jsonb_strip_nulls(
    coalesce(metadata, '{}'::jsonb) ||
    jsonb_build_object(
      'sender_email', 'jason@home-reach.com',
      'from_email', 'jason@home-reach.com',
      'reply_to', 'jason@home-reach.com',
      'sender_name', 'Jason McCurry'
    )
  ),
  updated_at = now()
where business_line = 'political'
  and channel = 'email'
  and status in ('draft', 'needs_review', 'approved', 'queued_for_review', 'scheduled')
  and (
    lower(coalesce(metadata->>'sender_email', '')) in ('jasonmccurry7@gmail.com', 'livetogivemarketing@gmail.com')
    or lower(coalesce(metadata->>'from_email', '')) in ('jasonmccurry7@gmail.com', 'livetogivemarketing@gmail.com')
    or lower(coalesce(metadata->>'reply_to', '')) in ('jasonmccurry7@gmail.com', 'livetogivemarketing@gmail.com')
  );;
