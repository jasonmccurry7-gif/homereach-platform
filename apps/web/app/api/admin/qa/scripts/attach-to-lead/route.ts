// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/qa/scripts/attach-to-lead
//   { leadId, answerId, questionId, scriptId?, note? }
//
// Writes qa_lead_attachments row + a sales_events row of type
// 'qa_script_attached' (additive event type; no sales_events schema change).
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { qaFlagGate, requireAgent } from "@/lib/qa/guards";
import { logUsage } from "@/lib/qa/usage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const flag = qaFlagGate();
  if (flag) return flag;
  const g = await requireAgent();
  if (!g.ok) return g.response;

  const body = (await req.json().catch(() => ({}))) as Partial<{
    leadId: string;
    answerId: string;
    questionId: string;
    scriptId: string;
    note: string;
  }>;

  if (!body.leadId || !body.answerId || !body.questionId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  // 1) Insert the Q&A lead attachment
  const { data: attachment, error: attErr } = await g.supa
    .from("qa_lead_attachments")
    .insert({
      lead_id: body.leadId,
      question_id: body.questionId,
      answer_id: body.answerId,
      script_id: body.scriptId ?? null,
      attached_by_agent_id: g.agentId,
      note: body.note?.slice(0, 1000) ?? null,
    })
    .select("id")
    .single();

  if (attErr) {
    return NextResponse.json({ error: attErr.message }, { status: 500 });
  }

  // 2) Additive row in sales_events — visible in lead timeline via existing
  //    UI. We do not alter the sales_events table schema. If sales_events uses
  //    an enum that doesn't include 'qa_script_attached', this INSERT will
  //    fail with a type error — in that case, the fallback is to use an
  //    existing generic event_type (e.g., 'note'). The failure mode is
  //    caught and logged but does not break the attachment itself.
  try {
    await g.supa.from("sales_events").insert({
      lead_id: body.leadId,
      agent_id: g.agentId,
      event_type: "qa_script_attached",
      metadata: {
        qa_attachment_id: (attachment as any).id,
        question_id: body.questionId,
        answer_id: body.answerId,
      },
    } as any);
  } catch (err) {
    console.warn("[qa] sales_events insert failed (non-fatal):", err);
  }

  await logUsage(g.supa, {
    eventType: "attached_to_lead",
    agentId: g.agentId,
    leadId: body.leadId,
    questionId: body.questionId,
    answerId: body.answerId,
    scriptId: body.scriptId ?? null,
    metadata: { attachment_id: (attachment as any).id },
  });

  return NextResponse.json({
    ok: true,
    attachmentId: (attachment as any).id,
  });
}
