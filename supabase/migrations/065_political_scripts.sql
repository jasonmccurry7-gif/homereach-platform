-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 063 — Political Command Center: Script Library
--
-- Adds `political_scripts` — a neutral, service-only script library for
-- the Action Center (Call / Text / Email / Facebook DM).
--
-- Seeds the table with the 9 scripts from the Political Command Center
-- master brief (call opener + 3 branch responses, text, Facebook DM, email,
-- quote follow-up sms + email). All copy is explicitly non-political:
-- HomeReach = mail execution, print coordination, delivery logistics.
-- Zero persuasion framing, voter references, or ideology cues.
--
-- Strictly additive:
--   • No existing columns / tables / enums touched.
--   • No existing RLS altered.
--   • RLS follows the 059+ pattern (service_role full, admin full,
--     sales_agent read, no public access).
--   • Re-runnable: every CREATE is guarded; seeds use ON CONFLICT DO NOTHING
--     keyed on a stable `slug` column so re-running this migration doesn't
--     duplicate rows even if the seed set is edited later.
--
-- Compliance:
--   • Bodies contain ZERO persuasion framing.
--   • Template variables are limited to operational fields: candidate_name,
--     office, district, state, rep_name. No voter-targeting variables.
--   • The script library is separate from the proposal + contract surfaces
--     so a new script added here never changes a signed contract's terms.
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Enum
-- ═════════════════════════════════════════════════════════════════════════════

do $$ begin
  create type public.political_script_channel_enum as enum (
    'call',
    'sms',
    'email',
    'facebook_dm'
  );
exception
  when duplicate_object then null;
end $$;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_scripts
-- ═════════════════════════════════════════════════════════════════════════════

create table if not exists public.political_scripts (
  id              uuid primary key default gen_random_uuid(),

  -- Stable identifier used for ON CONFLICT DO NOTHING on seed upserts.
  -- Operators editing copy should change `body` but keep `slug`.
  slug            text not null unique,

  channel         public.political_script_channel_enum not null,
  category        text not null,           -- 'outreach_opener' | 'follow_up' | 'deadline_reminder' | etc.
  name            text not null,

  -- Subject only applies to 'email'. Null for other channels.
  subject         text,
  body            text not null,

  -- Operational scoping. Null = applies to any state/race. Future: tighten.
  state           text,

  -- Order within a channel/category, for UI listing.
  sort_order      integer not null default 0,

  active          boolean not null default true,

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists political_scripts_channel_idx  on public.political_scripts (channel);
create index if not exists political_scripts_category_idx on public.political_scripts (category);
create index if not exists political_scripts_active_idx   on public.political_scripts (active);
create index if not exists political_scripts_state_idx    on public.political_scripts (state)
  where state is not null;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Row Level Security
--    service_role full, admin full, sales_agent read-only. No public access.
-- ═════════════════════════════════════════════════════════════════════════════

alter table public.political_scripts enable row level security;

drop policy if exists "political_scripts_service" on public.political_scripts;
create policy "political_scripts_service"
  on public.political_scripts for all to service_role using (true) with check (true);

drop policy if exists "political_scripts_admin" on public.political_scripts;
create policy "political_scripts_admin"
  on public.political_scripts for all to authenticated
  using      (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "political_scripts_agent_read" on public.political_scripts;
create policy "political_scripts_agent_read"
  on public.political_scripts for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','sales_agent')));


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. updated_at trigger (reuse 059 function)
-- ═════════════════════════════════════════════════════════════════════════════

drop trigger if exists trg_political_scripts_updated_at on public.political_scripts;
create trigger trg_political_scripts_updated_at
  before update on public.political_scripts
  for each row execute function public.tg_political_touch_updated_at();


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Seed — neutral scripts from the master brief
--    ON CONFLICT DO NOTHING keyed on slug so re-running this migration
--    never duplicates rows. Edits to body/subject by operators are preserved.
-- ═════════════════════════════════════════════════════════════════════════════

insert into public.political_scripts (slug, channel, category, name, subject, body, sort_order)
values
  -- ── CALL ────────────────────────────────────────────────────────────────
  ('call_opener_v1', 'call', 'outreach_opener',
   'Call — Initial outreach',
   null,
   'Hi, this is {{rep_name}} with HomeReach. Quick question — are you handling your campaign mail in-house or working with someone already? We help campaigns handle the execution side: coverage planning, print, and delivery logistics, so nothing slips under deadline. Are you planning any mail drops for this race?',
   10),

  ('call_has_vendor_v1', 'call', 'branch_response',
   'Call — They already have a vendor',
   null,
   'Got it — that''s helpful. A lot of campaigns already have something in place but still need backup coverage, faster turnaround, or a more cost-efficient option. Would you be open to seeing a quick side-by-side mail plan for your area?',
   20),

  ('call_no_vendor_v1', 'call', 'branch_response',
   'Call — No vendor in place',
   null,
   'Perfect — that''s exactly why I''m reaching out. I can map your area and send over a simple mail plan with coverage, timing, and investment. It only takes a few minutes.',
   30),

  ('call_hesitant_v1', 'call', 'branch_response',
   'Call — Hesitant',
   null,
   'No problem. I can just map the area and send a quick plan so you can see what it would look like. No obligation.',
   40),

  -- ── SMS ─────────────────────────────────────────────────────────────────
  ('sms_opener_v1', 'sms', 'outreach_opener',
   'Text — Initial outreach',
   null,
   'Hi {{candidate_name}}, {{rep_name}} with HomeReach. Quick question — are you planning any direct mail for your {{office}} race? I can map the area and show what it would take to reach the households you want covered.',
   10),

  ('sms_quote_follow_up_v1', 'sms', 'quote_follow_up',
   'Text — Quote follow-up',
   null,
   'Hey {{candidate_name}} — just sent over your campaign mail plan. Happy to adjust coverage, timing, or budget if needed. Want me to tailor it further for you?',
   20),

  -- ── FACEBOOK DM ─────────────────────────────────────────────────────────
  ('fb_dm_opener_v1', 'facebook_dm', 'outreach_opener',
   'Facebook DM — Initial outreach',
   null,
   'Hi {{candidate_name}} — quick question. Are you handling mail for your campaign internally, or working with someone already? HomeReach helps with campaign mail execution, print coordination, and delivery logistics.',
   10),

  -- ── EMAIL ───────────────────────────────────────────────────────────────
  ('email_opener_v1', 'email', 'outreach_opener',
   'Email — Initial outreach',
   'Quick question on your {{office}} campaign mail',
   'Hi {{candidate_name}},

Are you planning any direct mail for your {{office}} race?

HomeReach helps campaigns handle the execution side — coverage planning, print coordination, and delivery logistics — so nothing slips under deadline.

If helpful, I can map the area and show what coverage options would look like.

Thanks,
{{rep_name}}
HomeReach',
   10),

  ('email_quote_follow_up_v1', 'email', 'quote_follow_up',
   'Email — Quote follow-up',
   'Quick adjustment?',
   'Hi {{candidate_name}},

Wanted to follow up — I can adjust the plan based on budget, geography, or timing if needed.

Happy to refine it so it fits exactly what you''re trying to accomplish.

— HomeReach',
   20)

on conflict (slug) do nothing;
