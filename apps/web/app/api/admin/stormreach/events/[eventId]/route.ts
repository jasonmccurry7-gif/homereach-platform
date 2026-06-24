import { NextResponse } from "next/server";
import { requireAdmin, requireAdminOrSalesAgent } from "@/lib/auth/api-guards";
import { createGuardedServiceRoleClient } from "@/lib/security/guarded-service-role";
import { loadStormReachEventDetail, updateStormEventStatus } from "@/lib/stormreach/repository";
import type { StormEventStatus } from "@/lib/stormreach/types";

export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ eventId: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const guard = await requireAdminOrSalesAgent();
  if (!guard.ok) return guard.response;

  const { eventId } = await params;
  const { supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin", "sales_agent"],
    guard,
    purpose: "Read StormReach event detail",
    route: `/api/admin/stormreach/events/${eventId}`,
  });

  return NextResponse.json(await loadStormReachEventDetail(eventId, supabase));
}

export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  const { eventId } = await params;
  const { actor, supabase } = createGuardedServiceRoleClient({
    allowedRoles: ["admin"],
    guard,
    purpose: "Update StormReach event review state",
    route: `/api/admin/stormreach/events/${eventId}`,
  });
  const body = await request.json().catch(() => ({})) as {
    status?: StormEventStatus;
    impactedZipCodes?: string[];
    impactedPolygonGeojson?: Record<string, unknown>;
    recommendedIndustries?: string[];
  };

  if (body.status) {
    return NextResponse.json(await updateStormEventStatus(eventId, body.status, { supabase, actor }));
  }

  const detail = await loadStormReachEventDetail(eventId, supabase);
  if (!detail.event) return NextResponse.json({ ok: false, error: "Storm event not found." }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (Array.isArray(body.impactedZipCodes)) update.impacted_zip_codes = body.impactedZipCodes.map(String);
  if (body.impactedPolygonGeojson && typeof body.impactedPolygonGeojson === "object") update.impacted_polygon_geojson = body.impactedPolygonGeojson;
  if (Array.isArray(body.recommendedIndustries)) update.recommended_industries = body.recommendedIndustries.map(String);

  const { error } = await supabase.from("storm_events").update(update).eq("id", detail.event.id);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  await supabase.from("storm_audit_logs").insert({
    storm_event_id: detail.event.id,
    actor_user_id: actor.id,
    actor_label: actor.label,
    action: "event_overrides_updated",
    status: detail.event.status,
    summary: "StormReach admin updated event overrides.",
    details: update,
    approval_status: "needs_review",
  });

  return NextResponse.json({ ok: true });
}
