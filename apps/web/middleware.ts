import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Route Protection Middleware
//
// Hierarchy:
//   /admin/*          - admin role only (ADMIN_DEV_BYPASS=true bypasses in dev)
//   /admin/agent-view - also accessible to sales_agent role
//   /agent/*          - admin + sales_agent (mobile agent experience, feature-flagged)
//   /dashboard/*      - any authenticated user
//   /api/auth/*       - always public (Supabase callback)
//   /login /signup    - public; authenticated users are redirected by role
//   /                 - public (marketing)
//
// Auth state is read from the Supabase session cookie.
// User role is stored in the JWT custom claim `user_role` (set via DB trigger).

const PROTECTED = {
  admin: /^\/admin(\/|$)/,
  agent: /^\/agent(\/|$)/,
  dashboard: /^\/dashboard(\/|$)/,
};

// Routes inside /admin accessible to sales_agent role.
const AGENT_ALLOWED_ROUTES =
  /^\/admin\/(agent-view|ad-designer|roi-preview|products|bundles|crm|sales-dashboard|sales-engine|facebook)(\/|$)|^\/admin\/agent-view$/;

function safeAuthRedirectPath(request: NextRequest): string | null {
  const redirect = request.nextUrl.searchParams.get("redirect");
  if (!redirect || !redirect.startsWith("/") || redirect.startsWith("//")) return null;

  try {
    const target = new URL(redirect, request.url);
    if (target.origin !== request.nextUrl.origin) return null;
    if (target.pathname.startsWith("/api/")) return null;
    if (target.pathname === "/login" || target.pathname === "/signup") return null;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const devBypass = process.env.ADMIN_DEV_BYPASS === "true";

  // Always allow Supabase auth callbacks.
  if (pathname.startsWith("/api/auth/")) {
    return NextResponse.next({ request });
  }

  // Dev bypass: skip all auth logic for admin routes in local/dev only.
  if (devBypass && PROTECTED.admin.test(pathname)) {
    return NextResponse.next({ request });
  }

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

  if (PROTECTED.admin.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }

    if (role === "sales_agent" && !AGENT_ALLOWED_ROUTES.test(pathname)) {
      return NextResponse.redirect(new URL("/admin/agent-view", request.url));
    }

    if (role !== "admin" && role !== "sales_agent") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (PROTECTED.agent.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
    if (role !== "admin" && role !== "sales_agent") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (PROTECTED.dashboard.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(pathname)}`, request.url)
      );
    }
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    const requestedRedirect = safeAuthRedirectPath(request);
    if (requestedRedirect) {
      return NextResponse.redirect(new URL(requestedRedirect, request.url));
    }

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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
