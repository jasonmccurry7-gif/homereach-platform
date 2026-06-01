import { createServiceClient } from "@/lib/supabase/service";
import { decryptSecret, encryptSecret } from "@/lib/security/encrypted-secret";
import {
  GoogleBusinessProfileClient,
  refreshGoogleBusinessProfileToken,
  type GoogleBusinessProfileLocation,
  type GoogleBusinessProfileOAuthTokenResponse,
  type GoogleBusinessProfileReview,
} from "./client";
import { getGoogleBusinessProfileConfigStatus } from "./config";

type SaveConnectionArgs = {
  userId: string;
  token: GoogleBusinessProfileOAuthTokenResponse;
};

type ConnectionRow = {
  id: string;
  owner_user_id: string;
  access_token_encrypted: string | null;
  refresh_token_encrypted: string | null;
  token_expires_at: string | null;
  scopes: string[] | null;
  status: string;
};

export type GoogleBusinessProfileIntegrationStatus = ReturnType<typeof getGoogleBusinessProfileConfigStatus> & {
  connected: boolean;
  connectionCount: number;
  locationCount: number;
  reviewCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
};

export async function saveGoogleBusinessProfileConnection(args: SaveConnectionArgs) {
  const encryptionKey = process.env.GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    return {
      stored: false,
      reason: "GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY is not configured, so OAuth tokens were not persisted.",
    };
  }
  if (!hasSupabaseServiceEnv()) {
    return {
      stored: false,
      reason: "Supabase service credentials are not configured, so OAuth tokens were not persisted.",
    };
  }

  const supabase = createServiceClient();
  const expiresAt = args.token.expires_in
    ? new Date(Date.now() + args.token.expires_in * 1000).toISOString()
    : null;

  const { error } = await supabase
    .from("google_business_profile_connections")
    .upsert(
      {
        owner_user_id: args.userId,
        access_token_encrypted: encryptSecret(args.token.access_token, encryptionKey),
        refresh_token_encrypted: args.token.refresh_token
          ? encryptSecret(args.token.refresh_token, encryptionKey)
          : null,
        token_expires_at: expiresAt,
        scopes: args.token.scope ? args.token.scope.split(/\s+/).filter(Boolean) : [],
        status: "connected",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_user_id" },
    );

  if (error) {
    return {
      stored: false,
      reason: `Supabase google_business_profile_connections write failed: ${error.message}`,
    };
  }

  return { stored: true, reason: "Google Business Profile OAuth tokens persisted with server-side encryption." };
}

export async function getStoredGoogleBusinessProfileAccessToken(ownerUserId?: string | null) {
  const encryptionKey = process.env.GOOGLE_BUSINESS_PROFILE_TOKEN_ENCRYPTION_KEY?.trim();
  if (!encryptionKey || !hasSupabaseServiceEnv()) return null;

  const supabase = createServiceClient();
  let query = supabase
    .from("google_business_profile_connections")
    .select("id, owner_user_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, status")
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (ownerUserId) query = query.eq("owner_user_id", ownerUserId);

  const { data, error } = await query.maybeSingle();
  const row = data as ConnectionRow | null;
  if (error || !row?.access_token_encrypted) return null;

  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  const refreshWindowMs = 5 * 60 * 1000;
  if (!expiresAt || expiresAt > Date.now() + refreshWindowMs) {
    return decryptSecret(row.access_token_encrypted, encryptionKey);
  }

  if (!row.refresh_token_encrypted) return decryptSecret(row.access_token_encrypted, encryptionKey);
  const refreshed = await refreshStoredGoogleBusinessProfileToken({
    connectionId: row.id,
    encryptionKey,
    refreshToken: decryptSecret(row.refresh_token_encrypted, encryptionKey),
  });
  return refreshed?.accessToken ?? decryptSecret(row.access_token_encrypted, encryptionKey);
}

