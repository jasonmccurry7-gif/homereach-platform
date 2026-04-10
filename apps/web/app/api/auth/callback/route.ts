import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// Supabase Auth Callback
//
// Handles token exchange for:
//   - Email confirmation (signup)
//   - Password reset
//   - Magic link login
//   - OAuth provider callbacks
//
// Flow:
//   Supabase sends user to: /api/auth/callback?code=xxx&next=/destination
//   We exchange the code for a session, set the cookie, then redirect.
//
// In Supabase Dashboard → Authentication → URL Configuration:
//   Site URL:         https://home-reach.com
//   Redirect URLs:    https://home-reach.com/api/auth/callback
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const type = searchParams.get("type"); // "recovery" for password reset

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Password reset: send to the reset-password page
      if (type === "recovery") {
        return NextResponse.redirect(`${origin}/reset-password`);
      }

      // All other flows: check role and route accordingly
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const role = user?.app_metadata?.user_role as string | undefined;
      let destination = next;

      if (!destination || destination === "/dashboard") {
        destination = role === "admin" ? "/admin" : "/dashboard";
      }

      return NextResponse.redirect(`${origin}${destination}`);
    }
  }

  // Auth failed — send to login with an error param
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
  );
}
