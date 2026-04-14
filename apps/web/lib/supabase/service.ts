import { createClient } from "@supabase/supabase-js";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Service Role Client
// Use ONLY in admin API routes and cron jobs.
// This bypasses RLS entirely — never expose to the browser.
// ─────────────────────────────────────────────────────────────────────────────

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
