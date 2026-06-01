import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/auth/api-guards";
import { exchangeMetaOAuthCode, fetchMetaPages, fetchMetaUser, MetaGraphApiError } from "@/lib/social-content/meta/client";
import { getMetaOAuthScopes, getMetaRedirectUri } from "@/lib/social-content/meta/config";
import { saveMetaConnectionsFromOAuth } from "@/lib/social-content/meta/repository";

type OAuthContext = {
  returnTo?: string | null;
  businessName?: string | null;
  clientEmail?: string | null;
};

export async function GET(req: Request) {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;

  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const metaError = requestUrl.searchParams.get("error");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("meta_oauth_state")?.value;
  const context = parseOAuthContext(cookieStore.get("meta_oauth_context")?.value);
  const returnTo = sanitizeReturnTo(context.returnTo);
  const redirectUri = getMetaRedirectUri(req.url);

  if (metaError) {
    return redirectWithCleanup(req, returnTo, { connected: "0", reason: metaError });
  }

  if (!code || !state || !expectedState || state !== expectedState || !redirectUri || !guard.user?.id) {
    return redirectWithCleanup(req, returnTo, { connected: "0", reason: "oauth_state" });
  }

  try {
    const token = await exchangeMetaOAuthCode({ code, redirectUri });
    const [metaUser, pages] = await Promise.all([
      fetchMetaUser(token.access_token),
      fetchMetaPages(token.access_token),
    ]);
    const saveResult = await saveMetaConnectionsFromOAuth({
      ownerUserId: guard.user.id,
      clientId: guard.user.id,
      clientEmail: context.clientEmail ?? guard.user.email ?? null,
      businessName: context.businessName ?? null,
      metaUser,
      token,
      pages,
      scopes: getMetaOAuthScopes(),
    });

    return redirectWithCleanup(req, returnTo, {
      connected: saveResult.stored ? "1" : "0",
      pages: String(saveResult.pageCount),
      stored: String(saveResult.savedCount),
      reason: saveResult.stored ? "ok" : "no_pages_saved",
    });
  } catch (error) {
    const reason = error instanceof MetaGraphApiError ? `meta_${error.status}` : "callback_error";
    return redirectWithCleanup(req, returnTo, { connected: "0", reason });
  }
}

function redirectWithCleanup(req: Request, returnTo: string, params: Record<string, string>) {
  const url = new URL(returnTo, req.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = NextResponse.redirect(url);
  response.cookies.delete("meta_oauth_state");
  response.cookies.delete("meta_oauth_context");
  return response;
}

function parseOAuthContext(value: string | undefined): OAuthContext {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as OAuthContext;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function sanitizeReturnTo(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/dashboard/social-publishing";
  return value;
}
