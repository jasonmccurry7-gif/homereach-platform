import {
  GBP_ACCOUNT_MANAGEMENT_API_BASE_URL,
  GBP_BUSINESS_INFORMATION_API_BASE_URL,
  GBP_MY_BUSINESS_API_BASE_URL,
  GBP_OAUTH_TOKEN_URL,
} from "./config";
import { getStoredGoogleBusinessProfileAccessToken } from "./repository";

export class GoogleBusinessProfileApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "GoogleBusinessProfileApiError";
  }
}

type GoogleBusinessProfileRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export type GoogleBusinessProfileOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export type GoogleBusinessProfileAccount = {
  name: string;
  accountName?: string;
  type?: string;
  role?: string;
};

export type GoogleBusinessProfileLocation = {
  name: string;
  title?: string;
  storeCode?: string;
  websiteUri?: string;
  phoneNumbers?: unknown;
  categories?: unknown;
  storefrontAddress?: unknown;
  metadata?: unknown;
  profile?: unknown;
  regularHours?: unknown;
};

export type GoogleBusinessProfileReview = {
  name: string;
  reviewId?: string;
  reviewer?: { displayName?: string; profilePhotoUrl?: string };
  starRating?: string;
  comment?: string;
  createTime?: string;
  updateTime?: string;
  reviewReply?: { comment?: string; updateTime?: string };
};

export class GoogleBusinessProfileClient {
  constructor(private readonly token?: string | null) {}

  private async accessToken() {
    const accessToken = this.token || await getStoredGoogleBusinessProfileAccessToken();
    if (!accessToken) {
      throw new GoogleBusinessProfileApiError("Google Business Profile is not connected", 503, {
        env: "GOOGLE_BUSINESS_PROFILE OAuth connection",
      });
    }
    return accessToken;
  }

  private async request<T>(baseUrl: string, path: string, options: GoogleBusinessProfileRequestOptions = {}) {
    const accessToken = options.token || await this.accessToken();
    const response = await fetch(`${baseUrl}${path}`, {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });

    const text = await response.text();
    const payload = text ? safeJson(text) : null;
    if (!response.ok) {
      throw new GoogleBusinessProfileApiError(
        `Google Business Profile API request failed: ${response.status}`,
        response.status,
        payload,
      );
    }
    return payload as T;
  }

  listAccounts() {
    return this.request<{ accounts?: GoogleBusinessProfileAccount[] }>(
      GBP_ACCOUNT_MANAGEMENT_API_BASE_URL,
      "/accounts",
    );
  }

  listLocations(accountName: string) {
    const readMask = [
      "name",
      "title",
      "storeCode",
      "phoneNumbers",
      "categories",
      "storefrontAddress",
      "websiteUri",
      "metadata",
      "profile",
      "regularHours",
    ].join(",");
    return this.request<{ locations?: GoogleBusinessProfileLocation[] }>(
      GBP_BUSINESS_INFORMATION_API_BASE_URL,
      `/${encodeURIComponentName(accountName)}/locations?readMask=${encodeURIComponent(readMask)}`,
    );
  }

  listReviews(locationName: string, pageSize = 20) {
    return this.request<{ reviews?: GoogleBusinessProfileReview[] }>(
      GBP_MY_BUSINESS_API_BASE_URL,
      `/${encodeURIComponentName(locationName)}/reviews?pageSize=${pageSize}`,
    );
  }

  listLocalPosts(locationName: string, pageSize = 20) {
    return this.request<{ localPosts?: unknown[] }>(
      GBP_MY_BUSINESS_API_BASE_URL,
      `/${encodeURIComponentName(locationName)}/localPosts?pageSize=${pageSize}`,
    );
  }
}

export async function exchangeGoogleBusinessProfileOAuthCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<GoogleBusinessProfileOAuthTokenResponse> {
  const clientId = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new GoogleBusinessProfileApiError("Google Business Profile OAuth client is not configured", 503, {
      missing: ["GOOGLE_BUSINESS_PROFILE_CLIENT_ID", "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET"],
    });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(GBP_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok) {
    throw new GoogleBusinessProfileApiError(
      `Google Business Profile OAuth token exchange failed: ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as GoogleBusinessProfileOAuthTokenResponse;
}

export async function refreshGoogleBusinessProfileToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;

  const response = await fetch(GBP_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
    cache: "no-store",
  });
  const text = await response.text();
  const payload = text ? safeJson(text) : null;
  if (!response.ok || !payload || typeof payload !== "object" || !("access_token" in payload)) {
    return null;
  }
  return payload as GoogleBusinessProfileOAuthTokenResponse;
}

function encodeURIComponentName(name: string) {
  return name.split("/").map((part) => encodeURIComponent(part)).join("/");
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
