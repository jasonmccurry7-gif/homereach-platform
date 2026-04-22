// ─────────────────────────────────────────────────────────────────────────────
// HomeReach SEO Engine - Preview Token Helpers
//
// HMAC-SHA256 tokens scoped to (page_id, actor_id) with a 1-hour TTL.
// Allows admins to preview draft pages without publishing them.
//
// If SEO_PREVIEW_TOKEN_SECRET is unset, preview is disabled (safer default).
// ─────────────────────────────────────────────────────────────────────────────

import { createHmac, timingSafeEqual } from "node:crypto";
import { getPreviewSecret } from "./env";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export type PreviewPayload = {
  pageId: string;
  actorId: string;
  expiresAt: number;
};

/** Generates a preview token. Returns null if secret is unset. */
export function generatePreviewToken(pageId: string, actorId: string): string | null {
  const secret = getPreviewSecret();
  if (!secret) return null;
  const expiresAt = Date.now() + TOKEN_TTL_MS;
  const payload: PreviewPayload = { pageId, actorId, expiresAt };
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export type PreviewValidation =
  | { valid: true; pageId: string; actorId: string }
  | { valid: false; reason: string };

/** Validates a preview token against a known page_id. */
export function validatePreviewToken(token: string, expectedPageId: string): PreviewValidation {
  const secret = getPreviewSecret();
  if (!secret) return { valid: false, reason: "preview_disabled" };
  const parts = token.split(".");
  if (parts.length !== 2) return { valid: false, reason: "malformed_token" };
  const [payloadB64, sig] = parts;
  const expectedSig = createHmac("sha256", secret).update(payloadB64).digest("base64url");
  const expectedBuf = Buffer.from(expectedSig);
  const actualBuf = Buffer.from(sig);
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "signature_mismatch" };
  }
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8")) as PreviewPayload;
    if (payload.pageId !== expectedPageId) return { valid: false, reason: "page_id_mismatch" };
    if (Date.now() > payload.expiresAt) return { valid: false, reason: "expired" };
    return { valid: true, pageId: payload.pageId, actorId: payload.actorId };
  } catch {
    return { valid: false, reason: "payload_parse_failed" };
  }
}
