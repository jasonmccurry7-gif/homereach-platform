-- Tighten fb_opportunities mutation policies.
--
-- SELECT remains available to signed-in operators. INSERT/UPDATE are limited
-- to admin and sales_agent JWT roles; protected routes already enforce the same
-- application boundary.

drop policy if exists auth_insert_fb_opp on public.fb_opportunities;
drop policy if exists auth_update_fb_opp on public.fb_opportunities;

create policy auth_insert_fb_opp
  on public.fb_opportunities
  for insert
  to authenticated
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') in ('admin', 'sales_agent')
  );

create policy auth_update_fb_opp
  on public.fb_opportunities
  for update
  to authenticated
  using (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') in ('admin', 'sales_agent')
  )
  with check (
    coalesce(auth.jwt() -> 'app_metadata' ->> 'user_role', '') in ('admin', 'sales_agent')
  );;
