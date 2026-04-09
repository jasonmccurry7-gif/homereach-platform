// ─────────────────────────────────────────────────────────────────────────────
// Hot Lead Detector
//
// Pattern-matches every inbound message against buying signal patterns.
// Returns an array of HotSignal detections with confidence scores.
// This runs on EVERY inbound message — zero delay, instant classification.
// ─────────────────────────────────────────────────────────────────────────────

import type { HotSignal, HotSignalType } from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Signal Pattern Definitions
// Each pattern: { type, patterns[], confidence }
// ─────────────────────────────────────────────────────────────────────────────

interface SignalPattern {
  type:       HotSignalType;
  patterns:   RegExp[];
  confidence: number;   // base confidence (0–1)
}

const SIGNAL_PATTERNS: SignalPattern[] = [

  // ── Pricing ───────────────────────────────────────────────────────────────
  {
    type: "asked_pricing",
    confidence: 0.95,
    patterns: [
      /how much/i,
      /what.{0,10}(cost|price|pricing|charge|fee|rate)/i,
      /how.{0,10}(expensive|affordable)/i,
      /\$\d+/i,
      /what.{0,15}(pay|paying|spend)/i,
      /monthly.{0,10}(cost|fee|price)/i,
      /pricing/i,
      /per month/i,
    ],
  },

  // ── Expressed interest ────────────────────────────────────────────────────
  {
    type: "said_interested",
    confidence: 0.90,
    patterns: [
      /\binterested\b/i,
      /sounds good/i,
      /i.{0,5}(like|love) (this|that|it)/i,
      /tell me more/i,
      /this looks (good|great|interesting)/i,
      /that.{0,10}sounds (good|great|awesome)/i,
      /i.{0,8}want (to|this|that)/i,
      /sign me up/i,
      /where do i sign/i,
      /count me in/i,
      /i.{0,5}(do|am) (want|interested)/i,
    ],
  },

  // ── How it works ──────────────────────────────────────────────────────────
  {
    type: "asked_how_it_works",
    confidence: 0.80,
    patterns: [
      /how does (it|this) work/i,
      /how.{0,10}work/i,
      /explain (this|it|more)/i,
      /what.{0,15}exactly/i,
      /tell me (more|about)/i,
      /how.{0,15}(process|program|system)/i,
      /what.{0,15}(get|include|come with)/i,
      /what exactly (do|are|is)/i,
      /what.{0,10}offer/i,
    ],
  },

  // ── How to start ──────────────────────────────────────────────────────────
  {
    type: "asked_how_to_start",
    confidence: 0.95,
    patterns: [
      /how (do i|can i|would i).{0,15}(start|begin|get started|sign up)/i,
      /get (started|set up|going)/i,
      /what.{0,15}(next|step)/i,
      /how (do|can) (i|we) (sign|join|enroll)/i,
      /ready to (go|start|move forward)/i,
      /how.{0,10}sign up/i,
      /sign (me|us) up/i,
      /let.{0,5}do it/i,
    ],
  },

  // ── Availability ──────────────────────────────────────────────────────────
  {
    type: "asked_availability",
    confidence: 0.85,
    patterns: [
      /still available/i,
      /spot.{0,15}(open|available|left)/i,
      /is (there|it).{0,15}(available|open)/i,
      /any (spots|openings|space).{0,15}(left|available)/i,
      /how many.{0,15}(left|available|open)/i,
      /(when.{0,10}|how soon).{0,15}available/i,
      /available in.{0,20}/i,
    ],
  },

  // ── City / Category mention ───────────────────────────────────────────────
  {
    type: "mentioned_city_category",
    confidence: 0.70,
    patterns: [
      /\b(we|i).{0,10}(cover|serve|based in|located in|work in)\b/i,
      /\b(in|near|around)\s+[A-Z][a-z]+/,
      /\bmy (area|city|region|market|neighborhood)\b/i,
      /\b(plumbing|hvac|roofing|landscaping|electrical|painting|cleaning|dental|auto|pest|flooring|windows|gutters|siding|realty)\b/i,
    ],
  },

  // ── Urgency ───────────────────────────────────────────────────────────────
  {
    type: "expressed_urgency",
    confidence: 0.88,
    patterns: [
      /asap/i,
      /right away/i,
      /as soon as possible/i,
      /urgent(ly)?/i,
      /need(s?) (this|it) (now|fast|quickly|soon)/i,
      /can.{0,5}(you|we) (do|start|move).{0,10}(today|now|this week)/i,
      /\b(today|tonight|this week|immediately)\b/i,
      /ASAP/,
      /need to move fast/i,
      /slow season.{0,20}coming/i,
      /before.{0,20}(season|spring|summer|winter|fall)/i,
    ],
  },

  // ── Next steps ────────────────────────────────────────────────────────────
  {
    type: "asked_next_steps",
    confidence: 0.90,
    patterns: [
      /what.{0,15}next/i,
      /what.{0,15}(need to|have to|should i) (do|send|fill)/i,
      /what.{0,15}(the )?process/i,
      /how.{0,10}(proceed|move forward|continue)/i,
      /what (do|does) (i|it|this) need/i,
      /how long.{0,15}(take|takes)/i,
      /when.{0,15}(can|will|would) (it|we|this) (start|launch|go live)/i,
    ],
  },

  // ── Budget / readiness ────────────────────────────────────────────────────
  {
    type: "mentioned_budget",
    confidence: 0.85,
    patterns: [
      /\bbudget\b/i,
      /can (afford|budget|swing|do)/i,
      /within (my|our|the) budget/i,
      /have.{0,10}\$([\d,]+)/i,
      /set aside.{0,15}(for|for marketing)/i,
      /marketing.{0,15}budget/i,
      /spend(ing)?.{0,10}(on|for) marketing/i,
    ],
  },

  {
    type: "mentioned_readiness",
    confidence: 0.88,
    patterns: [
      /\b(ready|prepared).{0,15}(to|for|go|start|move)\b/i,
      /let.{0,5}(do|move|go)/i,
      /\blet.{0,5}move forward\b/i,
      /i.{0,5}(think|feel) (this|it) (is|could be) (the|a) (right|good) (fit|move|decision)/i,
      /where (do i|should i) sign/i,
      /what.{0,15}(need from me|info do you need)/i,
    ],
  },

  // ── Positive sentiment ────────────────────────────────────────────────────
  {
    type: "positive_sentiment",
    confidence: 0.65,
    patterns: [
      /\b(great|awesome|perfect|amazing|excellent|love it|sounds great|nice|yes|yeah|yep|sure)\b/i,
      /this is (exactly|just) what/i,
      /good timing/i,
      /been (looking|thinking) (for|about) (something like )?this/i,
      /been (wanting|meaning) to (do|try) something like this/i,
      /that.{0,5}(makes sense|sounds right)/i,
    ],
  },

  // ── Specific question ─────────────────────────────────────────────────────
  {
    type: "asked_specific_question",
    confidence: 0.72,
    patterns: [
      /how many (customers|leads|calls|responses)/i,
      /what.{0,10}(results|roi|return|response rate|success rate)/i,
      /do you (have|work with).{0,15}(my area|my category|my industry)/i,
      /how.{0,15}(many|big).{0,15}(reach|area|territory|zone)/i,
      /can (you|i|we) (see|get|have) (an example|a sample|a preview)/i,
      /exclusive/i,
      /only one (business|company|spot)/i,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Core Detection Function
// ─────────────────────────────────────────────────────────────────────────────

export function detectSignals(
  messageBody: string,
  sentAt: string
): HotSignal[] {
  const results: HotSignal[] = [];
  const text = messageBody.trim();

  for (const def of SIGNAL_PATTERNS) {
    for (const pattern of def.patterns) {
      if (pattern.test(text)) {
        results.push({
          type:        def.type,
          triggeredBy: text.slice(0, 120),
          confidence:  def.confidence,
          detectedAt:  sentAt,
        });
        break; // one match per signal type per message
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Quick HOT check — for instant escalation trigger
// ─────────────────────────────────────────────────────────────────────────────

export function isHotSignalPresent(messageBody: string): boolean {
  const signals = detectSignals(messageBody, new Date().toISOString());
  const hotSignalTypes: HotSignalType[] = [
    "asked_pricing",
    "said_interested",
    "asked_how_to_start",
    "asked_next_steps",
    "expressed_urgency",
    "mentioned_budget",
    "mentioned_readiness",
    "asked_availability",
  ];
  return signals.some(
    (s) => hotSignalTypes.includes(s.type) && s.confidence >= 0.75
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate 1-sentence AI summary of why this is a hot lead
// ─────────────────────────────────────────────────────────────────────────────

export function buildHotLeadSummary(
  businessName: string,
  city: string,
  category: string,
  triggerMessage: string,
  signals: HotSignal[]
): string {
  const topSignal = signals[0];
  if (!topSignal) {
    return `${businessName} in ${city} engaged on ${category} — showing strong interest.`;
  }

  const summaryMap: Record<HotSignalType, string> = {
    asked_pricing:           `${businessName} (${city}) asked about pricing — ready to evaluate.`,
    said_interested:         `${businessName} (${city}) said they're interested in HomeReach for ${category}.`,
    asked_how_to_start:      `${businessName} (${city}) asked how to get started — hot buying signal.`,
    asked_next_steps:        `${businessName} (${city}) is asking what comes next — ready to move.`,
    expressed_urgency:       `${businessName} (${city}) is expressing urgency — needs quick response.`,
    mentioned_budget:        `${businessName} (${city}) mentioned budget — financial intent confirmed.`,
    mentioned_readiness:     `${businessName} (${city}) indicated they're ready to move forward.`,
    asked_availability:      `${businessName} (${city}) asked if spots are still available in ${category}.`,
    asked_how_it_works:      `${businessName} (${city}) wants details on how the system works.`,
    mentioned_city_category: `${businessName} confirmed their area/category — qualification complete.`,
    asked_specific_question: `${businessName} (${city}) asked a specific question about results/coverage.`,
    positive_sentiment:      `${businessName} (${city}) responded positively to the pitch.`,
  };

  return summaryMap[topSignal.type] ?? `${businessName} showing strong buying intent.`;
}
