import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

// ─────────────────────────────────────────────────────────────────────────────
// Facebook Revenue Engine API
//
// GET  /api/admin/facebook?view=execution  → today's execution list
// GET  /api/admin/facebook?view=pipeline   → full pipeline
// POST /api/admin/facebook                 → create opportunity + generate scripts
// PUT  /api/admin/facebook                 → update opportunity (log action)
// ─────────────────────────────────────────────────────────────────────────────

const OHIO_CITIES = [
  "Wooster","Medina","Massillon","Cuyahoga Falls","Canton",
  "Akron","Brunswick","Barberton","Wadsworth","Stow","Kent",
];

const CATEGORY_MAP: Record<string, string> = {
  "plumb|pipe":                       "Plumbing",
  "hvac|heat|cool|air":               "HVAC",
  "roof":                             "Roofing",
  "landscap|lawn|yard|mow":           "Landscaping",
  "clean|maid|janitor|pressure.?wash":"Home Cleaning",
  "electric":                         "Electrical",
  "paint":                            "Painting",
  "pest|exterminat":                  "Pest Control",
  "junk|haul|remov":                  "Junk Removal",
  "tree|trim|stump|arborist":         "Tree Service",
  "garage.?door":                     "Garage Doors",
  "gutter":                           "Gutters",
  "floor":                            "Flooring",
  "window|door install":              "Windows & Doors",
  "remodel|renovati|contractor":      "Home Remodeling",
  "real estate|realtor":              "Real Estate",
  "solar":                            "Solar",
  "insurance":                        "Insurance",
  "concrete|masonry":                 "Concrete & Masonry",
  "restaurant|pizza|diner|food|cafe": "Restaurant & Food",
};

// ── Reply templates (rotating, human-sounding) ────────────────────────────────
const REPLY_TEMPLATES = {
  curiosity: [
    "Quick question — are you doing anything consistent to get in front of homeowners in {city}, or mostly posts like this?",
    "Are you running anything ongoing locally, or is this mainly how you find new clients?",
    "Smart jumping in early here. Do you have anything set up to reach homeowners directly in {city}?",
  ],
  compliment: [
    "Great work — that category does really well with direct homeowner exposure. Are you already doing anything like that in {city}?",
    "Solid presence. Are you doing any direct outreach to homeowners in {city} or mostly digital?",
    "Nice — {category} businesses typically kill it with direct mail in this area. Have you tried anything like that?",
  ],
  scarcity: [
    "That category is actually moving fast in {city} right now. Are you locked into anything for homeowner reach?",
    "Spots for {category} in {city} don't stay open long — are you in anything right now for local homeowner exposure?",
    "Only asking because we have one opening left for {category} in {city} — wanted to flag it before it fills.",
  ],
  local: [
    "Homeowners in {city} are really active right now — are you getting in front of them consistently?",
    "That area has strong homeowner density. Are you doing any targeted local advertising?",
    "I work with a few {category} businesses in {city} — the ones doing well are usually running something offline too. Are you?",
  ],
};

function detectCity(text: string): string | null {
  const lower = text.toLowerCase();
  return OHIO_CITIES.find(c => lower.includes(c.toLowerCase())) ?? null;
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [pattern, category] of Object.entries(CATEGORY_MAP)) {
    if (new RegExp(pattern).test(lower)) return category;
  }
  return null;
}

function scorePost(postText: string, category: string | null, city: string | null): {
  urgency: number; conversion: number; lead: number;
} {
  let urgency = 3, conversion = 3;
  const lower = postText.toLowerCase();
  if (/need|urgent|asap|emergency|right away|today/.test(lower)) urgency += 4;
  if (/hiring|looking for|recommend/.test(lower)) urgency += 2;
  if (/licensed|insured|years|established|award/.test(lower)) conversion += 3;
  if (/website|reviews|professional/.test(lower)) conversion += 2;
  if (city) conversion += 1;
  if (category) conversion += 1;
  const PRIORITY_CATS = ["Roofing","HVAC","Plumbing","Landscaping","Home Remodeling"];
  if (category && PRIORITY_CATS.includes(category)) conversion += 2;
  return {
    urgency: Math.min(10, urgency),
    conversion: Math.min(10, conversion),
    lead: Math.min(100, (urgency + conversion) * 5),
  };
}

