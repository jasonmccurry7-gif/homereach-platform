import crypto from "crypto";

export type InboundSmsBridgeResult =
  | {
      processed: false;
      reason?: string;
    }
  | {
      processed: true;
      eventId?: string | null;
    };

function timingSafeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function buildInboundSmsWebhookUrl(
  requestUrl: string,
  appUrl?: string,
  canonicalPath = "/api/webhooks/outreach/sms",
): string {
  return appUrl ? `${appUrl}${canonicalPath}` : requestUrl;
}

export function buildTwilioInboundSignature(
  authToken: string,
  url: string,
  params: URLSearchParams,
): string {
  const signedPayload = Array.from(new Set(params.keys()))
    .sort()
    .reduce((payload, key) => `${payload}${key}${params.get(key) ?? ""}`, url);

  return crypto
    .createHmac("sha1", authToken)
    .update(signedPayload)
    .digest("base64");
}

export function validateTwilioInboundSignature({
  authToken,
  nodeEnv,
  signature,
  requestUrl,
  appUrl,
  params,
  canonicalPath,
}: {
  authToken?: string;
  nodeEnv?: string;
  signature?: string | null;
  requestUrl: string;
  appUrl?: string;
  params: URLSearchParams;
  canonicalPath?: string;
}): boolean {
  if (!authToken) return nodeEnv !== "production";
  if (!signature) return false;

  const url = buildInboundSmsWebhookUrl(requestUrl, appUrl, canonicalPath);
  const expected = buildTwilioInboundSignature(authToken, url, params);

  return timingSafeEqual(expected, signature);
}

export function shouldRetryUnmatchedInboundSmsReply({
  bridgeFailed,
  bridgeResult,
}: {
  bridgeFailed: boolean;
  bridgeResult?: InboundSmsBridgeResult | null;
}): boolean {
  if (bridgeFailed) return true;
  return bridgeResult?.processed === true && !bridgeResult.eventId;
}
