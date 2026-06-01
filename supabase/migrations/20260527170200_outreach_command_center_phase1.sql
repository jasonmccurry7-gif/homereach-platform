create extension if not exists pgcrypto;

alter table public.outreach_prospects
  add column if not exists owner_contact_name text,
  add column if not exists business_type text,
  add column if not exists campaign_type text not null default 'unknown',
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists state text,
  add column if not exists source text,
  add column if not exists assigned_sender text check (assigned_sender is null or assigned_sender in ('heather','josh','chelsi','jason')),
  add column if not exists opted_out_at timestamptz,
  add column if not exists opt_out_reason text;

alter table public.daily_outreach_tasks
  add column if not exists campaign_type text not null default 'unknown',
  add column if not exists city text,
  add column if not exists county text,
  add column if not exists state text,
  add column if not exists source text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'outreach_prospects_campaign_type_check' and conrelid = 'public.outreach_prospects'::regclass) then
    alter table public.outreach_prospects add constraint outreach_prospects_campaign_type_check check (campaign_type in ('political','supplyfy','targeted_mailing','government_contracting','unknown'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'daily_outreach_tasks_campaign_type_check' and conrelid = 'public.daily_outreach_tasks'::regclass) then
    alter table public.daily_outreach_tasks add constraint daily_outreach_tasks_campaign_type_check check (campaign_type in ('political','supplyfy','targeted_mailing','government_contracting','unknown'));
  end if;
end $$;

create index if not exists outreach_prospects_campaign_type_status_idx on public.outreach_prospects (campaign_type, status) where opted_out_at is null;
create index if not exists daily_outreach_tasks_campaign_type_date_idx on public.daily_outreach_tasks (outreach_date, campaign_type, send_status);

create table if not exists public.daily_outreach_campaign_controls (
  id uuid primary key default gen_random_uuid(),
  campaign_type text not null unique check (campaign_type in ('political','supplyfy')),
  display_name text not null,
  daily_cap integer not null default 5 check (daily_cap between 0 and 30),
  paused boolean not null default false,
  manual_approval_required boolean not null default true,
  sunday_sending_enabled boolean not null default false,
  business_start_minutes integer not null default 510,
  business_end_minutes integer not null default 1050,
  min_spacing_minutes integer not null default 45 check (min_spacing_minutes >= 30),
  timezone text not null default 'America/New_York',
  metadata jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.daily_outreach_campaign_controls (campaign_type,display_name,daily_cap,paused,manual_approval_required,business_start_minutes,business_end_minutes,min_spacing_minutes,timezone,metadata)
values
('political','Political postcard campaigns',5,false,true,510,1050,45,'America/New_York','{"audience":"local candidates, campaign committees, county parties","guardrail":"public campaign context and geography only"}'::jsonb),
('supplyfy','Supplyfy restaurants and bakeries',5,false,true,510,1050,45,'America/New_York','{"audience":"restaurants, bakeries, pizza shops, cafes, food-service operators","guardrail":"cost visibility without unsupported savings guarantees"}'::jsonb)
on conflict (campaign_type) do nothing;

create table if not exists public.outreach_email_templates (
  id uuid primary key default gen_random_uuid(),
  campaign_type text not null check (campaign_type in ('political','supplyfy')),
  template_key text not null,
  display_name text not null,
  subject text not null,
  body text not null,
  variables text[] not null default array['first_name','business_name','campaign_name','city','county','sender_name','sender_email','offer_type','calendar_link','quote_link','dashboard_link'],
  is_active boolean not null default true,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_type, template_key)
);

insert into public.outreach_email_templates (campaign_type,template_key,display_name,subject,body)
values
('political','first_touch','First-touch email','{{campaign_name}} postcard launch options','Hi {{first_name}},

I am {{sender_name}} with HomeReach. We help local campaigns launch postcard programs quickly with clear options, targeting, design, printing, and mailing handled in one workflow.

For {{campaign_name}}, I can show four practical postcard options, local route targeting, and county/city/township/ZIP targeting so the campaign can compare cost, timing, and execution without chasing vendors.

Would it be useful if I sent the simple quote path and postcard options?

{{sender_name}}
HomeReach
{{sender_email}}

If this is not the right contact, reply unsubscribe and I will remove this address.'),
('political','follow_up_1','Follow-up 1','Re: {{campaign_name}} postcard launch options','Hi {{first_name}},

Following up quickly. HomeReach can help with campaign postcard design, printing, targeting, and mailing, including route or geography-based planning for {{city}}/{{county}}.

The useful first step is a simple options view: postcard concepts, target area, estimated timing, and quote path.

Should I send that over?

{{sender_name}}
{{sender_email}}'),
('political','follow_up_2','Follow-up 2','Should I close the loop?','Hi {{first_name}},

Should I close the loop on postcard options for {{campaign_name}}, or is there someone else handling mail and campaign logistics?

No pressure. I just do not want to keep following up if the timing is off.

{{sender_name}}
{{sender_email}}'),
('political','reply_interested_candidate','Reply to interested candidate','Postcard options for {{campaign_name}}','Hi {{first_name}},

Great. The fastest next step is to look at geography, timeline, quantity, creative readiness, and whether you want one mailer or a short sequence.

I can prepare a simple options view with design, printing, targeting, mailing, and a quote path.

{{quote_link}}

{{sender_name}}
{{sender_email}}'),
('political','reply_send_info','Reply to send info','Info for {{campaign_name}}','Hi {{first_name}},

Here is the short version: HomeReach handles campaign postcard design, printing, targeting, and mailing. We can organize options around county, city, township, ZIP, or route-level geography.

The cleanest review path is to compare four postcard campaign options, then choose the one that fits your timing and budget.

{{quote_link}}

{{sender_name}}
{{sender_email}}'),
('political','reply_cost','Reply to cost question','Cost path for {{campaign_name}}','Hi {{first_name}},

Cost depends on size, quantity, timing, geography, and whether the campaign needs design support. I can give a clear quote once I know the target area and approximate volume.

If helpful, I can send the simple quote path here:
{{quote_link}}

{{sender_name}}
{{sender_email}}'),
('supplyfy','first_touch','First-touch email','Quick supply cost check for {{business_name}}','Hi {{first_name}},

I am {{sender_name}} with HomeReach. We are helping restaurants, bakeries, cafes, pizza shops, and food-service operators see where ingredient and supply costs may be drifting.

Supplyfy is built to compare vendors, track repeat purchases, surface price changes, and show a simple owner dashboard without turning ordering into a spreadsheet project.

Would you want to see a quick example dashboard for {{business_name}}?

{{sender_name}}
HomeReach
{{sender_email}}

If this is not useful, reply unsubscribe and I will remove this address.'),
('supplyfy','follow_up_1','Follow-up 1','Re: supply cost check for {{business_name}}','Hi {{first_name}},

Quick follow-up. The Supplyfy angle is simple: compare supplier pricing, spot repeat purchase drift, and help owners see whether there is a practical savings opportunity.

Would a sample dashboard be useful?

{{sender_name}}
{{sender_email}}'),
('supplyfy','follow_up_2','Follow-up 2','Close the loop?','Hi {{first_name}},

Should I close the loop on the Supplyfy supply-cost review for {{business_name}}, or is there someone else who handles purchasing and vendor pricing?

{{sender_name}}
{{sender_email}}'),
('supplyfy','reply_interested_owner','Reply to interested owner','Supplyfy example for {{business_name}}','Hi {{first_name}},

Great. The first thing I would review is recurring ingredients/supplies, current vendors, common reorder items, and any categories where pricing feels inconsistent.

Here is the dashboard path:
{{dashboard_link}}

{{sender_name}}
{{sender_email}}'),
('supplyfy','reply_how_it_works','Reply to how it works','How Supplyfy works','Hi {{first_name}},

Supplyfy compares what you buy repeatedly, what vendors charge, and how pricing changes over time. The goal is to show owners a clear view of vendor differences, repeat purchase drift, and possible savings areas.

It is meant to support better decisions, not force you to change suppliers automatically.

{{dashboard_link}}

{{sender_name}}
{{sender_email}}'),
('supplyfy','reply_cost','Reply to cost question','Supplyfy cost path','Hi {{first_name}},

Cost depends on how much purchasing data you want reviewed and how hands-on you want the setup to be. The safe first step is a small review so we can see whether there is enough savings potential to justify more.

{{calendar_link}}

{{sender_name}}
{{sender_email}}')
on conflict (campaign_type, template_key) do nothing;

create table if not exists public.daily_outreach_replies (
  id uuid primary key default gen_random_uuid(),
  prospect_id uuid references public.outreach_prospects(id) on delete set null,
  task_id uuid references public.daily_outreach_tasks(id) on delete set null,
  campaign_type text not null default 'unknown',
  sender_email text,
  from_email text,
  from_name text,
  business_or_campaign_name text,
  original_subject text,
  reply_preview text,
  sentiment text not null default 'needs_follow_up' check (sentiment in ('interested','maybe_later','not_interested','needs_follow_up','bad_contact')),
  status text not null default 'open' check (status in ('open','assigned','completed','snoozed')),
  recommended_next_action text,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists daily_outreach_replies_status_received_idx on public.daily_outreach_replies (status, received_at desc);
create index if not exists daily_outreach_replies_campaign_type_idx on public.daily_outreach_replies (campaign_type, sentiment);

alter table public.daily_outreach_campaign_controls enable row level security;
alter table public.outreach_email_templates enable row level security;
alter table public.daily_outreach_replies enable row level security;

drop policy if exists daily_outreach_campaign_controls_service on public.daily_outreach_campaign_controls;
create policy daily_outreach_campaign_controls_service on public.daily_outreach_campaign_controls for all to service_role using (true) with check (true);
drop policy if exists daily_outreach_campaign_controls_admin_read on public.daily_outreach_campaign_controls;
create policy daily_outreach_campaign_controls_admin_read on public.daily_outreach_campaign_controls for select to authenticated using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists outreach_email_templates_service on public.outreach_email_templates;
create policy outreach_email_templates_service on public.outreach_email_templates for all to service_role using (true) with check (true);
drop policy if exists outreach_email_templates_admin_read on public.outreach_email_templates;
create policy outreach_email_templates_admin_read on public.outreach_email_templates for select to authenticated using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

drop policy if exists daily_outreach_replies_service on public.daily_outreach_replies;
create policy daily_outreach_replies_service on public.daily_outreach_replies for all to service_role using (true) with check (true);
drop policy if exists daily_outreach_replies_admin_read on public.daily_outreach_replies;
create policy daily_outreach_replies_admin_read on public.daily_outreach_replies for select to authenticated using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

comment on table public.daily_outreach_campaign_controls is 'Campaign-level daily outreach caps, pauses, windows, and approval gates for the Outreach Command Center.';
comment on table public.outreach_email_templates is 'Editable Outreach Command Center templates with review-safe variables.';
comment on table public.daily_outreach_replies is 'Phase 1 reply inbox surface; deeper inbox sync can hydrate this table in Phase 2.';;
