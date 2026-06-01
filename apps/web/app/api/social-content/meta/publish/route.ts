import { NextResponse } from "next/server";
import { requireAuthenticated, roleOf } from "@/lib/auth/api-guards";
import { createServiceClient } from "@/lib/supabase/service";
import { SocialPublishBlockedError } from "@/lib/social-content/publish-guard";
import { publishMetaPublication } from "@/lib/social-content/meta/publisher";
import { listMetaConnectionsForUser } from "@/lib/social-content/meta/repository";

export async function POST(req: Request) {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;

  const body = await safeJson(req);
  const publicationId = stringField(body.publicationId);
  if (!publicationId) {
    return NextResponse.json({ ok: false, error: "publicationId is required." }, { status: 400 });
  }

  const connectionId = await loadPublicationConnectionId(publicationId);
  if (!connectionId) {
    return NextResponse.json({ ok: false, error: "Meta publication was not found." }, { status: 404 });
  }

  const allowed = await userCanUseConnection(guard.user!.id, roleOf(guard.user), connectionId);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const result = await publishMetaPublication({
      publicationId,
      actorId: guard.user!.id,
      action: "publish_now",
    });
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    if (error instanceof SocialPublishBlockedError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to publish Meta post." },
      { status: 500 },
    );
  }
}

async function loadPublicationConnectionId(publicationId: string) {
  const db = createServiceClient();
  const { data, error } = await db
    .from("social_publication_records")
    .select("meta_connection_id,provider")
    .eq("id", publicationId)
    .maybeSingle();
  if (error || data?.provider !== "meta") return null;
  return typeof data.meta_connection_id === "string" ? data.meta_connection_id : null;
}

async function userCanUseConnection(userId: string, role: string | null, connectionId: string) {
  const { connections } = await listMetaConnectionsForUser({ userId, role, limit: 100 });
  return connections.some((connection) => connection.id === connectionId);
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function stringField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}
