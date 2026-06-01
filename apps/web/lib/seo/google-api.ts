import { createSign } from "node:crypto";

type GoogleCredentials = {
  clientEmail: string;
  privateKey: string;
};

export function getGoogleCredentials(): GoogleCredentials | null {
  const rawJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    const parsed = parseCredentialJson(rawJson);
    if (parsed) return parsed;
  }

  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ||
    process.env.GOOGLE_SEARCH_CONSOLE_CLIENT_EMAIL ||
    process.env.GA4_CLIENT_EMAIL ||
    "";
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ||
    process.env.GOOGLE_SEARCH_CONSOLE_PRIVATE_KEY ||
    process.env.GA4_PRIVATE_KEY ||
    "";

  if (!clientEmail || !privateKey) return null;
  return {
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

export async function getGoogleAccessToken(scope: string) {
  const credentials = getGoogleCredentials();
  if (!credentials) {
    throw new Error("Missing Google service account credentials.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const assertion = signJwt(
    {
      alg: "RS256",
      typ: "JWT",
    },
    {
      iss: credentials.clientEmail,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSeconds + 3600,
      iat: nowSeconds,
    },
    credentials.privateKey,
  );

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  const payload = (await response.json()) as { access_token?: string; error?: string; error_description?: string };

  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Google token request failed.");
  }

  return payload.access_token;
}

function parseCredentialJson(raw: string): GoogleCredentials | null {
  try {
    const decoded = raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  } catch {
    return null;
  }
}

function normalizePrivateKey(key: string) {
  return key.replace(/\\n/g, "\n");
}

function signJwt(header: Record<string, unknown>, claimSet: Record<string, unknown>, privateKey: string) {
  const encodedHeader = base64Url(JSON.stringify(header));
  const encodedClaimSet = base64Url(JSON.stringify(claimSet));
  const unsigned = `${encodedHeader}.${encodedClaimSet}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey);
  return `${unsigned}.${base64Url(signature)}`;
}

function base64Url(input: string | Buffer) {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}
