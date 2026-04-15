import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/sales/at-risk?agent_id=X
// "Deals You Are About to Lose" engine.
// Returns stalled deals with recovery actions.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  try {
    const sessionClient = await createClient();
    const { data: { user } } = await sessionClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url     = new URL(req.url);
    const agentId = url.searchParams.get("agent_id") ?? user.id;
    const db      = createServiceClient();
    const now     = new Date();
    const h48     = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const d3      = new Date(now.getTime() - 3  * 24 * 60 * 60 * 1000).toISOString();
    const d7      = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000).toISOString();

    const atRisk: {
      id: string; lead_id: string; business_name: string; city: string;
      category: string; phone: string | null; email: string | null;
      risk_type: string; risk_label: string; stale_since: string;
      recovery_action: string; recovery_message: string;
      estimated_value: string; days_stale: number;
    }[] = [];

    // ── Interested leads — no follow-up in 48h ────────────────────────────────
    const { data: intLeads } = await db.from("sales_leads").select("*")
      .eq("status", "interested")
      .lt("last_contacted_at", h48)
      .eq("do_not_contact", false)
      .order("last_contacted_at", { ascending: true })
      .limit(5);

    for (const lead of intLeads ?? []) {
      const days = Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / 86400000);
      atRisk.push({
        id:              `int_${lead.id}`,
        lead_id:         lead.id,
        business_name:   lead.business_name,
        city:            lead.city ?? "",
        category:        lead.category ?? "",
        phone:           lead.phone,
        email:           lead.email,
        risk_type:       "interested_stale",
        risk_label:      "Interested — No Follow-Up",
        stale_since:     lead.last_contacted_at,
        recovery_action: lead.phone ? "call" : "send_text",
        recovery_message: `Hey ${lead.business_name.split(" ")[0] ?? "there"} — just circling back. That spot in ${lead.city ?? "your area"} is still open. Did you want to move forward?`,
        estimated_value: "$200–$900/mo",
        days_stale:      days,
      });
    }

    // ── Replied leads — no response sent ────────────────────────────────────
    const { data: repliedLeads } = await db.from("sales_leads").select("*")
      .eq("status", "replied")
      .lt("last_reply_at", h48)
      .eq("do_not_contact", false)
      .order("last_reply_at", { ascending: true })
      .limit(5);

    for (const lead of repliedLeads ?? []) {
      const days = Math.floor((now.getTime() - new Date(lead.last_reply_at ?? now).getTime()) / 86400000);
      atRisk.push({
        id:              `rep_${lead.id}`,
        lead_id:         lead.id,
        business_name:   lead.business_name,
        city:            lead.city ?? "",
        category:        lead.category ?? "",
        phone:           lead.phone,
        email:           lead.email,
        risk_type:       "replied_no_response",
        risk_label:      "They Replied — You Didn't",
        stale_since:     lead.last_reply_at ?? "",
        recovery_action: "respond",
        recovery_message: `Hey! Sorry for the slow reply — still have that spot in ${lead.city ?? "your area"} open. Want to lock it in?`,
        estimated_value: "$200–$900/mo",
        days_stale:      days,
      });
    }

    // ── Payment sent — not yet confirmed ────────────────────────────────────
    const { data: paymentLeads } = await db.from("sales_leads").select("*")
      .eq("status", "payment_sent")
      .lt("last_contacted_at", h48)
      .eq("do_not_contact", false)
      .order("last_contacted_at", { ascending: true })
      .limit(3);

    for (const lead of paymentLeads ?? []) {
      const days = Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / 86400000);
      atRisk.push({
        id:              `pay_${lead.id}`,
        lead_id:         lead.id,
        business_name:   lead.business_name,
        city:            lead.city ?? "",
        category:        lead.category ?? "",
        phone:           lead.phone,
        email:           lead.email,
        risk_type:       "payment_sent_stale",
        risk_label:      "Payment Link Sent — Not Paid",
        stale_since:     lead.last_contacted_at,
        recovery_action: "call",
        recovery_message: `Hey — wanted to make sure you got the link okay. The ${lead.city ?? ""} spot is still being held for you. Did you run into any issues?`,
        estimated_value: "$200–$900/mo (CONFIRMED CLOSE)",
        days_stale:      days,
      });
    }

    // ── Contacted 7+ days ago — no movement ─────────────────────────────────
    const { data: staleLeads } = await db.from("sales_leads").select("*")
      .eq("status", "contacted")
      .lt("last_contacted_at", d7)
      .eq("do_not_contact", false)
      .order("score", { ascending: false })
      .limit(3);

    for (const lead of staleLeads ?? []) {
      const days = Math.floor((now.getTime() - new Date(lead.last_contacted_at).getTime()) / 86400000);
      atRisk.push({
        id:              `stale_${lead.id}`,
        lead_id:         lead.id,
        business_name:   lead.business_name,
        city:            lead.city ?? "",
        category:        lead.category ?? "",
        phone:           lead.phone,
        email:           lead.email,
        risk_type:       "contacted_stale",
        risk_label:      `Contacted ${days} Days Ago — No Movement`,
        stale_since:     lead.last_contacted_at,
        recovery_action: lead.phone ? "call" : "send_text",
        recovery_message: `Hey — circling back on the homeowner mailer in ${lead.city ?? "your area"}. That ${lead.category?.toLowerCase() ?? "business"} spot is still open. Still interested?`,
        estimated_value: "$200–$900/mo",
        days_stale:      days,
      });
    }

    // Sort by days_stale desc (most overdue first), then by risk type priority
    const riskOrder = ["payment_sent_stale","replied_no_response","interested_stale","contacted_stale"];
    atRisk.sort((a, b) => {
      const ai = riskOrder.indexOf(a.risk_type);
      const bi = riskOrder.indexOf(b.risk_type);
      if (ai !== bi) return ai - bi;
      return b.days_stale - a.days_stale;
    });

    // Calculate total pipeline at risk
    const totalAtRisk = atRisk.length;
    const estimatedValue = totalAtRisk * 400; // conservative avg

    return NextResponse.json({
      at_risk:         atRisk.slice(0, 10),
      total_at_risk:   totalAtRisk,
      estimated_value_cents: estimatedValue * 100,
      message:         totalAtRisk > 0
        ? `$${(estimatedValue / 100 * totalAtRisk).toLocaleString()} sitting in stalled deals — recover them now`
        : null,
    });

  } catch (err) {
    console.error("[at-risk]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
