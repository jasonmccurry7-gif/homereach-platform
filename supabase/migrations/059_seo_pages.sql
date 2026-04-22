-- ============================================================================
-- HomeReach SEO Engine v1 - Registry Migration
-- ============================================================================
-- Creates seo_pages and seo_page_versions tables plus supporting functions,
-- triggers, and RLS policies. Additive only. No existing table is altered.
--
-- Supabase SQL editor notes (per Jason's operator rules):
--   - No DO blocks. Each statement stands alone.
--   - ASCII only. No em-dashes, no smart quotes.
--   - One statement per line where possible.
--   - CREATE FUNCTION bodies use $func$ instead of $$ to avoid any dollar-
--     quote clash if the editor annotates the outer block.
--
-- Rollback: supabase/migrations/060_drop_seo_engine.sql
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Table: seo_pages
-- ---------------------------------------------------------------------------

create table if not exists public.seo_pages (
  id                 uuid primary key default gen_random_uuid(),
  page_type          text not null check (page_type in ('city_category','city','targeted_route','featured')),
  slug               text not null unique,
  city_id            uuid not null references public.cities(id) on delete restrict,
  category_id        uuid null references public.categories(id) on delete restrict,
  tier               text null check (tier is null or tier in ('anchor')),
  status             text not null default 'draft' check (status in ('draft','review','approved','published','archived')),
  title_tag          text null,
  meta_description   text null,
  h1                 text null,
  h1_slug            text null unique,
  content_blocks     jsonb not null default '[]'::jsonb,
  schema_ld          jsonb not null default '[]'::jsonb,
  internal_links     jsonb not null default '[]'::jsonb,
  primary_cta_url    text null,
  quality_check      jsonb not null default jsonb_build_object('passed', false, 'issues', '[]'::jsonb, 'checked_at', null),
  inventory_snapshot jsonb not null default '{}'::jsonb,
  published_at       timestamptz null,
  created_by         uuid null references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists seo_pages_page_type_idx on public.seo_pages (page_type);
create index if not exists seo_pages_status_idx on public.seo_pages (status);
create index if not exists seo_pages_city_id_idx on public.seo_pages (city_id);
create index if not exists seo_pages_category_id_idx on public.seo_pages (category_id);
create index if not exists seo_pages_published_at_idx on public.seo_pages (published_at) where status = 'published';

comment on table public.seo_pages is 'SEO Engine v1 - canonical registry of every SEO landing page (draft, review, approved, published, archived).';
comment on column public.seo_pages.slug is 'Canonical URL path relative to app root, e.g. advertise/wooster/roofing. Enforces page-level uniqueness.';
comment on column public.seo_pages.inventory_snapshot is 'Snapshot of spot_assignments state at publish time, for auditability. Not used for live scarcity rendering.';

-- ---------------------------------------------------------------------------
-- Table: seo_page_versions
-- ---------------------------------------------------------------------------

create table if not exists public.seo_page_versions (
  id              uuid primary key default gen_random_uuid(),
  page_id         uuid not null references public.seo_pages(id) on delete cascade,
  version_number  integer not null,
  snapshot        jsonb not null,
  change_reason   text null,
  actor_id        uuid null references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (page_id, version_number)
);

create index if not exists seo_page_versions_page_id_idx on public.seo_page_versions (page_id);
create index if not exists seo_page_versions_created_at_idx on public.seo_page_versions (created_at);

comment on table public.seo_page_versions is 'Append-only version history for seo_pages. Populated by trigger on published-row content changes.';

-- ---------------------------------------------------------------------------
-- Function: seo_pages_inventory_ok
-- ---------------------------------------------------------------------------
-- Returns true if no spot_assignments row exists for the (city, category)
-- pair with status in ('pending', 'active'). Used by the admin API publish
-- path to block pages that would claim availability the DB contradicts.
-- ---------------------------------------------------------------------------

create or replace function public.seo_pages_inventory_ok(p_city_id uuid, p_category_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $func$
begin
  if p_category_id is null then
    return true;
  end if;
  return not exists (
    select 1
    from public.spot_assignments
    where city_id = p_city_id
      and category_id = p_category_id
      and status in ('pending', 'active')
  );
end;
$func$;

comment on function public.seo_pages_inventory_ok(uuid, uuid) is 'Returns true if the city+category slot is available (no pending/active spot_assignment). Used by publish gate.';

-- ---------------------------------------------------------------------------
-- Function: seo_pages_quality_check
-- ---------------------------------------------------------------------------
-- Runs the v1 publish-time quality checks against a seo_pages row and writes
-- the result to quality_check. Returns the result jsonb for API use.
--
-- Check list (keep in sync with lib/seo/quality.ts):
--   1. word_count_ok       (content_blocks body text >= 500 words)
--   2. authored_blocks_ok  (city_relevance + faq + proof_trust combined >= 200 words)
--   3. title_tag_ok        (40..60 chars)
--   4. meta_description_ok (120..160 chars)
--   5. h1_present          (h1 is non-empty)
--   6. cta_url_present     (primary_cta_url starts with '/get-started/' or '/targeted/start')
--   7. inventory_ok        (seo_pages_inventory_ok)
--   8. slug_not_reserved   (slug does not collide with a reserved path prefix)
-- The server also runs a live HEAD check on primary_cta_url; that cannot run
-- in SQL and is handled in the API route.
-- ---------------------------------------------------------------------------

create or replace function public.seo_pages_quality_check(p_page_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_row           public.seo_pages%rowtype;
  v_issues        jsonb := '[]'::jsonb;
  v_body_text     text;
  v_word_count    integer;
  v_authored_text text;
  v_authored_wc   integer;
  v_result        jsonb;
  v_inventory_ok  boolean;
  v_title_len     integer;
  v_meta_len      integer;
begin
  select * into v_row from public.seo_pages where id = p_page_id;
  if not found then
    return jsonb_build_object('passed', false, 'issues', jsonb_build_array('page_not_found'), 'checked_at', now());
  end if;

  -- 1. word_count_ok
  select coalesce(string_agg(b->>'text', ' '), '')
    into v_body_text
    from jsonb_array_elements(v_row.content_blocks) as b;
  v_word_count := array_length(regexp_split_to_array(trim(coalesce(v_body_text, '')), '\s+'), 1);
  if v_word_count is null or v_word_count < 500 then
    v_issues := v_issues || to_jsonb('word_count_below_500:' || coalesce(v_word_count, 0)::text);
  end if;

  -- 2. authored_blocks_ok (sum of text from blocks flagged requires_human_authoring OR blocks of kind city_relevance/faq/proof_trust)
  select coalesce(string_agg(b->>'text', ' '), '')
    into v_authored_text
    from jsonb_array_elements(v_row.content_blocks) as b
    where (b->>'kind') in ('city_relevance','faq','proof_trust','category_pain');
  v_authored_wc := array_length(regexp_split_to_array(trim(coalesce(v_authored_text, '')), '\s+'), 1);
  if v_authored_wc is null or v_authored_wc < 200 then
    v_issues := v_issues || to_jsonb('authored_words_below_200:' || coalesce(v_authored_wc, 0)::text);
  end if;

  -- 3. title_tag length
  v_title_len := coalesce(length(v_row.title_tag), 0);
  if v_title_len < 40 or v_title_len > 60 then
    v_issues := v_issues || to_jsonb('title_tag_length_out_of_range:' || v_title_len::text);
  end if;

  -- 4. meta_description length
  v_meta_len := coalesce(length(v_row.meta_description), 0);
  if v_meta_len < 120 or v_meta_len > 160 then
    v_issues := v_issues || to_jsonb('meta_description_length_out_of_range:' || v_meta_len::text);
  end if;

  -- 5. h1 present
  if v_row.h1 is null or length(trim(v_row.h1)) = 0 then
    v_issues := v_issues || to_jsonb('h1_missing');
  end if;

  -- 6. cta_url_present and well-formed
  if v_row.primary_cta_url is null or length(v_row.primary_cta_url) = 0 then
    v_issues := v_issues || to_jsonb('primary_cta_url_missing');
  elsif not (v_row.primary_cta_url like '/get-started/%' or v_row.primary_cta_url like '/targeted/start%') then
    v_issues := v_issues || to_jsonb('primary_cta_url_not_funnel:' || v_row.primary_cta_url);
  end if;

  -- 7. inventory_ok
  v_inventory_ok := public.seo_pages_inventory_ok(v_row.city_id, v_row.category_id);
  if not v_inventory_ok then
    -- Allow if page is explicitly in waitlist framing (content_blocks has a waitlist block kind).
    if not exists (
      select 1 from jsonb_array_elements(v_row.content_blocks) as b where b->>'kind' = 'waitlist'
    ) then
      v_issues := v_issues || to_jsonb('inventory_locked_without_waitlist');
    end if;
  end if;

  -- 8. slug_not_reserved
  if v_row.slug like 'get-started/%' or v_row.slug like 'targeted/start%' or v_row.slug like 'api/%' or v_row.slug like 'admin/%' or v_row.slug like 'auth/%' then
    v_issues := v_issues || to_jsonb('slug_reserved:' || v_row.slug);
  end if;

  v_result := jsonb_build_object(
    'passed', (jsonb_array_length(v_issues) = 0),
    'issues', v_issues,
    'checked_at', now()
  );

  update public.seo_pages
     set quality_check = v_result,
         updated_at = now()
   where id = p_page_id;

  return v_result;
end;
$func$;

comment on function public.seo_pages_quality_check(uuid) is 'Runs v1 publish-time quality checks against a seo_pages row. Writes to quality_check and returns the result.';

-- ---------------------------------------------------------------------------
-- Trigger: seo_pages_version_on_update
-- ---------------------------------------------------------------------------
-- Snapshots prior state into seo_page_versions when a published row's
-- content fields change. Version numbers monotonic per page.
-- ---------------------------------------------------------------------------

create or replace function public.seo_pages_version_capture()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  v_next_version integer;
begin
  if old.status = 'published' and (
    old.content_blocks is distinct from new.content_blocks or
    old.schema_ld is distinct from new.schema_ld or
    old.title_tag is distinct from new.title_tag or
    old.meta_description is distinct from new.meta_description or
    old.h1 is distinct from new.h1
  ) then
    select coalesce(max(version_number), 0) + 1
      into v_next_version
      from public.seo_page_versions
     where page_id = old.id;

    insert into public.seo_page_versions (page_id, version_number, snapshot, change_reason, actor_id)
    values (old.id, v_next_version,
      jsonb_build_object(
        'title_tag', old.title_tag,
        'meta_description', old.meta_description,
        'h1', old.h1,
        'content_blocks', old.content_blocks,
        'schema_ld', old.schema_ld,
        'internal_links', old.internal_links,
        'primary_cta_url', old.primary_cta_url,
        'captured_at', now()
      ),
      'auto_snapshot_on_published_update',
      old.created_by
    );
  end if;

  new.updated_at := now();
  return new;
end;
$func$;

drop trigger if exists seo_pages_version_on_update on public.seo_pages;
create trigger seo_pages_version_on_update
  before update on public.seo_pages
  for each row
  execute function public.seo_pages_version_capture();

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

alter table public.seo_pages enable row level security;
alter table public.seo_page_versions enable row level security;

-- Admins have full CRUD. Uses the same pattern as qa_questions + content_intel tables.
drop policy if exists seo_pages_admin_all on public.seo_pages;
create policy seo_pages_admin_all on public.seo_pages
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

drop policy if exists seo_page_versions_admin_all on public.seo_page_versions;
create policy seo_page_versions_admin_all on public.seo_page_versions
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    )
  );

-- Service-role reads (rendering + sitemap) get published rows only.
drop policy if exists seo_pages_service_read_published on public.seo_pages;
create policy seo_pages_service_read_published on public.seo_pages
  for select
  using (
    auth.role() = 'service_role' or status = 'published'
  );
