import { NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
          setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
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
        console.log(`[auth/callback] recovery flow → /reset-password`);
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

      console.log(
        `[auth/callback] user=${user?.email ?? "(anon)"} role=${role ?? "(none)"}` +
        ` next=${next} → destination=${destination}`,
      );
      return NextResponse.redirect(`${origin}${destination}`);
    }

    console.error(`[auth/callback] exchangeCodeForSession failed: ${error.message}`);
  } else {
    console.warn(`[auth/callback] no code in querystring — auth flow incomplete`);
  }

  // Auth failed — send to login with an error param
  console.warn(`[auth/callback] auth failed — redirecting to /login with error`);
  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Authentication failed. Please try again.")}`
  );
}
