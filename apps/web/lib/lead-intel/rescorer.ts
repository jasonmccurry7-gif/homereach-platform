// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Lead Rescorer (batch)
//
// Pulls active leads + active market signals, scores each lead, writes
// signal_score + signal_tier + signal_score_computed_at back to the row.
//
// Runs per day via scheduled task. Gated by ENABLE_LEAD_INTEL. Safe to run
// multiple times per day (idempotent — always recomputes from current data).
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";
import { getRescoreBatchCap } from "./env";
import { scoreLead, type ActiveSignal, type LeadRow } from "./scorer";

type Supa = ReturnType<typeof createServiceClient>;

export type RescoreSummary = {
  ok: boolean;
  leadsScanned: number;
  leadsUpdated: number;
  tierCounts: { high: number; medium: number; low: number };
  errors: string[];
  durationMs: number;
};

// Status values we skip — closed/archived/lost leads don't need scoring
const SKIP_STATUSES = new Set(["closed", "won", "lost", "archived"]);

export async function rescoreAllLeads(): Promise<RescoreSummary> {
  const t0 = Date.now();
  const supa: Supa = createServiceClient();
  const errors: string[] = [];
  const cap = getRescoreBatchCap();

  // 1) Fetch active market signals once (shared across all leads)
  const nowIso = new Date().toISOString();
  const { data: sigRows, error: sigErr } = await supa
    .from("ci_market_signals")
    .select("category, location, intensity_score, expires_at")
    .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
  if (sigErr) errors.push(`signals: ${sigErr.message}`);
  const signals: ActiveSignal[] = (sigRows ?? []).map((r: any) => ({
    category: r.category,
    location: r.location,
    intensity_score: Number(r.intensity_score ?? 3),
    expires_at: r.expires_at,
  }));

  // 2) Page through leads in batches. Use PostgREST pagination.
  let leadsScanned = 0;
  let leadsUpdated = 0;
  const tierCounts = { high: 0, medium: 0, low: 0 };

  const PAGE_SIZE = 500;
  for (let offset = 0; offset < cap; offset += PAGE_SIZE) {
    const { data, error } = await supa
      .from("leads")
      .select("id, state, category, buying_signal, last_contacted_at, last_reply_at, created_at, status")
      .range(offset, offset + PAGE_SIZE - 1)
      .order("created_at", { ascending: false });
    if (error) {
      errors.push(`page(${offset}): ${error.message}`);
      break;
    }
    if (!data || data.length === 0) break;

    // Score + collect updates
    const updates: Array<{ id: string; signal_score: number; signal_tier: string }> = [];
    for (const row of data as any[]) {
      leadsScanned++;
      if (row.status && SKIP_STATUSES.has(String(row.status).toLowerCase())) continue;
      const r = scoreLead(row as LeadRow, signals);
      updates.push({ id: row.id, signal_score: r.total, signal_tier: r.tier });
      tierCounts[r.tier]++;
    }

    // Apply updates — small batches to keep payloads reasonable
    for (const u of updates) {
      const { error: uErr } = await supa
        .from("leads")
        .update({
          signal_score: u.signal_score,
          signal_tier: u.signal_tier,
          signal_score_computed_at: new Date().toISOString(),
        })
        .eq("id", u.id);
      if (uErr) {
        errors.push(`update(${u.id}): ${uErr.message}`);
      } else {
        leadsUpdated++;
      }
    }

    if (data.length < PAGE_SIZE) break;
  }

  return {
    ok: errors.length === 0,
    leadsScanned,
    leadsUpdated,
    tierCounts,
    errors,
    durationMs: Date.now() - t0,
  };
}
