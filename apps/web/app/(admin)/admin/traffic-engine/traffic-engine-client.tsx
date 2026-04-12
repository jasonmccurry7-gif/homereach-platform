"use client";

import { useState, useCallback } from "react";
import type { CityExpansionData } from "./page";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "fb-engine" | "outbound" | "city-expansion" | "ad-copy";

interface Props {
  cities: CityExpansionData[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORIES = [
  "Roofing",
  "HVAC",
  "Real Estate",
  "Med Spa",
  "Plumbing",
  "Landscaping",
  "Pest Control",
  "Pool Service",
  "Cleaning Service",
  "Solar",
  "Windows & Doors",
  "Gutters",
  "Painting",
  "Flooring",
  "Kitchen Remodeling",
  "Bathroom Remodeling",
  "Electrician",
  "Tree Service",
  "Garage Doors",
  "Deck & Patio",
  "Fence",
  "Insulation",
  "Concrete",
  "Chimney",
  "Security Systems",
];

const FB_CITIES = [
  "Austin, TX",
  "Dallas, TX",
  "Houston, TX",
  "San Antonio, TX",
  "Phoenix, AZ",
  "Scottsdale, AZ",
  "Denver, CO",
  "Nashville, TN",
  "Charlotte, NC",
  "Raleigh, NC",
  "Atlanta, GA",
  "Tampa, FL",
  "Orlando, FL",
  "Jacksonville, FL",
  "Las Vegas, NV",
];

// ─────────────────────────────────────────────────────────────────────────────
// FB Post Templates
// ─────────────────────────────────────────────────────────────────────────────

function getPostsForCityAndCategory(city: string, category: string, seed: number) {
  const questionHooks = [
    `Would 2,500 homeowners in ${city} seeing your ${category} business every month help you grow?\n\nWe mail to verified homeowners — exclusive placement, one business per category.\n\nComment "info" and I'll send details. 👇`,
    `If 2,500 ${city} homeowners saw your ${category} business every month — how many new customers could you handle?\n\nSerious question. We have one spot left.\n\nComment below or DM me. 👇`,
    `Quick question for ${category} businesses in ${city}:\n\nHow are you currently generating referrals?\n\nBecause we have a direct mail spot open that reaches 2,500+ homeowners in your area — exclusively. No competitors on the same mailer.\n\nDrop a comment if you want details. 👇`,
    `${city} homeowners spend an average of $12k+ on home services every year.\n\nIs your ${category} business visible to them?\n\nWe have one open spot on a monthly homeowner mailer. Exclusive. No competing ${category} businesses on the same piece.\n\nComment "yes" if you want to see if your market is available. 👇`,
    `What would it mean for your ${category} business if 2,500 ${city} homeowners saw your name every single month?\n\nWe do that. One business per category. Exclusive placement. Direct mail to verified homeowners.\n\nThis isn't for everyone — but if you're looking to grow in ${city}, it might be for you.\n\nDM me or comment below. 👇`,
  ];

  const scarcityPosts = [
    `Only 2 spots left in ${city} for home service businesses on our homeowner mailer.\n\n${category} is still available. After this, waitlist only.\n\nIf that's you — DM me now.`,
    `The ${category} spot in ${city} just opened back up.\n\nPrevious business closed down. It's available again.\n\nWe mail to 2,500+ homeowners every month. One business per category. No exceptions.\n\nIf you're a ${category} business in ${city}, this is for you. DM me today.`,
    `Running out of space in ${city}.\n\n${category} is still available — but we're filling fast.\n\n📬 2,500 homeowners per month\n🔒 Exclusive placement\n🏆 One business per category\n\nComment "available" and I'll check your specific market.`,
    `Last call for ${city} — ${category} spot still open.\n\nAfter this one fills, it's waitlist only (usually 3–6 months).\n\nIf growing your ${category} business in ${city} is on your list this year — now is the time. DM me.`,
  ];

  const opportunityPosts = [
    `I'm opening up a local advertising spot in ${city} — looking for one ${category} business to partner with.\n\nNot an agency. Not a directory. Direct mail to verified homeowners in your exact market.\n\n2,500 homeowners. Monthly. Exclusive.\n\nIf that sounds interesting, DM me and I'll tell you more. No pitch, promise.`,
    `Looking for a great ${category} business in ${city} to feature in our monthly homeowner mailer.\n\nWe've been doing this for years. One business per category. No competitors.\n\nIf you're good at what you do and want more visibility — this is worth a conversation.\n\nDM me or drop a comment. 👇`,
    `Not a pitch — genuinely looking for a ${category} business in ${city} who wants more visibility with homeowners.\n\nWe run a direct mail program. 2,500+ homeowners per month. Exclusive placement.\n\nIf you're the right fit, awesome. If not, no hard feelings.\n\nComment or DM me if you want to learn more.`,
    `Building a direct mail program in ${city} targeting verified homeowners.\n\nNeed a great ${category} business to feature.\n\nHere's the deal:\n✅ 2,500+ homeowners see your business every month\n✅ You're the only ${category} on the mailer\n✅ No long-term contract to start\n\nInterested? Drop a comment and I'll send details.`,
  ];

  const qi = seed % questionHooks.length;
  const si = seed % scarcityPosts.length;
  const oi = seed % opportunityPosts.length;

  return {
    question: questionHooks[qi],
    scarcity: scarcityPosts[si],
    opportunity: opportunityPosts[oi],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// DM Scripts
// ─────────────────────────────────────────────────────────────────────────────

const DM_SCRIPTS = [
  {
    label: "Initial response — after comment/like",
    script: (city: string, cat: string) =>
      `Hey! Thanks for reaching out — are you currently the owner of a ${cat} business in ${city}, or looking on behalf of someone else?\n\nJust want to make sure I send you the right info!`,
  },
  {
    label: "After they confirm ownership",
    script: (city: string, cat: string) =>
      `Perfect! We help ${cat} businesses reach 2,500+ homeowners in ${city} every month through direct mail — exclusive placement, one business per category.\n\nIt takes about 2 minutes to see if your spot is still available:\n👉 homereach.com/get-started\n\nWant me to check availability in ${city} for you right now?`,
  },
  {
    label: "They asked how much it costs",
    script: (city: string, _cat: string) =>
      `Great question! Pricing depends on your city and the spot type, but it's designed to be affordable for local businesses.\n\nYou can see exact pricing (and check if your market is still available) here:\n👉 homereach.com/get-started\n\nTakes about 60 seconds. No commitment to check.`,
  },
  {
    label: "They went cold after showing interest",
    script: (city: string, cat: string) =>
      `Hey — just following up from my earlier message! The ${cat} spot in ${city} is still available, but we're moving through our list.\n\nNo pressure at all — just didn't want you to miss it if it was something you were considering.\n\nWant me to hold it for you for 24 hours?`,
  },
  {
    label: "Final follow-up (last touch)",
    script: (city: string, cat: string) =>
      `Last message from me — I promise!\n\nThe ${cat} spot in ${city} is about to be offered to the next person on the list. If you want it, now's the time.\n\nIf the timing isn't right, totally understand. Just reply "not now" and I'll take you off my list.\n\nEither way — no hard feelings!`,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Outbound Sequences
// ─────────────────────────────────────────────────────────────────────────────

function getOutboundSequence(city: string, category: string, businessName: string) {
  return {
    email1: {
      subject: `Quick question, ${businessName}`,
      body: `Hi there,

Quick question — are you currently looking to grow your ${category} business in ${city}, or pretty set right now?

I run a direct mail program that puts local businesses in front of 2,500+ homeowners every month. Exclusive placement — one ${category} business per city.

Not sure if it's a fit, but figured it was worth asking.

— Jason
HomeReach`,
    },
    sms1: {
      body: `Hey, this is Jason with HomeReach. Quick question — are you looking to grow your ${category} business in ${city} this year? We have one open spot on a homeowner mailer. Worth a 2-min conversation?`,
    },
    email2: {
      subject: `Re: Quick question, ${businessName}`,
      body: `Hi again,

Just wanted to follow up on my last note.

We have one open spot in ${city} for a ${category} business on our monthly homeowner mailer. 2,500+ verified homeowners. Exclusive — no competing businesses on the same piece.

Here's what a few partners have said:
- "We got 3 new customers in the first month"
- "Best ROI of anything we've tried locally"
- "The exclusivity alone is worth it"

If you're interested, you can check if your spot is still available here: homereach.com/get-started

Takes about 2 minutes.

— Jason`,
    },
    sms2: {
      body: `Hey ${businessName}, Jason again from HomeReach. The ${category} spot in ${city} is still open — wanted to make sure you saw my last message. Reply "info" and I'll send details, or "stop" to opt out.`,
    },
    email3: {
      subject: `Last note — ${city} ${category} spot`,
      body: `Hi,

Last note from me — I promise.

The ${category} spot in ${city} is still available. After it fills, the next opening is typically 3–6 months out.

If the timing isn't right, totally understand — no hard feelings. Just reply and let me know and I'll take you off my list.

If you want to see if it's a fit: homereach.com/get-started

Either way, appreciate your time.

— Jason
HomeReach`,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ad Copy Library
// ─────────────────────────────────────────────────────────────────────────────

const AD_COPY = {
  headlines: [
    "Reach 2,500+ homeowners in your city every month",
    "Only one [category] business per city",
    "Limited spots available in [City]",
    "Local businesses: want more visibility?",
    "Exclusive placement. No competitors. Direct mail.",
    "2,500 homeowners will see your business this month",
    "Stop sharing ad space. Own your market.",
    "The only [category] business homeowners see this month",
  ],
  primaryDescriptions: [
    "HomeReach puts your business in front of 2,500+ verified homeowners every month — exclusively. One business per category, per city. Check availability in your market.",
    "Direct mail to 2,500+ homeowners. Exclusive placement. No competing businesses on the same piece. See if your city is still available.",
    "We mail to homeowners in your city every month. You're the only [category] business on the mailer. No contracts. Cancel anytime after 90 days.",
  ],
  callsToAction: [
    "Check Availability →",
    "Claim Your Spot →",
    "See If Your City Is Open →",
    "Get Started →",
    "Check My Market →",
  ],
  targetingNotes: [
    "Target: Small business owners, home services, local radius (15–25 miles from city center)",
    "Interest targeting: Small business owners, entrepreneurs, home improvement, contractor services",
    "Lookalike: Upload your current customer list and target similar business owners in each metro",
    "Retargeting: Anyone who visited /get-started but didn't complete checkout — hit them with scarcity angle",
    "Facebook groups: Post in local business owner groups, home services groups, entrepreneur groups in each target city",
  ],
  landingOptions: [
    "Option A: homereach.com/get-started — City selection page (warm traffic)",
    "Option B: homereach.com/targeted — Calculator page (colder traffic, higher intent filter)",
    "Option C: Direct to /get-started/[city-slug] — Skip city picker, use if targeting city-specific ads",
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Utility
// ─────────────────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);

  return (
    <button
      onClick={copy}
      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${
        copied
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white"
      }`}
    >
      {copied ? "✓ Copied!" : "Copy"}
    </button>
  );
}

function ScriptCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</span>
        <CopyButton text={text} />
      </div>
      <pre className="px-4 py-3 text-sm text-gray-200 whitespace-pre-wrap font-sans leading-relaxed">
        {text}
      </pre>
    </div>
  );
}

function PostCard({
  type,
  emoji,
  label,
  text,
}: {
  type: string;
  emoji: string;
  label: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-lg">{emoji}</span>
          <div>
            <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">{type}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        </div>
        <CopyButton text={text} />
      </div>
      <div className="p-4">
        <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// City status helper
// ─────────────────────────────────────────────────────────────────────────────

function cityStatus(city: CityExpansionData) {
  const a = city.activeSpots;
  if (a === 0) return { label: "Open", color: "green", dot: "bg-green-400", badge: "bg-green-900/30 text-green-400 border-green-800/50" };
  if (a <= 3) return { label: "Getting traction", color: "yellow", dot: "bg-yellow-400", badge: "bg-yellow-900/30 text-yellow-400 border-yellow-800/50" };
  if (a <= 6) return { label: "Filling fast", color: "orange", dot: "bg-orange-400 animate-pulse", badge: "bg-orange-900/30 text-orange-400 border-orange-800/50" };
  return { label: "Near capacity", color: "red", dot: "bg-red-400 animate-pulse", badge: "bg-red-900/30 text-red-400 border-red-800/50" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function TrafficEngineClient({ cities }: Props) {
  const [tab, setTab] = useState<Tab>("fb-engine");

  // FB Engine state
  const [fbCity, setFbCity] = useState(FB_CITIES[0]);
  const [fbCategory, setFbCategory] = useState(CATEGORIES[0]);
  const [fbSeed, setFbSeed] = useState(0);
  const posts = getPostsForCityAndCategory(fbCity, fbCategory, fbSeed);

  // Outbound state
  const [obCity, setObCity] = useState(FB_CITIES[0]);
  const [obCategory, setObCategory] = useState(CATEGORIES[0]);
  const [obBusinessName, setObBusinessName] = useState("Acme Roofing");
  const [obTouch, setObTouch] = useState<"email1" | "sms1" | "email2" | "sms2" | "email3">("email1");
  const sequence = getOutboundSequence(obCity, obCategory, obBusinessName);

  // DM Scripts state
  const [dmCity, setDmCity] = useState(FB_CITIES[0]);
  const [dmCategory, setDmCategory] = useState(CATEGORIES[0]);

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "fb-engine", label: "FB Growth Engine", emoji: "📱" },
    { id: "outbound", label: "Outbound Engine", emoji: "📞" },
    { id: "city-expansion", label: "City Expansion", emoji: "🗺️" },
    { id: "ad-copy", label: "Ad Copy Library", emoji: "📣" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Traffic Engine</h1>
          <p className="mt-1 text-sm text-gray-400">
            Feed the machine — consistent leads, consistent revenue.
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-blue-800/50 bg-blue-900/10 px-4 py-2">
          <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          <span className="text-sm text-blue-400 font-medium">LIVE</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-gray-800/50 p-1 border border-gray-700">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
              tab === t.id
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-gray-700"
            }`}
          >
            <span>{t.emoji}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ─── TAB: FB GROWTH ENGINE ─────────────────────────────────────────── */}
      {tab === "fb-engine" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <p className="text-sm font-semibold text-gray-300 mb-4">Generate daily posts for:</p>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">City</label>
                <select
                  value={fbCity}
                  onChange={(e) => setFbCity(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {FB_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                  <option value="custom">Custom city…</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">Category</label>
                <select
                  value={fbCategory}
                  onChange={(e) => setFbCategory(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFbSeed((s) => s + 1)}
                  className="flex items-center gap-2 rounded-lg bg-gray-700 border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                >
                  🔄 Rotate variations
                </button>
              </div>
            </div>
          </div>

          {/* Daily Posts */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Today&apos;s Posts
              </h2>
              <span className="text-xs text-gray-500">— Ready to copy and post</span>
            </div>
            <div className="space-y-4">
              <PostCard
                type="Type 1 — Question Hook"
                emoji="🤔"
                label="Designed to trigger comments + DMs"
                text={posts.question}
              />
              <PostCard
                type="Type 2 — Scarcity"
                emoji="⏳"
                label="Creates urgency, drives fast action"
                text={posts.scarcity}
              />
              <PostCard
                type="Type 3 — Opportunity"
                emoji="🤝"
                label="Partnership framing, human tone"
                text={posts.opportunity}
              />
            </div>
          </div>

          {/* DM Scripts */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                DM Conversion Scripts
              </h2>
              <span className="text-xs text-gray-500">— When someone comments or reaches out</span>
            </div>

            <div className="flex flex-wrap gap-4 mb-4">
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">City (for DMs)</label>
                <select
                  value={dmCity}
                  onChange={(e) => setDmCity(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {FB_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">Category (for DMs)</label>
                <select
                  value={dmCategory}
                  onChange={(e) => setDmCategory(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-3">
              {DM_SCRIPTS.map((dm) => (
                <ScriptCard
                  key={dm.label}
                  label={dm.label}
                  text={dm.script(dmCity, dmCategory)}
                />
              ))}
            </div>
          </div>

          {/* Comment Reply Scripts */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Comment Reply Scripts
              </h2>
              <span className="text-xs text-gray-500">— Reply fast, move to DM</span>
            </div>
            <div className="space-y-3">
              {[
                {
                  label: "They asked about price",
                  text: `Hey! Pricing depends on your city — you can check availability and see exact rates here: homereach.com/get-started — takes about 60 seconds 👍`,
                },
                {
                  label: "They asked how it works",
                  text: `Great question! We design and mail a branded postcard to 2,500+ homeowners in your city every month. Your business is the ONLY ${fbCategory} featured — no competitors on the same piece. DM me and I'll send full details!`,
                },
                {
                  label: `They said "I'm interested"`,
                  text: `Awesome! DM me and I'll check if ${fbCity} is still available for you 🙌`,
                },
                {
                  label: "They tagged someone else",
                  text: `Hey [tagged person] — happy to answer any questions! DM me or check availability here: homereach.com/get-started 👋`,
                },
                {
                  label: "They said they already tried direct mail",
                  text: `Totally understand — most direct mail doesn't work because you're competing with 10 other businesses on the same piece. Ours is exclusive — you're the only ${fbCategory} on the mailer. Big difference. DM me and I'll show you an example!`,
                },
              ].map((s) => (
                <ScriptCard key={s.label} label={s.label} text={s.text} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: OUTBOUND ENGINE ─────────────────────────────────────────── */}
      {tab === "outbound" && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <p className="text-sm font-semibold text-gray-300 mb-4">
              Generate outreach sequence for:
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">City</label>
                <select
                  value={obCity}
                  onChange={(e) => setObCity(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {FB_CITIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">Category</label>
                <select
                  value={obCategory}
                  onChange={(e) => setObCategory(e.target.value)}
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5 min-w-[180px]">
                <label className="text-xs text-gray-500 font-medium">Business Name</label>
                <input
                  type="text"
                  value={obBusinessName}
                  onChange={(e) => setObBusinessName(e.target.value)}
                  placeholder="e.g. Acme Roofing"
                  className="rounded-lg bg-gray-700 border border-gray-600 px-3 py-2 text-sm text-white placeholder-gray-500"
                />
              </div>
            </div>
          </div>

          {/* Touch selector */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              3-touch sequence (max contact per lead)
            </p>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  { id: "email1", label: "Touch 1 — Email" },
                  { id: "sms1", label: "Touch 2 — SMS" },
                  { id: "email2", label: "Touch 3 — Email" },
                  { id: "sms2", label: "Touch 4 — SMS" },
                  { id: "email3", label: "Touch 5 — Final Email" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setObTouch(t.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                    obTouch === t.id
                      ? "bg-blue-600 text-white"
                      : "bg-gray-700 text-gray-400 border border-gray-600 hover:text-white hover:bg-gray-600"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* The selected touch */}
          {obTouch === "email1" && (
            <div className="space-y-3">
              <ScriptCard label="Subject line" text={sequence.email1.subject} />
              <ScriptCard label="Email body" text={sequence.email1.body} />
            </div>
          )}
          {obTouch === "sms1" && (
            <ScriptCard label="SMS — Touch 2 (send if no email reply in 2 days)" text={sequence.sms1.body} />
          )}
          {obTouch === "email2" && (
            <div className="space-y-3">
              <ScriptCard label="Subject line" text={sequence.email2.subject} />
              <ScriptCard label="Email body" text={sequence.email2.body} />
            </div>
          )}
          {obTouch === "sms2" && (
            <ScriptCard label="SMS — Touch 4 (send if no reply in 2 more days)" text={sequence.sms2.body} />
          )}
          {obTouch === "email3" && (
            <div className="space-y-3">
              <ScriptCard label="Subject line" text={sequence.email3.subject} />
              <ScriptCard label="Email body — Final (after this, stop outreach)" text={sequence.email3.body} />
            </div>
          )}

          {/* Lead sourcing notes */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <h3 className="text-sm font-bold text-white mb-3">📋 Lead Sourcing — Where to Find Them</h3>
            <div className="space-y-2 text-sm text-gray-300">
              {[
                "Google Maps: Search '[category] in [city]' → scrape name, phone, email from listings",
                "Yelp: Filter by category + city, sort by review count (established = has budget)",
                "HomeAdvisor / Angi: Businesses paying for leads = actively looking to grow",
                "Facebook Groups: '[City] Business Owners', '[City] Home Services' — engage then DM",
                "LinkedIn: Search '[category] owner [city]' — works especially well for real estate + med spa",
                "Nextdoor Business Pages: Local businesses with pages = care about local marketing",
                "Chamber of Commerce lists: Usually free PDFs per city, great for high-intent businesses",
              ].map((note, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-blue-400 shrink-0">→</span>
                  <span>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Prioritization */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <h3 className="text-sm font-bold text-white mb-3">🎯 High-Value Categories — Prioritize These</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { cat: "Roofing", why: "Avg job $8k–$15k" },
                { cat: "HVAC", why: "Avg job $3k–$10k" },
                { cat: "Real Estate", why: "$500–$3k/mo budget" },
                { cat: "Med Spa", why: "Repeat customers, high LTV" },
                { cat: "Solar", why: "Avg job $20k–$30k" },
                { cat: "Kitchen Remodeling", why: "Avg job $15k–$50k" },
                { cat: "Bathroom Remodeling", why: "Avg job $8k–$25k" },
                { cat: "Windows & Doors", why: "Avg job $5k–$15k" },
                { cat: "Plumbing", why: "High repeat rate" },
              ].map((item) => (
                <div
                  key={item.cat}
                  className="rounded-lg border border-gray-600 bg-gray-700/50 p-3"
                >
                  <p className="text-sm font-semibold text-white">{item.cat}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{item.why}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: CITY EXPANSION ────────────────────────────────────────────── */}
      {tab === "city-expansion" && (
        <div className="space-y-6">
          {/* Summary stats */}
          {cities.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: "Total Cities",
                  value: cities.length,
                  sub: "in system",
                  color: "text-white",
                },
                {
                  label: "Active Cities",
                  value: cities.filter((c) => c.isActive).length,
                  sub: "live now",
                  color: "text-green-400",
                },
                {
                  label: "Total Active Spots",
                  value: cities.reduce((s, c) => s + c.activeSpots, 0),
                  sub: "paying subscribers",
                  color: "text-blue-400",
                },
                {
                  label: "Total MRR",
                  value: `$${Math.round(cities.reduce((s, c) => s + c.mrrCents, 0) / 100).toLocaleString()}`,
                  sub: "monthly recurring",
                  color: "text-yellow-400",
                },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl border border-gray-700 bg-gray-800/50 p-4"
                >
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{stat.sub}</p>
                </div>
              ))}
            </div>
          )}

          {cities.length === 0 ? (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-8 text-center">
              <p className="text-2xl mb-2">🗺️</p>
              <p className="text-white font-semibold">No cities in DB yet</p>
              <p className="text-sm text-gray-400 mt-1">
                Add cities in Admin → Cities, then they&apos;ll appear here with real spot data.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-gray-700 overflow-hidden">
              <div className="px-5 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
                <h2 className="text-sm font-bold text-white">City Pipeline</h2>
                <span className="text-xs text-gray-500">
                  — {cities.length} cities tracked
                </span>
              </div>
              <div className="divide-y divide-gray-700/50">
                {cities
                  .sort((a, b) => b.activeSpots - a.activeSpots)
                  .map((city) => {
                    const status = cityStatus(city);
                    return (
                      <div
                        key={city.id}
                        className="flex items-center gap-4 px-5 py-4 hover:bg-gray-800/30 transition-colors"
                      >
                        {/* Status dot */}
                        <div className="shrink-0 flex items-center justify-center w-8 h-8">
                          <span className={`w-3 h-3 rounded-full ${status.dot}`} />
                        </div>

                        {/* City info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white">
                              {city.name}, {city.state}
                            </p>
                            {!city.isActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-bold">
                                INACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {city.activeSpots} active · {city.pendingSpots} pending
                          </p>
                        </div>

                        {/* MRR */}
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-white">
                            ${Math.round(city.mrrCents / 100).toLocaleString()}
                          </p>
                          <p className="text-xs text-gray-500">/mo</p>
                        </div>

                        {/* Status badge */}
                        <div className="shrink-0">
                          <span
                            className={`text-xs px-2.5 py-1 rounded-full border font-medium ${status.badge}`}
                          >
                            {status.label}
                          </span>
                        </div>

                        {/* Action */}
                        <div className="shrink-0">
                          {city.activeSpots === 0 ? (
                            <span className="text-xs text-gray-500">Start pushing →</span>
                          ) : city.activeSpots <= 3 ? (
                            <span className="text-xs text-yellow-500">Post daily →</span>
                          ) : (
                            <span className="text-xs text-orange-400 font-semibold">Push hard →</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Expansion playbook */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-5">
            <h3 className="text-sm font-bold text-white mb-4">📈 Expansion Playbook</h3>
            <div className="space-y-3">
              {[
                {
                  trigger: "City at 0 active spots",
                  action: "Post 3x/week in local Facebook groups. Run outbound sequence to top 20 businesses in high-value categories.",
                  urgency: "low",
                },
                {
                  trigger: "City at 1–3 active spots",
                  action: "Post daily. Amplify with scarcity posts. Start Facebook ad ($10–20/day targeting city + home services).",
                  urgency: "medium",
                },
                {
                  trigger: "City at 4–6 active spots",
                  action: "This is your proof-of-concept city. Use it for case studies and social proof in ALL other cities. Push hard with ads.",
                  urgency: "high",
                },
                {
                  trigger: "City hitting 70–80% capacity",
                  action: "Open the next city. Announce waitlist for full city. Redirect ads to new market while maintaining momentum.",
                  urgency: "expand",
                },
                {
                  trigger: "City full",
                  action: "Activate waitlist. Use as social proof everywhere. Start 2 new cities using the same playbook.",
                  urgency: "scale",
                },
              ].map((step) => (
                <div
                  key={step.trigger}
                  className={`flex gap-4 p-3 rounded-lg border ${
                    step.urgency === "low"
                      ? "border-gray-700 bg-gray-700/20"
                      : step.urgency === "medium"
                      ? "border-yellow-800/40 bg-yellow-900/10"
                      : step.urgency === "high"
                      ? "border-orange-800/40 bg-orange-900/10"
                      : "border-blue-800/40 bg-blue-900/10"
                  }`}
                >
                  <div className="shrink-0 w-5 h-5 rounded-full bg-gray-600 flex items-center justify-center mt-0.5">
                    <span className="text-[10px] font-bold text-white">
                      {step.urgency === "low"
                        ? "1"
                        : step.urgency === "medium"
                        ? "2"
                        : step.urgency === "high"
                        ? "3"
                        : step.urgency === "expand"
                        ? "4"
                        : "5"}
                    </span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-wide">
                      IF: {step.trigger}
                    </p>
                    <p className="text-sm text-gray-300 mt-1">{step.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB: AD COPY LIBRARY ─────────────────────────────────────────── */}
      {tab === "ad-copy" && (
        <div className="space-y-6">
          {/* Headlines */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
              <h2 className="text-sm font-bold text-white">Headlines</h2>
              <p className="text-xs text-gray-400 mt-0.5">Use as primary ad headline. Replace [City] / [category].</p>
            </div>
            <div className="divide-y divide-gray-700/50">
              {AD_COPY.headlines.map((h, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-gray-800/30">
                  <p className="text-sm text-gray-200">{h}</p>
                  <CopyButton text={h} />
                </div>
              ))}
            </div>
          </div>

          {/* Primary descriptions */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
              <h2 className="text-sm font-bold text-white">Primary Descriptions</h2>
              <p className="text-xs text-gray-400 mt-0.5">Ad body copy. Replace [City] / [category].</p>
            </div>
            <div className="divide-y divide-gray-700/50">
              {AD_COPY.primaryDescriptions.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-gray-800/30">
                  <p className="text-sm text-gray-200 flex-1">{d}</p>
                  <CopyButton text={d} />
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
              <h2 className="text-sm font-bold text-white">Call-to-Action Buttons</h2>
            </div>
            <div className="flex flex-wrap gap-2 p-4">
              {AD_COPY.callsToAction.map((cta, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2"
                >
                  <span className="text-sm text-gray-200">{cta}</span>
                  <CopyButton text={cta} />
                </div>
              ))}
            </div>
          </div>

          {/* Targeting notes */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
              <h2 className="text-sm font-bold text-white">🎯 Targeting Strategy</h2>
            </div>
            <div className="divide-y divide-gray-700/50">
              {AD_COPY.targetingNotes.map((note, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span className="text-blue-400 shrink-0 mt-0.5">→</span>
                  <p className="text-sm text-gray-300">{note}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Landing options */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
            <div className="px-5 py-3 bg-gray-800 border-b border-gray-700">
              <h2 className="text-sm font-bold text-white">🔗 Landing Page Options</h2>
            </div>
            <div className="divide-y divide-gray-700/50">
              {AD_COPY.landingOptions.map((opt, i) => (
                <div key={i} className="flex items-start gap-3 px-5 py-4">
                  <span
                    className={`shrink-0 text-xs px-1.5 py-0.5 rounded font-bold ${
                      i === 0
                        ? "bg-green-900/40 text-green-400"
                        : i === 1
                        ? "bg-blue-900/40 text-blue-400"
                        : "bg-purple-900/40 text-purple-400"
                    }`}
                  >
                    {opt.split(":")[0]}
                  </span>
                  <p className="text-sm text-gray-300">{opt.split(": ").slice(1).join(": ")}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Performance tracking */}
          <div className="rounded-xl border border-blue-800/50 bg-blue-900/10 p-5">
            <h3 className="text-sm font-bold text-blue-300 mb-3">📊 Metrics to Track Weekly</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { metric: "FB Post Reach", target: "100–500 per post" },
                { metric: "Comment Rate", target: ">2% = good hook" },
                { metric: "DM Conversion", target: ">20% to intake" },
                { metric: "Ad CTR", target: ">2% = good creative" },
                { metric: "Cost per Lead", target: "<$20 target" },
                { metric: "Lead → Close Rate", target: ">15% = strong" },
                { metric: "Email Reply Rate", target: ">5% = good copy" },
                { metric: "SMS Reply Rate", target: ">10% = good" },
                { metric: "Intake → Paid Rate", target: ">30% = strong funnel" },
              ].map((item) => (
                <div key={item.metric} className="rounded-lg border border-blue-800/30 bg-blue-900/10 p-3">
                  <p className="text-xs font-semibold text-blue-300">{item.metric}</p>
                  <p className="text-xs text-blue-400/70 mt-0.5">{item.target}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