export async function loadGoogleBusinessProfileIntegrationStatus(): Promise<GoogleBusinessProfileIntegrationStatus> {
  if (!hasSupabaseServiceEnv()) {
    return {
      ...getGoogleBusinessProfileConfigStatus(),
      connected: false,
      connectionCount: 0,
      locationCount: 0,
      reviewCount: 0,
      lastSyncAt: null,
      lastError: "Supabase service credentials are not configured.",
    };
  }

  const supabase = createServiceClient();
  const [connections, locations, reviews, lastLog] = await Promise.all([
    countRows("google_business_profile_connections", "status", "connected"),
    countRows("local_visibility_google_locations"),
    countRows("local_visibility_reviews", "source", "google"),
    supabase
      .from("local_visibility_google_sync_logs")
      .select("created_at,status,error_message")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const connected = connections.count > 0;
  return {
    ...getGoogleBusinessProfileConfigStatus({ connected }),
    connected,
    connectionCount: connections.count,
    locationCount: locations.count,
    reviewCount: reviews.count,
    lastSyncAt: typeof lastLog.data?.created_at === "string" ? lastLog.data.created_at : null,
    lastError: typeof lastLog.data?.error_message === "string" ? lastLog.data.error_message : null,
  };
}

export async function syncGoogleBusinessProfileReadOnly() {
  const supabase = createServiceClient();
  const log = await createSyncLog("running");

  try {
    const client = new GoogleBusinessProfileClient();
    const accountPayload = await client.listAccounts();
    const accounts = accountPayload.accounts ?? [];
    let locationCount = 0;
    let reviewCount = 0;

    for (const account of accounts) {
      if (!account.name) continue;
      const locationPayload = await client.listLocations(account.name);
      const locations = locationPayload.locations ?? [];
      locationCount += locations.length;

      for (const location of locations) {
        await upsertLocation(supabase, account.name, location);
        const reviewPayload = await client.listReviews(location.name, 20).catch(() => ({ reviews: [] }));
        const reviews = reviewPayload.reviews ?? [];
        reviewCount += reviews.length;
        for (const review of reviews) {
          await upsertReview(supabase, account.name, location.name, review);
        }
      }
    }

    await supabase
      .from("local_visibility_google_sync_logs")
      .update({
        status: "synced",
        finished_at: new Date().toISOString(),
        accounts_count: accounts.length,
        locations_count: locationCount,
        reviews_count: reviewCount,
        metadata: { mode: "read_only" },
      })
      .eq("id", log.id);

    return { ok: true, accounts: accounts.length, locations: locationCount, reviews: reviewCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Business Profile sync failed";
    await supabase
      .from("local_visibility_google_sync_logs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", log.id);
    return { ok: false, error: message };
  }
}

async function refreshStoredGoogleBusinessProfileToken(args: {
  connectionId: string;
  refreshToken: string;
  encryptionKey: string;
}) {
  const token = await refreshGoogleBusinessProfileToken(args.refreshToken);
  if (!token?.access_token) return null;

  const supabase = createServiceClient();
  const expiresAt = token.expires_in
    ? new Date(Date.now() + token.expires_in * 1000).toISOString()
    : null;
  await supabase
    .from("google_business_profile_connections")
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

async function upsertLocation(
  supabase: ReturnType<typeof createServiceClient>,
  accountName: string,
  location: GoogleBusinessProfileLocation,
) {
  if (!location.name) return;
  await supabase
    .from("local_visibility_google_locations")
    .upsert(
      {
        google_account_name: accountName,
        google_location_name: location.name,
        location_title: location.title ?? null,
        store_code: location.storeCode ?? null,
        website_uri: location.websiteUri ?? null,
        phone_numbers: location.phoneNumbers ?? null,
        categories: location.categories ?? null,
        storefront_address: location.storefrontAddress ?? null,
        metadata: {
          googleMetadata: location.metadata ?? null,
          profile: location.profile ?? null,
          regularHours: location.regularHours ?? null,
        },
        status: "active",
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "google_location_name" },
    );
}

async function upsertReview(
  supabase: ReturnType<typeof createServiceClient>,
  accountName: string,
  locationName: string,
  review: GoogleBusinessProfileReview,
) {
  const externalReviewId = review.reviewId || review.name;
  if (!externalReviewId) return;
  await supabase
    .from("local_visibility_reviews")
    .upsert(
      {
        source: "google",
        external_review_id: externalReviewId,
        reviewer_name: review.reviewer?.displayName ?? null,
        rating: ratingToNumber(review.starRating),
        review_text: review.comment ?? null,
        review_created_at: review.createTime ?? null,
        response_status: review.reviewReply?.comment ? "posted" : "needs_review",
        approved_response: review.reviewReply?.comment ?? null,
        posted_at: review.reviewReply?.updateTime ?? null,
        sentiment: inferSentiment(review.starRating),
        metadata: {
          googleReviewName: review.name,
          googleAccountName: accountName,
          googleLocationName: locationName,
          importedFrom: "google_business_profile_read_only_sync",
          replyUpdateTime: review.reviewReply?.updateTime ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "source,external_review_id" },
    );
}

async function createSyncLog(status: "running" | "synced" | "failed") {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("local_visibility_google_sync_logs")
    .insert({ status, sync_type: "read_only" })
    .select("id")
    .single();

  if (error || !data?.id) throw new Error(error?.message ?? "Unable to create Google Business Profile sync log.");
  return { id: data.id as string };
}

async function countRows(table: string, column?: string, value?: string) {
  const supabase = createServiceClient();
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (column && value) query = query.eq(column, value);
  const { count, error } = await query;
  return { count: error ? 0 : count ?? 0, error: error?.message ?? null };
}

function ratingToNumber(starRating: string | undefined) {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  };
  return starRating ? map[starRating] ?? null : null;
}

function inferSentiment(starRating: string | undefined) {
  const rating = ratingToNumber(starRating);
  if (!rating) return null;
  if (rating >= 4) return "positive";
  if (rating <= 2) return "negative";
  return "neutral";
}

function hasSupabaseServiceEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
