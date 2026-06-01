-- HomeReach AI Creative Production Studio
-- Additive, approval-first creative asset generation and review layer.
-- Does not send, post, publish, submit, charge, or modify active campaigns.

create table if not exists public.creative_brand_kits (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  owner_type text not null default 'homereach',
  logo_url text,
  colors text[] not null default array[]::text[],
  tone text not null default '',
  fonts text[] not null default array[]::text[],
  cta_language text[] not null default array[]::text[],
  offer_language text not null default '',
  forbidden_claims text[] not null default array[]::text[],
  required_disclaimer_language text[] not null default array[]::text[],
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_brand_kits_status_idx
  on public.creative_brand_kits (status, owner_type);

create table if not exists public.creative_prompt_templates (
  id uuid primary key default gen_random_uuid(),
  template_key text not null unique,
  name text not null,
  offer_key text not null check (offer_key in (
    'shared_postcards',
    'targeted_mail',
    'political_mail',
    'procurement_dashboard',
    'government_contracts',
    'facebook_group_post',
    'dm_followup',
    'short_form_video',
    'local_business_promo',
    'candidate_explainer',
    'home_service_before_after'
  )),
  asset_type text not null,
  platform text not null default 'any',
  prompt_text text not null default '',
  script_seed text not null default '',
  storyboard_seed jsonb not null default '[]'::jsonb,
  compliance_notes text not null default '',
  status text not null default 'active' check (status in ('active','draft','archived')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_prompt_templates_offer_idx
  on public.creative_prompt_templates (offer_key, asset_type, status);

create table if not exists public.creative_assets (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  business_id uuid references public.businesses(id) on delete set null,
  candidate_id uuid references public.campaign_candidates(id) on delete set null,
  offer_key text not null check (offer_key in (
    'shared_postcards',
    'targeted_mail',
    'political_mail',
    'procurement_dashboard',
    'government_contracts',
    'facebook_group_post',
    'dm_followup',
    'short_form_video',
    'local_business_promo',
    'candidate_explainer',
    'home_service_before_after'
  )),
  asset_type text not null check (asset_type in (
    '15_second_ugc_ad',
    '30_second_ugc_ad',
    '60_second_explainer_video',
    'product_service_promo_video',
    'political_campaign_intro_video',
    'local_business_testimonial_ad',
    'facebook_group_post_creative',
    'static_image_ad',
    'thumbnail',
    'postcard_qr_hero_image',
    'before_after_visual_concept',
    'campaign_offer_graphic',
    'multi_language_version',
    'voiceover_script',
    'scene_by_scene_storyboard'
  )),
  platform text not null check (platform in (
    'facebook',
    'instagram',
    'youtube_shorts',
    'tiktok',
    'website',
    'email',
    'sms',
    'postcard_qr_landing_page'
  )),
  brand_voice text not null default 'homereach_executive',
  brand_kit_id uuid references public.creative_brand_kits(id) on delete set null,
  prompt_template_id uuid references public.creative_prompt_templates(id) on delete set null,
  provider_key text not null default 'mock',
  provider_job_id text,
  provider_status text not null default 'mock_ready',
  prompt_used text not null default '',
  script_used text not null default '',
  storyboard jsonb not null default '[]'::jsonb,
  caption text not null default '',
  hashtags text[] not null default array[]::text[],
  file_url text,
  thumbnail_url text,
  status text not null default 'awaiting_review' check (status in (
    'draft',
    'generating',
    'awaiting_review',
    'approved',
    'rejected',
    'needs_revision',
    'archived'
  )),
  approval_status text not null default 'needs_review' check (approval_status in (
    'needs_review',
    'approved',
    'rejected',
    'needs_revision'
  )),
  compliance_review_status text not null default 'needs_review' check (compliance_review_status in (
    'not_required',
    'needs_review',
    'approved',
    'blocked'
  )),
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 10),
  best_use_case text not null default '',
  strengths text[] not null default array[]::text[],
  weaknesses text[] not null default array[]::text[],
  recommended_improvement text not null default '',
  approval_recommendation text not null default 'revise' check (approval_recommendation in ('approve','revise','reject')),
  notes text,
  winning_label text not null default 'untested' check (winning_label in ('untested','winner','loser','control')),
  winning_asset boolean not null default false,
  saved_to_campaign boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_assets_review_idx
  on public.creative_assets (status, approval_status, created_at desc);
create index if not exists creative_assets_entity_idx
  on public.creative_assets (business_id, campaign_id, candidate_id);
create index if not exists creative_assets_winner_idx
  on public.creative_assets (winning_asset, offer_key);

create table if not exists public.creative_asset_reviews (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.creative_assets(id) on delete cascade,
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  review_status text not null default 'needs_review' check (review_status in (
    'needs_review',
    'approved',
    'rejected',
    'needs_revision'
  )),
  quality_score integer not null default 0 check (quality_score >= 0 and quality_score <= 10),
  checklist jsonb not null default '{}'::jsonb,
  review_notes text,
  created_at timestamptz not null default now()
);

create index if not exists creative_asset_reviews_asset_idx
  on public.creative_asset_reviews (asset_id, created_at desc);

create table if not exists public.creative_generation_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid references public.creative_assets(id) on delete set null,
  provider_key text not null default 'mock',
  action_type text not null default 'generate',
  request_payload jsonb not null default '{}'::jsonb,
  response_payload jsonb not null default '{}'::jsonb,
  status text not null default 'logged' check (status in ('queued','success','failure','blocked','logged')),
  error_message text,
  duration_ms integer,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists creative_generation_logs_asset_idx
  on public.creative_generation_logs (asset_id, created_at desc);
create index if not exists creative_generation_logs_provider_idx
  on public.creative_generation_logs (provider_key, status, created_at desc);

create table if not exists public.creative_automation_rules (
  id uuid primary key default gen_random_uuid(),
  rule_key text not null unique,
  name text not null,
  cadence text not null default 'manual',
  asset_type text not null,
  platform text not null,
  enabled boolean not null default false,
  approval_required boolean not null default true,
  status text not null default 'future_ready' check (status in ('active','paused','future_ready','retired')),
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creative_automation_rules_status_idx
  on public.creative_automation_rules (enabled, status);

insert into public.creative_brand_kits (
  name,
  owner_type,
  colors,
  tone,
  fonts,
  cta_language,
  offer_language,
  forbidden_claims,
  required_disclaimer_language
) values
  (
    'HomeReach',
    'homereach',
    array['#07111f','#2563eb','#10b981','#ffffff'],
    'Premium, operational, clear, executive, and local-business friendly.',
    array['Geist','system sans-serif'],
    array['Get a Free Supply Cost Review','Build My Campaign Plan','Request Review'],
    'HomeReach helps local businesses and campaigns protect margin, stay visible, and execute smarter.',
    array['guaranteed leads','guaranteed savings','automatic publishing','automatic bid submission'],
    array['Human approval required before sending, publishing, or paid usage.']
  ),
  (
    'Supply Savings',
    'inventory_procurement',
    array['#052e2b','#059669','#e6fffb','#111827'],
    'Calm, ROI-aware, margin-protective, and practical.',
    array['Geist','system sans-serif'],
    array['Get a Free Supply Cost Review','Find Hidden Savings'],
    'Stop overpaying for supplies through vendor comparison, spend tracking, and owner-visible workflows.',
    array['guaranteed savings','vendor switch without approval','automatic ordering'],
    array['Savings examples are estimates until reviewed.']
  ),
  (
    'Political Campaign',
    'political_campaign',
    array['#0f172a','#dc2626','#ffffff','#2563eb'],
    'Clear, disciplined, geography-aware, and compliance-first.',
    array['Geist','system sans-serif'],
    array['Review Campaign Plan','Approve Mail Plan'],
    'Campaign mail planning with geography, cost, print, timing, and approval visibility.',
    array['voter ideology inference','persuasion scoring','unsupported opponent claims'],
    array['Political creative requires human compliance review before use.']
  ),
  (
    'Government Contract Offer',
    'government_contracts',
    array['#0f172a','#38bdf8','#f8fafc','#64748b'],
    'Precise, compliance-aware, organized, and operator-friendly.',
    array['Geist','system sans-serif'],
    array['Open Bid Workflow','Review Opportunity Fit'],
    'AI-assisted contract opportunity workflows for tracking, bid/no-bid review, and draft preparation.',
    array['guaranteed award','automatic bid submission','certified compliance without review'],
    array['Submission and compliance decisions require human approval.']
  )
on conflict (name) do update
set
  owner_type = excluded.owner_type,
  colors = excluded.colors,
  tone = excluded.tone,
  fonts = excluded.fonts,
  cta_language = excluded.cta_language,
  offer_language = excluded.offer_language,
  forbidden_claims = excluded.forbidden_claims,
  required_disclaimer_language = excluded.required_disclaimer_language,
  updated_at = now();

insert into public.creative_prompt_templates (
  template_key,
  name,
  offer_key,
  asset_type,
  platform,
  prompt_text,
  script_seed,
  storyboard_seed,
  compliance_notes
) values
  (
    'shared_postcards_starter',
    'Shared Postcard Ad starter workflow',
    'shared_postcards',
    '30_second_ugc_ad',
    'any',
    'Create a premium creative asset about local businesses sharing space on one high-visibility postcard mailed directly to homeowners.',
    'Local businesses can stay visible together without carrying the full print and postage cost alone.',
    '[]'::jsonb,
    'Do not guarantee leads. Category availability is subject to review.'
  ),
  (
    'targeted_mail_starter',
    'Targeted Mail Campaign starter workflow',
    'targeted_mail',
    'scene_by_scene_storyboard',
    'any',
    'Create route-level creative for reaching neighbors around the best customers with focused direct mail.',
    'Reach the neighbors around your best customers with a focused direct mail campaign.',
    '[]'::jsonb,
    'Do not promise exact delivery timing without operations confirmation.'
  ),
  (
    'procurement_dashboard_starter',
    'Inventory/Procurement Dashboard starter workflow',
    'procurement_dashboard',
    '30_second_ugc_ad',
    'any',
    'Create a premium creative draft for the supply savings offer: stop overpaying for supplies, compare vendors, track spend, and find savings.',
    'Stop overpaying for supplies. Let HomeReach help compare vendors, track spend, and find savings.',
    '[]'::jsonb,
    'Do not guarantee savings. Do not imply vendor switching or purchasing without approval.'
  ),
  (
    'political_mail_starter',
    'Political Mail starter workflow',
    'political_mail',
    'political_campaign_intro_video',
    'any',
    'Create a neutral political mail planning creative using geography, timing, cost, and print execution visibility only.',
    'Fast, clear campaign mail planning with route, geography, cost, and print execution visibility.',
    '[]'::jsonb,
    'No inferred voter beliefs. No persuasion scoring. Campaign claims require source review.'
  ),
  (
    'government_contracts_starter',
    'Government Contract Dashboard starter workflow',
    'government_contracts',
    '60_second_explainer_video',
    'any',
    'Create a premium explainer for AI-assisted contract opportunity tracking and bid preparation workflows.',
    'Find, track, and prepare small business bids faster with AI-assisted contract opportunity workflows.',
    '[]'::jsonb,
    'Do not certify compliance, submit bids, guarantee awards, or bind HomeReach.'
  )
on conflict (template_key) do update
set
  name = excluded.name,
  offer_key = excluded.offer_key,
  asset_type = excluded.asset_type,
  platform = excluded.platform,
  prompt_text = excluded.prompt_text,
  script_seed = excluded.script_seed,
  compliance_notes = excluded.compliance_notes,
  updated_at = now();

insert into public.creative_automation_rules (
  rule_key,
  name,
  cadence,
  asset_type,
  platform,
  enabled,
  approval_required,
  status,
  notes
) values
  (
    'daily_facebook_post_draft',
    'Daily Facebook post draft',
    'daily',
    'facebook_group_post_creative',
    'facebook',
    false,
    true,
    'paused',
    'Draft-only. Never posts without human approval.'
  ),
  (
    'weekly_business_ad_variations',
    'Weekly business ad variations',
    'weekly',
    '30_second_ugc_ad',
    'instagram',
    false,
    true,
    'future_ready',
    'Generates review queue items only.'
  ),
  (
    'weekly_political_creative_batch',
    'Weekly political campaign creative batch',
    'weekly',
    'political_campaign_intro_video',
    'facebook',
    false,
    true,
    'future_ready',
    'Requires campaign-provided claims and compliance review.'
  ),
  (
    'monthly_postcard_promo_pack',
    'Monthly postcard campaign promo pack',
    'monthly',
    'campaign_offer_graphic',
    'website',
    false,
    true,
    'future_ready',
    'Creates drafts for shared and targeted mail offers.'
  ),
  (
    'new_lead_followup_creative_draft',
    'New lead follow-up creative draft',
    'event_based',
    'static_image_ad',
    'sms',
    false,
    true,
    'future_ready',
    'Never sends automatically. Approval and consent checks remain required.'
  )
on conflict (rule_key) do update
set
  name = excluded.name,
  cadence = excluded.cadence,
  asset_type = excluded.asset_type,
  platform = excluded.platform,
  approval_required = excluded.approval_required,
  status = excluded.status,
  notes = excluded.notes,
  updated_at = now();

do $$
begin
  if to_regclass('public.platform_feature_flags') is not null then
    insert into public.platform_feature_flags (
      flag_key,
      label,
      module,
      status,
      enabled,
      kill_switch,
      requires_approval,
      safety_level,
      description,
      metadata
    ) values (
      'creative_studio_enabled',
      'AI Creative Production Studio',
      'creative_studio',
      'active',
      true,
      false,
      true,
      'high',
      'Enables the admin Creative Studio draft, review, scoring, and provider handoff surface. Publishing and sending remain approval-gated.',
      '{"auto_publish":false,"provider_default":"mock","human_approval_required":true}'::jsonb
    )
    on conflict (flag_key) do update
    set
      label = excluded.label,
      module = excluded.module,
      status = excluded.status,
      requires_approval = excluded.requires_approval,
      safety_level = excluded.safety_level,
      description = excluded.description,
      metadata = excluded.metadata,
      updated_at = now();
  end if;
end $$;

alter table public.creative_brand_kits enable row level security;
alter table public.creative_prompt_templates enable row level security;
alter table public.creative_assets enable row level security;
alter table public.creative_asset_reviews enable row level security;
alter table public.creative_generation_logs enable row level security;
alter table public.creative_automation_rules enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on table public.creative_brand_kits to authenticated;
grant select, insert, update, delete on table public.creative_prompt_templates to authenticated;
grant select, insert, update, delete on table public.creative_assets to authenticated;
grant select, insert, update, delete on table public.creative_asset_reviews to authenticated;
grant select, insert, update, delete on table public.creative_generation_logs to authenticated;
grant select, insert, update, delete on table public.creative_automation_rules to authenticated;
grant all privileges on table public.creative_brand_kits to service_role;
grant all privileges on table public.creative_prompt_templates to service_role;
grant all privileges on table public.creative_assets to service_role;
grant all privileges on table public.creative_asset_reviews to service_role;
grant all privileges on table public.creative_generation_logs to service_role;
grant all privileges on table public.creative_automation_rules to service_role;

do $$
declare
  tbl text;
begin
  foreach tbl in array array[
    'creative_brand_kits',
    'creative_prompt_templates',
    'creative_assets',
    'creative_asset_reviews',
    'creative_generation_logs',
    'creative_automation_rules'
  ]
  loop
    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname = tbl || '_service_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to service_role using (true) with check (true)',
        tbl || '_service_all',
        tbl
      );
    end if;

    if not exists (
      select 1 from pg_policies
      where schemaname = 'public'
        and tablename = tbl
        and policyname = tbl || '_admin_all'
    ) then
      execute format(
        'create policy %I on public.%I for all to authenticated using (coalesce(auth.jwt() -> ''app_metadata'' ->> ''user_role'', '''') = ''admin'') with check (coalesce(auth.jwt() -> ''app_metadata'' ->> ''user_role'', '''') = ''admin'')',
        tbl || '_admin_all',
        tbl
      );
    end if;
  end loop;
end $$;

comment on table public.creative_assets is
  'Approval-first AI Creative Production Studio asset library. Generated assets never publish/send automatically.';
comment on table public.creative_generation_logs is
  'Provider request/response audit log for creative generation attempts. Secrets must never be stored here.';
comment on table public.creative_automation_rules is
  'Draft-only scheduled creative generation rules. Human approval is required before use.';
;