function generateReply(
  city: string | null,
  category: string | null,
  agentName: string,
  seed: number = 0
): string {
  const cityStr = city ?? "your area";
  const catStr  = category ?? "your industry";

  // Pick template group and rotate
  const groups  = Object.keys(REPLY_TEMPLATES) as Array<keyof typeof REPLY_TEMPLATES>;
  const group   = groups[seed % groups.length];
  const templates = REPLY_TEMPLATES[group];
  const template  = templates[Math.floor(seed / groups.length) % templates.length];

  return template
    .replace(/{city}/g, cityStr)
    .replace(/{category}/g, catStr)
    .replace(/{agent}/g, agentName);
}

function generateDmFlow(
  businessName: string,
  city: string | null,
  category: string | null,
  agentName: string,
  agentPhone: string
): { stage1: string; stage2: string; stage3: string; stage4: string; stage5: string } {
  const biz  = businessName || "your business";
  const loc  = city ?? "your area";
  const cat  = category ?? "your industry";
  const firstName = businessName.split(/\s+/)[0] ?? "there";

  return {
    stage1: `Hey! Saw your post in the group and had to reach out — we work with ${cat} businesses in ${loc} specifically. Are you doing anything right now to get in front of homeowners consistently, or is it mostly referrals and social?`,

    stage2: `Got it. So the challenge a lot of ${cat} businesses in ${loc} face is consistency — digital is hit or miss and referrals plateau. Quick question: when a homeowner in ${loc} needs ${cat} services, how are they finding you right now?`,

    stage3: `That's actually exactly the gap we fill. HomeReach runs direct-mail postcard campaigns — your ad goes to 2,500+ verified homeowners in ${loc} every single month. No algorithm, no competition. And here's the key: we only allow ONE business per category per mailer. So if you lock in ${cat}, no other ${cat} business can advertise while you're active.`,

    stage4: `Real talk — we have one spot open right now for ${cat} in ${loc}. I don't know how long it'll stay open because we had another business asking about it earlier this week. Spots typically go in 3–5 days once we start outreach. Want me to send you the details on what it costs and what it looks like?`,

    stage5: `Here's how to lock it in — takes 3 minutes: home-reach.com/get-started\n\nPick your spot size (starts at $200/mo), enter your info, and you're in. I can hold your category for 24 hours if you want to look it over first — just let me know.\n\nOr if it's easier, call/text me directly: ${agentPhone} — happy to walk you through it.\n\n— ${agentName}, HomeReach`,
  };
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db  = createServiceClient();
    const url = new URL(req.url);
    const view = url.searchParams.get("view") ?? "execution";
    const agentId = url.searchParams.get("agent_id") ?? user.id;

    if (view === "execution") {
      // Today's execution: items that need action
      const { data: items } = await db
        .from("fb_opportunities")
        .select("*")
        .eq("assigned_agent_id", agentId)
        .not("pipeline_status", "in", "(closed_won,closed_lost)")
        .order("lead_score", { ascending: false })
        .limit(50);

      // Group by action needed
      const needsComment  = (items ?? []).filter(i => ["replies_generated","post_qualified"].includes(i.pipeline_status));
      const needsDm       = (items ?? []).filter(i => ["engaged","dm_ready"].includes(i.pipeline_status));
      const inConversation = (items ?? []).filter(i => ["dm_sent","replied","qualified"].includes(i.pipeline_status));
      const hotLeads      = (items ?? []).filter(i => i.is_hot_lead);
      const followUps     = (items ?? []).filter(i =>
        i.pipeline_status === "follow_up" ||
        (i.follow_up_due_at && new Date(i.follow_up_due_at) <= new Date())
      );
      const closeReady    = (items ?? []).filter(i => ["offer_presented","close_attempt"].includes(i.pipeline_status));

      return NextResponse.json({
        date: new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
        agent_id: agentId,
        execution: { needsComment, needsDm, inConversation, hotLeads, followUps, closeReady },
        totals: {
          total_active:    (items ?? []).length,
          needs_comment:   needsComment.length,
          needs_dm:        needsDm.length,
          hot_leads:       hotLeads.length,
          follow_ups_due:  followUps.length,
          close_ready:     closeReady.length,
        },
      });
    }

    // Full pipeline view
    const { data: all } = await db
      .from("fb_opportunities")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    return NextResponse.json({ opportunities: all ?? [] });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── POST — Create opportunity + generate scripts ────────────────────────────
export async function POST(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const db   = createServiceClient();
    const body = await req.json();

    const {
      post_text, post_url, group_name, post_type,
      commenter_name, business_name, original_comment, profile_link,
      trust_signals = [],
    } = body;

    const sourceText = `${post_text ?? ""} ${original_comment ?? ""} ${business_name ?? ""}`;
    const city     = detectCity(sourceText);
    const category = detectCategory(sourceText);
    const scores   = scorePost(sourceText, category, city);

    // Load agent identity for personalized scripts
    const { data: identity } = await db
      .from("agent_identities")
      .select("from_name, twilio_phone")
      .eq("agent_id", user.id)
      .maybeSingle();
    const { data: profile } = await db
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    const agentName  = identity?.from_name ?? profile?.full_name ?? "HomeReach";
    const agentPhone = identity?.twilio_phone ? formatPhone(identity.twilio_phone) : "(330) 304-4916";
    const seed       = Date.now() % 12; // rotation seed

    const reply  = generateReply(city, category, agentName, seed);
    const dmFlow = generateDmFlow(business_name ?? commenter_name ?? "there", city, category, agentName, agentPhone);

    // Check category availability
    let categoryAvailable = true;
    if (city && category) {
      const { count } = await db
        .from("sales_leads")
        .select("id", { count: "exact" })
        .eq("city", city)
        .eq("category", category)
        .eq("status", "closed");
      categoryAvailable = (count ?? 0) < 10;
    }

    const { data: opp, error } = await db
      .from("fb_opportunities")
      .insert({
        post_type:          post_type ?? "business_promo",
        group_name,
        post_url,
        post_text,
        city_detected:      city,
        category_detected:  category,
        urgency_score:      scores.urgency,
        conversion_score:   scores.conversion,
        lead_score:         scores.lead,
        close_probability:  scores.conversion * 10,
        commenter_name,
        business_name,
        profile_link,
        original_comment,
        trust_signals,
        suggested_reply:    reply,
        dm_stage_1:         dmFlow.stage1,
        dm_stage_2:         dmFlow.stage2,
        dm_stage_3:         dmFlow.stage3,
        dm_stage_4:         dmFlow.stage4,
        dm_stage_5:         dmFlow.stage5,
        pipeline_status:    "replies_generated",
        assigned_agent_id:  user.id,
        category_available: categoryAvailable,
        is_hot_lead:        scores.urgency >= 7,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ opportunity: opp });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// ─── PUT — Update opportunity (log action, advance stage) ────────────────────
export async function PUT(req: Request) {
  try {
    const db   = createServiceClient();
    const body = await req.json();
    const { id, action, ...updates } = body;

    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Advance pipeline based on action
    const stageMap: Record<string, string> = {
      comment_sent:     "comment_posted",
      reply_received:   "engaged",
      dm_sent:          "dm_sent",
      dm_replied:       "replied",
      qualified:        "qualified",
      offer_sent:       "offer_presented",
      close_attempt:    "close_attempt",
      closed_won:       "closed_won",
      closed_lost:      "closed_lost",
      follow_up:        "follow_up",
    };

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = { ...updates, updated_at: now };

    if (action && stageMap[action]) {
      patch.pipeline_status = stageMap[action];
      if (action === "comment_sent")  patch.comment_sent_at = now;
      if (action === "dm_sent")       patch.dm_sent_at = now;
      if (action === "dm_replied")    patch.last_reply_at = now;
      if (action === "closed_won")    patch.closed_at = now;
      // Check for hot lead keywords
      if (updates.message_received) {
        const hot = /price|how much|interested|tell me more|send info|availability|spots/.test(
          (updates.message_received as string).toLowerCase()
        );
        if (hot) { patch.is_hot_lead = true; patch.pipeline_status = "close_attempt"; }
      }
    }

    const { data, error } = await db
      .from("fb_opportunities")
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ opportunity: data });

  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

function formatPhone(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `(${d.slice(0,3)}) ${d.slice(3,6)}-${d.slice(6)}` : raw;
}
