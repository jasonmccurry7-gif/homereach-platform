export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.toLowerCase().startsWith("bearer ")) return null;
  return authHeader.slice("bearer ".length).trim() || null;
}

export function extractRequestSecret(req: Request): string | null {
  return req.headers.get("x-cron-secret")?.trim() || extractBearerToken(req);
}

export function requestSecretMatches(req: Request, expected?: string): boolean {
  if (!expected) return false;
  return extractRequestSecret(req) === expected;
}
