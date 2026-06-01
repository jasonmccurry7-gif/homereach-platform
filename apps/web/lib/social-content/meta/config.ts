import "server-only";

export const DEFAULT_META_GRAPH_API_VERSION = "v24.0";

export const DEFAULT_META_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_manage_metadata",
  "instagram_basic",
  "instagram_content_publish",
];

export type MetaPublishingConfigStatus = {
  connectedPublishingEnabled: boolean;
  autoPublishingEnabled: boolean;
  appConfigured: boolean;
  encryptionConfigured: boolean;
  graphApiVersion: string;
  publishingMode: string;
  warnings: string[];
};

export function boolEnv(name: string) {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export function getMetaGraphApiVersion() {
  return process.env.META_GRAPH_API_VERSION?.trim() || DEFAULT_META_GRAPH_API_VERSION;
}

export function getMetaGraphBaseUrl() {
  return `https://graph.facebook.com/${getMetaGraphApiVersion()}`;
}

export function getMetaOAuthAuthorizeUrl() {
  return `https://www.facebook.com/${getMetaGraphApiVersion()}/dialog/oauth`;
}

export function getMetaOAuthScopes() {
  const configured = process.env.META_OAUTH_SCOPES?.trim();
  if (!configured) return DEFAULT_META_OAUTH_SCOPES;
  return configured
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export function getMetaRedirectUri(reqUrl?: string) {
  const configured = process.env.META_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (!reqUrl) return null;
  return new URL("/api/social-content/meta/oauth/callback", reqUrl).toString();
}

export function loadMetaPublishingConfigStatus(): MetaPublishingConfigStatus {
  const warnings: string[] = [];
  const appConfigured = Boolean(
    process.env.META_APP_ID?.trim() &&
      process.env.META_APP_SECRET?.trim() &&
      process.env.META_REDIRECT_URI?.trim(),
  );
  const encryptionConfigured = Boolean(process.env.META_TOKEN_ENCRYPTION_KEY?.trim());
  const connectedPublishingEnabled = boolEnv("ENABLE_META_CONNECTED_PUBLISHING");
  const autoPublishingEnabled = boolEnv("ENABLE_META_AUTO_PUBLISHING");
  const publishingMode = process.env.SOCIAL_PUBLISHING_MODE?.trim() || "review_only";

  if (!connectedPublishingEnabled) warnings.push("ENABLE_META_CONNECTED_PUBLISHING is not enabled.");
  if (!autoPublishingEnabled) warnings.push("ENABLE_META_AUTO_PUBLISHING is not enabled.");
  if (!appConfigured) warnings.push("META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI are required for OAuth.");
  if (!encryptionConfigured) warnings.push("META_TOKEN_ENCRYPTION_KEY is required to persist OAuth tokens.");
  if (publishingMode !== "live") warnings.push("SOCIAL_PUBLISHING_MODE must be live before external publishing.");

  return {
    connectedPublishingEnabled,
    autoPublishingEnabled,
    appConfigured,
    encryptionConfigured,
    graphApiVersion: getMetaGraphApiVersion(),
    publishingMode,
    warnings,
  };
}

export function requireMetaOAuthConfig(reqUrl?: string) {
  const appId = process.env.META_APP_ID?.trim();
  const appSecret = process.env.META_APP_SECRET?.trim();
  const redirectUri = getMetaRedirectUri(reqUrl);

  if (!appId || !appSecret || !redirectUri) {
    throw new Error("META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI are required.");
  }

  return { appId, appSecret, redirectUri };
}

export function requireMetaTokenEncryptionKey() {
  const key = process.env.META_TOKEN_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("META_TOKEN_ENCRYPTION_KEY is required.");
  return key;
}
