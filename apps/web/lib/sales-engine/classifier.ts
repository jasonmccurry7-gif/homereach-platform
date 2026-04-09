// ─────────────────────────────────────────────────────────────────────────────
// Lead Classifier
//
// Scores every lead 0–100 and assigns cold / warm / hot temperature.
// Classification is dynamic — re-run after every inbound message.
//
// Score bands:
//   0–29  → cold
//   30–59 → warm
//   60+   → HOT
// ─────────────────────────────────────────────────────────────────────────────

import type {
  SalesLead, LeadClassification, LeadTemperature, HotSignal,
} from "./types";
import { detectSignals } from "./hot-lead-detector";

// ─────────────────────────────────────────────────────────────────────────────
// Score Weights
// ─────────────────────────────────────────────────────────────────────────────

const SIGNAL_WEIGHTS: Record<string, number> = {
  asked_pricing:           35,
  said_interested:         30,
  asked_how_to_start:      30,
  asked_next_steps:        28,
  expressed_urgency:       25,
  mentioned_budget:        25,
  mentioned_readiness:     25,
  asked_availability:      20,
  asked_how_it_works:      18,
  mentioned_city_category: 15,
  asked_specific_question: 12,
  positive_sentiment:      10,
};

// Behavioral score additions (lead-level context)
const BEHAVIOR_SCORES = {
  hasReplied:           15,   // any reply = baseline engagement
  multipleReplies:      10,   // more than 1 reply
  qualificationComplete: 8,   // city + category + interest confirmed
  recentActivity:        8,   // replied in last 2 hours
};

// ─────────────────────────────────────────────────────────────────────────────
// Core Classifier
// ─────────────────────────────────────────────────────────────────────────────

export function classifyLead(lead: SalesLead): LeadClassification {
  let score = 0;
  const allSignals: HotSignal[] = [];

  // ── Score existing conversation signals ───────────────────────────────────
  for (const msg of lead.messages) {
    if (msg.role !== "lead") continue;

    const signals = detectSignals(msg.body, msg.sentAt);
    allSignals.push(...signals);

    for (const signal of signals) {
      score += Math.round((SIGNAL_WEIGHTS[signal.type] ?? 5) * signal.confidence);
    }
  }

  // ── Behavioral bonuses ────────────────────────────────────────────────────
  if (lead.qualification.hasReplied) {
    score += BEHAVIOR_SCORES.hasReplied;
  }

  const replyCount = lead.messages.filter((m) => m.role === "lead").length;
  if (replyCount > 1) {
    score += BEHAVIOR_SCORES.multipleReplies;
  }

  const q = lead.qualification;
  if (q.city && q.category && q.interestLevel && q.interestLevel !== "none") {
    score += BEHAVIOR_SCORES.qualificationComplete;
  }

  // Recent activity bonus
  if (lead.lastMessageAt) {
    const minutesSinceLast = (Date.now() - new Date(lead.lastMessageAt).getTime()) / 60000;
    if (minutesSinceLast < 120) {
      score += BEHAVIOR_SCORES.recentActivity;
    }
  }

  // Interest level override
  if (q.interestLevel === "ready")      score = Math.max(score, 70);
  if (q.interestLevel === "interested") score = Math.max(score, 45);

  // Cap at 100
  score = Math.min(score, 100);

  const temperature = scoreToTemperature(score);

  // Dedupe signals — keep highest confidence per type
  const dedupedSignals = dedupeSignals(allSignals);

  const reasoning = buildReasoning(temperature, score, dedupedSignals, lead);

  return {
    temperature,
    score,
    signals: dedupedSignals,
    lastUpdated: new Date().toISOString(),
    reasoning,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Classify from a single new message (incremental update)
// ─────────────────────────────────────────────────────────────────────────────

export function classifyFromMessage(
  existing: LeadClassification,
  newMessage: string,
  sentAt: string
): LeadClassification {
  const newSignals = detectSignals(newMessage, sentAt);
  let scoreDelta = 0;

  for (const signal of newSignals) {
    scoreDelta += Math.round((SIGNAL_WEIGHTS[signal.type] ?? 5) * signal.confidence);
  }

  const newScore = Math.min(existing.score + scoreDelta, 100);
  const temperature = scoreToTemperature(newScore);
  const allSignals = dedupeSignals([...existing.signals, ...newSignals]);

  return {
    temperature,
    score: newScore,
    signals: allSignals,
    lastUpdated: sentAt,
    reasoning: `Score updated +${scoreDelta} → ${newScore}. New signals: ${newSignals.map((s) => s.type).join(", ") || "none"}.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

export function scoreToTemperature(score: number): LeadTemperature {
  if (score >= 60) return "hot";
  if (score >= 30) return "warm";
  return "cold";
}

function dedupeSignals(signals: HotSignal[]): HotSignal[] {
  const best = new Map<string, HotSignal>();
  for (const s of signals) {
    const existing = best.get(s.type);
    if (!existing || s.confidence > existing.confidence) {
      best.set(s.type, s);
    }
  }
  return Array.from(best.values()).sort((a, b) => b.confidence - a.confidence);
}

function buildReasoning(
  temp: LeadTemperature,
  score: number,
  signals: HotSignal[],
  lead: SalesLead
): string {
  if (temp === "hot") {
    const topSignal = signals[0];
    return topSignal
      ? `HOT (${score}): Triggered by "${topSignal.type.replace(/_/g, " ")}" — ${topSignal.triggeredBy.slice(0, 60)}`
      : `HOT (${score}): High engagement across ${signals.length} signals.`;
  }
  if (temp === "warm") {
    return `WARM (${score}): ${lead.qualification.hasReplied ? "Has replied." : "No reply yet."} ${signals.length > 0 ? `Signals: ${signals.map((s) => s.type.replace(/_/g, " ")).join(", ")}.` : "No strong signals yet."}`;
  }
  return `COLD (${score}): ${lead.qualification.hasReplied ? "Replied but low intent." : "No reply. Follow-up pending."}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch Classify
// ─────────────────────────────────────────────────────────────────────────────

export function classifyAll(leads: SalesLead[]): SalesLead[] {
  return leads.map((lead) => ({
    ...lead,
    classification: classifyLead(lead),
    updatedAt: new Date().toISOString(),
  }));
}

// Temperature display helpers
export function getTemperatureMeta(temp: LeadTemperature): {
  label:  string;
  color:  string;
  bg:     string;
  icon:   string;
  border: string;
} {
  const map = {
    hot:  { label: "HOT 🔥",   color: "text-red-400",    bg: "bg-red-900/30",    icon: "🔥", border: "border-red-800/60" },
    warm: { label: "WARM",     color: "text-amber-400",  bg: "bg-amber-900/30",  icon: "🌡️", border: "border-amber-800/40" },
    cold: { label: "COLD",     color: "text-blue-400",   bg: "bg-blue-900/20",   icon: "❄️", border: "border-blue-900/30" },
  };
  return map[temp];
}
