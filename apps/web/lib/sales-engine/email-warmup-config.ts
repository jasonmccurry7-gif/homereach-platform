// ─────────────────────────────────────────────────────────────────────────────
// Email Warm-Up Configuration
//
// SEED LIST  — internal addresses used to build sender reputation.
//              These inboxes should open emails and reply when possible.
//
// RAMP TABLE — daily volume targets per agent identity.
//              Days 1-3: seeds only. Days 4+: blend with real prospects.
// ─────────────────────────────────────────────────────────────────────────────

// ── Seed recipients ──────────────────────────────────────────────────────────
// Add any internal/trusted addresses here. All warm-up emails during Days 1-3
// go exclusively to this list. After Day 3, seeds are interleaved with real
// prospect emails at the ratios defined in WARMUP_RAMP.
export const WARMUP_SEED_EMAILS: string[] = [
  "jasonmccurry7@gmail.com",
  "livetogivemarketing@gmail.com",
];

// ── Daily ramp schedule ───────────────────────────────────────────────────────
// seed_ratio: fraction of each day's target sent to seed addresses (vs. real)
// 1.0 = 100% seeds, 0.0 = 100% real. Seeds always fire first each day.
export interface WarmupRampEntry {
  dayStart:   number;
  dayEnd:     number;  // inclusive; use 9999 for "forever"
  dailyTarget: number;
  seedRatio:  number;
}

export const WARMUP_RAMP: WarmupRampEntry[] = [
  { dayStart:  1, dayEnd:  3, dailyTarget: 10, seedRatio: 1.0  }, // Days 1-3:  seeds only
  { dayStart:  4, dayEnd:  7, dailyTarget: 25, seedRatio: 0.80 }, // Days 4-7:  80% seeds
  { dayStart:  8, dayEnd: 14, dailyTarget: 50, seedRatio: 0.50 }, // Days 8-14: 50/50
  { dayStart: 15, dayEnd: 9999, dailyTarget: 75, seedRatio: 0.20 }, // Day 15+:   20% seeds
];

export function getRampEntry(warmupDay: number): WarmupRampEntry {
  return (
    WARMUP_RAMP.find(r => warmupDay >= r.dayStart && warmupDay <= r.dayEnd) ??
    WARMUP_RAMP[WARMUP_RAMP.length - 1]!
  );
}

// ── Seed email templates ──────────────────────────────────────────────────────
// Natural-sounding messages used for seed sends. Mailbox providers measure
// engagement (opens, replies), so these should read as real correspondence.
export interface WarmupTemplate {
  subject: string;
  body:    string;  // plain text; HTML wrapper added by send function
}

export const WARMUP_SEED_TEMPLATES: WarmupTemplate[] = [
  {
    subject: "Quick check-in",
    body:    "Hey, just following up — wanted to make sure everything's going smoothly on your end. Let me know if there's anything I can help with.",
  },
  {
    subject: "Checking in",
    body:    "Hope things are going well! Just reaching out to connect and see if there's any way we can support you this week.",
  },
  {
    subject: "Touching base",
    body:    "Just wanted to drop a quick note to say hi and see how everything is going. Always good to stay in touch — feel free to reply anytime.",
  },
  {
    subject: "Quick update from us",
    body:    "A few things are moving on our end and I wanted to keep you in the loop. Happy to chat more whenever works for you.",
  },
  {
    subject: "Hope this finds you well",
    body:    "Just a quick message to check in and make sure you have everything you need from us. Reply anytime — always good to hear from you.",
  },
  {
    subject: "Following up",
    body:    "Hey — didn't want to let too much time pass without reaching out. Let me know if there's anything on your end you'd like to discuss.",
  },
  {
    subject: "Staying connected",
    body:    "Wanted to take a moment to check in and make sure we're all aligned. Feel free to reply with any thoughts or questions.",
  },
  {
    subject: "A quick hello",
    body:    "Just popping in to say hello and make sure things are on track. Looking forward to hearing from you soon.",
  },
];

// Pick a template by index (rotate daily so inboxes see varied content)
export function getSeedTemplate(day: number, recipientIndex: number): WarmupTemplate {
  const offset = (day - 1 + recipientIndex) % WARMUP_SEED_TEMPLATES.length;
  return WARMUP_SEED_TEMPLATES[offset]!;
}
