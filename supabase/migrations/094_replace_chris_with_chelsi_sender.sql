-- Replace the retired Chris outbound sender with Chelsi.
-- This is intentionally idempotent: it preserves the existing agent_id
-- and territory assignments while changing only the public sender identity.

update public.agent_identities
set
  from_name = 'Chelsi',
  from_email = 'chelsi@home-reach.com',
  reply_to_email = 'chelsi@home-reach.com',
  updated_at = now()
where lower(coalesce(from_email, '')) = 'chris@home-reach.com'
   or lower(coalesce(from_name, '')) = 'chris';

update public.profiles
set
  full_name = 'Chelsi',
  email = 'chelsi@home-reach.com',
  updated_at = now()
where id in (
    select agent_id
    from public.agent_identities
    where lower(coalesce(from_email, '')) = 'chelsi@home-reach.com'
  )
   or lower(coalesce(email, '')) = 'chris@home-reach.com'
   or lower(coalesce(full_name, '')) = 'chris';
