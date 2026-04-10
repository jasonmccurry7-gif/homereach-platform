import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Route Protection Middleware
//
// Hierarchy:
//   /admin/*          — admin role only (ADMIN_DEV_BYPASS=true bypasses in dev)
//   /admin/agent-view — also accessible to sales_agent role
//   /dashboard/*      — any authenticated user
//   /api/auth/*       — always public (Supabase callback)
//   /login /signup    — public; authenticated users are redirected by role
//   /                 — public (marketing)
//
// Roles:
//   admin       → /admin (full OS)
//   sales_agent → /admin/agent-view (restricted)
//   client      → /dashboard
//   nonprofit   → /dashboard
//   sponsor     → /dashboard
//
// Auth state is read from the Supabase session cookie.
// User role is stored in the JWT custom claim `user_role` (set via DB trigger).
// ─────────────────────────────────────────────────────────────────────────────

const PROTECTED = {
  admin:     /^\/admin(\/|$)/,
  dashboard: /^\/dashboard(\/|$)/,
};

// Agent-view is inside /admin but accessible to sales_agent too
const AGENT_VIEW_ROUTE = /^\/admin\/agent-view(\/|$)/;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";

  // ── Always allow: Supabase auth callback ─────────────────────────────────
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request });
  }

  // ── Dev bypass: skip ALL auth logic for admin routes (dev only) ──────────
  if (devBypass && PROTECTED.admin.test(pathname)) {
    return NextResponse.next({ request });
  }

  // ── Build Supabase client ─────────────────────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = user?.app_metadata?.user_role as string | undefined;

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (PROTECTED.admin.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }

    // sales_agent can only access agent-view inside /admin
    if (role === "sales_agent" && !AGENT_VIEW_ROUTE.test(pathname)) {
      return NextResponse.redirect(new URL("/admin/agent-view", request.url));
    }

    // Everyone else who is not admin and not a sales_agent goes to /dashboard
    if (role !== "admin" && role !== "sales_agent") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Dashboard routes ──────────────────────────────────────────────────────
  if (PROTECTED.dashboard.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
  }

  // ── Redirect authenticated users away from auth pages ────────────────────
  if (user && (pathname === "/login" || pathname === "/signup")) {
    let destination: string;
    if (role === "admin") {
      destination = "/admin";
    } else if (role === "sales_agent") {
      destination = "/admin/agent-view";
    } else {
      destination = "/dashboard";
    }
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static (static files)
     *   - _next/image (image optimization)
     *   - favicon.ico
     *   - public assets (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
