const LOCAL_APP_URL = "http://localhost:3000";
const PRODUCTION_APP_URL = "https://home-reach.com";

function normalizeBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, "");
}

function normalizeVercelUrl(value: string | undefined): string | null {
  const normalized = normalizeBaseUrl(value);
  if (!normalized) return null;
  return /^https?:\/\//i.test(normalized) ? normalized : `https://${normalized}`;
}

export function getInternalAppBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ??
    normalizeVercelUrl(process.env.VERCEL_BRANCH_URL) ??
    normalizeVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeVercelUrl(process.env.VERCEL_URL) ??
    LOCAL_APP_URL
  );
}

export function getPublicAppBaseUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(process.env.NEXT_PUBLIC_BASE_URL) ??
    normalizeVercelUrl(process.env.VERCEL_BRANCH_URL) ??
    normalizeVercelUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeVercelUrl(process.env.VERCEL_URL) ??
    PRODUCTION_APP_URL
  );
}
