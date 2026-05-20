-- ─────────────────────────────────────────────────────────────────────────────
-- FEC OH 2026 Staging Inspection Pack
--
-- Run this AFTER the FEC ingestion completes (cycle=2026, state=OH).
-- Each query block is self-contained — run them all at once or one at a time.
--
-- Goal: produce the technical report needed to design Phase 1B (dedup +
-- promotion) against the actual FEC payload shape rather than guesses.
--
-- Paste into the Supabase SQL editor. Read-only — touches no data.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 0. Identify the latest FEC batches (use these IDs in queries below)
-- ═════════════════════════════════════════════════════════════════════════════

select
  pi.id                  as import_batch_id,
  pi.kind,
  pi.source,
  pi.uploaded_at,
  pi.row_count_total     as fetched,
  pi.row_count_accepted  as inserted,
  pi.row_count_duplicate as skipped,
  pi.row_count_rejected  as failed,
  pi.status,
  pi.notes
from public.political_imports pi
where pi.kind in ('fec_candidates','fec_committees')
order by pi.uploaded_at desc
limit 10;


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. Headline counts
-- ═════════════════════════════════════════════════════════════════════════════

select
  'staging_candidates'    as table_name,
  count(*)                as total_rows,
  count(distinct state)   as distinct_states,
  count(distinct cycle)   as distinct_cycles,
  count(distinct office_text) as distinct_offices,
  count(distinct source_record_id) as distinct_fec_ids
from public.staging_candidates
union all
select
  'staging_organizations',
  count(*),
  count(distinct state),
  null,
  count(distinct org_type),
  count(distinct source_record_id)
from public.staging_organizations;


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. Office breakdown — what offices did we pull?
-- ═════════════════════════════════════════════════════════════════════════════

select
  office_text,
  cycle,
  count(*) as candidates,
  count(distinct state) as states,
  count(distinct district) as distinct_districts
from public.staging_candidates
group by office_text, cycle
order by candidates desc;


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. Stable-ID coverage
--    What fraction of rows carry the strong identifiers we'd dedup on?
-- ═════════════════════════════════════════════════════════════════════════════

with c as (
  select count(*) as n,
         count(source_record_id) as n_fec_id,
         count(state)             as n_state,
         count(office_text)       as n_office,
         count(district)          as n_district,
         count(party_optional)    as n_party,
         count(campaign_email)    as n_email,
         count(campaign_phone)    as n_phone,
         count(campaign_website)  as n_website,
         count(treasurer_name)    as n_treasurer
  from public.staging_candidates
)
select
  'candidates' as table_name,
  n,
  round(100.0 * n_fec_id    / nullif(n,0), 1) as pct_with_fec_id,
  round(100.0 * n_state     / nullif(n,0), 1) as pct_with_state,
  round(100.0 * n_office    / nullif(n,0), 1) as pct_with_office,
  round(100.0 * n_district  / nullif(n,0), 1) as pct_with_district,
  round(100.0 * n_party     / nullif(n,0), 1) as pct_with_party,
  round(100.0 * n_email     / nullif(n,0), 1) as pct_with_email,
  round(100.0 * n_phone     / nullif(n,0), 1) as pct_with_phone,
  round(100.0 * n_website   / nullif(n,0), 1) as pct_with_website
from c
union all
select
  'organizations',
  count(*),
  round(100.0 * count(source_record_id) / nullif(count(*),0), 1),
  round(100.0 * count(state)             / nullif(count(*),0), 1),
  null, null,
  round(100.0 * count(ein)               / nullif(count(*),0), 1),  -- repurposed: pct_with_ein
  round(100.0 * count(primary_contact_email) / nullif(count(*),0), 1),
  round(100.0 * count(primary_contact_phone) / nullif(count(*),0), 1),
  round(100.0 * count(website)           / nullif(count(*),0), 1)
from public.staging_organizations;
-- Note for organizations row: pct_with_party = pct_with_ein, pct_with_district = NULL.


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. Dedupe-hash collision detection
--    A collision = multiple staging rows with the same dedupe_hash.
--    Each cluster is the dedup engine's first job: decide which (if any)
--    is the canonical row.
-- ═════════════════════════════════════════════════════════════════════════════

-- 4a. Candidate hash collisions
select
  dedupe_hash,
  count(*) as cluster_size,
  string_agg(distinct candidate_name, ' | ') as names_in_cluster,
  string_agg(distinct source_record_id, ', ') as fec_ids,
  string_agg(distinct cycle::text, ', ') as cycles
from public.staging_candidates
group by dedupe_hash
having count(*) > 1
order by cluster_size desc
limit 25;

-- 4b. Organization hash collisions
select
  dedupe_hash,
  count(*) as cluster_size,
  string_agg(distinct legal_name, ' | ') as names_in_cluster,
  string_agg(distinct source_record_id, ', ') as fec_ids
from public.staging_organizations
group by dedupe_hash
having count(*) > 1
order by cluster_size desc
limit 25;


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. Same FEC ID, different normalized identity
--    FEC sometimes ships the same candidate_id with slight name variations
--    across pulls (e.g. "DOE, JANE M" vs "DOE, JANE"). These should be
--    auto-merged (FEC ID wins).
-- ═════════════════════════════════════════════════════════════════════════════

