-- Prevent anonymous/public direct execution of public RPC functions.
--
-- Supabase/Postgres grants EXECUTE on newly created functions to PUBLIC by
-- default unless revoked. Several internal SECURITY DEFINER routines are used
-- only behind protected application routes, so anonymous RPC execution should
-- be closed. Authenticated execution is preserved for now because existing
-- admin routes still call reviewed RPCs with the signed-in session client.

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

grant execute on all functions in schema public to service_role;

grant execute on function public.check_and_increment_send_count(uuid, text, date) to authenticated;
grant execute on function public.compute_facebook_daily_score(uuid, date) to authenticated;
grant execute on function public.enroll_lead_in_sequence(uuid, uuid, uuid) to authenticated;
grant execute on function public.enroll_lead_in_sequence(uuid, uuid, uuid, boolean) to authenticated;
grant execute on function public.get_agent_for_city(text) to authenticated;
grant execute on function public.get_my_role() to authenticated;
grant execute on function public.increment_lead_messages(uuid) to authenticated;
grant execute on function public.increment_lead_replies(uuid) to authenticated;
grant execute on function public.log_agent_run(text, text, integer, integer, integer, text, integer, integer, integer, integer, integer) to authenticated;
grant execute on function public.merge_duplicate_lead(uuid, uuid, uuid) to authenticated;
grant execute on function public.reassign_lead_to_agent(uuid, uuid) to authenticated;
grant execute on function public.refresh_leaderboard(text, date) to authenticated;
grant execute on function public.reset_daily_power_mode() to authenticated;
grant execute on function public.reset_daily_run_counters() to authenticated;
grant execute on function public.restore_from_quarantine(uuid, uuid, text) to authenticated;
grant execute on function public.seo_pages_inventory_ok(uuid, uuid) to authenticated;
grant execute on function public.seo_pages_quality_check(uuid) to authenticated;
grant execute on function public.seo_pages_version_capture() to authenticated;
grant execute on function public.update_power_mode_streak(uuid, integer, integer, integer, integer) to authenticated;;
