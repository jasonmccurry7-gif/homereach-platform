const LOCAL_APP_URL = "http://localhost:3000";
const PRODUCTION_APP_URL = "https://home-reach.com";

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

export function getInternalAppBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ??
    LOCAL_APP_URL
  );
}

export function getPublicAppBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ??
    PRODUCTION_APP_URL
  );
}
