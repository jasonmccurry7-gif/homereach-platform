import { createHash, createCipheriv, randomBytes } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { CanvaOAuthTokenResponse } from "./client";

type SaveCanvaConnectionArgs = {
  userId: string;
  canvaUserId?: string | null;
  token: CanvaOAuthTokenResponse;
};

export async function saveCanvaConnection(args: SaveCanvaConnectionArgs) {
  const encryptionKey = process.env.CANVA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    return {
      stored: false,
      reason: "CANVA_TOKEN_ENCRYPTION_KEY is not configured, so OAuth tokens were not persisted.",
    };
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      stored: false,
      reason: "Supabase service credentials are not configured, so OAuth tokens were not persisted.",
    };
  }

  const supabase = createServiceClient();
  const expiresAt = args.token.expires_in
    ? new Date(Date.now() + args.token.expires_in * 1000).toISOString()
    : null;

  const payload = {
    owner_user_id: args.userId,
    canva_user_id: args.canvaUserId,
    access_token_encrypted: encryptSecret(args.token.access_token, encryptionKey),
    refresh_token_encrypted: args.token.refresh_token
      ? encryptSecret(args.token.refresh_token, encryptionKey)
      : null,
    token_expires_at: expiresAt,
    scopes: args.token.scope ? args.token.scope.split(/\s+/).filter(Boolean) : [],
    status: "connected",
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("canva_connections")
    .upsert(payload, { onConflict: "owner_user_id" });

  if (error) {
    return {
      stored: false,
      reason: `Supabase canva_connections write failed: ${error.message}`,
    };
  }

  return { stored: true, reason: "Canva OAuth tokens persisted with server-side encryption." };
}

function encryptSecret(value: string, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", normalizeKey(key), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function normalizeKey(key: string) {
  return createHash("sha256").update(key).digest();
}
