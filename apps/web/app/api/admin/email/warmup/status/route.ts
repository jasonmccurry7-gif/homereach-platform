import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getRampEntry, WARMUP_SEED_EMAILS } from "@/lib/sales-engine/email-warmup-config";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/email/warmup/status
// Returns warm-up state for all active agents: day, sent totals, reply rate,
// current ramp target, and seed list.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function GET() {
  const db = createServiceClient();

  const { data: states } = await db
    .from("email_warmup_state")
    .select(`
      id, agent_id, from_email, warmup_day, total_sent,
      total_replied, reply_rate, is_active, started_at, last_run_at,
      profiles!agent_id ( full_name )
    `)
    .order("started_at", { ascending: false });

  const enriched = (states ?? []).map(s => {
    const ramp = getRampEntry(s.warmup_day);
    return {
      ...s,
      current_daily_target: ramp.dailyTarget,
      current_seed_ratio:   ramp.seedRatio,
      seeds_today:          Math.ceil(ramp.dailyTarget * ramp.seedRatio),
      real_today:           ramp.dailyTarget - Math.ceil(ramp.dailyTarget * ramp.seedRatio),
    };
  });

  return NextResponse.json({
    ok: true,
    seed_list: WARMUP_SEED_EMAILS,
    agents: enriched,
  });
}
