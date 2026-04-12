"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Growth Intelligence Client
//
// Renders the full growth dashboard:
//  1. Hero metrics (deals today/week/target, city fill, conversations)
//  2. Daily activity log form (5 channels)
//  3. 7-day channel performance table (volume, responses, rate vs benchmark)
//  4. City fill progress bar
//  5. Deal velocity tracker
//  6. Daily report output (copyable)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useMemo, useCallback } from "react";
import type { GrowthActivityLog, GrowthChannel, CHANNEL_BENCHMARKS, GROWTH_TARGETS } from "@homereach/db";

// ── Types ─────────────────────────────────────────────────────────────────────

type BusinessRow = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
};

type CityRow = {
  id: string;
  name: string;
  slug: string;
  activeSpots: number;
  isFilled: boolean;
};

type Props = {
  today:             string;
  activityLogs:      GrowthActivityLog[];
  todayLogs:         GrowthActivityLog[];
  recentBusinesses:  BusinessRow[];
  citiesWithData:    CityRow[];
  filledCities:      number;
  totalCities:       number;
  dealsLast7:        number;
  benchmarks:        typeof CHANNEL_BENCHMARKS;
  targets:           typeof GROWTH_TARGETS;
};

type ChannelFormState = {
  volumeSent:           number;
  adSpendDollars:       number;  // dollars (converted to cents on submit)
  responses:            number;
  conversationsStarted: number;
  dealsClosed:          number;
  notes:                string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

const CHANNELS: GrowthChannel[] = [
  "email",
  "sms",
  "facebook_dm",
  "facebook_post",
  "facebook_ads",
];

const CHANNEL_META: Record<GrowthChannel, { label: string; emoji: string; volumeLabel: string }> = {
  email:          { label: "Email",         emoji: "📧", volumeLabel: "Emails sent"  },
  sms:            { label: "SMS",           emoji: "📱", volumeLabel: "SMS sent"     },
  facebook_dm:    { label: "Facebook DM",   emoji: "💬", volumeLabel: "DMs sent"     },
  facebook_post:  { label: "FB Groups",     emoji: "📢", volumeLabel: "Posts made"   },
  facebook_ads:   { label: "Facebook Ads",  emoji: "📣", volumeLabel: "Ad spend ($)" },
};

function emptyForm(): ChannelFormState {
  return {
    volumeSent: 0,
    adSpendDollars: 0,
    responses: 0,
    conversationsStarted: 0,
    dealsClosed: 0,
    notes: "",
  };
}

function logToForm(log: GrowthActivityLog | undefined): ChannelFormState {
  if (!log) return emptyForm();
  return {
    volumeSent:           log.volumeSent           ?? 0,
    adSpendDollars:       (log.adSpendCents         ?? 0) / 100,
    responses:            log.responses             ?? 0,
    conversationsStarted: log.conversationsStarted  ?? 0,
    dealsClosed:          log.dealsClosed           ?? 0,
    notes:                log.notes                 ?? "",
  };
}

// ── Performance analysis helpers ──────────────────────────────────────────────

function calcResponseRate(log: GrowthActivityLog): number | null {
  if (log.channel === "facebook_ads") return null;
  if (!log.volumeSent || log.volumeSent === 0) return null;
  return log.responses / log.volumeSent;
}

function formatPct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function varianceColor(variance: number): string {
  if (variance >= 0)    return "text-green-400";
  if (variance >= -0.3) return "text-yellow-400";
  return "text-red-400";
}

function varianceBadge(variance: number): string {
  if (variance >= 0.1)  return "↑ Over target";
  if (variance >= -0.1) return "≈ On target";
  if (variance >= -0.3) return "↓ Below target";
  return "⚠ Under-performing";
}

// ── Main component ────────────────────────────────────────────────────────────

export function GrowthClient({
  today,
  activityLogs,
  todayLogs,
  recentBusinesses,
  citiesWithData,
  filledCities,
  totalCities,
  dealsLast7,
  benchmarks,
  targets,
}: Props) {
  // ── Log form state ────────────────────────────────────────────────────────
  const [logDate, setLogDate]   = useState(today);
  const [saveStates, setSaveStates] = useState<Record<GrowthChannel, SaveState>>({
    email: "idle", sms: "idle", facebook_dm: "idle", facebook_post: "idle", facebook_ads: "idle",
  });

  // Initialize form with today's existing logs if available
  const [forms, setForms] = useState<Record<GrowthChannel, ChannelFormState>>(() => {
    const init: Record<GrowthChannel, ChannelFormState> = {
      email: emptyForm(), sms: emptyForm(), facebook_dm: emptyForm(),
      facebook_post: emptyForm(), facebook_ads: emptyForm(),
    };
    for (const log of todayLogs) {
      init[log.channel] = logToForm(log);
    }
    return init;
  });

  const [activeChannel, setActiveChannel] = useState<GrowthChannel>("email");
  const [reportVisible, setReportVisible] = useState(false);
  const [reportCopied,  setReportCopied]  = useState(false);

  // ── Update form field ─────────────────────────────────────────────────────
  const updateField = useCallback(
    (ch: GrowthChannel, field: keyof ChannelFormState, value: number | string) => {
      setForms((prev) => ({
        ...prev,
        [ch]: { ...prev[ch], [field]: value },
      }));
    },
    []
  );

  // ── Save a single channel's log ───────────────────────────────────────────
  const saveChannel = useCallback(
    async (ch: GrowthChannel) => {
      setSaveStates((p) => ({ ...p, [ch]: "saving" }));
      const f = forms[ch];
      try {
        const res = await fetch("/api/admin/growth/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date:                 logDate,
            channel:              ch,
            volumeSent:           ch === "facebook_ads" ? (f.adSpendDollars > 0 ? 1 : 0) : f.volumeSent,
            adSpendCents:         ch === "facebook_ads" ? Math.round(f.adSpendDollars * 100) : 0,
            responses:            f.responses,
            conversationsStarted: f.conversationsStarted,
            dealsClosed:          f.dealsClosed,
            notes:                f.notes || undefined,
          }),
        });
        if (!res.ok) throw new Error("Save failed");
        setSaveStates((p) => ({ ...p, [ch]: "saved" }));
        setTimeout(() => setSaveStates((p) => ({ ...p, [ch]: "idle" })), 2500);
      } catch {
        setSaveStates((p) => ({ ...p, [ch]: "error" }));
        setTimeout(() => setSaveStates((p) => ({ ...p, [ch]: "idle" })), 3000);
      }
    },
    [forms, logDate]
  );

  // ── 7-day performance summary ─────────────────────────────────────────────
  const sevenDayAgo = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  }, [today]);

  const last7Logs = useMemo(
    () => activityLogs.filter((l) => l.date >= sevenDayAgo),
    [activityLogs, sevenDayAgo]
  );

  // Per-channel 7-day totals
  const channelSummary = useMemo(() => {
    return CHANNELS.map((ch) => {
      const logs = last7Logs.filter((l) => l.channel === ch);
      const totalVolume        = logs.reduce((s, l) => s + (l.volumeSent ?? 0),           0);
      const totalAdSpend       = logs.reduce((s, l) => s + (l.adSpendCents ?? 0),         0) / 100;
      const totalResponses     = logs.reduce((s, l) => s + (l.responses ?? 0),            0);
      const totalConversations = logs.reduce((s, l) => s + (l.conversationsStarted ?? 0), 0);
      const totalDeals         = logs.reduce((s, l) => s + (l.dealsClosed ?? 0),          0);
      const activeDays         = logs.length;

      const bm = benchmarks[ch] as Record<string, number>;
      const responseRate = ch === "facebook_ads"
        ? null
        : totalVolume > 0 ? totalResponses / totalVolume : null;

      const expectedRateLow  = ch === "facebook_ads" ? null : bm.responseRateLow;
      const expectedRateHigh = ch === "facebook_ads" ? null : bm.responseRateHigh;
      const expectedRateMid  = (expectedRateLow && expectedRateHigh)
        ? (expectedRateLow + expectedRateHigh) / 2 : null;

      const variance = (responseRate && expectedRateMid)
        ? (responseRate - expectedRateMid) / expectedRateMid : null;

      // Volume variance (volume sent vs target * active days)
      const volumeTarget    = ch === "facebook_ads" ? bm.adSpendTargetCents / 100 * activeDays
                                                     : bm.volumeTarget * activeDays;
      const volumeActual    = ch === "facebook_ads" ? totalAdSpend : totalVolume;
      const volumeVariance  = volumeTarget > 0 ? (volumeActual - volumeTarget) / volumeTarget : null;

      return {
        channel:          ch,
        activeDays,
        totalVolume,
        totalAdSpend,
        totalResponses,
        totalConversations,
        totalDeals,
        responseRate,
        expectedRateLow,
        expectedRateHigh,
        variance,
        volumeTarget,
        volumeActual,
        volumeVariance,
      };
    });
  }, [last7Logs, benchmarks]);

  // ── Today's totals (from form state, updated live) ────────────────────────
  const todayTotals = useMemo(() => {
    let convs = 0, deals = 0;
    for (const ch of CHANNELS) {
      convs += forms[ch].conversationsStarted;
      deals += forms[ch].dealsClosed;
    }
    return { convs, deals };
  }, [forms]);

  // ── Last 7 days deals (from logs + DB) ───────────────────────────────────
  const dealsLast7FromLogs = useMemo(
    () => last7Logs.reduce((s, l) => s + (l.dealsClosed ?? 0), 0),
    [last7Logs]
  );
  const dealsDisplay = Math.max(dealsLast7, dealsLast7FromLogs);

  // ── Daily report generation ───────────────────────────────────────────────
  const report = useMemo(() => {
    const date  = logDate;
    const lines: string[] = [];
    lines.push(`═══════════════════════════════════════════════`);
    lines.push(`  HOMEREACH DAILY GROWTH REPORT — ${date}`);
    lines.push(`═══════════════════════════════════════════════`);
    lines.push(``);
    lines.push(`📊 SUMMARY`);
    lines.push(`───────────────────────────────────────────────`);

    let totalVol = 0, totalResp = 0, totalConv = 0, totalDeals = 0;
    for (const ch of CHANNELS) {
      const f = forms[ch];
      const vol  = ch === "facebook_ads" ? f.adSpendDollars : f.volumeSent;
      totalVol   += vol;
      totalResp  += f.responses;
      totalConv  += f.conversationsStarted;
      totalDeals += f.dealsClosed;
    }

    lines.push(`  Total Activity:       ${totalVol} (across all channels)`);
    lines.push(`  Conversations:        ${totalConv} / target: ${targets.conversationsPerDayLow}–${targets.conversationsPerDayHigh}`);
    lines.push(`  Deals Closed:         ${totalDeals} / target: ${targets.dealsPerDayLow}–${targets.dealsPerDayHigh}`);
    lines.push(`  Cities Filled:        ${filledCities} / target: ${targets.citiesTarget}`);
    lines.push(``);
    lines.push(`📣 CHANNEL BREAKDOWN`);
    lines.push(`───────────────────────────────────────────────`);

    for (const ch of CHANNELS) {
      const f  = forms[ch];
      const bm = benchmarks[ch] as Record<string, number>;
      const meta = CHANNEL_META[ch];
      const vol  = ch === "facebook_ads" ? `$${f.adSpendDollars}` : String(f.volumeSent);
      const rate = (ch !== "facebook_ads" && f.volumeSent > 0)
        ? ` (${((f.responses / f.volumeSent) * 100).toFixed(1)}%)`
        : "";
      const expected = ch === "facebook_ads"
        ? `target: $${(bm.adSpendTargetCents ?? 5000) / 100}/day`
        : `target: ${(bm.responseRateLow * 100).toFixed(0)}–${(bm.responseRateHigh * 100).toFixed(0)}%`;
      lines.push(`  ${meta.emoji} ${meta.label}`);
      lines.push(`     Sent: ${vol}  |  Responses: ${f.responses}${rate}  |  ${expected}`);
      if (f.conversationsStarted > 0) lines.push(`     Conversations: ${f.conversationsStarted}`);
      if (f.dealsClosed > 0)          lines.push(`     ✅ Deals closed: ${f.dealsClosed}`);
      if (f.notes)                    lines.push(`     Notes: ${f.notes}`);
    }

    lines.push(``);
    lines.push(`🔍 PERFORMANCE vs BENCHMARKS (7-day)`);
    lines.push(`───────────────────────────────────────────────`);
    for (const s of channelSummary) {
      const meta = CHANNEL_META[s.channel];
      const rateStr = s.responseRate !== null ? `${(s.responseRate * 100).toFixed(1)}%` : "N/A";
      const varStr  = s.variance !== null
        ? `${s.variance >= 0 ? "+" : ""}${(s.variance * 100).toFixed(0)}%`
        : "N/A";
      const badge = s.variance !== null ? varianceBadge(s.variance) : "";
      lines.push(`  ${meta.emoji} ${meta.label}: response rate ${rateStr} (variance: ${varStr}) ${badge}`);
    }

    lines.push(``);
    lines.push(`🎯 REQUIRED ADJUSTMENTS FOR TOMORROW`);
    lines.push(`───────────────────────────────────────────────`);

    let adjustmentCount = 0;
    for (const s of channelSummary) {
      const meta = CHANNEL_META[s.channel];
      if (s.volumeVariance !== null && s.volumeVariance < -0.2) {
        const bm = benchmarks[s.channel] as Record<string, number>;
        const target = s.channel === "facebook_ads"
          ? `$${(bm.adSpendTargetCents ?? 5000) / 100}/day`
          : `${bm.volumeTarget}/day`;
        lines.push(`  → ${meta.label}: increase volume to ${target} (currently running below target)`);
        adjustmentCount++;
      }
      if (s.responseRate !== null && (s.responseRate < (benchmarks[s.channel] as Record<string, number>).responseRateLow)) {
        lines.push(`  → ${meta.label}: response rate below floor — review messaging/targeting`);
        adjustmentCount++;
      }
    }

    if (totalConv < targets.conversationsPerDayLow) {
      lines.push(`  → Total conversations (${totalConv}) below minimum target (${targets.conversationsPerDayLow}) — increase all channel volumes`);
      adjustmentCount++;
    }
    if (totalDeals < targets.dealsPerDayLow) {
      lines.push(`  → Deals closed (${totalDeals}) below daily target (${targets.dealsPerDayLow}) — focus on follow-up with active conversations`);
      adjustmentCount++;
    }
    if (adjustmentCount === 0) {
      lines.push(`  ✅ All channels at or above target. Maintain current strategy.`);
    }

    lines.push(``);
    lines.push(`🏙️  CITY FILL PROGRESS: ${filledCities}/${targets.citiesTarget} cities`);
    const progressPct = Math.round((filledCities / targets.citiesTarget) * 100);
    const bar = "█".repeat(Math.round(progressPct / 5)) + "░".repeat(20 - Math.round(progressPct / 5));
    lines.push(`  [${bar}] ${progressPct}%`);

    lines.push(``);
    lines.push(`═══════════════════════════════════════════════`);
    lines.push(`  Generated by HomeReach Growth Intelligence`);
    lines.push(`═══════════════════════════════════════════════`);

    return lines.join("\n");
  }, [forms, channelSummary, logDate, filledCities, targets, benchmarks]);

  const copyReport = useCallback(async () => {
    await navigator.clipboard.writeText(report);
    setReportCopied(true);
    setTimeout(() => setReportCopied(false), 2000);
  }, [report]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Growth Intelligence</h1>
          <p className="text-sm text-gray-400 mt-1">
            Target: {targets.dealsPerDayLow}–{targets.dealsPerDayHigh} deals/day · {targets.citiesTarget} cities in {targets.cityFillWeeks} weeks
          </p>
        </div>
        <button
          onClick={() => setReportVisible((v) => !v)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {reportVisible ? "Hide Report" : "📋 Daily Report"}
        </button>
      </div>

      {/* ── Hero metrics ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroCard
          label="Deals Today"
          value={String(todayTotals.deals)}
          target={`${targets.dealsPerDayLow}–${targets.dealsPerDayHigh}`}
          isGood={todayTotals.deals >= targets.dealsPerDayLow}
          emoji="💰"
        />
        <HeroCard
          label="Deals (7 days)"
          value={String(dealsDisplay)}
          target={`${targets.dealsPerDayLow * 7}–${targets.dealsPerDayHigh * 7}`}
          isGood={dealsDisplay >= targets.dealsPerDayLow * 7}
          emoji="📈"
        />
        <HeroCard
          label="Convos Today"
          value={String(todayTotals.convs)}
          target={`${targets.conversationsPerDayLow}–${targets.conversationsPerDayHigh}`}
          isGood={todayTotals.convs >= targets.conversationsPerDayLow}
          emoji="💬"
        />
        <HeroCard
          label="Cities Filled"
          value={String(filledCities)}
          target={String(targets.citiesTarget)}
          isGood={filledCities >= targets.citiesTarget}
          emoji="🏙️"
          subValue={`${Math.round((filledCities / targets.citiesTarget) * 100)}%`}
        />
      </div>

      {/* ── Daily log form ────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">📝 Log Today's Activity</h2>
          <input
            type="date"
            value={logDate}
            onChange={(e) => setLogDate(e.target.value)}
            className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Channel tabs */}
        <div className="flex gap-1 mb-6 flex-wrap">
          {CHANNELS.map((ch) => {
            const meta  = CHANNEL_META[ch];
            const saved = saveStates[ch];
            const hasData = forms[ch].volumeSent > 0 || forms[ch].adSpendDollars > 0 || forms[ch].responses > 0;
            return (
              <button
                key={ch}
                onClick={() => setActiveChannel(ch)}
                className={[
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  activeChannel === ch
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white",
                  saved === "saved" ? "ring-1 ring-green-500" : "",
                ].join(" ")}
              >
                <span>{meta.emoji}</span>
                <span>{meta.label}</span>
                {hasData && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 ml-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Active channel form */}
        {CHANNELS.map((ch) => {
          if (ch !== activeChannel) return null;
          const f    = forms[ch];
          const meta = CHANNEL_META[ch];
          const bm   = benchmarks[ch] as Record<string, number>;
          const ss   = saveStates[ch];

          return (
            <div key={ch} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Volume / Ad spend */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">{meta.volumeLabel}</label>
                  <input
                    type="number"
                    min={0}
                    value={ch === "facebook_ads" ? f.adSpendDollars : f.volumeSent}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateField(ch, ch === "facebook_ads" ? "adSpendDollars" : "volumeSent", v);
                    }}
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={ch === "facebook_ads"
                      ? `$${(bm.adSpendTargetCents ?? 5000) / 100}`
                      : String(bm.volumeTarget ?? 0)}
                  />
                  <span className="text-[10px] text-gray-600">
                    Target: {ch === "facebook_ads"
                      ? `$${(bm.adSpendTargetCents ?? 5000) / 100}/day`
                      : `${bm.volumeTarget}/day`}
                  </span>
                </div>

                {/* Responses / Leads */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">
                    {ch === "facebook_post" || ch === "facebook_ads" ? "Leads" : "Replies"}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={f.responses}
                    onChange={(e) => updateField(ch, "responses", Number(e.target.value))}
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-600">
                    {ch === "facebook_ads"
                      ? `Target: ${bm.leadsPerDayLow ?? 3}–${bm.leadsPerDayHigh ?? 10}/day`
                      : ch === "facebook_post"
                      ? `Target: ${bm.leadsLow ?? 5}–${bm.leadsHigh ?? 15}/day`
                      : `Target rate: ${(bm.responseRateLow * 100).toFixed(0)}–${(bm.responseRateHigh * 100).toFixed(0)}%`}
                  </span>
                </div>

                {/* Response rate (display only) */}
                {ch !== "facebook_ads" && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-gray-400">Response Rate</label>
                    <div className="bg-gray-800 text-sm border border-gray-700 rounded-lg px-3 py-2 text-center">
                      {f.volumeSent > 0
                        ? (
                          <span className={
                            (f.responses / f.volumeSent) >= bm.responseRateLow
                              ? "text-green-400 font-semibold"
                              : "text-red-400 font-semibold"
                          }>
                            {((f.responses / f.volumeSent) * 100).toFixed(1)}%
                          </span>
                        )
                        : <span className="text-gray-600">—</span>
                      }
                    </div>
                    <span className="text-[10px] text-gray-600">
                      Floor: {(bm.responseRateLow * 100).toFixed(0)}%
                    </span>
                  </div>
                )}

                {/* Conversations */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Convos Started</label>
                  <input
                    type="number"
                    min={0}
                    value={f.conversationsStarted}
                    onChange={(e) => updateField(ch, "conversationsStarted", Number(e.target.value))}
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-600">Qualified leads</span>
                </div>

                {/* Deals closed */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Deals Closed</label>
                  <input
                    type="number"
                    min={0}
                    value={f.dealsClosed}
                    onChange={(e) => updateField(ch, "dealsClosed", Number(e.target.value))}
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-[10px] text-gray-600">Attributed to this channel</span>
                </div>

                {/* Notes */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400">Notes</label>
                  <input
                    type="text"
                    value={f.notes}
                    onChange={(e) => updateField(ch, "notes", e.target.value)}
                    placeholder="optional..."
                    className="bg-gray-800 text-white text-sm border border-gray-700 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Save button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveChannel(ch)}
                  disabled={ss === "saving"}
                  className={[
                    "px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                    ss === "saving" ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                    : ss === "saved"  ? "bg-green-600 text-white"
                    : ss === "error"  ? "bg-red-600 text-white"
                    : "bg-blue-600 hover:bg-blue-500 text-white",
                  ].join(" ")}
                >
                  {ss === "saving" ? "Saving…"
                  : ss === "saved"  ? "✓ Saved"
                  : ss === "error"  ? "Error — Retry"
                  : `Save ${meta.label} Log`}
                </button>
                <span className="text-xs text-gray-500">
                  Saves for {logDate} · Overwrites any previous entry for this channel/day
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── 7-day channel performance table ──────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">📊 7-Day Channel Performance</h2>
          <p className="text-xs text-gray-500 mt-0.5">Expected vs actual response rates · Variance from benchmark mid-point</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-500 uppercase tracking-wider">
                <th className="px-6 py-3 text-left">Channel</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">Target Vol</th>
                <th className="px-4 py-3 text-right">Responses</th>
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-right">Expected</th>
                <th className="px-4 py-3 text-right">Variance</th>
                <th className="px-4 py-3 text-right">Convos</th>
                <th className="px-4 py-3 text-right">Deals</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {channelSummary.map((s) => {
                const meta  = CHANNEL_META[s.channel];
                const bm    = benchmarks[s.channel] as Record<string, number>;
                const rateStr = s.responseRate !== null ? formatPct(s.responseRate) : "N/A";
                const expStr  = s.responseRate !== null
                  ? `${formatPct(bm.responseRateLow)}–${formatPct(bm.responseRateHigh)}`
                  : (s.channel === "facebook_ads" ? `${bm.leadsPerDayLow ?? 3}–${bm.leadsPerDayHigh ?? 10} leads/day` : "N/A");
                const varStr  = s.variance !== null
                  ? `${s.variance >= 0 ? "+" : ""}${(s.variance * 100).toFixed(0)}%`
                  : "—";
                const volDisplay = s.channel === "facebook_ads"
                  ? `$${s.totalAdSpend.toFixed(0)}`
                  : String(s.totalVolume);
                const volTargetDisplay = s.channel === "facebook_ads"
                  ? `$${(s.volumeTarget).toFixed(0)}`
                  : String(Math.round(s.volumeTarget));
                const volVarianceBad = s.volumeVariance !== null && s.volumeVariance < -0.2;

                return (
                  <tr key={s.channel} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-3 text-white font-medium">
                      <span className="mr-1.5">{meta.emoji}</span>{meta.label}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${volVarianceBad ? "text-red-400" : "text-gray-300"}`}>
                      {volDisplay}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-500">
                      {volTargetDisplay}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {s.totalResponses}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-white">
                      {s.activeDays === 0 ? <span className="text-gray-600">No data</span> : rateStr}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 text-xs">
                      {expStr}
                    </td>
                    <td className={`px-4 py-3 text-right font-mono font-semibold ${
                      s.activeDays === 0 ? "text-gray-600"
                      : s.variance === null ? "text-gray-600"
                      : varianceColor(s.variance)
                    }`}>
                      {s.activeDays === 0 ? "—" : varStr}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-300">
                      {s.totalConversations}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-green-400">
                      {s.totalDeals > 0 ? s.totalDeals : <span className="text-gray-600">0</span>}
                    </td>
                    <td className="px-6 py-3">
                      {s.activeDays === 0 ? (
                        <span className="text-xs text-gray-600">No activity logged</span>
                      ) : s.variance !== null ? (
                        <span className={`text-xs ${varianceColor(s.variance)}`}>
                          {varianceBadge(s.variance)}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">{s.totalResponses} leads in 7 days</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── City fill progress ────────────────────────────────────────────── */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">🏙️ City Fill Progress</h2>
          <span className="text-sm text-gray-400">
            {filledCities} / {targets.citiesTarget} cities · {totalCities} total
          </span>
        </div>

        {/* Overall progress bar */}
        <div className="mb-5">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>Progress toward {targets.citiesTarget}-city goal</span>
            <span className="font-semibold text-white">
              {Math.round((filledCities / targets.citiesTarget) * 100)}%
            </span>
          </div>
          <div className="h-3 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (filledCities / targets.citiesTarget) * 100)}%`,
                background: filledCities >= targets.citiesTarget
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : filledCities >= targets.citiesTarget * 0.5
                  ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                  : "linear-gradient(90deg, #3b82f6, #60a5fa)",
              }}
            />
          </div>
        </div>

        {/* City grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {citiesWithData.map((c) => (
            <div
              key={c.id}
              className={[
                "rounded-lg px-3 py-2 text-xs font-medium border transition-colors",
                c.isFilled
                  ? "bg-green-900/40 border-green-700 text-green-300"
                  : "bg-gray-800 border-gray-700 text-gray-400",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                <span>{c.isFilled ? "✅" : "⭕"}</span>
                <span className="truncate">{c.name}</span>
              </div>
              {c.activeSpots > 0 && (
                <div className="text-[10px] text-gray-500 mt-0.5">{c.activeSpots} spot{c.activeSpots !== 1 ? "s" : ""}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Recent deals from DB ──────────────────────────────────────────── */}
      {recentBusinesses.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4">
            💰 Recent Businesses (last 30 days)
          </h2>
          <div className="space-y-2">
            {recentBusinesses.slice(0, 10).map((b) => (
              <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <span className="text-white text-sm font-medium">{b.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={[
                    "text-xs px-2 py-0.5 rounded-full",
                    b.status === "active"  ? "bg-green-900 text-green-400"
                    : b.status === "pending" ? "bg-yellow-900 text-yellow-400"
                    : "bg-gray-800 text-gray-400",
                  ].join(" ")}>
                    {b.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(b.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Daily report ──────────────────────────────────────────────────── */}
      {reportVisible && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-white">📋 Daily Report</h2>
            <button
              onClick={copyReport}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors"
            >
              {reportCopied ? "✓ Copied!" : "Copy to clipboard"}
            </button>
          </div>
          <pre className="font-mono text-xs text-gray-300 bg-gray-950 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {report}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function HeroCard({
  label, value, target, isGood, emoji, subValue,
}: {
  label: string;
  value: string;
  target: string;
  isGood: boolean;
  emoji: string;
  subValue?: string;
}) {
  return (
    <div className={[
      "rounded-xl border p-4 flex flex-col gap-1",
      isGood ? "bg-green-900/20 border-green-800" : "bg-gray-900 border-gray-800",
    ].join(" ")}>
      <div className="flex items-center gap-1.5 text-xs text-gray-500">
        <span>{emoji}</span>
        <span>{label}</span>
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold ${isGood ? "text-green-400" : "text-white"}`}>
          {value}
        </span>
        {subValue && <span className="text-sm text-gray-400 mb-0.5">{subValue}</span>}
      </div>
      <div className="text-xs text-gray-600">target: {target}</div>
    </div>
  );
}
