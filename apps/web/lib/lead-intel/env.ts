// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Lead Intelligence Feature Flag + Config
//
// Reuses CONTENT_INTEL_CRON_SECRET so you don't have to juggle a second secret.
// Flag-off = all routes 404, no scoring run, no UI.
// ─────────────────────────────────────────────────────────────────────────────

export function isLeadIntelEnabled(): boolean {
  return process.env.ENABLE_LEAD_INTEL === "true";
}

export function getCronSecret(): string | null {
  return process.env.CONTENT_INTEL_CRON_SECRET || null;
}

/** Cap on leads to rescore per batch run — stays under Vercel's 300s. */
export function getRescoreBatchCap(): number {
  const raw = process.env.LEAD_INTEL_BATCH_CAP;
  const n = raw ? parseInt(raw, 10) : 5000;
  return Number.isFinite(n) && n > 0 ? n : 5000;
}
