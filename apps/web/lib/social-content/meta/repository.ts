import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/security/encrypted-secret";
import { requireMetaTokenEncryptionKey } from "./config";
import type { MetaOAuthTokenResponse, MetaPage, MetaUser } from "./client";

export type SocialMetaConnectionSummary = {
  id: string;
  ownerUserId: string | null;
  clientId: string | null;
  clientEmail: string | null;
  businessName: string | null;
  provider: "meta";
  metaUserId: string | null;
  metaUserName: string | null;
  pageId: string | null;
  pageName: string | null;
  instagramBusinessAccountId: string | null;
  instagramUsername: string | null;
  tokenExpiresAt: string | null;
  scopes: string[];
  status: string;
  lastVerifiedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
};

type SaveMetaConnectionsArgs = {
  ownerUserId: string;
  clientId?: string | null;
  clientEmail?: string | null;
  businessName?: string | null;
  metaUser: MetaUser;
  token: MetaOAuthTokenResponse;
  pages: MetaPage[];
  scopes: string[];
};

type MetaConnectionRow = {
  id: string;
  owner_user_id: string | null;
  client_id: string | null;
  client_email: string | null;
  business_name: string | null;
  provider: "meta";
  meta_user_id: string | null;
  meta_user_name: string | null;
  page_id: string | null;
  page_name: string | null;
  page_access_token_encrypted?: string | null;
  user_access_token_encrypted?: string | null;
  instagram_business_account_id: string | null;
  instagram_username: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
  last_verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export async function saveMetaConnectionsFromOAuth(args: SaveMetaConnectionsArgs) {
  const encryptionKey = requireMetaTokenEncryptionKey();
  const db = createServiceClient();
  const expiresAt = args.token.expires_in
    ? new Date(Date.now() + args.token.expires_in * 1000).toISOString()
    : null;
  const userAccessTokenEncrypted = encryptSecret(args.token.access_token, encryptionKey);
  const savedIds: string[] = [];
  const errors: string[] = [];

  for (const page of args.pages) {
    if (!page.id || !page.access_token) {
      errors.push(`Skipped ${page.name ?? page.id ?? "unknown page"} because Meta did not return a page access token.`);
      continue;
    }

    const payload = {
      owner_user_id: args.ownerUserId,
      client_id: args.clientId ?? args.ownerUserId,
      client_email: args.clientEmail ?? null,
      business_name: args.businessName ?? page.name ?? null,
      provider: "meta",
      connection_type: "facebook_login",
      meta_user_id: args.metaUser.id,
      meta_user_name: args.metaUser.name ?? null,
      page_id: page.id,
      page_name: page.name ?? null,
      page_access_token_encrypted: encryptSecret(page.access_token, encryptionKey),
      user_access_token_encrypted: userAccessTokenEncrypted,
      instagram_business_account_id: page.instagram_business_account?.id ?? null,
      instagram_username: page.instagram_business_account?.username ?? null,
      token_expires_at: expiresAt,
      scopes: args.scopes,
      status: "connected",
      last_verified_at: new Date().toISOString(),
      last_error: null,
      metadata: {
        page_tasks: page.tasks ?? [],
        source: "meta_oauth",
      },
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db
      .from("social_meta_connections")
      .upsert(payload, { onConflict: "provider,page_id" })
      .select("id")
      .single();

    if (error) {
      errors.push(`${page.name ?? page.id}: ${error.message}`);
    } else if (data?.id) {
      savedIds.push(String(data.id));
    }
  }

  return {
    stored: savedIds.length > 0,
    savedIds,
    pageCount: args.pages.length,
    savedCount: savedIds.length,
    errors,
  };
}

export async function listMetaConnectionsForUser({
  userId,
  role,
  limit = 50,
}: {
  userId: string;
  role?: string | null;
  limit?: number;
}): Promise<{ connections: SocialMetaConnectionSummary[]; warning: string | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { connections: [], warning: "Supabase service credentials are not configured." };
  }

  const db = createServiceClient();
  let query = db
    .from("social_meta_connections")
    .select(
      [
        "id",
        "owner_user_id",
        "client_id",
        "client_email",
        "business_name",
        "provider",
        "meta_user_id",
        "meta_user_name",
        "page_id",
        "page_name",
        "instagram_business_account_id",
        "instagram_username",
        "token_expires_at",
        "scopes",
        "status",
        "last_verified_at",
        "last_error",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (role !== "admin") {
    query = query.or(`owner_user_id.eq.${userId},client_id.eq.${userId}`);
  }

  const { data, error } = await query;
  if (error) return { connections: [], warning: error.message };
  return {
    connections: ((data ?? []) as unknown as MetaConnectionRow[]).map(toSummary),
    warning: null,
  };
}

export async function getMetaConnectionForPublishing(connectionId: string) {
  const encryptionKey = requireMetaTokenEncryptionKey();
  const db = createServiceClient();
  const { data, error } = await db
    .from("social_meta_connections")
    .select(
      [
        "id",
        "owner_user_id",
        "client_id",
        "client_email",
        "business_name",
        "provider",
        "meta_user_id",
        "meta_user_name",
        "page_id",
        "page_name",
        "page_access_token_encrypted",
        "user_access_token_encrypted",
        "instagram_business_account_id",
        "instagram_username",
        "token_expires_at",
        "scopes",
        "status",
        "last_verified_at",
        "last_error",
        "created_at",
        "updated_at",
      ].join(","),
    )
    .eq("id", connectionId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Meta connection was not found.");
  const row = data as unknown as MetaConnectionRow;
  if (row.status !== "connected") throw new Error("Meta connection is not connected.");
  if (!row.page_access_token_encrypted) throw new Error("Meta page access token is missing.");

  return {
    ...toSummary(row),
    pageAccessToken: decryptSecret(row.page_access_token_encrypted, encryptionKey),
    userAccessToken: row.user_access_token_encrypted
      ? decryptSecret(row.user_access_token_encrypted, encryptionKey)
      : null,
  };
}

export async function recordMetaConnectionError(connectionId: string, errorMessage: string) {
  const db = createServiceClient();
  await db
    .from("social_meta_connections")
    .update({
      status: "error",
      last_error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);
}

function toSummary(row: MetaConnectionRow): SocialMetaConnectionSummary {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id,
    clientId: row.client_id,
    clientEmail: row.client_email,
    businessName: row.business_name,
    provider: "meta",
    metaUserId: row.meta_user_id,
    metaUserName: row.meta_user_name,
    pageId: row.page_id,
    pageName: row.page_name,
    instagramBusinessAccountId: row.instagram_business_account_id,
    instagramUsername: row.instagram_username,
    tokenExpiresAt: row.token_expires_at,
    scopes: row.scopes ?? [],
    status: row.status,
    lastVerifiedAt: row.last_verified_at,
    lastError: row.last_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
