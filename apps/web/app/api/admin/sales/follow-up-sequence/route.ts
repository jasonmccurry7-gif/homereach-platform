import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { createClient } from "@/lib/supabase/server";
import {
  auditDeliverabilityCopy,
  buildAiOutputContent,
  buildOutreachSourceAttribution,
  scoreNextBestAction,
} from "@/lib/sales-engine/outreach-governance";

interface FollowUpTask {
  lead_id: string;
  business_name: string;
  city: string;
  category: string;
  phone: string | null;
  email: string | null;
  facebook_url: string | null;
  sequence_day: 1 | 3 | 5 | 7;
  channel: "sms" | "email" | "call" | "dm";
  draft_message: string;
  days_since_contact: number;
}

function getDraftMessage(
  sequenceDay: 1 | 3 | 5 | 7,
  lead: {
    business_name: string;
    contact_name: string | null;
    city: string;
    category: string;
  }
): string {
  const firstName = lead.contact_name?.split(" ")[0] || "there";
  const cityName = lead.city || "your area";
  const categoryName = lead.category || "category";

  const messages: Record<number, string> = {
    1: `Hi ${firstName}, quick follow-up on the ${cityName} ${categoryName} visibility option. Want me to send the simple coverage and pricing breakdown?`,
    3: `Subject: Clear ${categoryName} visibility option in ${cityName}\n\nHi ${firstName},\n\nI wanted to make sure you had the details for the ${categoryName} visibility option in ${cityName}. HomeReach keeps this simple: protected category placement, a clear postcard path, and a low-lift setup.\n\nWould you like me to send the pricing link and next step?\n\nBest`,
    5: `Hi ${firstName}, last check-in on the ${cityName} ${categoryName} option. Is the timing off, or would a simpler coverage/cost breakdown help you decide? Either answer is fine.`,
    7: `Final note on the ${cityName} ${categoryName} visibility option. Happy to close the loop or send the simple plan if it would help later.`,
  };

  return messages[sequenceDay] || "";
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agent_id");
    if (!agentId) {
      return NextResponse.json({ error: "agent_id required" }, { status: 400 });
    }

    const db = createServiceClient();
    const now = new Date();
    const oneDay = now.getTime() - 24 * 60 * 60 * 1000;
    const threeDays = now.getTime() - 3 * 24 * 60 * 60 * 1000;
    const fiveDays = now.getTime() - 5 * 24 * 60 * 60 * 1000;
    const sevenDays = now.getTime() - 7 * 24 * 60 * 60 * 1000;

    // Fetch candidates for each sequence day
    const [day1, day3, day5, day7] = await Promise.all([
      // Day 1: contacted 1 day ago, no reply
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(oneDay).toISOString())
        .lte("last_contacted_at", now.toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true)
        .not("sms_opt_out", "is", true),

      // Day 3: first contacted 3 days ago, no reply, have email
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(threeDays).toISOString())
        .lte("last_contacted_at", new Date(threeDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("email", "is", null)
        .not("do_not_contact", "is", true),

      // Day 5: contacted 5 days ago, no reply
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(fiveDays).toISOString())
        .lte("last_contacted_at", new Date(fiveDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true),

      // Day 7: contacted 7 days ago, no reply, have email or facebook
      db
        .from("sales_leads")
        .select(
          `id, business_name, contact_name, city, category, phone, email, facebook_url, last_contacted_at`
        )
        .eq("assigned_agent_id", agentId)
        .gte("last_contacted_at", new Date(sevenDays).toISOString())
        .lte("last_contacted_at", new Date(sevenDays + 24 * 60 * 60 * 1000).toISOString())
        .is("last_reply_at", null)
        .not("do_not_contact", "is", true),
    ]);

    const tasks: FollowUpTask[] = [];

    // Add day 1 tasks (SMS)
    (day1.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 1,
        channel: "sms",
        draft_message: getDraftMessage(1, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 3 tasks (Email)
    (day3.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 3,
        channel: "email",
        draft_message: getDraftMessage(3, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 5 tasks (Call or SMS)
    (day5.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 5,
        channel: "sms",
        draft_message: getDraftMessage(5, lead),
        days_since_contact: daysSince,
      });
    });

    // Add day 7 tasks (Email or DM)
    (day7.data || []).forEach((lead) => {
      const daysSince = Math.floor(
        (now.getTime() - new Date(lead.last_contacted_at || now).getTime()) /
          (24 * 60 * 60 * 1000)
      );
      tasks.push({
        lead_id: lead.id,
        business_name: lead.business_name,
        city: lead.city,
        category: lead.category,
        phone: lead.phone,
        email: lead.email,
        facebook_url: lead.facebook_url,
        sequence_day: 7,
        channel: lead.email ? "email" : lead.facebook_url ? "dm" : "email",
        draft_message: getDraftMessage(7, lead),
        days_since_contact: daysSince,
      });
    });

    const governedTasks = tasks.map((task) => {
      const leadContext = {
        id: task.lead_id,
        business_name: task.business_name,
        city: task.city,
        category: task.category,
        phone: task.phone,
        email: task.email,
        facebook_url: task.facebook_url,
        last_contacted_at: new Date(now.getTime() - task.days_since_contact * 24 * 60 * 60 * 1000).toISOString(),
      };
      const channel = task.channel === "dm" ? "facebook_dm" : task.channel;
      const sourceAttribution = buildOutreachSourceAttribution({
        workflow: "admin_sales_follow_up_sequence",
        channel,
        lead: leadContext,
        destination: task.channel === "sms" || task.channel === "call" ? task.phone : task.channel === "email" ? task.email : task.facebook_url,
        templateId: `follow_up_sequence_day_${task.sequence_day}`,
        action: "Follow-up sequence draft",
        nextAction: "Review and approve one-to-one before marking sent.",
        sources: ["sales_leads", "sales_events"],
      });
      return {
        ...task,
        approval: {
          required: true,
          status: "needs_review",
          reason: "Generated follow-up drafts must be reviewed before outbound use.",
        },
        source_attribution: sourceAttribution,
        next_best_action: scoreNextBestAction(leadContext, { channel }),
        deliverability: auditDeliverabilityCopy(task.draft_message, channel),
      };
    });

    return NextResponse.json({ sequence_tasks: governedTasks });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[follow-up-sequence GET] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { agentId, leadId, sequenceDay, channel, message } = body;

    if (!agentId || !leadId || !sequenceDay || !channel || !message) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const db = createServiceClient();
    const { data: lead } = await db
      .from("sales_leads")
      .select("id, business_name, contact_name, city, category, phone, email, facebook_url, status, score, buying_signal, last_contacted_at, last_reply_at, next_follow_up_at, do_not_contact, sms_opt_out, is_quarantined, email_status")
      .eq("id", leadId)
      .maybeSingle();
    const leadContext = lead ?? {
      id: leadId,
      business_name: "Unknown business",
      city: "",
      category: "",
    };
    const governedChannel = channel === "dm" ? "facebook_dm" : channel;
    const sourceAttribution = buildOutreachSourceAttribution({
      workflow: "admin_sales_follow_up_sequence",
      channel: governedChannel,
      lead: leadContext,
      destination: channel === "sms" || channel === "call" ? lead?.phone : channel === "email" ? lead?.email : lead?.facebook_url,
      templateId: `follow_up_sequence_day_${sequenceDay}`,
      action: "Follow-up sequence POST",
      nextAction: "Human approval required before this follow-up is considered sent.",
      approvalStatus: body.humanApproved === true || body.approval_status === "approved" ? "approved" : "needs_review",
      sources: ["sales_leads", "sales_events"],
    });
    const deliverability = auditDeliverabilityCopy(message, governedChannel);
    const humanApproved = body.humanApproved === true || body.approval_status === "approved";

    if (!humanApproved || deliverability.status === "blocked") {
      try {
        await db.from("ai_outputs").insert({
          title: `Follow-up draft: ${sourceAttribution.related_entity.label}`,
          agent_name: "Outreach Agent",
          workflow: "admin_sales_follow_up_sequence",
          output_type: "draft",
          content: buildAiOutputContent({
            channel: governedChannel,
            body: message,
            cta: "Review, approve, and send one-to-one from the admin workflow.",
            complianceNotes: deliverability.notes,
            sourceAttribution,
          }),
          data_sources: sourceAttribution.sources_referenced,
          prompt_sop_name: "skills/outreach/SKILL.md",
          approval_status: "needs_review",
          verification_status: deliverability.status === "blocked" ? "needs_review" : "pending",
          metadata: {
            source_attribution: sourceAttribution,
            deliverability,
            sequence_day: sequenceDay,
          },
        });
      } catch (draftError) {
        console.warn("[follow-up-sequence POST] AI output draft log skipped:", draftError);
      }

      return NextResponse.json({
        ok: true,
        approval_status: "needs_review",
        message: deliverability.status === "blocked"
          ? "Follow-up draft needs revision before outbound use"
          : "Follow-up draft saved for review; not marked as sent",
        source_attribution: sourceAttribution,
        deliverability,
      });
    }

    // Approval records the draft decision only. Sending must go through the approved provider pipeline.
    await db.from("sales_events").insert({
      agent_id: agentId,
      lead_id: leadId,
      action_type: "lead_loaded",
      channel: channel,
      message: message,
      metadata: {
        sequence_day: sequenceDay,
        approval_status: "approved",
        draft_only: true,
        send_required_separately: true,
        source_attribution: sourceAttribution,
        deliverability,
      },
    });

    return NextResponse.json({
      ok: true,
      approval_status: "approved",
      source_attribution: sourceAttribution,
      deliverability,
      sent: false,
      message: "Follow-up approved as a draft. No outbound message was sent or marked sent by this route.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[follow-up-sequence POST] error:`, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
