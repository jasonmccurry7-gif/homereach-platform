import { NextResponse } from "next/server";
import { requireAuthenticated, userHasRole } from "@/lib/auth/api-guards";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";
import { recordAdTechAction } from "@/lib/ad-tech/engine";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_ACTIONS = new Set([
  "approve",
  "request_changes",
  "reject",
  "question",
  "mark_ready",
  "manual_launch_complete",
]);

export async function POST(request: Request) {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;
  const privileged = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent", "client"],
    guard,
    purpose: "ad_tech_approval_action",
    route: "/api/ad-tech/actions",
  });
  const user = guard.user;
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const actionType = String(body.actionType ?? "");
  if (!ALLOWED_ACTIONS.has(actionType)) {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const role = privileged.actor.role;
  const isAdmin = userHasRole(user, ["admin", "sales_agent"]);
  if ((actionType === "mark_ready" || actionType === "manual_launch_complete") && !isAdmin) {
    return NextResponse.json({ error: "Admin approval required" }, { status: 403 });
  }

  try {
    const result = await recordAdTechAction({
      supabase: privileged.supabase,
      actionType,
      actorUserId: user.id,
      actorEmail: user.email ?? null,
      actorRole: String(role ?? "client"),
      launchPackageId: typeof body.launchPackageId === "string" ? body.launchPackageId : null,
      approvalId: typeof body.approvalId === "string" ? body.approvalId : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });
    return NextResponse.json({ ...result, ok: true });
  } catch (error) {
    console.error("[ad-tech/action] failed", error);
    const message = error instanceof Error ? error.message : "Ad-Tech action failed";
    const status = message.startsWith("Forbidden") || message === "Admin approval required." ? 403 : 500;
    return NextResponse.json(
      { error: message },
      { status },
    );
  }
}
