import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// ─────────────────────────────────────────────────────────────────────────────
// Route Protection Middleware
//
// Protects routes by role:
//   /admin/*    — admin only
//   /dashboard/* — any authenticated user
//   /political/{advanced command routes} - admin only
//   /get-started/* — public (funnel)
//   /          — public (marketing)
//
// Auth state is read from the Supabase session cookie.
// User role is stored in the JWT custom claim `user_role` (set via DB trigger).
// ─────────────────────────────────────────────────────────────────────────────

const PROTECTED_ROUTES = {
  admin: /^\/admin(\/|$)/,
  adminAgentView: /^\/admin\/agent-view(\/|$)/,
  adminAgentMiniApps: /^\/admin\/agent-mini-apps(\/|$)/,
  adminApi: /^\/api\/admin(\/|$)/,
  adminAgentMiniAppsApi: /^\/api\/admin\/agent-mini-apps(\/|$)/,
  adminAlertPreferencesApi: /^\/api\/admin\/alerts\/preferences(\/|$)/,
  adminSalesApi: /^\/api\/admin\/sales(\/|$)/,
  agentApi: /^\/api\/agent(\/|$)/,
  agent: /^\/agent(\/|$)/,
  dashboard: /^\/dashboard(\/|$)/,
  operationsCopilot: /^\/operations-copilot(\/|$)/,
  politicalCommand: /^\/political\/(?:analytics|maps|presentation|routes)(\/|$)/,
  politicalPublicCoverageApi: /^\/political\/routes\/coverage(\/|$)/,
  targetedAdminApi: /^\/api\/targeted\/admin(\/|$)/,
};

type CronSecretEnvKey =
  | "CRON_SECRET"
  | "CONTENT_INTEL_CRON_SECRET"
  | "POLITICAL_CRON_SECRET"
  | "FSGOS_CRON_SECRET";

const CRON_ALLOWED_API_ROUTES: Array<{
  route: RegExp;
  envKeys?: readonly CronSecretEnvKey[];
}> = [
  { route: /^\/api\/admin\/automation\/send-due(\/|$)/ },
  { route: /^\/api\/admin\/daily-outreach\/send-due(\/|$)/ },
  { route: /^\/api\/admin\/revenue-messaging\/send-approved(\/|$)/ },
  { route: /^\/api\/admin\/control-tower\/daily-brief(\/|$)/ },
  { route: /^\/api\/admin\/daily-content\/generate(\/|$)/ },
  { route: /^\/api\/admin\/daily-content\/[^/]+\/higgsfield(\/|$)/ },
  { route: /^\/api\/admin\/content-intel\/cron(\/|$)/, envKeys: ["CONTENT_INTEL_CRON_SECRET"] },
  { route: /^\/api\/admin\/lead-intel\/cron(\/|$)/, envKeys: ["CONTENT_INTEL_CRON_SECRET"] },
  { route: /^\/api\/admin\/political\/intelligence\/sync(\/|$)/, envKeys: ["POLITICAL_CRON_SECRET", "CONTENT_INTEL_CRON_SECRET", "CRON_SECRET"] },
  { route: /^\/api\/admin\/system\/apex(\/|$)/ },
  { route: /^\/api\/admin\/system\/agents\/(?:pulse|ledger|kaizen|prospector)(\/|$)/ },
  { route: /^\/api\/admin\/agents\/scraper(\/|$)/ },
  { route: /^\/api\/admin\/health(\/|$)/ },
  { route: /^\/api\/admin\/sales\/power-mode\/end-of-day(\/|$)/ },
  { route: /^\/api\/admin\/sales\/facebook\/alert(\/|$)/ },
  { route: /^\/api\/admin\/sales\/facebook\/daily-score(\/|$)/ },
  { route: /^\/api\/admin\/procurement\/price-ingestion\/run(\/|$)/ },
  { route: /^\/api\/admin\/gov-contracts\/sync(\/|$)/ },
];

const SALES_AGENT_SALES_API_ROUTES = [
  /^\/api\/admin\/sales\/alert(\/|$)/,
  /^\/api\/admin\/sales\/at-risk(\/|$)/,
  /^\/api\/admin\/sales\/call-list(\/|$)/,
  /^\/api\/admin\/sales\/call-log(\/|$)/,
  /^\/api\/admin\/sales\/call-scripts(\/|$)/,
  /^\/api\/admin\/sales\/call-stats(\/|$)/,
  /^\/api\/admin\/sales\/close-deal(\/|$)/,
  /^\/api\/admin\/sales\/event(\/|$)/,
  /^\/api\/admin\/sales\/power-mode\/check(\/|$)/,
  /^\/api\/admin\/sales\/priority-actions(\/|$)/,
  /^\/api\/admin\/sales\/replies(\/|$)/,
  /^\/api\/admin\/sales\/todays-tasks(\/|$)/,
  /^\/api\/admin\/sales\/facebook\/alert(\/|$)/,
  /^\/api\/admin\/sales\/facebook\/mission(\/|$)/,
  /^\/api\/admin\/sales\/facebook\/scorecard(\/|$)/,
];

