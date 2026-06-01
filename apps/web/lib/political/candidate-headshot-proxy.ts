const LOCAL_POLITICAL_HEADSHOT_PREFIX = "/api/political/candidate-headshot";

export function politicalCandidateHeadshotProxyUrl(sourceUrl: string, candidateName?: string): string {
  if (!sourceUrl || sourceUrl.startsWith("/") || sourceUrl.startsWith("data:")) return sourceUrl;
  const params = new URLSearchParams({ src: sourceUrl });
  if (candidateName?.trim()) params.set("name", candidateName.trim());
  return `${LOCAL_POLITICAL_HEADSHOT_PREFIX}?${params.toString()}`;
}
