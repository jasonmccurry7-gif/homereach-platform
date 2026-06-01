export type GoogleBusinessProfileMode =
  | "not_configured"
  | "oauth_ready"
  | "connected";

export const GBP_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GBP_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GBP_SCOPE = "https://www.googleapis.com/auth/business.manage";
export const GBP_ACCOUNT_MANAGEMENT_API_BASE_URL = "https://mybusinessaccountmanagement.googleapis.com/v1";
export const GBP_BUSINESS_INFORMATION_API_BASE_URL = "https://mybusinessbusinessinformation.googleapis.com/v1";
export const GBP_MY_BUSINESS_API_BASE_URL = "https://mybusiness.googleapis.com/v4";

export type GoogleBusinessProfileConfigStatus = {
  mode: GoogleBusinessProfileMode;
  missingRequired: string[];
  oauthRedirectUri: string | null;
  scope: string;
  publishingEnabled: boolean;
  safety: {
    reviewReplyMode: "draft_only" | "approval_required";
    postPublishMode: "draft_only" | "approval_required";
    listingUpdateMode: "draft_only" | "approval_required";
  };
  nextActions: string[];
};

export function getGoogleBusinessProfileConfigStatus(args?: { connected?: boolean }): GoogleBusinessProfileConfigStatus {
  const required = [
    "GOOGLE_BUSINESS_PROFILE_CLIENT_ID",
    "GOOGLE_BUSINESS_PROFILE_CLIENT_SECRET",
    "GOOGLE_BUSINESS_PROFILE_REDIRECT_URI",
  ];
  const missingRequired = required.filter((key) => !process.env[key]?.trim());
  const connected = Boolean(args?.connected);
  const mode: GoogleBusinessProfileMode = connected
    ? "connected"
    : missingRequired.length === 0
      ? "oauth_ready"
      : "not_configured";

  const publishingEnabled = process.env.GOOGLE_BUSINESS_PROFILE_ENABLE_PUBLISHING?.replace(/^\uFEFF/, "").trim() === "true";
  return {
    mode,
    missingRequired,
    oauthRedirectUri: process.env.GOOGLE_BUSINESS_PROFILE_REDIRECT_URI?.trim() || null,
    scope: GBP_SCOPE,
    publishingEnabled,
    safety: {
      reviewReplyMode: "approval_required",
      postPublishMode: publishingEnabled ? "approval_required" : "draft_only",
      listingUpdateMode: "draft_only",
    },
    nextActions: buildNextActions(mode, missingRequired, publishingEnabled),
  };
}

function buildNextActions(mode: GoogleBusinessProfileMode, missingRequired: string[], publishingEnabled: boolean) {
  if (mode === "not_configured") {
    return [
      `Add Google OAuth credentials in Vercel: ${missingRequired.join(", ")}.`,
      "Enable the Business Profile APIs in the approved Google Cloud project.",
      "Connect a Google account that manages the business profiles.",
    ];
  }

  if (mode === "oauth_ready") {
    return [
      "Connect a Google account from the admin Local Visibility dashboard.",
      "Run the first read-only account, location, and review sync.",
      "Keep public replies, posts, and listing changes approval-only.",
    ];
  }

  return [
    "Run read-only sync to refresh accounts, locations, and reviews.",
    publishingEnabled
      ? "Publishing remains approval-gated. Do not post replies or GBP updates without human approval."
      : "Publishing is disabled. Continue using draft-only GBP posts and review replies.",
  ];
}