select
  source_record_id as fec_id,
  count(*) as row_count,
  count(distinct candidate_name) as distinct_names,
  count(distinct office_text)    as distinct_offices,
  count(distinct state)          as distinct_states,
  string_agg(distinct candidate_name, ' | ') as name_variants
from public.staging_candidates
where source_record_id is not null
group by source_record_id
having count(distinct candidate_name) > 1
   or count(distinct office_text) > 1
order by row_count desc
limit 25;


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. Candidate ↔ Committee linkage quality
--    FEC reports "principal_committees" inside the candidate raw_payload.
--    This is the structured link Phase 1B can use to attach an org to a
--    candidate during promotion.
-- ═════════════════════════════════════════════════════════════════════════════

-- 6a. % of candidates with at least one principal committee
select
  count(*) as total_candidates,
  count(*) filter (
    where jsonb_array_length(coalesce(raw_payload->'principal_committees','[]'::jsonb)) > 0
  ) as with_principal_committee,
  round(100.0 * count(*) filter (
    where jsonb_array_length(coalesce(raw_payload->'principal_committees','[]'::jsonb)) > 0
  ) / nullif(count(*), 0), 1) as pct
from public.staging_candidates;

-- 6b. % of committees with a linked candidate
select
  count(*) as total_committees,
  count(linked_candidate_source_id) as with_linked_candidate,
  round(100.0 * count(linked_candidate_source_id) / nullif(count(*),0), 1) as pct
from public.staging_organizations;

-- 6c. Cross-check: do candidates' principal committees exist in our committees pull?
with cand_committees as (
  select distinct
    sc.source_record_id as candidate_fec_id,
    pc->>'committee_id' as committee_fec_id
  from public.staging_candidates sc,
       jsonb_array_elements(coalesce(sc.raw_payload->'principal_committees','[]'::jsonb)) as pc
  where sc.source_record_id is not null
)
select
  count(*) as total_links,
  count(so.id) as resolvable_links,
  count(*) - count(so.id) as missing_committee_rows,
  round(100.0 * count(so.id) / nullif(count(*),0), 1) as pct_resolvable
from cand_committees cc
left join public.staging_organizations so
  on so.source_record_id = cc.committee_fec_id;


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. Confidence-score distribution
--    Pure data-completeness signal (no ideology). Drives review-queue order.
-- ═════════════════════════════════════════════════════════════════════════════

select
  case
    when data_confidence_score >= 90 then '90-100 (high)'
    when data_confidence_score >= 70 then '70-89  (good)'
    when data_confidence_score >= 50 then '50-69  (medium)'
    when data_confidence_score >= 30 then '30-49  (low)'
    else                                   '0-29   (poor)'
  end as bucket,
  count(*) filter (where 'staging_candidates' = 'staging_candidates') as candidates_in_bucket
from public.staging_candidates
group by 1
order by 1;


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. Match against existing live tables
--    For each staging row, do we already have a campaign_candidates row
--    with the same FEC ID? (Phase 1B's auto-merge will need to do this.)
-- ═════════════════════════════════════════════════════════════════════════════

-- 8a. Candidates that ALREADY have a live row by fec_candidate_id
select
  count(*) as staging_candidates_with_live_match
from public.staging_candidates sc
join public.campaign_candidates cc on cc.fec_candidate_id = sc.source_record_id;

-- 8b. Organizations that ALREADY have a live row by fec_committee_id
select
  count(*) as staging_organizations_with_live_match
from public.staging_organizations so
join public.political_organizations po on po.fec_committee_id = so.source_record_id;


-- ═════════════════════════════════════════════════════════════════════════════
-- 9. Sample rows for eyeballing
--    Pull 10 candidates + 10 committees with the highest confidence scores
--    so we can read what "good" actually looks like.
-- ═════════════════════════════════════════════════════════════════════════════

-- 9a. Top candidates
select
  candidate_name, party_optional, office_text, state, district,
  cycle, data_confidence_score, source_record_id,
  raw_payload->'principal_committees'->0->>'committee_id' as primary_committee_id
from public.staging_candidates
order by data_confidence_score desc nulls last, candidate_name
limit 10;

-- 9b. Top committees
select
  legal_name, org_type, state, ein, primary_contact_name,
  data_confidence_score, source_record_id, linked_candidate_source_id
from public.staging_organizations
order by data_confidence_score desc nulls last, legal_name
limit 10;


-- ═════════════════════════════════════════════════════════════════════════════
-- 10. Audit-side rejection inspection
--     What kinds of rows did the FEC client itself fail on (per-batch)?
-- ═════════════════════════════════════════════════════════════════════════════

select
  pi.kind,
  pi.uploaded_at,
  pi.row_count_rejected,
  pi.sample_rejections
from public.political_imports pi
where pi.kind in ('fec_candidates','fec_committees')
  and pi.row_count_rejected > 0
order by pi.uploaded_at desc
limit 5;


-- ═════════════════════════════════════════════════════════════════════════════
-- Done. Paste the result of each numbered block back to Claude for analysis.
-- ─────────────────────────────────────────────────────────────────────────────
