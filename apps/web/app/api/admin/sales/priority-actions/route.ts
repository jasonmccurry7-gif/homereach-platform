import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/priority-actions?agent_id=X
//
// The "DO THIS NOW" engine.
// Ranks every actionable item by revenue likelihood.
// Returns top 5–8 priority actions the agent should take immediately.
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, number> = {
  verbal_yes_no_contract:     100,
  contract_sent_not_signed:    95,
  signed_not_paid:             90,
  interested_no_followup:      85,
  pricing_sent_24h:            80,
  callback_requested:          75,
  hot_lead_no_contact:         70,
  nearly_full_city:            65,
  founder_rate_expiring:       60,
  warm_lead_3d_stale:         50,
  voicemail_left_24h:          45,
  replied_no_response:         40,
};

interface PriorityAction {
  id:               string;
  lead_id:          string;
  business_name:    string;
  city:             string;
  category:         string;
  phone:            string | null;
  email:            string | null;
  action_type:      string;
  what_to_do:       string;
  why_it_matters:   string;
  urgency:          "critical" | "high" | "medium";
  revenue_potential: string;
  priority_score:   number;
  cta_label:        string;
  cta_action:       string; // 'call', 'send_contract', 'send_pricing', 'send_text', 'send_email'
  last_event_at:    string | null;
}

