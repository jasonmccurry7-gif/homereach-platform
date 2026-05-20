// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — YouTube Data API v3 Client (search + metadata only)
//
// No transcript logic here (see transcripts.ts). No external SDK — uses fetch.
// Respects CONTENT_INTEL_DAILY_CAP at the caller level; this module is
// stateless.
// ─────────────────────────────────────────────────────────────────────────────

import { getYoutubeKey } from "./env";

export type YTVideoCandidate = {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelName: string;
  publishedAt: string; // ISO
};

const BASE = "https://www.googleapis.com/youtube/v3";

export async function searchYouTube(opts: {
  query: string;
  publishedAfter?: string; // ISO
  maxResults?: number;     // default 10
  channelId?: string;      // optional: constrain to a specific channel
}): Promise<YTVideoCandidate[]> {
  const key = getYoutubeKey();
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: opts.query,
    maxResults: String(opts.maxResults ?? 10),
    order: "relevance",
    key,
  });
  if (opts.publishedAfter) params.set("publishedAfter", opts.publishedAfter);
  if (opts.channelId) params.set("channelId", opts.channelId);

  const res = await fetch(`${BASE}/search?${params.toString()}`, {
    // Run on the edge? No — this is called from the cron handler which is node runtime.
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`[youtube] search ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as any;
  const items = Array.isArray(json.items) ? json.items : [];
  return items
    .filter((i: any) => i?.id?.videoId && i?.snippet)
    .map((i: any) => ({
      videoId: i.id.videoId,
      title: String(i.snippet.title || "").slice(0, 500),
      description: String(i.snippet.description || "").slice(0, 4000),
      channelId: String(i.snippet.channelId || ""),
      channelName: String(i.snippet.channelTitle || ""),
      publishedAt: String(i.snippet.publishedAt || ""),
    }));
}

/** Resolve a YouTube handle like "@DanMartell" → channelId. */
export async function resolveChannelId(handle: string): Promise<string | null> {
  const key = getYoutubeKey();
  const q = handle.startsWith("@") ? handle.slice(1) : handle;
  const params = new URLSearchParams({
    part: "snippet",
    type: "channel",
    q,
    maxResults: "1",
    key,
  });
  const res = await fetch(`${BASE}/search?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const first = json?.items?.[0];
  return first?.id?.channelId || first?.snippet?.channelId || null;
}
