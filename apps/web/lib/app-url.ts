function normalizeUrl(candidate: string | null | undefined): string | null {
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

export function resolveInternalAppUrl(defaultValue = "http://localhost:3000"): string {
  const candidates = [
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate);
    if (normalized) return normalized;
  }

  return defaultValue;
}

export function resolveEnvAlias(...keys: string[]): string | null {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return null;
}
