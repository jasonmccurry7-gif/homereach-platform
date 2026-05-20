import {
  CANVA_CONNECT_API_BASE_URL,
  CANVA_OAUTH_TOKEN_URL,
  getCanvaAccessToken,
  type CanvaExportType,
} from "./config";

export class CanvaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly details: unknown,
  ) {
    super(message);
    this.name = "CanvaApiError";
  }
}

type CanvaRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  token?: string | null;
};

export type CanvaAutofillFieldValue =
  | string
  | number
  | boolean
  | null
  | { type: "image"; asset_id: string }
  | { type: "table"; rows: Array<Record<string, string | number | boolean | null>> };

export type CanvaAutofillRequest = {
  brand_template_id: string;
  data: Record<string, CanvaAutofillFieldValue>;
  title?: string;
};

export type CanvaExportRequest = {
  design_id: string;
  format: {
    type: CanvaExportType;
    size?: "regular" | "compressed";
    pages?: number[];
  };
};

export type CanvaOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

export class CanvaConnectClient {
  constructor(private readonly token = getCanvaAccessToken()) {}

  private async request<T>(path: string, options: CanvaRequestOptions = {}): Promise<T> {
    const accessToken = getCanvaAccessToken(options.token ?? this.token);
    if (!accessToken) {
      throw new CanvaApiError("Canva access token is not configured", 503, {
        env: "CANVA_ACCESS_TOKEN",
      });
    }

    const response = await fetch(`${CANVA_CONNECT_API_BASE_URL}${path}`, {
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
      throw new CanvaApiError(`Canva API request failed: ${response.status}`, response.status, payload);
    }

    return payload as T;
  }

  listBrandTemplates(limit = 20) {
    return this.request<{ items?: unknown[] }>(`/brand-templates?limit=${limit}`);
  }

  getBrandTemplateDataset(brandTemplateId: string) {
    return this.request<{ dataset?: unknown }>(`/brand-templates/${encodeURIComponent(brandTemplateId)}/dataset`);
  }

  createAutofillJob(request: CanvaAutofillRequest) {
    return this.request<{ job?: unknown; id?: string }>("/autofills", {
      method: "POST",
      body: request,
    });
  }

  getAutofillJob(jobId: string) {
    return this.request<{ job?: unknown }>(`/autofills/${encodeURIComponent(jobId)}`);
  }

  createExportJob(request: CanvaExportRequest) {
    return this.request<{ job?: unknown; id?: string }>("/exports", {
      method: "POST",
      body: request,
    });
  }

  getExportJob(jobId: string) {
    return this.request<{ job?: unknown }>(`/exports/${encodeURIComponent(jobId)}`);
  }

  createFolder(name: string, parentFolderId?: string) {
    return this.request<{ folder?: unknown; id?: string }>("/folders", {
      method: "POST",
      body: parentFolderId ? { name, parent_folder_id: parentFolderId } : { name },
    });
  }
}

export async function exchangeCanvaOAuthCode(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<CanvaOAuthTokenResponse> {
  const clientId = process.env.CANVA_CLIENT_ID?.trim();
  const clientSecret = process.env.CANVA_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new CanvaApiError("Canva OAuth client is not configured", 503, {
      missing: ["CANVA_CLIENT_ID", "CANVA_CLIENT_SECRET"],
    });
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier,
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
  if (!response.ok) {
    throw new CanvaApiError(`Canva OAuth token exchange failed: ${response.status}`, response.status, payload);
  }

  return payload as CanvaOAuthTokenResponse;
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
