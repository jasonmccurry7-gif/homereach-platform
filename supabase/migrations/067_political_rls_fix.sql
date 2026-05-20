-- ─────────────────────────────────────────────────────────────────────────────
-- HomeReach Migration 067 — Political Command Center: RLS Recursion Fix
--
-- Resolves: ERROR 42P17 "infinite recursion detected in policy for
-- relation 'profiles'" when querying any political_* table.
--
-- Cause: migrations 059–066 used inline `EXISTS (SELECT 1 FROM profiles
-- WHERE id = auth.uid() AND role = 'admin')` for admin/agent role checks.
-- That pattern works only when `profiles` has no self-referential RLS.
-- HomeReach's current `profiles` RLS does query profiles in its own
-- policies, causing Postgres to abort with recursion.
--
-- Fix: replace every profiles-table check with the JWT claim pattern that
-- migrations 24+ adopted across the codebase:
--     (auth.jwt()->'app_metadata'->>'user_role')
-- The user_role claim is set on every authenticated user by the
-- handle_new_user() trigger (migration 00). It's available in the JWT
-- on every request, so the check never touches the profiles table.
--
-- Strictly additive in the operational sense — drops + recreates RLS
-- POLICIES only. No schema, indexes, triggers, or data touched. No
-- impact on existing data, only on access semantics.
--
-- service_role policies are preserved as-is (they grant the postgres
-- service role, not the JWT-bearing user, so no recursion risk there).
--
-- SAFE TO RE-RUN.
-- ─────────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════════
-- 1. campaign_candidates (originally migration 061 / DB applied as 059)
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "campaign_candidates_admin"          on public.campaign_candidates;
drop policy if exists "campaign_candidates_agent_read"     on public.campaign_candidates;
drop policy if exists "campaign_candidates_agent_update"   on public.campaign_candidates;
drop policy if exists "campaign_candidates_agent_insert"   on public.campaign_candidates;

create policy "campaign_candidates_admin"
  on public.campaign_candidates for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "campaign_candidates_agent_read"
  on public.campaign_candidates for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "campaign_candidates_agent_update"
  on public.campaign_candidates for update to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');

create policy "campaign_candidates_agent_insert"
  on public.campaign_candidates for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ═════════════════════════════════════════════════════════════════════════════
-- 2. political_campaigns
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_campaigns_admin"             on public.political_campaigns;
drop policy if exists "political_campaigns_agent_read"        on public.political_campaigns;
drop policy if exists "political_campaigns_agent_insert"      on public.political_campaigns;
drop policy if exists "political_campaigns_agent_update_own"  on public.political_campaigns;

create policy "political_campaigns_admin"
  on public.political_campaigns for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_campaigns_agent_read"
  on public.political_campaigns for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_campaigns_agent_insert"
  on public.political_campaigns for insert to authenticated
  with check (
    (auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent'
    and (owner_id is null or owner_id = auth.uid())
  );

create policy "political_campaigns_agent_update_own"
  on public.political_campaigns for update to authenticated
  using      (owner_id = auth.uid())
  with check (owner_id = auth.uid());


-- ═════════════════════════════════════════════════════════════════════════════
-- 3. political_campaign_contacts
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_campaign_contacts_admin"          on public.political_campaign_contacts;
drop policy if exists "political_campaign_contacts_agent_read"     on public.political_campaign_contacts;
drop policy if exists "political_campaign_contacts_agent_insert"   on public.political_campaign_contacts;
drop policy if exists "political_campaign_contacts_agent_update"   on public.political_campaign_contacts;

create policy "political_campaign_contacts_admin"
  on public.political_campaign_contacts for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_campaign_contacts_agent_read"
  on public.political_campaign_contacts for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_campaign_contacts_agent_insert"
  on public.political_campaign_contacts for insert to authenticated
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');

create policy "political_campaign_contacts_agent_update"
  on public.political_campaign_contacts for update to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent');


-- ═════════════════════════════════════════════════════════════════════════════
-- 4. political_proposals
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_proposals_admin"             on public.political_proposals;
drop policy if exists "political_proposals_agent_read"        on public.political_proposals;
drop policy if exists "political_proposals_agent_insert"      on public.political_proposals;
drop policy if exists "political_proposals_agent_update_own"  on public.political_proposals;

create policy "political_proposals_admin"
  on public.political_proposals for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_proposals_agent_read"
  on public.political_proposals for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));

create policy "political_proposals_agent_insert"
  on public.political_proposals for insert to authenticated
  with check (
    (auth.jwt()->'app_metadata'->>'user_role') = 'sales_agent'
    and (created_by is null or created_by = auth.uid())
  );

create policy "political_proposals_agent_update_own"
  on public.political_proposals for update to authenticated
  using      (created_by = auth.uid())
  with check (created_by = auth.uid());


-- ═════════════════════════════════════════════════════════════════════════════
-- 5. political_orders
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_orders_admin"        on public.political_orders;
drop policy if exists "political_orders_agent_read"   on public.political_orders;

create policy "political_orders_admin"
  on public.political_orders for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_orders_agent_read"
  on public.political_orders for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));


-- ═════════════════════════════════════════════════════════════════════════════
-- 6. political_contracts
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_contracts_admin"        on public.political_contracts;
drop policy if exists "political_contracts_agent_read"   on public.political_contracts;

create policy "political_contracts_admin"
  on public.political_contracts for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_contracts_agent_read"
  on public.political_contracts for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));


-- ═════════════════════════════════════════════════════════════════════════════
-- 7. political_scripts
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_scripts_admin"        on public.political_scripts;
drop policy if exists "political_scripts_agent_read"   on public.political_scripts;

create policy "political_scripts_admin"
  on public.political_scripts for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_scripts_agent_read"
  on public.political_scripts for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));


-- ═════════════════════════════════════════════════════════════════════════════
-- 8. political_priority_runs
-- ═════════════════════════════════════════════════════════════════════════════

drop policy if exists "political_priority_runs_admin"        on public.political_priority_runs;
drop policy if exists "political_priority_runs_agent_read"   on public.political_priority_runs;

create policy "political_priority_runs_admin"
  on public.political_priority_runs for all to authenticated
  using      ((auth.jwt()->'app_metadata'->>'user_role') = 'admin')
  with check ((auth.jwt()->'app_metadata'->>'user_role') = 'admin');

create policy "political_priority_runs_agent_read"
  on public.political_priority_runs for select to authenticated
  using ((auth.jwt()->'app_metadata'->>'user_role') in ('admin','sales_agent'));
