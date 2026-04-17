import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

interface AgentNudgeData {
  agentId: string;
  fullName: string;
  phone: string | null;
  textsSent: number;
  emailsSent: number;
  callsMade: number;
}

const AGENT_PHONES: Record<string, string> = {
  josh: "+13303222746",
  heather: "+12034176080",
  chris: "+13302214199",
  jason: "+13302069639",
};

const NUDGE_MESSAGES = [
  (texts: number, emails: number, calls: number) =>
    `⚡ You're behind pace — ${texts}/20 texts, ${emails}/20 emails, ${calls}/15 calls. Let's go!`,
  (texts: number, emails: number, calls: number) =>
    `🔥 The leaderboard is moving — you have ${20 - texts} texts and ${20 - emails} emails left to hit minimum. Get after it.`,
  (texts: number, emails: number, calls: number) => {
    const missed = [texts < 10 ? "texts" : "", emails < 10 ? "emails" : "", calls < 5 ? "calls" : ""]
      .filter(Boolean)
      .join(", ");
    return `⚠️ Behind quota: ${missed} below target. Log in and knock these out: home-reach.com/admin/agent-view`;
  },
];

function getRandomNudge(texts: number, emails: number, calls: number): string {
  const fn = NUDGE_MESSAGES[Math.floor(Math.random() * NUDGE_MESSAGES.length)];
  return fn(texts, emails, calls);
}

function isBehindPace(count: number, target: number): boolean {
  const hour = new Date().getHours();
  const minutesPassed = hour * 60 + new Date().getMinutes();
  const minutesInDay = 24 * 60;
  const pctDayPassed = minutesPassed / minutesInDay;
  const expectedCount = target * pctDayPassed;
  return count < expectedCount;
}

async function shouldSendNudge(
  db: ReturnType<typeof createServiceClient>,
  agentId: string
): Promise<boolean> {
  const now = new Date();
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

  // Check if nudge was sent in last 3 hours
  const { count: recentNudges } = await db
    .from("sales_events")
    .select("*", { count: "exact", head: 0 })
    .eq("agent_id", agentId)
    .eq("channel", "sms")
    .eq("action_type", "message_sent")
    .gte("created_at", threeHoursAgo.toISOString())
    .match({ "metadata->alert_type": "nudge" });

  return (recentNudges || 0) === 0;
}

