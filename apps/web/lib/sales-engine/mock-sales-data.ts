// ─────────────────────────────────────────────────────────────────────────────
// Mock Sales Leads — Full Conversation Scenarios
//
// Covers: HOT ready-to-buy, WARM exploring, COLD no response, follow-up,
// human active, and closed. All with realistic SMS exchanges.
// ─────────────────────────────────────────────────────────────────────────────

import type { SalesLead, HotLeadAlert } from "./types";

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3_600_000).toISOString();
}
function daysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// Leads
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_SALES_LEADS: SalesLead[] = [

  // ── 1. HOT — asked pricing, wants to start ─────────────────────────────────
  {
    id: "lead-001",
    businessName: "Fairlawn Roofing LLC",
    contactName:  "Mike Vasquez",
    phone:        "(330) 867-1234",
    city:         "Fairlawn",
    state:        "OH",
    category:     "roofing",
    source:       "outbound_sms",
    classification: {
      temperature: "hot",
      score:       85,
      signals: [
        { type: "asked_pricing",    triggeredBy: "How much does this run per month?", confidence: 0.95, detectedAt: hoursAgo(1) },
        { type: "said_interested",  triggeredBy: "Yeah I'm definitely interested",   confidence: 0.90, detectedAt: hoursAgo(0.5) },
      ],
      lastUpdated: hoursAgo(0.5),
      reasoning:   "HOT (85): Asked pricing + expressed interest within same thread.",
    },
    stage:      "hot_escalated",
    control:    "ai_assist",
    escalation: "alert_sent",
    qualification: {
      city:          "Fairlawn",
      category:      "roofing",
      businessName:  "Fairlawn Roofing LLC",
      interestLevel: "interested",
      timeline:      "now",
      hasReplied:    true,
      messageCount:  4,
    },
    messages: [
      { id: "m-001-1", role: "ai",   channel: "sms", body: "Hey Mike! HomeReach here — we have an exclusive spot open for roofing companies in Fairlawn. Only one per category. Still available if you're interested?", sentAt: hoursAgo(3), isRead: true, intentScore: 0 },
      { id: "m-001-2", role: "lead", channel: "sms", body: "What is this exactly? How does it work?", sentAt: hoursAgo(2.5), isRead: true, intentScore: 18, signals: ["asked_how_it_works"] },
      { id: "m-001-3", role: "ai",   channel: "sms", body: "We send direct mail postcards to homeowners in Fairlawn — exclusively for your roofing company. No competitors on the card. Most roofers see 2–5 new calls per run.", sentAt: hoursAgo(2.4), isRead: true, intentScore: 0 },
      { id: "m-001-4", role: "lead", channel: "sms", body: "How much does this run per month?", sentAt: hoursAgo(1), isRead: true, intentScore: 35, signals: ["asked_pricing"] },
      { id: "m-001-5", role: "ai",   channel: "sms", body: "Great question — let me get you connected with someone on our team who can walk you through pricing for Fairlawn. One sec.", sentAt: hoursAgo(0.9), isRead: true, intentScore: 0 },
      { id: "m-001-6", role: "lead", channel: "sms", body: "Yeah I'm definitely interested, been wanting to try direct mail.", sentAt: hoursAgo(0.5), isRead: false, intentScore: 30, signals: ["said_interested"] },
    ],
    summary:         "Asked pricing + expressed strong interest. Ready to talk numbers. Don't wait.",
    lastMessageAt:   hoursAgo(0.5),
    lastMessageBody: "Yeah I'm definitely interested, been wanting to try direct mail.",
    lastMessageRole: "lead",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    399,
    alertSentAt:     hoursAgo(0.9),
    alertCount:      1,
    createdAt:       daysAgo(1),
    updatedAt:       hoursAgo(0.5),
  },

  // ── 2. HOT — asking how to get started ────────────────────────────────────
  {
    id: "lead-002",
    businessName: "Summit Electrical Services",
    contactName:  "Derek Shaw",
    phone:        "(330) 867-2200",
    city:         "Akron",
    state:        "OH",
    category:     "electrician",
    source:       "outbound_sms",
    classification: {
      temperature: "hot",
      score:       78,
      signals: [
        { type: "asked_how_to_start", triggeredBy: "How do I get started?", confidence: 0.95, detectedAt: hoursAgo(0.3) },
        { type: "asked_availability", triggeredBy: "Is the Akron spot still open?", confidence: 0.85, detectedAt: hoursAgo(0.8) },
      ],
      lastUpdated: hoursAgo(0.3),
      reasoning:   "HOT (78): Asked how to start + confirmed Akron availability.",
    },
    stage:      "hot_escalated",
    control:    "ai_assist",
    escalation: "alert_sent",
    qualification: {
      city:          "Akron",
      category:      "electrician",
      businessName:  "Summit Electrical Services",
      interestLevel: "ready",
      timeline:      "now",
      hasReplied:    true,
      messageCount:  3,
    },
    messages: [
      { id: "m-002-1", role: "ai",   channel: "sms", body: "Hi Derek! HomeReach — we have an open spot for electrical contractors in Akron. One per category — exclusive to you. Worth a look?", sentAt: hoursAgo(2), isRead: true, intentScore: 0 },
      { id: "m-002-2", role: "lead", channel: "sms", body: "Is the Akron spot still open? We've been looking for more local work.", sentAt: hoursAgo(0.8), isRead: true, intentScore: 20, signals: ["asked_availability", "mentioned_city_category"] },
      { id: "m-002-3", role: "ai",   channel: "sms", body: "Akron is still open for electricians — I'd hold it for you. We send to homeowners every 30 days, your name exclusively.", sentAt: hoursAgo(0.7), isRead: true, intentScore: 0 },
      { id: "m-002-4", role: "lead", channel: "sms", body: "How do I get started?", sentAt: hoursAgo(0.3), isRead: false, intentScore: 30, signals: ["asked_how_to_start"] },
    ],
    summary:         "Asked 'How do I get started?' — textbook buy signal. Needs human response now.",
    lastMessageAt:   hoursAgo(0.3),
    lastMessageBody: "How do I get started?",
    lastMessageRole: "lead",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    299,
    alertSentAt:     hoursAgo(0.25),
    alertCount:      1,
    createdAt:       daysAgo(1),
    updatedAt:       hoursAgo(0.3),
  },

  // ── 3. WARM — curious, exploring ──────────────────────────────────────────
  {
    id: "lead-003",
    businessName: "Green Thumb Landscaping",
    contactName:  "Carlos Reyes",
    phone:        "(330) 999-1234",
    city:         "Akron",
    state:        "OH",
    category:     "landscaping",
    source:       "outbound_sms",
    classification: {
      temperature: "warm",
      score:       42,
      signals: [
        { type: "asked_how_it_works",  triggeredBy: "Tell me more about how this works", confidence: 0.80, detectedAt: hoursAgo(4) },
        { type: "positive_sentiment",  triggeredBy: "That actually sounds pretty cool",  confidence: 0.65, detectedAt: hoursAgo(3.5) },
      ],
      lastUpdated: hoursAgo(3.5),
      reasoning:   "WARM (42): Curious, engaged, asking questions. No pricing inquiry yet.",
    },
    stage:      "qualifying",
    control:    "ai",
    escalation: "none",
    qualification: {
      city:          "Akron",
      category:      "landscaping",
      interestLevel: "curious",
      timeline:      "soon",
      hasReplied:    true,
      messageCount:  3,
    },
    messages: [
      { id: "m-003-1", role: "ai",   channel: "sms", body: "Hey Carlos! We work with landscapers in Akron — direct mail postcard campaigns, exclusive to your business in your category. Got a spot open.", sentAt: hoursAgo(5), isRead: true, intentScore: 0 },
      { id: "m-003-2", role: "lead", channel: "sms", body: "Tell me more about how this works", sentAt: hoursAgo(4), isRead: true, intentScore: 18, signals: ["asked_how_it_works"] },
      { id: "m-003-3", role: "ai",   channel: "sms", body: "Basically we mail to every homeowner in your route — your name, number, and logo front and center. No sharing. Postcards get kept on fridges for months.", sentAt: hoursAgo(3.8), isRead: true, intentScore: 0 },
      { id: "m-003-4", role: "lead", channel: "sms", body: "That actually sounds pretty cool. How many homes does it go to?", sentAt: hoursAgo(3.5), isRead: true, intentScore: 12, signals: ["asked_specific_question"] },
    ],
    summary:         "Curious, asking good questions. Spring season relevant. Push toward availability check.",
    lastMessageAt:   hoursAgo(3.5),
    lastMessageBody: "That actually sounds pretty cool. How many homes does it go to?",
    lastMessageRole: "lead",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    249,
    alertCount:      0,
    createdAt:       daysAgo(2),
    updatedAt:       hoursAgo(3.5),
  },

  // ── 4. WARM — objection ────────────────────────────────────────────────────
  {
    id: "lead-004",
    businessName: "Barberton Window & Door",
    contactName:  "Rachel Hollis",
    phone:        "(330) 745-8800",
    city:         "Barberton",
    state:        "OH",
    category:     "windows",
    source:       "outbound_sms",
    classification: {
      temperature: "warm",
      score:       35,
      signals: [
        { type: "said_interested",  triggeredBy: "Sounds interesting actually", confidence: 0.70, detectedAt: hoursAgo(6) },
      ],
      lastUpdated: hoursAgo(3),
      reasoning:   "WARM (35): Replied with interest, then raised timing concern.",
    },
    stage:      "warm_engaged",
    control:    "ai",
    escalation: "none",
    qualification: {
      city:          "Barberton",
      category:      "windows",
      interestLevel: "curious",
      timeline:      "later",
      hasReplied:    true,
      messageCount:  4,
    },
    messages: [
      { id: "m-004-1", role: "ai",   channel: "sms", body: "Hi Rachel! Open spot for window & door companies in Barberton — direct mail, your name exclusively to every homeowner in your route.", sentAt: hoursAgo(8), isRead: true, intentScore: 0 },
      { id: "m-004-2", role: "lead", channel: "sms", body: "Sounds interesting actually. When does it go out?", sentAt: hoursAgo(6), isRead: true, intentScore: 10, signals: ["said_interested"] },
      { id: "m-004-3", role: "ai",   channel: "sms", body: "We can set your run for this month or next — usually takes about 2 weeks to get cards printed and mailed. Want me to check exact timing?", sentAt: hoursAgo(5.8), isRead: true, intentScore: 0 },
      { id: "m-004-4", role: "lead", channel: "sms", body: "Budget's a little tight right now, might wait until summer", sentAt: hoursAgo(3), isRead: true, intentScore: 8 },
    ],
    summary:         "Interested but soft budget objection. Timing concern — revisit late May/June.",
    lastMessageAt:   hoursAgo(3),
    lastMessageBody: "Budget's a little tight right now, might wait until summer",
    lastMessageRole: "lead",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    249,
    alertCount:      0,
    createdAt:       daysAgo(3),
    updatedAt:       hoursAgo(3),
  },

  // ── 5. COLD — no response, 1 follow-up sent ────────────────────────────────
  {
    id: "lead-005",
    businessName: "Tallmadge Pest Control",
    contactName:  "Steve Nguyen",
    phone:        "(330) 633-5500",
    city:         "Tallmadge",
    state:        "OH",
    category:     "pest_control",
    source:       "outbound_sms",
    classification: {
      temperature: "cold",
      score:       0,
      signals:     [],
      lastUpdated: daysAgo(2),
      reasoning:   "COLD (0): No reply to initial or first follow-up.",
    },
    stage:      "follow_up",
    control:    "ai",
    escalation: "none",
    qualification: {
      city:          "Tallmadge",
      category:      "pest_control",
      interestLevel: "none",
      timeline:      "unknown",
      hasReplied:    false,
      messageCount:  0,
    },
    messages: [
      { id: "m-005-1", role: "ai", channel: "sms", body: "Hey Steve! HomeReach here — we have an open spot for pest control companies in Tallmadge. One per category. Worth a look?", sentAt: daysAgo(3), isRead: false, intentScore: 0 },
      { id: "m-005-2", role: "ai", channel: "sms", body: "Hey Steve, just circling back — the Tallmadge pest control spot is still open. Worth 2 minutes to take a look?", sentAt: daysAgo(2), isRead: false, intentScore: 0 },
    ],
    summary:         "No response after initial + 1 follow-up. Due for 2nd follow-up.",
    lastMessageAt:   daysAgo(2),
    lastMessageBody: "Hey Steve, just circling back — the Tallmadge pest control spot is still open. Worth 2 minutes to take a look?",
    lastMessageRole: "ai",
    followUpCount:   1,
    followUpNextAt:  daysAgo(-1),
    maxFollowUps:    3,
    alertCount:      0,
    createdAt:       daysAgo(3),
    updatedAt:       daysAgo(2),
  },

  // ── 6. HUMAN ACTIVE — agent is in the convo ───────────────────────────────
  {
    id: "lead-006",
    businessName: "Cuyahoga Falls Painting",
    contactName:  "Tom Parker",
    phone:        "(330) 922-3300",
    city:         "Cuyahoga Falls",
    state:        "OH",
    category:     "painting",
    source:       "outbound_sms",
    classification: {
      temperature: "hot",
      score:       90,
      signals: [
        { type: "asked_pricing",    triggeredBy: "What's the monthly cost for this?", confidence: 0.95, detectedAt: daysAgo(1) },
        { type: "expressed_urgency", triggeredBy: "Spring's almost here need to get going", confidence: 0.88, detectedAt: daysAgo(1) },
        { type: "mentioned_readiness", triggeredBy: "Ready to move forward if price is right", confidence: 0.88, detectedAt: hoursAgo(22) },
      ],
      lastUpdated: hoursAgo(22),
      reasoning:   "HOT (90): Pricing, urgency, and readiness signals all present.",
    },
    stage:      "hot_escalated",
    control:    "human",
    escalation: "human_active",
    agentId:    "agent-1",
    qualification: {
      city:          "Cuyahoga Falls",
      category:      "painting",
      businessName:  "Cuyahoga Falls Painting",
      interestLevel: "ready",
      timeline:      "now",
      hasReplied:    true,
      messageCount:  6,
    },
    messages: [
      { id: "m-006-1", role: "ai",         channel: "sms", body: "Hey Tom! HomeReach — exclusive spot open for painters in Cuyahoga Falls. Your name on every homeowner postcard in the area.", sentAt: daysAgo(2), isRead: true, intentScore: 0 },
      { id: "m-006-2", role: "lead",        channel: "sms", body: "What's the monthly cost for this?", sentAt: daysAgo(1), isRead: true, intentScore: 35, signals: ["asked_pricing"] },
      { id: "m-006-3", role: "ai",         channel: "sms", body: "Great question — pulling in our team to get you exact numbers for Cuyahoga Falls. One sec.", sentAt: daysAgo(1), isRead: true, intentScore: 0 },
      { id: "m-006-4", role: "lead",        channel: "sms", body: "Spring's almost here need to get going on marketing", sentAt: daysAgo(1), isRead: true, intentScore: 25, signals: ["expressed_urgency"] },
      { id: "m-006-5", role: "lead",        channel: "sms", body: "Ready to move forward if price is right", sentAt: hoursAgo(22), isRead: true, intentScore: 25, signals: ["mentioned_readiness"] },
      { id: "m-006-6", role: "human_agent", channel: "sms", body: "Hey Tom! This is Jason from HomeReach. For Cuyahoga Falls we have the anchor spot at $399/mo — covers 2,500+ homes every month, exclusive to you. Want me to lock it in?", sentAt: hoursAgo(20), isRead: true, intentScore: 0 },
    ],
    summary:         "Agent active. Pricing + urgency + readiness confirmed. Close imminent.",
    lastMessageAt:   hoursAgo(20),
    lastMessageBody: "Hey Tom! This is Jason from HomeReach. For Cuyahoga Falls we have the anchor spot at $399/mo...",
    lastMessageRole: "human_agent",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    399,
    alertSentAt:     daysAgo(1),
    alertCount:      1,
    createdAt:       daysAgo(2),
    updatedAt:       hoursAgo(20),
  },

  // ── 7. COLD — fresh, no reply yet ─────────────────────────────────────────
  {
    id: "lead-007",
    businessName: "Twinsburg Garage Doors",
    contactName:  "Brad Kowalski",
    phone:        "(330) 425-5500",
    city:         "Twinsburg",
    state:        "OH",
    category:     "garage_door",
    source:       "outbound_sms",
    classification: {
      temperature: "cold",
      score:       0,
      signals:     [],
      lastUpdated: hoursAgo(6),
      reasoning:   "COLD (0): Initial outreach sent 6 hours ago. No response.",
    },
    stage:      "awaiting_response",
    control:    "ai",
    escalation: "none",
    qualification: {
      city:          "Twinsburg",
      category:      "garage_door",
      interestLevel: "none",
      timeline:      "unknown",
      hasReplied:    false,
      messageCount:  0,
    },
    messages: [
      { id: "m-007-1", role: "ai", channel: "sms", body: "Hi Brad! HomeReach here — we have an exclusive spot for garage door companies in Twinsburg. One business per category. Want me to check if yours is still open?", sentAt: hoursAgo(6), isRead: false, intentScore: 0 },
    ],
    summary:         "Initial outreach sent. No reply yet.",
    lastMessageAt:   hoursAgo(6),
    lastMessageBody: "Hi Brad! HomeReach here — we have an exclusive spot for garage door companies in Twinsburg.",
    lastMessageRole: "ai",
    followUpCount:   0,
    followUpNextAt:  hoursAgo(-18),
    maxFollowUps:    3,
    alertCount:      0,
    createdAt:       hoursAgo(6),
    updatedAt:       hoursAgo(6),
  },

  // ── 8. CLOSED WON ─────────────────────────────────────────────────────────
  {
    id: "lead-008",
    businessName: "North Hill Insurance",
    contactName:  "Patricia Reed",
    phone:        "(330) 867-9100",
    city:         "Akron",
    state:        "OH",
    category:     "insurance",
    source:       "outbound_sms",
    classification: {
      temperature: "hot",
      score:       95,
      signals: [
        { type: "said_interested",    triggeredBy: "Yes let's do it", confidence: 0.90, detectedAt: daysAgo(5) },
        { type: "asked_how_to_start", triggeredBy: "How do I sign up?",  confidence: 0.95, detectedAt: daysAgo(5) },
      ],
      lastUpdated: daysAgo(5),
      reasoning:   "HOT → Closed won.",
    },
    stage:      "closed_won",
    control:    "human",
    escalation: "resolved",
    agentId:    "agent-1",
    qualification: {
      city:          "Akron",
      category:      "insurance",
      businessName:  "North Hill Insurance",
      interestLevel: "ready",
      timeline:      "now",
      hasReplied:    true,
      messageCount:  5,
    },
    messages: [
      { id: "m-008-1", role: "ai",         channel: "sms", body: "Hi Patricia! Open spot for insurance agencies in Akron — direct mail postcard campaign, exclusively yours.", sentAt: daysAgo(6), isRead: true, intentScore: 0 },
      { id: "m-008-2", role: "lead",        channel: "sms", body: "Yes let's do it. How do I sign up?", sentAt: daysAgo(5), isRead: true, intentScore: 65, signals: ["said_interested", "asked_how_to_start"] },
      { id: "m-008-3", role: "ai",         channel: "sms", body: "Awesome! Let me get you connected with our team right now.", sentAt: daysAgo(5), isRead: true, intentScore: 0 },
      { id: "m-008-4", role: "human_agent", channel: "sms", body: "Patricia, Jason here! Welcome — you're locked in for Akron Insurance. Sending your onboarding link now.", sentAt: daysAgo(5), isRead: true, intentScore: 0 },
      { id: "m-008-5", role: "lead",        channel: "sms", body: "Great, just signed up. Looking forward to it!", sentAt: daysAgo(4), isRead: true, intentScore: 0 },
    ],
    summary:         "Closed won. Signed up same day. $299/mo.",
    lastMessageAt:   daysAgo(4),
    lastMessageBody: "Great, just signed up. Looking forward to it!",
    lastMessageRole: "lead",
    followUpCount:   0,
    maxFollowUps:    3,
    monthlyValue:    299,
    alertSentAt:     daysAgo(5),
    alertCount:      1,
    createdAt:       daysAgo(6),
    updatedAt:       daysAgo(4),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Mock Alerts (corresponding to hot leads)
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_HOT_ALERTS: HotLeadAlert[] = [
  {
    id:           "alert-001",
    leadId:       "lead-001",
    businessName: "Fairlawn Roofing LLC",
    city:         "Fairlawn",
    category:     "roofing",
    summary:      "Fairlawn Roofing LLC asked about pricing — ready to evaluate.",
    lastMessage:  "How much does this run per month?",
    sentTo:       "+13302069639",
    formattedMessage: "🔥 HOT LEAD\nFairlawn Roofing LLC – Fairlawn\nroofing\nLast: 'How much does this run per month?'\nFairlawn Roofing LLC asked about pricing — ready to evaluate.\nAct now.",
    sentAt:       hoursAgo(0.9),
    status:       "sent",
  },
  {
    id:           "alert-002",
    leadId:       "lead-002",
    businessName: "Summit Electrical Services",
    city:         "Akron",
    category:     "electrician",
    summary:      "Summit Electrical asked 'How do I get started?' — hot buying signal.",
    lastMessage:  "How do I get started?",
    sentTo:       "+13302069639",
    formattedMessage: "🔥 HOT LEAD\nSummit Electrical Services – Akron\nelectrician\nLast: 'How do I get started?'\nSummit Electrical asked how to get started — hot buying signal.\nAct now.",
    sentAt:       hoursAgo(0.25),
    status:       "sent",
  },
  {
    id:           "alert-003",
    leadId:       "lead-006",
    businessName: "Cuyahoga Falls Painting",
    city:         "Cuyahoga Falls",
    category:     "painting",
    summary:      "Cuyahoga Falls Painting is ready to move forward if price is right.",
    lastMessage:  "Ready to move forward if price is right",
    sentTo:       "+13302069639",
    formattedMessage: "🔥 HOT LEAD\nCuyahoga Falls Painting – Cuyahoga Falls\npainting\nLast: 'Ready to move forward if price is right'\nCuyahoga Falls Painting indicated they're ready to move forward.\nAct now.",
    sentAt:       daysAgo(1),
    status:       "sent",
  },
  {
    id:           "alert-004",
    leadId:       "lead-008",
    businessName: "North Hill Insurance",
    city:         "Akron",
    category:     "insurance",
    summary:      "North Hill Insurance said 'Yes let's do it' — immediate close opportunity.",
    lastMessage:  "Yes let's do it. How do I sign up?",
    sentTo:       "+13302069639",
    formattedMessage: "🔥 HOT LEAD\nNorth Hill Insurance – Akron\ninsurance\nLast: 'Yes let's do it. How do I sign up?'\nNorth Hill Insurance said they're ready — immediate close.\nAct now.",
    sentAt:       daysAgo(5),
    status:       "sent",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Stats helper
// ─────────────────────────────────────────────────────────────────────────────

import type { SalesEngineStats } from "./types";

export function computeSalesStats(leads: SalesLead[]): SalesEngineStats {
  const hot     = leads.filter((l) => l.classification.temperature === "hot").length;
  const warm    = leads.filter((l) => l.classification.temperature === "warm").length;
  const cold    = leads.filter((l) => l.classification.temperature === "cold").length;
  const escaped = leads.filter((l) => l.escalation !== "none").length;
  const humanActive = leads.filter((l) => l.control === "human").length;

  const today = new Date(); today.setHours(0,0,0,0);
  const alertsToday = MOCK_HOT_ALERTS.filter((a) => new Date(a.sentAt) >= today).length;

  const closedWon  = leads.filter((l) => l.stage === "closed_won");
  const totalMRR   = closedWon.reduce((s, l) => s + (l.monthlyValue ?? 0), 0);
  const convRate   = leads.length > 0 ? Math.round((closedWon.length / leads.length) * 100) : 0;

  return {
    totalLeads:         leads.length,
    hot, warm, cold,
    escalated:          escaped,
    humanActive,
    alertsSentToday:    alertsToday,
    avgResponseTimeMin: 12,
    conversionRate:     convRate,
    totalMRR,
  };
}
