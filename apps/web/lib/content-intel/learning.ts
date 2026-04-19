// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Learning / Weight Update Loop
//
// Called by the feedback endpoint after every win/neutral/fail outcome.
// Updates ci_theme_performance_memory and ci_trusted_channels trust, and
// writes an audit row to ci_weight_deltas.
//
// Wins boost the theme + channel weight. Failures dampen them. Neutral is a
// no-op (but still recorded).
// ─────────────────────────────────────────────────────────────────────────────

import { createServiceClient } from "@/lib/supabase/service";

type Supa = ReturnType<typeof createServiceClient>;

const WIN_THEME_DELTA     = 0.15;
const FAIL_THEME_DELTA    = -0.10;
const WIN_CHANNEL_DELTA   = 0.05;
const FAIL_CHANNEL_DELTA  = -0.05;

export async function applyOutcome(args: {
  eventId: string;
  itemType: "action" | "script" | "offer" | "automation" | "enhancement" | "insight";
  itemId: string;
  outcome: "win" | "neutral" | "failed" | "pending";
  supa?: Supa;
}): Promise<void> {
  if (args.outcome === "pending" || args.outcome === "neutral") return;
  const supa = args.supa ?? createServiceClient();

  // Resolve the parent insight + source video to derive theme & channel.
  const { data: origin } = await resolveOrigin(supa, args.itemType, args.itemId);
  if (!origin) return;

  const delta = args.outcome === "win" ? WIN_THEME_DELTA : FAIL_THEME_DELTA;
  const chDelta = args.outcome === "win" ? WIN_CHANNEL_DELTA : FAIL_CHANNEL_DELTA;

  // 1) Theme memory
  if (origin.theme && origin.category) {
    await upsertThemeMemory(supa, origin.category, origin.theme, args.outcome, delta);
    await supa.from("ci_weight_deltas").insert({
      target_type: "theme",
      target_key: `${origin.category}::${origin.theme}`,
      delta,
      reason: `${args.outcome} on ${args.itemType}`,
      source_event_id: args.eventId,
    });
  }

  // 2) Channel trust
  if (origin.channel_name) {
    await supa.rpc("ci_bump_channel_trust", {
      p_name: origin.channel_name,
      p_delta: chDelta,
    }).then(() => void 0).catch(async () => {
      // Fallback if the RPC doesn't exist: read-modify-write
      const { data } = await supa
        .from("ci_trusted_channels")
        .select("id, trust_score")
        .ilike("channel_name", origin.channel_name!)
        .maybeSingle();
      if (data) {
        const next = clamp((data as any).trust_score + chDelta, 1, 5);
        await supa.from("ci_trusted_channels")
          .update({ trust_score: Math.round(next) })
          .eq("id", (data as any).id);
      }
    });
    await supa.from("ci_weight_deltas").insert({
      target_type: "channel",
      target_key: origin.channel_name,
      delta: chDelta,
      reason: `${args.outcome} on ${args.itemType}`,
      source_event_id: args.eventId,
    });
  }

  // 3) Promote winning patterns
  if (args.outcome === "win" && origin.insight_text && origin.category) {
    const pattern = origin.theme || origin.insight_text.slice(0, 120);
    await supa.from("ci_patterns").upsert(
      {
        category: origin.category,
        pattern,
        source_count: 1,
        win_count: 1,
        weight: 1.0,
        last_win_at: new Date().toISOString(),
      },
      { onConflict: "category,pattern", ignoreDuplicates: false },
    );
  }
}

async function resolveOrigin(
  supa: Supa,
  itemType: string,
  itemId: string,
): Promise<{ data: { theme?: string; category?: string; channel_name?: string; insight_text?: string } | null }> {
  let insightId: string | null = null;
  if (itemType === "insight") {
    insightId = itemId;
  } else {
    const table = `ci_${itemType}s`; // actions, scripts, offers, automations, enhancements
    const { data } = await supa.from(table).select("insight_id").eq("id", itemId).maybeSingle();
    insightId = (data as any)?.insight_id ?? null;
  }
  if (!insightId) return { data: null };
  const { data: ins } = await supa
    .from("ci_insights")
    .select("theme, category, insight_text, source_video_id")
    .eq("id", insightId)
    .maybeSingle();
  if (!ins) return { data: null };
  let channel_name: string | undefined;
  if ((ins as any).source_video_id) {
    const { data: q } = await supa
      .from("ci_ingestion_queue")
      .select("channel_name")
      .eq("video_id", (ins as any).source_video_id)
      .maybeSingle();
    channel_name = (q as any)?.channel_name;
  }
  return {
    data: {
      theme: (ins as any).theme,
      category: (ins as any).category,
      insight_text: (ins as any).insight_text,
      channel_name,
    },
  };
}

async function upsertThemeMemory(
  supa: Supa,
  category: string,
  theme: string,
  outcome: "win" | "failed",
  delta: number,
) {
  const { data: existing } = await supa
    .from("ci_theme_performance_memory")
    .select("id, usage_count, win_count, fail_count, weight, avg_apex_score")
    .eq("category", category)
    .eq("theme", theme)
    .maybeSingle();

  if (!existing) {
    await supa.from("ci_theme_performance_memory").insert({
      category,
      theme,
      usage_count: 1,
      win_count: outcome === "win" ? 1 : 0,
      fail_count: outcome === "failed" ? 1 : 0,
      weight: clamp(1.0 + delta, 0.1, 5.0),
      last_seen_at: new Date().toISOString(),
    });
    return;
  }
  await supa
    .from("ci_theme_performance_memory")
    .update({
      usage_count: (existing as any).usage_count + 1,
      win_count: (existing as any).win_count + (outcome === "win" ? 1 : 0),
      fail_count: (existing as any).fail_count + (outcome === "failed" ? 1 : 0),
      weight: clamp(Number((existing as any).weight) + delta, 0.1, 5.0),
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", (existing as any).id);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
