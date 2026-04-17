import { NextResponse }       from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies }            from "next/headers";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/signout
// Signs out the current user and clears session cookies.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST() {
  const cookieStore = await cookies();
  const responseCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            responseCookies.push({ name, value, options })
          );
        },
      },
    }
  );

  await supabase.auth.signOut();

  const response = NextResponse.json({ success: true });
  responseCookies.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  return response;
}