export async function GET(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url     = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") ?? user.id;
    const db      = createServiceClient();
    const now     = new Date();
    const h24     = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const h48     = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const d3      = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000).toISOString();

    const actions: PriorityAction[] = [];

    // ── 1. Verbal yes — no contract sent ─────────────────────────────────────
    const { data: verbalYes } = await db.from("sales_leads").select("*")
      .eq("status", "interested")
      .eq("do_not_contact", false)
      .is("next_follow_up_at", null)
      .lt("last_contacted_at", h24)
      .limit(3);

    for (const lead of verbalYes ?? []) {
      actions.push({
        id:               `verbal_${lead.id}`,
        lead_id:          lead.id,
        business_name:    lead.business_name,
        city:             lead.city ?? "",
        category:         lead.category ?? "",
        phone:            lead.phone,
        email:            lead.email,
        action_type:      "verbal_yes_no_contract",
        what_to_do:       `Send contract to ${lead.business_name}`,
        why_it_matters:   "They said yes — no contract sent yet. Every hour of delay risks losing them.",
        urgency:          "critical",
        revenue_potential: "$200–$900/mo",
        priority_score:   PRIORITY_MAP.verbal_yes_no_contract,
        cta_label:        "Send Contract Now",
        cta_action:       "send_contract",
        last_event_at:    lead.last_contacted_at,
      });
    }

    // ── 2. Pricing sent > 24h ago — no reply ─────────────────────────────────
    const { data: pricingSent } = await db.from("sales_events")
      .select("lead_id, created_at")
      .eq("action_type", "email_sent")
      .eq("agent_id", agentId)
      .lt("created_at", h24)
      .gte("created_at", d3)
      .limit(5);

    const pricingLeadIds = (pricingSent ?? []).map(e => e.lead_id).filter(Boolean);
    if (pricingLeadIds.length > 0) {
      const { data: pricingLeads } = await db.from("sales_leads").select("*")
        .in("id", pricingLeadIds)
        .not("status", "in", "(closed,dead,replied)")
        .limit(3);

      for (const lead of pricingLeads ?? []) {
        const event = (pricingSent ?? []).find(e => e.lead_id === lead.id);
        actions.push({
          id:               `pricing_${lead.id}`,
          lead_id:          lead.id,
          business_name:    lead.business_name,
          city:             lead.city ?? "",
          category:         lead.category ?? "",
          phone:            lead.phone,
          email:            lead.email,
          action_type:      "pricing_sent_24h",
          what_to_do:       `Follow up — pricing sent 24+ hours ago`,
          why_it_matters:   "Pricing sent but no response. One follow-up call doubles close rate.",
          urgency:          "high",
          revenue_potential: "$200–$900/mo",
          priority_score:   PRIORITY_MAP.pricing_sent_24h,
          cta_label:        "Call Now",
          cta_action:       "call",
          last_event_at:    event?.created_at ?? null,
        });
      }
    }

    // ── 3. Callback requested — not called yet ────────────────────────────────
    const { data: callbacks } = await db.from("call_logs")
      .select("lead_id, called_at, business_name, phone, city, category")
      .eq("agent_id", agentId)
      .eq("outcome", "call_back_later")
      .lte("called_at", now.toISOString())
      .limit(5);

    for (const cb of (callbacks ?? []).slice(0, 3)) {
      if (!cb.lead_id) continue;
      actions.push({
        id:               `callback_${cb.lead_id}`,
        lead_id:          cb.lead_id,
        business_name:    cb.business_name ?? "Unknown",
        city:             cb.city ?? "",
        category:         cb.category ?? "",
        phone:            cb.phone,
        email:            null,
        action_type:      "callback_requested",
        what_to_do:       `Call back ${cb.business_name} — they asked for it`,
        why_it_matters:   "They specifically asked you to call. This is a warm lead.",
        urgency:          "high",
        revenue_potential: "$200–$900/mo",
        priority_score:   PRIORITY_MAP.callback_requested,
        cta_label:        "Call Back Now",
        cta_action:       "call",
        last_event_at:    cb.called_at,
      });
    }

    // ── 4. Hot leads — replied but no action ─────────────────────────────────
    const { data: hotLeads } = await db.from("sales_leads").select("*")
      .eq("status", "replied")
      .eq("do_not_contact", false)
      .order("last_reply_at", { ascending: true })
      .limit(3);

    for (const lead of hotLeads ?? []) {
      actions.push({
        id:               `hot_${lead.id}`,
        lead_id:          lead.id,
        business_name:    lead.business_name,
        city:             lead.city ?? "",
        category:         lead.category ?? "",
        phone:            lead.phone,
        email:            lead.email,
        action_type:      "hot_lead_no_contact",
        what_to_do:       `${lead.business_name} replied — close them now`,
        why_it_matters:   "Inbound reply = buying signal. Speed is everything right now.",
        urgency:          "critical",
        revenue_potential: "$200–$900/mo",
        priority_score:   PRIORITY_MAP.hot_lead_no_contact + (lead.score ?? 0),
        cta_label:        "Respond Now",
        cta_action:       lead.phone ? "call" : "send_text",
        last_event_at:    lead.last_reply_at,
      });
    }

    // ── 5. Nearly full city — urgent close window ─────────────────────────────
    // Check if any assigned cities are filling up
    const { data: territories } = await db.from("agent_territories")
      .select("city").eq("agent_id", agentId);

    if (territories?.length) {
      const cities = territories.map(t => t.city);
      const { data: cityLeads } = await db.from("sales_leads")
        .select("city")
        .in("city", cities)
        .eq("status", "closed")
        .limit(200);

      const closedByCity: Record<string, number> = {};
      for (const l of cityLeads ?? []) {
        if (l.city) closedByCity[l.city] = (closedByCity[l.city] ?? 0) + 1;
      }

      for (const city of cities) {
        const closed = closedByCity[city] ?? 0;
        if (closed >= 7 && closed < 10) {
          actions.push({
            id:               `city_${city}`,
            lead_id:          "",
            business_name:    `${city} — ${10 - closed} spots left`,
            city,
            category:         "",
            phone:            null,
            email:            null,
            action_type:      "nearly_full_city",
            what_to_do:       `Push ${city} hard — only ${10 - closed} spots left`,
            why_it_matters:   `Once full, founding pricing ends and scarcity closes itself. Get these now.`,
            urgency:          closed >= 9 ? "critical" : "high",
            revenue_potential: `${10 - closed} × $200–$900/mo`,
            priority_score:   PRIORITY_MAP.nearly_full_city + (closed * 2),
            cta_label:        "Load Leads",
            cta_action:       "load_city_leads",
            last_event_at:    null,
          });
        }
      }
    }

    // ── 6. Voicemail left 24h+ ago — time to follow up ───────────────────────
    const { data: voicemails } = await db.from("call_logs")
      .select("lead_id, called_at, business_name, phone, city, category")
      .eq("agent_id", agentId)
      .eq("outcome", "left_voicemail")
      .lt("called_at", h24)
      .gte("called_at", d3)
      .limit(3);

    for (const vm of voicemails ?? []) {
      if (!vm.lead_id) continue;
      actions.push({
        id:               `vm_${vm.lead_id}`,
        lead_id:          vm.lead_id,
        business_name:    vm.business_name ?? "Unknown",
        city:             vm.city ?? "",
        category:         vm.category ?? "",
        phone:            vm.phone,
        email:            null,
        action_type:      "voicemail_left_24h",
        what_to_do:       `Follow up after voicemail — ${vm.business_name}`,
        why_it_matters:   "Left voicemail 24h+ ago. Time for a text follow-up.",
        urgency:          "medium",
        revenue_potential: "$200–$900/mo",
        priority_score:   PRIORITY_MAP.voicemail_left_24h,
        cta_label:        "Send Follow-Up Text",
        cta_action:       "send_text",
        last_event_at:    vm.called_at,
      });
    }

    // Sort by priority score descending, take top 8
    actions.sort((a, b) => b.priority_score - a.priority_score);
    const top = actions.slice(0, 8);

    return NextResponse.json({
      actions: top,
      total:   actions.length,
      last_updated: now.toISOString(),
    });

  } catch (err) {
    console.error("[priority-actions]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
