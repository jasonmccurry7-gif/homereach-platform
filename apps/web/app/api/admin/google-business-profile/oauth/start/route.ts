import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { GBP_OAUTH_AUTHORIZE_URL, GBP_SCOPE } from "@/lib/google-business-profile/config";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const clientId = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID?.trim();
  const redirectUri = process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { ok: false, error: "GOOGLE_BUSINESS_PROFILE_CLIENT_ID and GOOGLE_BUSINESS_PROFILE_REDIRECT_URI are required" },
      { status: 503 },
    );
  }

  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(64).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = new URL(GBP_OAUTH_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GBP_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");

  const response = NextResponse.redirect(url);
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  };
  response.cookies.set("gbp_oauth_state", state, cookieOptions);
  response.cookies.set("gbp_oauth_verifier", verifier, cookieOptions);
  return response;
}
