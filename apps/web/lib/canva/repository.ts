import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/security/encrypted-secret";
import { CANVA_OAUTH_TOKEN_URL } from "./config";
import type { CanvaOAuthTokenResponse } from "./client";

type SaveCanvaConnectionArgs = {
  userId: string;
  canvaUserId?: string | null;
  token: CanvaOAuthTokenResponse;
};

export type CanvaStoredConnectionStatus = {
  connected: boolean;
  connectionCount: number;
  designJobCount: number;
  exportJobCount: number;
  lastVerifiedAt: string | null;
  lastUpdatedAt: string | null;
  warning: string | null;
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

export async function getStoredCanvaAccessToken(ownerUserId?: string | null) {
  const encryptionKey = process.env.CANVA_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encryptionKey || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  const supabase = createServiceClient();
  let query = supabase
    .from("canva_connections")
    .select("id, owner_user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, status")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);

  const { data, error } = await query.maybeSingle();
  if (error || !data?.access_token_encrypted) return null;

  const expiresAt = data.token_expires_at ? new Date(data.token_expires_at).getTime() : 0;
  const refreshWindowMs = 5 * 60 * 1000;
  if (!expiresAt || expiresAt > Date.now() + refreshWindowMs) {
    return decryptSecret(data.access_token_encrypted, encryptionKey);
  }

  if (!data.refresh_token_encrypted) return decryptSecret(data.access_token_encrypted, encryptionKey);

  const refreshed = await refreshStoredCanvaToken({
    connectionId: data.id,
    refreshToken: decryptSecret(data.refresh_token_encrypted, encryptionKey),
    encryptionKey,
  });

  return refreshed?.accessToken ?? decryptSecret(data.access_token_encrypted, encryptionKey);
}

export async function loadCanvaStoredConnectionStatus(): Promise<CanvaStoredConnectionStatus> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      connected: false,
      connectionCount: 0,
      designJobCount: 0,
      exportJobCount: 0,
      lastVerifiedAt: null,
      lastUpdatedAt: null,
      warning: "Supabase service credentials are not configured.",
    };
  }

  const supabase = createServiceClient();
  const [connections, designJobs, exportJobs, latest] = await Promise.all([
    countRows("canva_connections", "status", "connected"),
    countRows("canva_design_jobs"),
    countRows("canva_export_jobs"),
    supabase
      .from("canva_connections")
      .select("last_verified_at,updated_at")
      .eq("status", "connected")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    connected: connections.count > 0,
    connectionCount: connections.count,
    designJobCount: designJobs.count,
    exportJobCount: exportJobs.count,
    lastVerifiedAt: typeof latest.data?.last_verified_at === "string" ? latest.data.last_verified_at : null,
    lastUpdatedAt: typeof latest.data?.updated_at === "string" ? latest.data.updated_at : null,
    warning: connections.error || designJobs.error || exportJobs.error || latest.error?.message || null,
  };
}

async function refreshStoredCanvaToken(args: {
  connectionId: string;
  refreshToken: string;
  encryptionKey: string;
}) {
  const clientId = process.env.CANVA_CLIENT_ID?.trim();
  const clientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: args.refreshToken,
  });

  const response = await fetch(CANVA_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok || !payload || typeof payload !== "object" || !("access_token" in payload)) {
    return null;
  }

  const token = payload as CanvaOAuthTokenResponse;
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  const supabase = createServiceClient();

  await supabase
    .from("canva_connections")
    .update({
      access_token_encrypted: encryptSecret(token.access_token, args.encryptionKey),
      refresh_token_encrypted: token.refresh_token
        ? encryptSecret(token.refresh_token, args.encryptionKey)
        : encryptSecret(args.refreshToken, args.encryptionKey),
      token_expires_at: expiresAt,
      scopes: token.scope ? token.scope.split(/\s+/).filter(Boolean) : undefined,
      last_verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.connectionId);

  return { accessToken: token.access_token };
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function countRows(table: string, column?: string, value?: string) {
  const supabase = createServiceClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (column && value) query = query.eq(column, value);
  const { count, error } = await query;
  return { count: error ? 0 : count ?? 0, error: error?.message ?? null };
}
