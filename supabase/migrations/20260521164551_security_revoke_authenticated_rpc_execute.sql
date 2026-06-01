-- Foundation hardening: admin/server workflows now call public RPCs through
-- guarded server routes that use the service role. Authenticated users should
-- not be able to invoke security-definer maintenance RPCs directly.

revoke execute on all functions in schema public from authenticated;

-- Keep server-side workflows operational.
grant execute on all functions in schema public to service_role;

-- Future functions should not become public RPCs by default.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from authenticated;
alter default privileges in schema public grant execute on functions to service_role;;
