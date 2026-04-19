// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Transcript Fetcher (Supadata-compatible)
//
// We hit a transcript API (defaults to Supadata v1) with the YouTube video id.
// The request is abstracted so you can swap providers by changing
// CONTENT_INTEL_TRANSCRIPT_BASE without touching pipeline code.
//
// Returns `null` when no transcript is available — the pipeline treats that
// as a hard skip (require_transcript=true in ci_ingestion_rules).
// ─────────────────────────────────────────────────────────────────────────────

import { getTranscriptKey } from "./env";

export type TranscriptResult = {
  text: string;
  source: string; // "supadata" | ...
  durationSec?: number;
};

const BASE = process.env.CONTENT_INTEL_TRANSCRIPT_BASE || "https://api.supadata.ai/v1";

export async function fetchTranscript(videoId: string): Promise<TranscriptResult | null> {
  const key = getTranscriptKey();
  const url = `${BASE}/youtube/transcript?videoId=${encodeURIComponent(videoId)}&text=true`;
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-api-key": key },
      cache: "no-store",
    });
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    // Don't throw — the pipeline should proceed with other videos.
    console.warn(`[content-intel] transcript ${videoId} → ${res.status}`);
    return null;
  }
  const json = (await res.json().catch(() => null)) as any;
  if (!json) return null;

  // Support two common shapes: {content: "..."} or {transcript: [{text, ...}]}
  let text = "";
  if (typeof json.content === "string") {
    text = json.content;
  } else if (Array.isArray(json.transcript)) {
    text = json.transcript
      .map((seg: any) => String(seg?.text ?? ""))
      .filter(Boolean)
      .join(" ");
  } else if (typeof json.text === "string") {
    text = json.text;
  }

  text = text.trim();
  if (!text) return null;

  return {
    text,
    source: "supadata",
    durationSec: typeof json.duration === "number" ? json.duration : undefined,
  };
}
