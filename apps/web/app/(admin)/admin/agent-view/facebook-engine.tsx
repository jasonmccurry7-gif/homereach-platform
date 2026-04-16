"use client";

import { useState, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Performance Engine
//
// ADDITIVE ONLY — does NOT modify any existing Facebook DM / Group Post
// workflows. This is a new performance coaching + tracking layer inserted
// into the agent view as a third top-level tab.
//
// Phases implemented:
//  Phase 2  — Today's Facebook Mission panel
//  Phase 3  — Task quality tracking (not vanity)
//  Phase 4  — Conversation depth + sales intent engine
//  Phase 5  — Twilio real-time alert triggers
//  Phase 6  — Performance Scorecard
//  Phase 7  — Achievement Progression panel
//  Phase 8  — Sales Execution layer
//  Phase 9  — City / Category opportunity logic
//  Phase 10 — Mobile-first UX
// ─────────────────────────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

type OpenSlot = {
  city:       string;
  category:   string;
  spot_type:  string;
  released_at: string | null;
};

type MissionTask = {
  type:   string;
  label:  string;
  icon:   string;
  target: number;
  why:    string;
  scripts: string[];
  fields: string[];
  proof_label: string;
  completed:  number;
  remaining:  number;
  done:       boolean;
  warmOpportunities: Array<{ business_name: string; city: string; category: string; facebook_url: string | null }>;
  openSlots:  OpenSlot[];
};

type MissionData = {
  date:                  string;
  agent_id:              string;
  assigned_cities:       string[];
  open_slots:            OpenSlot[];
  tasks:                 MissionTask[];
  total_completed_today: number;
  mission_score:         number;
};

type Scores = {
  visibility:  number;
  engagement:  number;
  conversion:  number;
  revenue_opp: number;
  overall:     number;
};

type Momentum = {
  breakout_post_progress:  number;
  epic_comment_progress:   number;
  superstar_engagement:    number;
  trust_momentum:          number;
  visibility_momentum:     number;
  conversion_momentum:     number;
};

type NextAction = { action: string; priority: "high" | "medium" | "low"; icon: string };

type ScorecardData = {
  date:     string;
  today: {
    posts: number; comments: number; conversations: number;
    dm_conversions: number; group_posts: number; sales_followups: number;
    dm_converted_count: number; biz_owner_interactions: number;
    avg_thread_depth: number; avg_quality_score: number;
    fb_sent_fallback: number;
  };
  scores:       Scores;
  streak:       { current: number; active_days_this_week: number };
  momentum:     Momentum;
  next_actions: NextAction[];
};

type EngineView = "mission" | "scorecard" | "momentum";

// ── Script Rotator ─────────────────────────────────────────────────────────────
function rotatePlaceholders(script: string, city: string, category: string): string {
  return script
    .replace(/\[CITY\]/g,     city     || "your city")
    .replace(/\[CATEGORY\]/g, category || "your industry");
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function FacebookEngine({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [view,       setView]       = useState<EngineView>("mission");
  const [mission,    setMission]    = useState<MissionData | null>(null);
  const [scorecard,  setScorecard]  = useState<ScorecardData | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [flash,      setFlash]      = useState<{ msg: string; ok: boolean } | null>(null);
  const [activeCity, setActiveCity] = useState<string>("");

  const toast = (msg: string, ok = true) => {
    setFlash({ msg, ok });
    setTimeout(() => setFlash(null), 3000);
  };

  // ── Load mission + scorecard ─────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch(`/api/admin/sales/facebook/mission?agent_id=${agentId}`),
        fetch(`/api/admin/sales/facebook/scorecard?agent_id=${agentId}`),
      ]);
      const [mData, sData] = await Promise.all([mRes.json(), sRes.json()]);
      setMission(mData);
      setScorecard(sData);
      if (mData.assigned_cities?.[0]) setActiveCity(mData.assigned_cities[0]);
    } catch (err) {
      console.error("[FacebookEngine] load error:", err);
    }
    setLoading(false);
  }, [agentId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Log task completion ───────────────────────────────────────────────────
  const logTask = async (taskType: string, payload: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/admin/sales/facebook/mission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_id: agentId,
          task_type: taskType,
          city: activeCity || mission?.assigned_cities?.[0] || "",
          ...payload,
        }),
      });
      const data = await res.json();
      toast(`✓ Logged! Quality score: ${data.quality_score ?? "—"}`);
      // Optimistic UI update
      setMission(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map(t =>
            t.type === taskType
              ? { ...t, completed: t.completed + 1, remaining: Math.max(0, t.remaining - 1), done: t.target > 0 && t.completed + 1 >= t.target }
              : t
          ),
          total_completed_today: prev.total_completed_today + 1,
        };
      });
      // Reload scorecard to refresh scores
      setTimeout(() => {
        fetch(`/api/admin/sales/facebook/scorecard?agent_id=${agentId}`)
          .then(r => r.json()).then(setScorecard).catch(() => {});
      }, 1000);
    } catch {
      toast("Failed to log task", false);
    }
  };

  // ── Send Twilio alert to self (high-opportunity detected) ─────────────────
  const fireAlert = async (alertType: string, message: string, context?: Record<string, unknown>) => {
    try {
      await fetch("/api/admin/sales/facebook/alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, alert_type: alertType, message, context }),
      });
      toast("📲 Alert sent to your phone");
    } catch {
      toast("Alert could not send", false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-400 text-sm">Loading Facebook Performance Engine…</p>
        </div>
      </div>
    );
  }

  const cities = mission?.assigned_cities ?? [];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Flash */}
      {flash && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-2xl font-bold text-sm transition-all ${flash.ok ? "bg-green-600" : "bg-red-600"}`}>
          {flash.msg}
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="font-black text-white text-base">📘 Facebook Engine</h1>
            <p className="text-xs text-gray-500">{agentName} · {mission?.date}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Overall score badge */}
            {scorecard && (
              <div className={`text-center px-3 py-1 rounded-xl border ${
                scorecard.scores.overall >= 70 ? "border-green-700 bg-green-900/20" :
                scorecard.scores.overall >= 40 ? "border-amber-700 bg-amber-900/20" :
                "border-gray-700 bg-gray-800"
              }`}>
                <div className={`text-lg font-black ${
                  scorecard.scores.overall >= 70 ? "text-green-400" :
                  scorecard.scores.overall >= 40 ? "text-amber-400" : "text-gray-400"
                }`}>{scorecard.scores.overall}</div>
                <div className="text-[10px] text-gray-600">Score</div>
              </div>
            )}
            {scorecard && scorecard.streak.current > 0 && (
              <div className="text-center px-3 py-1 rounded-xl border border-orange-700 bg-orange-900/20">
                <div className="text-lg font-black text-orange-400">{scorecard.streak.current}🔥</div>
                <div className="text-[10px] text-gray-600">Streak</div>
              </div>
            )}
            <button onClick={loadData} className="text-gray-600 hover:text-gray-300 text-xs">↻</button>
          </div>
        </div>

        {/* City selector */}
        {cities.length > 0 && (
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-600">Focus:</span>
            {cities.map(city => (
              <button
                key={city}
                onClick={() => setActiveCity(city)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                  activeCity === city
                    ? "border-blue-500 bg-blue-900/30 text-blue-300"
                    : "border-gray-700 text-gray-500 hover:text-gray-300"
                }`}
              >
                {city}
              </button>
            ))}
          </div>
        )}

        {/* Today's mission progress bar */}
        {mission && (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700"
                style={{ width: `${Math.min(100, mission.mission_score)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 shrink-0">{mission.total_completed_today} logged</span>
          </div>
        )}

        {/* Sub-nav */}
        <div className="flex gap-1 mt-2">
          {([
            { key: "mission",   label: "Mission",   icon: "🎯" },
            { key: "scorecard", label: "Scorecard", icon: "📊" },
            { key: "momentum",  label: "Momentum",  icon: "🚀" },
          ] as const).map(v => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                view === v.key ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {v.icon} {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-4 max-w-2xl w-full mx-auto">
        {view === "mission" && mission && (
          <MissionPanel
            tasks={mission.tasks}
            assignedCities={mission.assigned_cities}
            openSlots={mission.open_slots ?? []}
            activeCity={activeCity}
            onLogTask={logTask}
            onFireAlert={fireAlert}
          />
        )}
        {view === "scorecard" && scorecard && (
          <ScorecardPanel scorecard={scorecard} onFireAlert={fireAlert} />
        )}
        {view === "momentum" && scorecard && (
          <MomentumPanel momentum={scorecard.momentum} nextActions={scorecard.next_actions} streak={scorecard.streak} />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 2 + 3 + 8 + 9 — Today's Facebook Mission Panel
// ─────────────────────────────────────────────────────────────────────────────

function MissionPanel({
  tasks, assignedCities, activeCity, openSlots, onLogTask, onFireAlert,
}: {
  tasks:          MissionTask[];
  assignedCities: string[];
  openSlots:      OpenSlot[];
  activeCity:     string;
  onLogTask:      (type: string, payload: Record<string, unknown>) => void;
  onFireAlert:    (type: string, msg: string, ctx?: Record<string, unknown>) => void;
}) {
  const totalDone    = tasks.filter(t => t.done || t.type === "sales_opportunity_followup").length;
  const coreTaskCount = tasks.filter(t => t.type !== "sales_opportunity_followup").length;
  const allCoreDone  = tasks.filter(t => t.type !== "sales_opportunity_followup").every(t => t.done);

  return (
    <div className="space-y-3">
      {/* Mission summary */}
      <div className={`rounded-2xl border px-4 py-3 ${allCoreDone ? "bg-green-900/20 border-green-700/40" : "bg-gray-900 border-gray-800"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-white text-sm">
              {allCoreDone ? "🏆 Mission Complete!" : "📋 Today's Facebook Mission"}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalDone}/{coreTaskCount} core tasks done · Revenue-focused, not vanity
            </p>
          </div>
          {allCoreDone && (
            <button
              onClick={() => onFireAlert("daily_mission_done", "Facebook mission complete for today!", { city: activeCity })}
              className="text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-bold"
            >
              📲 Notify
            </button>
          )}
        </div>
      </div>

      {/* Open slots banner — show when real revenue slots exist */}
      {openSlots.length > 0 && (
        <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl px-4 py-3">
          <p className="text-xs font-bold text-emerald-400 mb-1">🎯 {openSlots.length} Open Slot{openSlots.length > 1 ? "s" : ""} Available — Revenue Priority</p>
          <div className="flex flex-wrap gap-2 mt-1">
            {openSlots.slice(0, 4).map((s, i) => (
              <span key={i} className="text-xs bg-emerald-900/40 border border-emerald-800/50 text-emerald-300 px-2 py-0.5 rounded-full">
                {s.city} · {s.category}
              </span>
            ))}
            {openSlots.length > 4 && <span className="text-xs text-gray-500">+{openSlots.length - 4} more</span>}
          </div>
          <p className="text-[11px] text-gray-500 mt-1.5">Target these city/category combos in your posts, group contributions, and DMs today.</p>
        </div>
      )}

      {/* Task cards */}
      {tasks.map(task => (
        <TaskCard
          key={task.type}
          task={task}
          activeCity={activeCity}
          onLogTask={onLogTask}
          onFireAlert={onFireAlert}
        />
      ))}
    </div>
  );
}

// ── Individual Task Card ──────────────────────────────────────────────────────

function TaskCard({
  task, activeCity, onLogTask, onFireAlert,
}: {
  task:        MissionTask;
  activeCity:  string;
  onLogTask:   (type: string, payload: Record<string, unknown>) => void;
  onFireAlert: (type: string, msg: string, ctx?: Record<string, unknown>) => void;
}) {
  const [open,         setOpen]         = useState(false);
  const [scriptIdx,    setScriptIdx]    = useState(0);
  const [proofText,    setProofText]    = useState("");
  const [proofUrl,     setProofUrl]     = useState("");
  const [threadDepth,  setThreadDepth]  = useState(1);
  const [dmConverted,  setDmConverted]  = useState(false);
  const [bizOwner,     setBizOwner]     = useState(false);
  const [nextAction,   setNextAction]   = useState("continue_thread");
  const [activeOpp,    setActiveOpp]    = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  const category = "home services";
  const scripts  = task.scripts.map(s => rotatePlaceholders(s, activeCity, category));

  const submit = async () => {
    setSubmitting(true);
    await onLogTask(task.type, {
      proof_text:                proofText,
      proof_url:                 proofUrl,
      script_used:               scripts[scriptIdx],
      thread_depth:              threadDepth,
      dm_converted:              dmConverted,
      business_owner_interaction: bizOwner,
      next_action:               nextAction,
    });
    // Reset form
    setProofText(""); setProofUrl(""); setThreadDepth(1);
    setDmConverted(false); setBizOwner(false);
    setOpen(false);
    setSubmitting(false);
  };

  const isComplete = task.done;
  const isSalesFollowup = task.type === "sales_opportunity_followup";

  return (
    <div className={`bg-gray-900 rounded-2xl border overflow-hidden transition-all ${
      isComplete ? "border-green-800/40 opacity-80" : "border-gray-800"
    }`}>
      {/* Task header */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => setOpen(v => !v)}
      >
        <span className="text-xl shrink-0">{task.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white">{task.label}</span>
            {isComplete && <span className="text-[10px] bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded-full font-bold">✓ DONE</span>}
            {!isComplete && !isSalesFollowup && (
              <span className="text-[10px] text-gray-500">{task.completed}/{task.target}</span>
            )}
          </div>
          <p className="text-xs text-gray-500 truncate mt-0.5">{task.why}</p>
        </div>
        {/* Progress ring for non-sales tasks */}
        {!isSalesFollowup && task.target > 0 && (
          <div className="shrink-0">
            <RingProgress value={task.completed} max={task.target} />
          </div>
        )}
        <span className="text-gray-600 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4">
          {/* Why it matters */}
          <div className="bg-blue-900/15 border border-blue-800/30 rounded-xl px-3 py-2">
            <p className="text-xs text-blue-300 leading-relaxed">💡 {task.why}</p>
          </div>

          {/* Warm opportunities for sales followup */}
          {isSalesFollowup && task.warmOpportunities.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 uppercase">Warm Facebook Prospects</p>
              {task.warmOpportunities.map((opp, i) => (
                <div
                  key={i}
                  className={`bg-gray-800 border rounded-xl p-3 cursor-pointer transition-all ${
                    activeOpp === `${i}` ? "border-amber-600" : "border-gray-700"
                  }`}
                  onClick={() => setActiveOpp(activeOpp === `${i}` ? null : `${i}`)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-white">{opp.business_name}</p>
                      <p className="text-xs text-gray-500">{opp.city} · {opp.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {opp.facebook_url && (
                        <a href={opp.facebook_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-lg"
                          onClick={e => e.stopPropagation()}>
                          FB ↗
                        </a>
                      )}
                      <button
                        onClick={() => onFireAlert("warm_opportunity", `Follow up on ${opp.business_name} Facebook engagement`, { business: opp.business_name, city: opp.city })}
                        className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded-lg"
                      >
                        📲
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Open city/category slots — high-priority revenue targets */}
          {task.openSlots && task.openSlots.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-xs font-bold text-emerald-400 uppercase">🎯 Open Slots — Real Revenue Opportunities</p>
              </div>
              <div className="bg-emerald-900/15 border border-emerald-800/30 rounded-xl px-3 py-2 mb-1">
                <p className="text-xs text-emerald-300 leading-relaxed">These city/category slots have been freed up — target them in your Facebook posts and outreach to fill them fast.</p>
              </div>
              <div className="space-y-1.5">
                {task.openSlots.map((slot, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800 border border-emerald-900/40 rounded-xl px-3 py-2">
                    <div>
                      <span className="text-sm font-bold text-white">{slot.city}</span>
                      <span className="text-xs text-gray-500 ml-2">·</span>
                      <span className="text-xs text-emerald-300 ml-2">{slot.category}</span>
                      <span className="text-xs text-gray-600 ml-2">({slot.spot_type})</span>
                    </div>
                    <button
                      onClick={() => onFireAlert(
                        "warm_opportunity",
                        `Open ${slot.spot_type} slot in ${slot.city} · ${slot.category} — target in your next Facebook post`,
                        { city: slot.city, category: slot.category, spot_type: slot.spot_type }
                      )}
                      className="text-xs bg-emerald-800 hover:bg-emerald-700 text-emerald-200 px-2 py-1 rounded-lg"
                    >
                      📲 Alert
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Script area */}
          {scripts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-gray-400 uppercase">Suggested Script</p>
                {scripts.length > 1 && (
                  <div className="flex gap-1">
                    {scripts.map((_, i) => (
                      <button key={i} onClick={() => setScriptIdx(i)}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${scriptIdx === i ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-400"}`}>
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-800 rounded-xl p-3">
                <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{scripts[scriptIdx]}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(scripts[scriptIdx])}
                  className="mt-2 text-xs text-gray-500 hover:text-white underline"
                >
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Proof / log section */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase">Log This Task</p>

            {/* Proof text */}
            <textarea
              value={proofText}
              onChange={e => setProofText(e.target.value)}
              placeholder={task.proof_label}
              rows={2}
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2.5 border border-gray-700 focus:outline-none focus:border-blue-500 resize-none placeholder-gray-600"
            />

            {/* Proof URL */}
            <input
              type="url"
              value={proofUrl}
              onChange={e => setProofUrl(e.target.value)}
              placeholder="Post/thread URL (optional — adds quality points)"
              className="w-full bg-gray-800 text-white text-sm rounded-xl px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500 placeholder-gray-600"
            />

            {/* Quality signals */}
            <div className="grid grid-cols-2 gap-2">
              {/* Thread depth */}
              <div className="bg-gray-800 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Thread Depth (replies)</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setThreadDepth(d => Math.max(1, d - 1))} className="w-6 h-6 rounded bg-gray-700 text-gray-300 text-sm">−</button>
                  <span className="text-white font-bold text-sm w-6 text-center">{threadDepth}</span>
                  <button onClick={() => setThreadDepth(d => Math.min(20, d + 1))} className="w-6 h-6 rounded bg-gray-700 text-gray-300 text-sm">+</button>
                </div>
              </div>

              {/* Next action */}
              <div className="bg-gray-800 rounded-xl p-2.5">
                <p className="text-[10px] text-gray-500 uppercase mb-1">Next Step</p>
                <select
                  value={nextAction}
                  onChange={e => setNextAction(e.target.value)}
                  className="w-full bg-gray-700 text-white text-xs rounded-lg px-2 py-1 focus:outline-none"
                >
                  <option value="continue_thread">Continue Thread</option>
                  <option value="move_to_dm">Move to DM</option>
                  <option value="send_intake">Send Intake Link</option>
                  <option value="invite_to_call">Invite to Call</option>
                  <option value="nurture">Nurture</option>
                </select>
              </div>
            </div>

            {/* Quality boost checkboxes */}
            <div className="flex gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dmConverted}
                  onChange={e => setDmConverted(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0"
                />
                <span className="text-xs text-gray-300">Moved to DM (+20 pts)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={bizOwner}
                  onChange={e => setBizOwner(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-amber-500 focus:ring-0"
                />
                <span className="text-xs text-gray-300">Business owner (+15 pts)</span>
              </label>
            </div>

            {/* Alert buttons */}
            <div className="flex gap-2 flex-wrap">
              {dmConverted && (
                <button
                  onClick={() => onFireAlert("dm_opportunity", `DM conversion logged for ${task.label}`, { city: activeCity })}
                  className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-3 py-1.5 rounded-lg font-bold"
                >
                  📲 Alert — DM Opp
                </button>
              )}
              {bizOwner && (
                <button
                  onClick={() => onFireAlert("biz_owner_engaged", `Business owner engaged in ${activeCity}`, { city: activeCity })}
                  className="text-xs bg-amber-700 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg font-bold"
                >
                  📲 Alert — Biz Owner
                </button>
              )}
            </div>

            {/* Submit */}
            <button
              onClick={submit}
              disabled={submitting || (!proofText && !proofUrl)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-black text-sm rounded-xl transition-all"
            >
              {submitting ? "Logging…" : `✓ Log ${task.label}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 6 — Performance Scorecard
// ─────────────────────────────────────────────────────────────────────────────

function ScorecardPanel({
  scorecard, onFireAlert,
}: {
  scorecard: ScorecardData;
  onFireAlert: (type: string, msg: string, ctx?: Record<string, unknown>) => void;
}) {
  const { today, scores, streak, next_actions } = scorecard;

  // Determine if there are hot threads needing response
  const hasHotThread = today.avg_thread_depth >= 2 && today.comments > 0;

  return (
    <div className="space-y-4">
      {/* Top score grid */}
      <div className="grid grid-cols-2 gap-3">
        <ScoreCard label="Visibility"    score={scores.visibility}   icon="👁️"  desc="Posts · Groups · Presence" />
        <ScoreCard label="Engagement"    score={scores.engagement}   icon="💬"  desc="Threads · Replies · Depth" />
        <ScoreCard label="Conversion"    score={scores.conversion}   icon="📩"  desc="DM transitions · Intake" />
        <ScoreCard label="Revenue Opp"   score={scores.revenue_opp}  icon="💰"  desc="Biz owners · Warm leads" />
      </div>

      {/* Overall */}
      <div className={`rounded-2xl border p-4 flex items-center justify-between ${
        scores.overall >= 70 ? "bg-green-900/20 border-green-700/40" :
        scores.overall >= 40 ? "bg-amber-900/15 border-amber-700/30" :
        "bg-gray-900 border-gray-800"
      }`}>
        <div>
          <p className="text-xs text-gray-400 uppercase">Overall Score</p>
          <p className={`text-4xl font-black mt-0.5 ${
            scores.overall >= 70 ? "text-green-400" :
            scores.overall >= 40 ? "text-amber-400" : "text-gray-400"
          }`}>{scores.overall}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {scores.overall >= 80 ? "Elite execution today 🏆" :
             scores.overall >= 60 ? "Good progress — keep pushing" :
             scores.overall >= 40 ? "Building momentum — more depth needed" :
             "Start logging tasks to see score grow"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Streak</p>
          <p className="text-2xl font-black text-orange-400">{streak.current}🔥</p>
          <p className="text-xs text-gray-600">{streak.active_days_this_week}/7 days</p>
        </div>
      </div>

      {/* Today's activity breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">Today's Activity</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Posts",          val: today.posts,                icon: "📣", target: 2  },
            { label: "Comments",       val: today.comments,             icon: "💬", target: 10 },
            { label: "Conversations",  val: today.conversations,        icon: "🔁", target: 5  },
            { label: "DM Transitions", val: today.dm_conversions,       icon: "📩", target: 5  },
            { label: "Group Posts",    val: today.group_posts,          icon: "📢", target: 2  },
            { label: "Sales F/U",      val: today.sales_followups,      icon: "🎯", target: 3  },
            { label: "DMs Converted",  val: today.dm_converted_count,   icon: "✅", target: 3  },
            { label: "Biz Owners",     val: today.biz_owner_interactions, icon: "🏢", target: 2 },
            { label: "Avg Depth",      val: today.avg_thread_depth,     icon: "📐", target: 3  },
          ].map(item => (
            <div key={item.label} className={`rounded-xl p-2.5 text-center ${
              Number(item.val) >= item.target ? "bg-green-900/20 border border-green-800/30" : "bg-gray-800"
            }`}>
              <p className="text-lg font-black text-white">{item.val}</p>
              <p className="text-[10px] text-gray-500">{item.icon} {item.label}</p>
              <p className="text-[10px] text-gray-700">/{item.target}</p>
            </div>
          ))}
        </div>

        {/* Quality note */}
        <div className="mt-3 bg-gray-800/50 rounded-xl px-3 py-2 border border-gray-700/50">
          <p className="text-xs text-gray-400">
            Avg quality score: <span className="text-white font-bold">{today.avg_quality_score}/100</span>
            {today.avg_quality_score >= 70 ? " · 🏆 High quality engagement" :
             today.avg_quality_score >= 50 ? " · Building depth — add proof URLs" :
             " · Start logging with thread depth + proof URL for higher scores"}
          </p>
        </div>
      </div>

      {/* Conversation depth + hot thread alerts */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">Conversation Intelligence</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between py-2 border-b border-gray-800">
            <div>
              <p className="text-sm text-white font-semibold">Average Thread Depth</p>
              <p className="text-xs text-gray-500">Threads with 2+ replies drive real DM opportunities</p>
            </div>
            <span className={`text-2xl font-black ${today.avg_thread_depth >= 2 ? "text-green-400" : "text-gray-400"}`}>
              {today.avg_thread_depth}
            </span>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-white font-semibold">Business Owner Interactions</p>
              <p className="text-xs text-gray-500">These are your highest-value conversations</p>
            </div>
            <span className={`text-2xl font-black ${today.biz_owner_interactions > 0 ? "text-amber-400" : "text-gray-600"}`}>
              {today.biz_owner_interactions}
            </span>
          </div>
        </div>

        {/* Fire alert for hot thread */}
        {hasHotThread && (
          <button
            onClick={() => onFireAlert("hot_thread", "Active threads need follow-up — re-engage now while engagement is hot")}
            className="mt-3 w-full py-2 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded-xl"
          >
            🔥 Alert — Hot Thread Needs Response Now
          </button>
        )}
      </div>

      {/* Next best actions */}
      {next_actions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
          <p className="text-xs font-bold text-gray-400 uppercase mb-3">Next Best Actions</p>
          <div className="space-y-2">
            {next_actions.map((action, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
                action.priority === "high"   ? "border-red-800/40 bg-red-900/10" :
                action.priority === "medium" ? "border-amber-800/30 bg-amber-900/10" :
                "border-gray-700 bg-gray-800"
              }`}>
                <span className="text-xl shrink-0">{action.icon}</span>
                <div className="flex-1">
                  <p className="text-sm text-white">{action.action}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  action.priority === "high"   ? "bg-red-900/40 text-red-300" :
                  action.priority === "medium" ? "bg-amber-900/40 text-amber-300" :
                  "bg-gray-700 text-gray-400"
                }`}>{action.priority}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHASE 7 — Achievement Momentum Panel
// ─────────────────────────────────────────────────────────────────────────────

function MomentumPanel({
  momentum, nextActions, streak,
}: {
  momentum:    Momentum;
  nextActions: NextAction[];
  streak:      { current: number; active_days_this_week: number };
}) {
  return (
    <div className="space-y-4">
      {/* Disclaimer */}
      <div className="bg-blue-900/15 border border-blue-800/30 rounded-2xl px-4 py-3">
        <p className="text-xs text-blue-300 leading-relaxed">
          <strong>Internal Estimated Progress</strong> — These scores are based on your engagement behavior patterns, not direct Facebook data.
          They reflect the behaviors that drive breakout content, rising posts, and high-performing comments.
        </p>
      </div>

      {/* Streak */}
      <div className={`rounded-2xl border p-4 flex items-center gap-4 ${
        streak.current >= 5 ? "border-orange-700 bg-orange-900/20" :
        streak.current >= 3 ? "border-amber-700 bg-amber-900/15" :
        "border-gray-800 bg-gray-900"
      }`}>
        <div className="text-4xl">{streak.current >= 5 ? "🏆" : streak.current >= 3 ? "🔥" : "📘"}</div>
        <div>
          <p className="font-black text-white text-lg">{streak.current}-Day Streak</p>
          <p className="text-xs text-gray-400">{streak.active_days_this_week}/7 days active this week</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {streak.current >= 7 ? "🏆 Elite performer — keep this going" :
             streak.current >= 5 ? "⚡ You're outperforming most — stay consistent" :
             streak.current >= 3 ? "🔥 Building real momentum" :
             "Post daily to build your streak — consistency is everything"}
          </p>
        </div>
      </div>

      {/* Momentum bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-4">
        <p className="text-xs font-bold text-gray-400 uppercase">Estimated Progress Toward Key Behaviors</p>

        {[
          {
            label: "Breakout-Style Post Behavior",
            desc:  "Estimated: comments + threads + shares your posts generate",
            value: momentum.breakout_post_progress,
            color: "bg-blue-500",
          },
          {
            label: "High-Performing Comment Pattern",
            desc:  "Estimated: comment volume + reply rate alignment",
            value: momentum.epic_comment_progress,
            color: "bg-purple-500",
          },
          {
            label: "Superstar Engagement Alignment",
            desc:  "Estimated: overall daily activity vs. top-performer baseline",
            value: momentum.superstar_engagement,
            color: "bg-amber-500",
          },
        ].map(item => (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <p className="text-sm font-semibold text-white">{item.label}</p>
                <p className="text-xs text-gray-600">{item.desc}</p>
              </div>
              <span className="text-sm font-black text-white ml-3">{item.value}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full ${item.color} rounded-full transition-all duration-700`} style={{ width: `${item.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Trust + visibility + conversion momentum */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase">Momentum Indicators</p>
        <div className="grid grid-cols-3 gap-3">
          <MomentumGauge label="Trust Momentum"       value={momentum.trust_momentum}      color="text-green-400"  />
          <MomentumGauge label="Visibility Momentum"  value={momentum.visibility_momentum}  color="text-blue-400"   />
          <MomentumGauge label="Conversion Momentum"  value={momentum.conversion_momentum}  color="text-purple-400" />
        </div>
        <p className="text-[10px] text-gray-700 text-center">
          Estimated based on engagement behavior — not direct Facebook badge data
        </p>
      </div>

      {/* What drives these numbers */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
        <p className="text-xs font-bold text-gray-400 uppercase mb-3">What Drives Real Facebook Performance</p>
        <div className="space-y-2 text-xs text-gray-400">
          {[
            "Posts that invite comments (questions, local angles, hot takes) outperform announcements 10:1",
            "Comments on active threads get you seen by their entire audience — not just the poster",
            "Thread depth (3+ replies) is a signal Facebook uses to boost content naturally",
            "Moving to DM within 24h of a warm public interaction doubles conversion rates",
            "Consistency beats intensity — 10 comments/day for 7 days outperforms 70 in one day",
            "Business owners who engage publicly are warm leads — always move these to DM fast",
          ].map((tip, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5 shrink-0">→</span>
              <p>{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ScoreCard({
  label, score, icon, desc,
}: {
  label: string; score: number; icon: string; desc: string;
}) {
  const color = score >= 70 ? "text-green-400" : score >= 40 ? "text-amber-400" : "text-gray-500";
  const bg    = score >= 70 ? "bg-green-900/15 border-green-800/30" :
                score >= 40 ? "bg-amber-900/10 border-amber-800/20" :
                "bg-gray-900 border-gray-800";
  return (
    <div className={`rounded-2xl border p-3 ${bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{icon} {label}</p>
          <p className={`text-3xl font-black mt-1 ${color}`}>{score}</p>
        </div>
        <div className="mt-1">
          <ScoreBar score={score} />
        </div>
      </div>
      <p className="text-[10px] text-gray-600 mt-1">{desc}</p>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const segments = [25, 50, 75, 100];
  return (
    <div className="flex gap-0.5">
      {segments.map((s, i) => (
        <div key={i} className={`w-1.5 h-6 rounded-full ${score >= s ? (score >= 70 ? "bg-green-500" : "bg-amber-500") : "bg-gray-700"}`} />
      ))}
    </div>
  );
}

function MomentumGauge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-black ${color}`}>{value}%</div>
      <div className="text-[10px] text-gray-500 mt-0.5">{label}</div>
      <div className="mt-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className="h-full bg-current opacity-60 rounded-full" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function RingProgress({ value, max }: { value: number; max: number }) {
  const pct  = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const done = value >= max;
  return (
    <div className="relative w-10 h-10">
      <svg className="w-10 h-10 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15.9155" fill="none" stroke="#374151" strokeWidth="3" />
        <circle
          cx="18" cy="18" r="15.9155" fill="none"
          stroke={done ? "#22c55e" : pct >= 50 ? "#f59e0b" : "#3b82f6"}
          strokeWidth="3"
          strokeDasharray={`${pct} ${100 - pct}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white">
        {done ? "✓" : `${value}`}
      </span>
    </div>
  );
}

function rotatePlaceholders(script: string, city: string, category: string): string {
  return script
    .replace(/\[CITY\]/g,     city     || "your city")
    .replace(/\[CATEGORY\]/g, category || "your industry")
    .replace(/\[NAME\]/g,     "there")
    .replace(/\[BUSINESS\]/g, "your business")
    .replace(/\[TOPIC\]/g,    "your business/services")
    .replace(/\[POST\]/g,     "our recent conversation");
}
