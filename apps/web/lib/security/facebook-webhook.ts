import { createHmac, timingSafeEqual } from "node:crypto";

const SHA256_HEX_RE = /^[a-f0-9]{64}$/i;

export function getFacebookVerifyToken(): string | null {
  const token =
    process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN ??
    process.env.FACEBOOK_VERIFY_TOKEN ??
    null;

  return token && token.trim() ? token.trim() : null;
}

export function getFacebookAppSecret(): string | null {
  const secret = process.env.FACEBOOK_APP_SECRET ?? null;
  return secret && secret.trim() ? secret.trim() : null;
}

export function verifyFacebookSignature(
  rawBody: string,
  signatureHeader: string | null,
): { ok: true } | { ok: false; reason: string; status: number } {
  const appSecret = getFacebookAppSecret();
  if (!appSecret) {
    return { ok: false, reason: "FACEBOOK_APP_SECRET is not configured.", status: 503 };
  }

  if (!signatureHeader) {
    return { ok: false, reason: "Missing x-hub-signature-256.", status: 401 };
  }

  const [algorithm, signature] = signatureHeader.split("=");
  if (algorithm !== "sha256" || !signature || !SHA256_HEX_RE.test(signature)) {
    return { ok: false, reason: "Invalid signature format.", status: 401 };
  }

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  if (signatureBuffer.length !== expectedBuffer.length) {
    return { ok: false, reason: "Invalid signature.", status: 401 };
  }

  if (!timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return { ok: false, reason: "Invalid signature.", status: 401 };
  }

  return { ok: true };
}