export async function POST(req: NextRequest) {
  try {
    const db = createServiceClient();
    const today = new Date().toISOString().split("T")[0];
    const todayStart = `${today}T00:00:00Z`;
    const todayEnd = `${today}T23:59:59Z`;

    // Fetch all agents
    const { data: agents = [] } = await db
      .from("profiles")
      .select("id, full_name, metadata")
      .eq("role", "sales_agent");

    const nudgesPending = [];

    for (const agent of agents) {
      // Skip Jason unless explicitly enabled
      if (agent.full_name?.toLowerCase().includes("jason")) {
        continue;
      }

      // Count activity today
      const { count: textsSent = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "sms")
        .eq("action_type", "text_sent")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      const { count: emailsSent = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "email")
        .eq("action_type", "email_sent")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      const { count: callsMade = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .eq("channel", "call")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      const { count: anyActivity = 0 } = await db
        .from("sales_events")
        .select("*", { count: "exact", head: 0 })
        .eq("agent_id", agent.id)
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);

      // Check if behind pace
      const textsBehind = isBehindPace(textsSent || 0, 20);
      const emailsBehind = isBehindPace(emailsSent || 0, 20);
      const callsBehind = isBehindPace(callsMade || 0, 15);
      const isBehind = textsBehind || emailsBehind || callsBehind;

      // Only send if: active today, behind pace, and not recently nudged
      if ((anyActivity || 0) > 0 && isBehind) {
        const shouldSend = await shouldSendNudge(db, agent.id);
        if (shouldSend) {
          const agentNameLower = (agent.full_name || "").toLowerCase();
          const phone =
            AGENT_PHONES[agentNameLower] ||
            (agent.metadata && typeof agent.metadata === "object" && "phone" in agent.metadata
              ? (agent.metadata as Record<string, unknown>).phone
              : null);

          if (phone) {
            nudgesPending.push({
              agentId: agent.id,
              fullName: agent.full_name || "Unknown",
              phone: phone as string,
              textsSent: textsSent || 0,
              emailsSent: emailsSent || 0,
              callsMade: callsMade || 0,
            });
          }
        }
      }
    }

    // Send nudges via Twilio
    const sentCount = await Promise.all(
      nudgesPending.map(async (nudge) => {
        try {
          const message = getRandomNudge(
            nudge.textsSent,
            nudge.emailsSent,
            nudge.callsMade
          );

          // Send SMS via Twilio (using fetch to call Twilio API)
          const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`;
          const twilioAuth = Buffer.from(
            `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`
          ).toString("base64");

          const res = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              Authorization: `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              From: process.env.TWILIO_PHONE_NUMBER || "+1234567890",
              To: nudge.phone,
              Body: message,
            }).toString(),
          });

          if (res.ok) {
            // Log nudge as event
            await db.from("sales_events").insert({
              agent_id: nudge.agentId,
              action_type: "message_sent",
              channel: "sms",
              message: message,
              metadata: { alert_type: "nudge", nudge_time: new Date().toISOString() },
            });

            return { success: true, agent: nudge.fullName };
          } else {
            console.error(`Failed to send nudge to ${nudge.fullName}`);
            return { success: false, agent: nudge.fullName, error: "Twilio API failed" };
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Nudge error for ${nudge.fullName}: ${msg}`);
          return { success: false, agent: nudge.fullName, error: msg };
        }
      })
    );

    const successful = sentCount.filter((r) => r.success).length;

    // ── Alert hook (fire-and-forget, never blocks, additive) ─────────────────
    // Fires reply_waiting + hot_lead personal SMS alerts to agents' personal phones
    // when leads require attention. Completely separate from the Twilio identity
    // outreach above. Guarded by ENABLE_INTERNAL_ALERTS flag.
    if (process.env.ENABLE_INTERNAL_ALERTS === "true") {
      const { origin } = new URL(req.url);
      Promise.resolve().then(async () => {
        try {
          const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

          // Hot leads: replied within 4h
          const { data: hotLeads } = await db
            .from("sales_leads")
            .select("id, business_name, city, assigned_agent_id, status, last_reply_at")
            .in("status", ["replied", "interested"])
            .gte("last_reply_at", fourHoursAgo)
            .eq("do_not_contact", false)
            .limit(20);

          const alertPromises: Promise<unknown>[] = [];

          for (const lead of hotLeads ?? []) {
            if (!lead.assigned_agent_id) continue;

            // reply_waiting
            if (lead.status === "replied") {
              alertPromises.push(
                fetch(`${origin}/api/admin/alerts/send`, {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    agent_id:      lead.assigned_agent_id,
                    alert_type:    "reply_waiting",
                    urgency:       "critical",
                    lead_id:       lead.id,
                    business_name: lead.business_name,
                    city:          lead.city,
                    shadow_mode:   process.env.ALERT_SHADOW_MODE === "true",
                  }),
                }).catch(() => {})
              );
            }

            // hot_lead for interested
            if (lead.status === "interested") {
              alertPromises.push(
                fetch(`${origin}/api/admin/alerts/send`, {
                  method:  "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    agent_id:      lead.assigned_agent_id,
                    alert_type:    "hot_lead",
                    urgency:       "high",
                    lead_id:       lead.id,
                    business_name: lead.business_name,
                    city:          lead.city,
                    shadow_mode:   process.env.ALERT_SHADOW_MODE === "true",
                  }),
                }).catch(() => {})
              );
            }
          }

          await Promise.allSettled(alertPromises);
        } catch { /* never throws — hook is fire-and-forget */ }
      });
    }

    return NextResponse.json({
      ok: true,
      nudges_sent: successful,
      total_pending: nudgesPending.length,
      details: sentCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[nudge route] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