type CookieToSet = {
  name: string;
  value: string;
  options: CookieOptions;
};

function requestSecret(request: NextRequest): string | null {
  const headerSecret = request.headers.get("x-cron-secret")?.trim();
  if (headerSecret) return headerSecret;

  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice("bearer ".length).trim() || null;
}

function cronRouteConfig(pathname: string) {
  return CRON_ALLOWED_API_ROUTES.find((entry) => entry.route.test(pathname));
}

function hasValidCronSecret(request: NextRequest, pathname: string): boolean {
  const provided = requestSecret(request);
  if (!provided) return false;

  const routeConfig = cronRouteConfig(pathname);
  if (!routeConfig) return false;

  const allowedKeys = routeConfig.envKeys ?? (["CRON_SECRET"] as const);

  return allowedKeys.some((key) => {
    const expected = process.env[key];
    return Boolean(expected && provided === expected);
  });
}

function isSalesAgentSalesApi(pathname: string): boolean {
  return SALES_AGENT_SALES_API_ROUTES.some((route) => route.test(pathname));
}

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

function loginRedirectFor(request: NextRequest, fallbackPath?: string) {
  const redirectPath =
    fallbackPath ?? `${request.nextUrl.pathname}${request.nextUrl.search}`;
  return new URL(`/login?redirect=${encodeURIComponent(redirectPath)}`, request.url);
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
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

  const { pathname } = request.nextUrl;

  if (
    PROTECTED_ROUTES.adminApi.test(pathname) ||
    PROTECTED_ROUTES.agentApi.test(pathname) ||
    PROTECTED_ROUTES.targetedAdminApi.test(pathname)
  ) {
    if (hasValidCronSecret(request, pathname)) {
      return supabaseResponse;
    }

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = user.app_metadata?.user_role as string | undefined;
    if (
      PROTECTED_ROUTES.agentApi.test(pathname) &&
      (role === "admin" || role === "sales_agent")
    ) {
      return supabaseResponse;
    }

    if (
      PROTECTED_ROUTES.adminAlertPreferencesApi.test(pathname) &&
      (role === "admin" || role === "sales_agent")
    ) {
      return supabaseResponse;
    }

    if (
      PROTECTED_ROUTES.adminSalesApi.test(pathname) &&
      (role === "admin" || (role === "sales_agent" && isSalesAgentSalesApi(pathname)))
    ) {
      return supabaseResponse;
    }

    if (
      PROTECTED_ROUTES.adminAgentMiniAppsApi.test(pathname) &&
      (role === "admin" || role === "sales_agent")
    ) {
      return supabaseResponse;
    }

    if (role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // ── Admin routes ──────────────────────────────────────────────────────────
  if (PROTECTED_ROUTES.admin.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(loginRedirectFor(request));
    }

    // Role check via custom JWT claim
    const role = user.app_metadata?.user_role as string | undefined;
    if (PROTECTED_ROUTES.adminAgentView.test(pathname) && role === "sales_agent") {
      return supabaseResponse;
    }

    if (PROTECTED_ROUTES.adminAgentMiniApps.test(pathname) && role === "sales_agent") {
      return supabaseResponse;
    }

    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (
    PROTECTED_ROUTES.politicalCommand.test(pathname) &&
    !PROTECTED_ROUTES.politicalPublicCoverageApi.test(pathname)
  ) {
    if (!user) {
      const redirectPath = `${pathname}${request.nextUrl.search}`;
      return NextResponse.redirect(
        new URL(`/login?redirect=${encodeURIComponent(redirectPath)}`, request.url)
      );
    }

    const role = user.app_metadata?.user_role as string | undefined;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (PROTECTED_ROUTES.agent.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(loginRedirectFor(request));
    }

    const role = user.app_metadata?.user_role as string | undefined;
    if (role !== "admin" && role !== "sales_agent") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  // ── Dashboard routes ──────────────────────────────────────────────────────
  if (PROTECTED_ROUTES.dashboard.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(loginRedirectFor(request));
    }
  }

  if (PROTECTED_ROUTES.operationsCopilot.test(pathname)) {
    if (!user) {
      return NextResponse.redirect(loginRedirectFor(request));
    }
  }

  // ── Redirect authenticated users away from auth pages ────────────────────
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const requestedRedirect = safeAuthRedirectPath(request);
    if (requestedRedirect) {
      return NextResponse.redirect(new URL(requestedRedirect, request.url));
    }

    const role = user.app_metadata?.user_role as string | undefined;
    const redirect =
      role === "admin" ? "/admin" :
      role === "sales_agent" ? "/admin/agent-view" :
      "/dashboard";
    return NextResponse.redirect(new URL(redirect, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
