import { createClient } from "@supabase/supabase-js";
import type { UserRole } from "@homereach/types";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Auth Service
//
// Server-side auth helpers. The service role client bypasses RLS and is
// ONLY used for admin operations. Never expose the service role key to the
// browser.
// ─────────────────────────────────────────────────────────────────────────────

export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// getUserRole
// Fetches the role for a user from the profiles table.
// Used in middleware to protect routes by role.
// ─────────────────────────────────────────────────────────────────────────────

export async function getUserRole(
  db: import("@homereach/db").typeof_db,
  userId: string
): Promise<UserRole | null> {
  const { profiles } = await import("@homereach/db");
  const { eq } = await import("drizzle-orm");

  const [profile] = await db
    .select({ role: profiles.role })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  return profile?.role ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────
// isAdminEmail
// Fast check — admin emails are set via ADMIN_EMAILS env var.
// Secondary gate in addition to role-based checks.
// ─────────────────────────────────────────────────────────────────────────────

export function isAdminEmail(email: string): boolean {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  return adminEmails.includes(email.toLowerCase());
}

// ─────────────────────────────────────────────────────────────────────────────
// createProfileOnSignup
// Called from a Supabase DB trigger OR the signup API route.
// Creates the profiles row immediately after auth.users is created.
// ─────────────────────────────────────────────────────────────────────────────

export async function createProfileOnSignup(
  db: import("@homereach/db").typeof_db,
  args: {
    id: string;
    email: string;
    fullName?: string;
    role?: UserRole;
  }
) {
  const { profiles } = await import("@homereach/db");

  const role: UserRole =
    args.role ?? (isAdminEmail(args.email) ? "admin" : "client");

  await db
    .insert(profiles)
    .values({
      id: args.id,
      email: args.email,
      fullName: args.fullName ?? "",
      role,
    })
    .onConflictDoNothing(); // idempotent — safe to call multiple times
}
