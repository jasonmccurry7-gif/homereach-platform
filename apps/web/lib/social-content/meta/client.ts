import "server-only";

import { getMetaGraphBaseUrl } from "./config";

type UnknownRecord = Record<string, unknown>;

export type MetaOAuthTokenResponse = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
};

export type MetaUser = {
  id: string;
  name?: string;
};

export type MetaPage = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
  } | null;
  tasks?: string[];
};

export type MetaPublishResult = {
  externalPostId: string;
  externalUrl: string | null;
  raw: UnknownRecord;
};

export class MetaGraphApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "MetaGraphApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function exchangeMetaOAuthCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  if (!appId || !appSecret) throw new Error("META_APP_ID and META_APP_SECRET are required.");
  const shortLived = await graphGet<MetaOAuthTokenResponse>("/oauth/access_token", {
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: redirectUri,
    code,
  });

  const longLived = await graphGet<MetaOAuthTokenResponse>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.access_token,
  });

  return longLived.access_token ? longLived : shortLived;
}

export async function fetchMetaUser(accessToken: string): Promise<MetaUser> {
  return graphGet<MetaUser>("/me", {
    fields: "id,name",
    access_token: accessToken,
  });
}

export async function fetchMetaPages(accessToken: string): Promise<MetaPage[]> {
  const payload = await graphGet<{ data?: MetaPage[] }>("/me/accounts", {
    fields: "id,name,access_token,instagram_business_account{id,username},tasks",
    access_token: accessToken,
  });

  return Array.isArray(payload.data) ? payload.data : [];
}

export async function publishMetaFacebookPagePost({
  pageId,
  pageAccessToken,
  message,
  mediaUrls,
  linkUrl,
}: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  mediaUrls: string[];
  linkUrl?: string | null;
}): Promise<MetaPublishResult> {
  const firstImage = mediaUrls.find(Boolean);
  if (firstImage) {
    const raw = await graphPost<UnknownRecord>(`/${pageId}/photos`, {
      access_token: pageAccessToken,
      url: firstImage,
      caption: message,
      published: "true",
    });
    const externalPostId = String(raw.post_id ?? raw.id ?? "");
    if (!externalPostId) throw new MetaGraphApiError("Meta did not return a Facebook post id.", 502, raw);
    return {
      externalPostId,
      externalUrl: `https://www.facebook.com/${externalPostId}`,
      raw,
    };
  }

  const raw = await graphPost<UnknownRecord>(`/${pageId}/feed`, {
    access_token: pageAccessToken,
    message,
    ...(linkUrl ? { link: linkUrl } : {}),
  });
  const externalPostId = String(raw.id ?? "");
  if (!externalPostId) throw new MetaGraphApiError("Meta did not return a Facebook post id.", 502, raw);
  return {
    externalPostId,
    externalUrl: `https://www.facebook.com/${externalPostId}`,
    raw,
  };
}

export async function publishMetaInstagramImagePost({
  instagramBusinessAccountId,
  pageAccessToken,
  caption,
  mediaUrls,
}: {
  instagramBusinessAccountId: string;
  pageAccessToken: string;
  caption: string;
  mediaUrls: string[];
}): Promise<MetaPublishResult> {
  const firstImage = mediaUrls.find(Boolean);
  if (!firstImage) {
    throw new MetaGraphApiError("Instagram publishing requires an approved image URL.", 400, {
      reason: "missing_image_url",
    });
  }

  const container = await graphPost<UnknownRecord>(`/${instagramBusinessAccountId}/media`, {
    access_token: pageAccessToken,
    image_url: firstImage,
    caption,
  });
  const creationId = String(container.id ?? "");
  if (!creationId) throw new MetaGraphApiError("Meta did not return an Instagram media container id.", 502, container);

  const raw = await graphPost<UnknownRecord>(`/${instagramBusinessAccountId}/media_publish`, {
    access_token: pageAccessToken,
    creation_id: creationId,
  });
  const externalPostId = String(raw.id ?? "");
  if (!externalPostId) throw new MetaGraphApiError("Meta did not return an Instagram media id.", 502, raw);

  const permalink = await fetchInstagramPermalink(externalPostId, pageAccessToken);
  return {
    externalPostId,
    externalUrl: permalink,
    raw: {
      media_container: scrubMetaResponse(container),
      media_publish: scrubMetaResponse(raw),
      permalink,
    },
  };
}

async function fetchInstagramPermalink(mediaId: string, pageAccessToken: string) {
  try {
    const payload = await graphGet<{ permalink?: string }>(`/${mediaId}`, {
      fields: "permalink",
      access_token: pageAccessToken,
    });
    return payload.permalink ?? null;
  } catch {
    return null;
  }
}

async function graphGet<T>(path: string, params: Record<string, string>) {
  const url = graphUrl(path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return graphFetch<T>(url, { method: "GET" });
}

async function graphPost<T>(path: string, body: Record<string, string>) {
  return graphFetch<T>(graphUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

async function graphFetch<T>(url: URL, init: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;

  if (!response.ok) {
    throw new MetaGraphApiError(metaErrorMessage(payload, response.status), response.status, scrubMetaResponse(payload));
  }

  return (payload ?? {}) as T;
}

function graphUrl(path: string) {
  const base = getMetaGraphBaseUrl();
  return new URL(path.startsWith("/") ? `${base}${path}` : `${base}/${path}`);
}

function metaErrorMessage(payload: unknown, status: number) {
  if (payload && typeof payload === "object") {
    const error = (payload as { error?: { message?: unknown; type?: unknown; code?: unknown } }).error;
    if (error?.message) return `Meta Graph API ${status}: ${String(error.message)}`;
  }
  return `Meta Graph API request failed with status ${status}.`;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function scrubMetaResponse(payload: unknown): UnknownRecord {
  if (!payload || typeof payload !== "object") return {};
  return JSON.parse(
    JSON.stringify(payload, (key, value) => {
      if (key.toLowerCase().includes("token")) return "[redacted]";
      return value;
    }),
  ) as UnknownRecord;
}
