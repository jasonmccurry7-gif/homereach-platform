import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { CanvaApiError, exchangeCanvaOAuthCode } from "@/lib/canva/client";
import { saveCanvaConnection } from "@/lib/canva/repository";

export async function GET(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get("canva_oauth_state")?.value;
  const verifier = cookieStore.get("canva_oauth_verifier")?.value;
  const redirectUri = process.env.CANVA_REDIRECT_URI?.trim();
  const userId = guard.user?.id;

  if (!code || !state || !expectedState || state !== expectedState || !verifier || !redirectUri || !userId) {
    return NextResponse.redirect(new URL("/admin/canva?connected=0&reason=oauth_state", req.url));
  }

  try {
    const token = await exchangeCanvaOAuthCode({ code, codeVerifier: verifier, redirectUri });
    const saveResult = await saveCanvaConnection({ userId, token });
    const response = NextResponse.redirect(
      new URL(`/admin/canva?connected=1&stored=${saveResult.stored ? "1" : "0"}`, req.url),
    );
    response.cookies.delete("canva_oauth_state");
    response.cookies.delete("canva_oauth_verifier");
    return response;
  } catch (error) {
    const reason = error instanceof CanvaApiError ? `canva_${error.status}` : "callback_error";
    return NextResponse.redirect(new URL(`/admin/canva?connected=0&reason=${reason}`, req.url));
  }
}
