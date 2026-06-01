import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/auth/api-guards";
import {
  getMetaOAuthAuthorizeUrl,
  getMetaOAuthScopes,
  requireMetaOAuthConfig,
  loadMetaPublishingConfigStatus,
} from "@/lib/social-content/meta/config";

export async function GET(req: Request) {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;

  const status = loadMetaPublishingConfigStatus();
  if (!status.connectedPublishingEnabled) {
    return NextResponse.json({ ok: false, error: "Meta connected publishing is disabled." }, { status: 503 });
  }

  let oauthConfig: ReturnType<typeof requireMetaOAuthConfig>;
  try {
    oauthConfig = requireMetaOAuthConfig(req.url);
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Meta OAuth is not configured." },
      { status: 503 },
    );
  }

  const requestUrl = new URL(req.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo"));
  const businessName = requestUrl.searchParams.get("businessName")?.trim() || null;
  const state = randomBytes(24).toString("base64url");
  const authorizeUrl = new URL(getMetaOAuthAuthorizeUrl());
  authorizeUrl.searchParams.set("client_id", oauthConfig.appId);
  authorizeUrl.searchParams.set("redirect_uri", oauthConfig.redirectUri);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", getMetaOAuthScopes().join(","));
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
  response.cookies.set("meta_oauth_state", state, cookieOptions);
  response.cookies.set(
    "meta_oauth_context",
    JSON.stringify({
      returnTo,
      businessName,
      clientEmail: guard.user?.email ?? null,
    }),
    cookieOptions,
  );
  return response;
}

function sanitizeReturnTo(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard/social-publishing";
  return value;
}
