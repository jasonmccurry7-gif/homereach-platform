import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import crypto from "crypto";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Webhook — HomeReach Closing Engine
//
// Routes:
//   GET  /api/facebook/webhook  → Webhook verification (Meta setup)
//   POST /api/facebook/webhook  → Incoming messages, comments, engagement
//
// Flow:
//   Facebook → Webhook → APEX classification → Echo/Prospector/Closer
//   → Facebook Messenger API → CRM update → Revenue
// ─────────────────────────────────────────────────────────────────────────────

// ── Hot lead keywords — trigger Closer immediately ───────────────────────────
const HOT_KEYWORDS = [
  "price", "how much", "cost", "pricing",
  "interested", "tell me more", "want to know",
  "availability", "spots left", "available",
  "sign up", "sign me up", "let's do it",
  "how do i", "where do i", "lock in", "reserve",
  "ready", "yes", "yeah", "sure",
];

// ── Qualifying keywords → move to Prospector ────────────────────────────────
const WARM_KEYWORDS = [
  "business", "restaurant", "plumber", "hvac", "roofing", "landscaping",
  "cleaning", "contractor", "service", "shop", "company",
  "advertising", "marketing", "customers", "clients", "reach",
  "homeowners", "neighborhood", "local",
];

// ── City detection ────────────────────────────────────────────────────────────
const OHIO_CITIES = [
  "wooster", "medina", "massillon", "cuyahoga falls", "canton",
  "akron", "brunswick", "barberton", "wadsworth", "stow", "kent",
];

// ── Facebook Graph API helpers ───────────────────────────────────────────────
const PAGE_ACCESS_TOKEN = () => process.env.FACEBOOK_PAGE_ACCESS_TOKEN ?? "";
const FB_API = "https://graph.facebook.com/v19.0";

async function fbSend(psid: string, text: string): Promise<string | null> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) { console.error("[FB] No page access token"); return null; }

  try {
    const res = await fetch(`${FB_API}/me/messages?access_token=${token}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        recipient:       { id: psid },
        message:         { text },
        messaging_type: "RESPONSE",
      }),
    });
    const data = await res.json() as { message_id?: string; error?: unknown };
    if (!res.ok) { console.error("[FB] Send error:", data.error); return null; }
    return data.message_id ?? null;
  } catch (err) {
    console.error("[FB] Send exception:", err);
    return null;
  }
}

async function fbCommentReply(commentId: string, message: string): Promise<void> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return;
  await fetch(`${FB_API}/${commentId}/comments?access_token=${token}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ message }),
  }).catch(() => {});
}

async function fbGetUserProfile(psid: string): Promise<{ name?: string; profile_pic?: string }> {
  const token = PAGE_ACCESS_TOKEN();
  if (!token) return {};
  try {
    const res = await fetch(`${FB_API}/${psid}?fields=name,profile_pic&access_token=${token}`);
    return await res.json() as { name?: string; profile_pic?: string };
  } catch { return {}; }
}

