import { createHmac, timingSafeEqual } from "crypto";

type SignatureValidationInput = {
  rawBody: string;
  signature: string | null;
  appSecret?: string;
  nodeEnv?: string;
};

type VerifyTokenInput = {
  primary?: string;
  legacy?: string;
  nodeEnv?: string;
};

type SignatureValidationResult =
  | { ok: true; skipped: boolean }
  | { ok: false; status: 401 | 503; error: string };

const DEV_VERIFY_TOKEN = "homereach-fb-verify";
const SHA256_HEX = /^[a-f0-9]{64}$/i;

export function buildFacebookWebhookSignature(
  rawBody: string,
  appSecret: string
): string {
  const hash = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  return `sha256=${hash}`;
}

export function resolveFacebookWebhookVerifyToken({
  primary,
  legacy,
  nodeEnv = process.env.NODE_ENV,
}: VerifyTokenInput): string | null {
  const configured = primary?.trim() || legacy?.trim();
  if (configured) return configured;

  return nodeEnv === "production" ? null : DEV_VERIFY_TOKEN;
}

export function validateFacebookWebhookSignature({
  rawBody,
  signature,
  appSecret,
  nodeEnv = process.env.NODE_ENV,
}: SignatureValidationInput): SignatureValidationResult {
  const secret = appSecret?.trim();

  if (!secret) {
    if (nodeEnv === "production") {
      return {
        ok: false,
        status: 503,
        error: "Facebook app secret not configured",
      };
    }

    return { ok: true, skipped: true };
  }

  if (!signature) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  const [algorithm, hash, extra] = signature.split("=");
  const providedHash = hash ?? "";
  if (
    extra !== undefined ||
    algorithm !== "sha256" ||
    !SHA256_HEX.test(providedHash)
  ) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  const expected = buildFacebookWebhookSignature(rawBody, secret).slice(
    "sha256=".length
  );
  const providedBuffer = Buffer.from(providedHash, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return { ok: false, status: 401, error: "Invalid signature" };
  }

  return { ok: true, skipped: false };
}
