const PRODUCTION_APP_URL = "https://home-reach.com";

type EnvLike = Record<string, string | undefined>;

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

export function getStripePublicAppBaseUrl(env: EnvLike = process.env): string {
  return (
    normalizeBaseUrl(env.NEXT_PUBLIC_APP_URL) ??
    normalizeBaseUrl(env.NEXT_PUBLIC_SITE_URL) ??
    normalizeBaseUrl(env.NEXT_PUBLIC_BASE_URL) ??
    normalizeVercelUrl(env.VERCEL_BRANCH_URL) ??
    normalizeVercelUrl(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    normalizeVercelUrl(env.VERCEL_URL) ??
    PRODUCTION_APP_URL
  );
}
