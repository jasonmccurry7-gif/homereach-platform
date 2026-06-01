import { NextResponse } from "next/server";
import { requireAuthenticated, roleOf } from "@/lib/auth/api-guards";
import { loadMetaPublishingConfigStatus } from "@/lib/social-content/meta/config";
import { listMetaConnectionsForUser } from "@/lib/social-content/meta/repository";

export async function GET() {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;

  const { connections, warning } = await listMetaConnectionsForUser({
    userId: guard.user!.id,
    role: roleOf(guard.user),
  });

  return NextResponse.json({
    ok: true,
    config: loadMetaPublishingConfigStatus(),
    connections,
    warning,
  });
}
