import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";

type ControlAction =
  | "pause_all"
  | "pause_email"
  | "pause_sms"
  | "pause_facebook"
  | "manual_approval_on"
  | "reduce_email_cap"
  | "reduce_sms_cap"
  | "clear_domain_pause";

function jsonError(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const payload = await req.json().catch(() => ({}));
  const action = payload?.action as ControlAction | undefined;
  const db = createServiceClient();

  const patch: Record<string, unknown> = {};
  let message = "";

  switch (action) {
    case "pause_all":
      patch.all_paused = true;
      message = "Global outbound pause enabled.";
      break;
    case "pause_email":
      patch.email_paused = true;
      message = "Email channel pause enabled.";
      break;
    case "pause_sms":
      patch.sms_paused = true;
      message = "SMS channel pause enabled.";
      break;
    case "pause_facebook":
      patch.facebook_paused = true;
      message = "Facebook channel pause enabled.";
      break;
    case "manual_approval_on":
      patch.manual_approval_mode = true;
      message = "Manual approval mode enabled.";
      break;
    case "reduce_email_cap":
      patch.daily_email_cap_per_sender = Math.max(1, Number(payload?.value ?? 5));
      patch.max_domain_daily_email_cap = Math.max(1, Number(payload?.domainValue ?? 20));
      message = "Email send caps reduced.";
      break;
    case "reduce_sms_cap":
      patch.daily_sms_cap = Math.max(0, Number(payload?.value ?? 0));
      message = "SMS send caps reduced.";
      break;
    case "clear_domain_pause":
      patch.domain_reputation_paused = false;
      message = "Domain reputation pause cleared.";
      break;
    default:
      return jsonError("Unknown deliverability control action.", 400);
  }

  const { data, error } = await db
    .from("system_controls")
    .update(patch)
    .eq("id", 1)
    .select("*")
    .maybeSingle();

  if (error) return jsonError(error.message, 500);

  await logPlatformAuditEvent({
    actorType: "human",
    actorId: guard.user?.id ?? null,
    actorLabel: guard.user?.email ?? "admin",
    module: "deliverability",
    actionType: `control_${action}`,
    entityType: "system_controls",
    entityId: "1",
    resultStatus: "success",
    severity: action?.startsWith("pause") ? "high" : "medium",
    message,
    metadata: { patch },
  });

  return NextResponse.json({ ok: true, message, controls: data });
}