// ── Webhook verification ──────────────────────────────────────────────────────
export async function GET(req: Request) {
  const url    = new URL(req.url);
  const mode   = url.searchParams.get("hub.mode");
  const token  = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  const verifyToken = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN;
  if (mode === "subscribe" && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ── Main webhook handler ──────────────────────────────────────────────────────
export async function POST(req: Request) {
  // Verify Meta signature
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (appSecret) {
    const signature = req.headers.get("x-hub-signature-256") ?? "";
    const rawBody   = await req.text();
    const expected  = "sha256=" + crypto
      .createHmac("sha256", appSecret)
      .update(rawBody)
      .digest("hex");
    if (signature !== expected) {
      return new NextResponse("Invalid signature", { status: 401 });
    }
    // Re-parse since we consumed the body
    try {
      const payload = JSON.parse(rawBody);
      await processWebhookPayload(payload);
    } catch { /* ignore parse errors */ }
  } else {
    // No signature check in dev
    const payload = await req.json().catch(() => null);
    if (payload) await processWebhookPayload(payload);
  }

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Payload processor
// ─────────────────────────────────────────────────────────────────────────────

async function processWebhookPayload(payload: Record<string, unknown>) {
  const object = payload.object as string;
  if (object !== "page") return;

  const entries = (payload.entry as Record<string, unknown>[]) ?? [];

  for (const entry of entries) {
    // ── Messenger messages ──────────────────────────────────────────────────
    const messaging = (entry.messaging as Record<string, unknown>[]) ?? [];
    for (const event of messaging) {
      if ((event.message as Record<string, unknown>)?.text) {
        await handleMessage(event).catch(err =>
          console.error("[FB] message handler error:", err)
        );
      }
      if (event.read || event.delivery) continue; // skip read receipts
    }

    // ── Page feed (comments) ────────────────────────────────────────────────
    const changes = (entry.changes as Record<string, unknown>[]) ?? [];
    for (const change of changes) {
      if ((change.value as Record<string, unknown>)?.item === "comment") {
        await handleComment(change.value as Record<string, unknown>).catch(err =>
          console.error("[FB] comment handler error:", err)
        );
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Message handler — core closing engine
// ─────────────────────────────────────────────────────────────────────────────

async function handleMessage(event: Record<string, unknown>) {
  const sender  = (event.sender as Record<string, string>)?.id;
  const msgObj  = event.message as Record<string, unknown>;
  const text    = (msgObj?.text as string ?? "").trim();
  if (!sender || !text) return;

  const db      = createServiceClient();
  const lower   = text.toLowerCase();

  // ── 1. Get or create lead record ──────────────────────────────────────────
  let { data: lead } = await db
    .from("facebook_leads")
    .select("*")
    .eq("fb_psid", sender)
    .maybeSingle();

  if (!lead) {
    const profile = await fbGetUserProfile(sender);
    const { data: newLead } = await db
      .from("facebook_leads")
      .insert({
        fb_psid:   sender,
        fb_name:   profile.name ?? null,
        fb_profile_pic: profile.profile_pic ?? null,
        source:    "messenger",
      })
      .select()
      .single();
    lead = newLead;
  }

  if (!lead) return;

  // ── 2. Log inbound message ────────────────────────────────────────────────
  await db.from("facebook_messages").insert({
    lead_id:   lead.id,
    direction: "inbound",
    message:   text,
    agent:     null,
  });

  await db.from("facebook_leads").update({
    last_message_at:  new Date().toISOString(),
    messages_received: (lead.messages_received ?? 0) + 1,
    updated_at:        new Date().toISOString(),
  }).eq("id", lead.id);

  // ── 3. APEX: classify intent ──────────────────────────────────────────────
  const intentScore = classifyIntent(lower, lead);
  const detectedCity = detectCity(lower);
  const detectedCategory = detectCategory(lower);

  // Update lead data if new info found
  const updates: Record<string, unknown> = { intent_level: intentScore };
  if (detectedCity    && !lead.city)     updates.city     = detectedCity;
  if (detectedCategory && !lead.category) updates.category = detectedCategory;
  await db.from("facebook_leads").update(updates).eq("id", lead.id);

  // ── 4. Route to correct agent ─────────────────────────────────────────────
  const isHot  = intentScore >= 7 || HOT_KEYWORDS.some(k => lower.includes(k));
  const isWarm = intentScore >= 4 || WARM_KEYWORDS.some(k => lower.includes(k));

  let response: string;
  let agentName: string;
  let newStatus: string = lead.lead_status;
  let newAgent: string  = lead.current_agent;
  let newStage: string  = lead.conversation_stage;

  if (isHot || lead.lead_status === "hot") {
    // ── CLOSER takes over ───────────────────────────────────────────────────
    agentName = "closer";
    newAgent  = "closer";
    newStatus = "hot";
    newStage  = lead.conversation_stage === "initial" ? "pricing" : "closing";
    response  = buildCloserResponse(text, lead, detectedCity, detectedCategory);

  } else if (isWarm || lead.current_agent === "prospector") {
    // ── PROSPECTOR qualifies ────────────────────────────────────────────────
    agentName = "prospector";
    newAgent  = "prospector";
    newStatus = "warm";
    newStage  = "qualifying";
    response  = buildProspectorResponse(text, lead, detectedCity, detectedCategory);

  } else {
    // ── ECHO handles initial engagement ────────────────────────────────────
    agentName = "echo";
    response  = buildEchoResponse(text, lead);
  }

  // ── 5. Send response ──────────────────────────────────────────────────────
  const mid = await fbSend(sender, response);

  // ── 6. Log outbound + update state ───────────────────────────────────────
  await db.from("facebook_messages").insert({
    lead_id:   lead.id,
    direction: "outbound",
    message:   response,
    agent:     agentName,
    mid:       mid ?? null,
  });

  await db.from("facebook_leads").update({
    current_agent:     newAgent,
    lead_status:       newStatus,
    conversation_stage: newStage,
    last_reply_at:     new Date().toISOString(),
    messages_sent:     (lead.messages_sent ?? 0) + 1,
    updated_at:        new Date().toISOString(),
  }).eq("id", lead.id);

  // ── 7. Upsert to sales_leads for full CRM tracking ───────────────────────
  if (lead.fb_name || detectedCity) {
    await db.from("sales_leads").upsert({
      business_name: lead.fb_name ?? `Facebook Lead ${sender.slice(-6)}`,
      city:          detectedCity ?? lead.city ?? "",
      category:      detectedCategory ?? lead.category ?? "",
      status:        newStatus === "hot" ? "interested" : newStatus === "warm" ? "contacted" : "queued",
      source:        "facebook",
      do_not_contact: false,
      sms_opt_out:   false,
    }, { onConflict: "id", ignoreDuplicates: false }).then(({ data: sl }) => {
      if (sl && !lead.sales_lead_id) {
        db.from("facebook_leads").update({ sales_lead_id: (sl as any)[0]?.id }).eq("id", lead.id).then(() => {}).catch(() => {});
      }
    }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Comment handler → DM conversion
// ─────────────────────────────────────────────────────────────────────────────

async function handleComment(value: Record<string, unknown>) {
  const commentId = value.comment_id as string;
  const senderId  = (value.from as Record<string, string>)?.id;
  const message   = (value.message as string ?? "").trim();
  if (!senderId || !message) return;

  const db = createServiceClient();

  // Public reply to the comment
  await fbCommentReply(commentId,
    "Thanks for engaging! 👋 I just sent you a quick DM with more info about what we do. Check your messages!"
  );

  // Send DM to start the conversation
  const profile = await fbGetUserProfile(senderId);
  const firstName = profile.name?.split(" ")[0] ?? "there";

  await fbSend(senderId,
    `Hey ${firstName}! 👋 Saw your comment and wanted to reach out directly.\n\nI'm with HomeReach — we run direct-mail postcard campaigns targeting thousands of verified homeowners in your area. One exclusive spot per business category per city.\n\nAre you currently doing any local advertising?`
  );

  // Log as a lead from comment
  await db.from("facebook_leads").upsert({
    fb_psid:         senderId,
    fb_name:         profile.name ?? null,
    source:          "comment",
    comment_post_id: commentId,
    current_agent:   "echo",
    lead_status:     "warm",
  }, { onConflict: "fb_psid" }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classification (0-10 scale)
// ─────────────────────────────────────────────────────────────────────────────

function classifyIntent(
  lower: string,
  lead: Record<string, unknown>
): number {
  let score = (lead.intent_level as number) ?? 0;
  if (HOT_KEYWORDS.some(k => lower.includes(k)))  score = Math.max(score, 7);
  if (WARM_KEYWORDS.some(k => lower.includes(k)))  score = Math.max(score, 4);
  if (/yes|yeah|sure|ok|okay|let's/.test(lower))   score = Math.max(score, 8);
  if (/no|not interested|stop|unsubscribe/.test(lower)) score = 0;
  return Math.min(10, score);
}

function detectCity(lower: string): string | null {
  return OHIO_CITIES.find(c => lower.includes(c)) ?? null;
}

function detectCategory(lower: string): string | null {
  const cats: Record<string, string> = {
    "restaurant|food|pizza|diner|cafe": "Restaurant & Food",
    "plumb|pipe":                        "Plumbing",
    "hvac|heat|cool|air condition":      "HVAC",
    "roof":                              "Roofing",
    "landscap|lawn|yard":                "Landscaping",
    "clean|maid|janitor":                "Home Cleaning",
    "electric":                          "Electrical",
    "paint":                             "Painting",
    "pest|exterminat":                   "Pest Control",
    "pressure.?wash|power.?wash":        "Pressure Washing",
    "junk|haul|remov":                   "Junk Removal",
    "tree|trim|stump":                   "Tree Service",
    "garage.?door":                      "Garage Doors",
    "gutter":                            "Gutters",
    "floor":                             "Flooring",
    "window|door install":               "Windows & Doors",
    "remodel|renovati|contactor":        "Home Remodeling",
    "real estate|realtor":               "Real Estate",
    "solar|panel":                       "Solar",
    "insurance":                         "Insurance",
    "concrete|masonry|brick":            "Concrete & Masonry",
  };
  for (const [pattern, category] of Object.entries(cats)) {
    if (new RegExp(pattern).test(lower)) return category;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent response builders
// ─────────────────────────────────────────────────────────────────────────────

function buildEchoResponse(text: string, lead: Record<string, unknown>): string {
  const name   = (lead.fb_name as string)?.split(" ")[0] ?? "there";
  const lower  = text.toLowerCase();

  if (lead.conversation_stage === "initial" || !lead.conversation_stage) {
    return `Hey ${name}! 👋 Thanks for reaching out to HomeReach!\n\nWe run exclusive direct-mail postcard campaigns — your ad goes out to 2,500+ verified homeowners monthly in your city. One business per category, so if you lock in your spot, no competitor can take it.\n\nWhat type of business do you run?`;
  }

  if (/hello|hi|hey|yo/.test(lower)) {
    return `Hey ${name}! Great to hear from you. What type of business are you in?`;
  }

  return `Thanks ${name}! I'd love to learn more about your business. What service or industry are you in?`;
}

function buildProspectorResponse(
  text:     string,
  lead:     Record<string, unknown>,
  city:     string | null,
  category: string | null
): string {
  const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";

  if (!category && !lead.category) {
    return `Great ${name}! What type of business do you run? (Plumbing, HVAC, Roofing, Cleaning, etc.)`;
  }

  if (!city && !lead.city) {
    const cat = category ?? (lead.category as string);
    return `Got it — ${cat}! And which city or area are you based in? We currently serve several markets in Ohio.`;
  }

  const cat  = category ?? (lead.category as string) ?? "your business";
  const loc  = city ?? (lead.city as string) ?? "your area";
  return `Perfect — ${cat} in ${loc}! 🎯\n\nWe actually have a few spots open there right now. Our campaigns put you in front of 2,500+ homeowners every month, and you're the only ${cat.toLowerCase()} business in the mailer — no competitors.\n\nWant to know what it costs and how many spots are left?`;
}

function buildCloserResponse(
  text:     string,
  lead:     Record<string, unknown>,
  city:     string | null,
  category: string | null
): string {
  const name = (lead.fb_name as string)?.split(" ")[0] ?? "there";
  const cat  = category ?? (lead.category as string) ?? "your category";
  const loc  = city ?? (lead.city as string) ?? "your area";
  const lower = text.toLowerCase();

  // Objection handling
  if (/too expensive|too much|can't afford|not in budget/.test(lower)) {
    return `${name}, I totally get it — budget matters. Here's the thing: our Back Feature spot starts at $200/mo and you're reaching 2,500 homeowners. That's less than a cup of coffee per day to be in front of thousands of local homeowners.\n\nAnd because it's exclusive, no other ${cat.toLowerCase()} business can advertise while you're active.\n\nWant me to show you the exact breakdown?`;
  }

  if (/need to think|think about it|not sure|maybe later/.test(lower)) {
    return `${name}, I hear you — it's a real decision. But here's what I can't guarantee: that spot will still be available tomorrow.\n\nWe only allow one ${cat.toLowerCase()} business per city. If someone else claims it today, you'd have to wait for it to open up again.\n\nCan I at least send you the details so you have everything in front of you?`;
  }

  if (/already advertis|already have|google|facebook ads/.test(lower)) {
    return `That's great ${name} — sounds like you're already investing in growth! HomeReach is different from digital: we put a physical postcard directly in homeowners' hands. No algorithm, no ad fatigue. Many of our clients run us alongside Google and see it adds a completely different type of customer.\n\nWant to see what the spot in ${loc} looks like?`;
  }

  // Pricing inquiry
  if (/price|how much|cost|pricing/.test(lower)) {
    return `Great question ${name}! Here's what's available in ${loc}:\n\n🥇 Anchor Spot: $600/mo — largest placement, front page, ONLY 1 available\n⭐ Front Feature: $250/mo — front page, 3 spots available\n✅ Back Feature: $200/mo — back page, 6 spots available\n\nAll include professional design, print, and mailing to 2,500+ verified homeowners.\n\nWhich option fits best for you?`;
  }

  // Hot intent
  if (/interested|tell me more|want to know|availability|spots left/.test(lower)) {
    return `${name}, here's the deal — we have limited spots open in ${loc} for ${cat} right now.\n\n📬 Your postcard goes to 2,500+ verified homeowners monthly\n🔒 You're the ONLY ${cat.toLowerCase()} in the mailer\n💰 Starts at just $200/mo\n\nTo lock your spot right now: home-reach.com/get-started\n\nSpots have been filling fast this week. Want me to hold yours while you check it out?`;
  }

  // Affirmative / ready to close
  if (/yes|yeah|sure|ok|let's|ready|sign|lock in|reserve/.test(lower)) {
    return `🎉 Awesome ${name}! Let's lock in your ${cat} spot in ${loc} before someone else grabs it.\n\nHere's your signup link:\nhome-reach.com/get-started\n\nTakes about 3 minutes. Choose your spot size, enter your business info, and you're in.\n\nIf you have any questions while you're going through it, just text me here. Let's get you live! 🚀`;
  }

  // Default closer response
  return `${name}, based on what you've told me — this is exactly what HomeReach was built for.\n\n${cat} in ${loc}, reaching 2,500+ homeowners monthly with ZERO competition in your category.\n\nHere's your link to claim your spot:\nhome-reach.com/get-started\n\nWhat's holding you back from locking it in today?`;
}
