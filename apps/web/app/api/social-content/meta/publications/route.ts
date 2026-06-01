import { NextResponse } from "next/server";
import { requireAuthenticated, roleOf } from "@/lib/auth/api-guards";
import { SocialPublishBlockedError } from "@/lib/social-content/publish-guard";
import { scheduleMetaPublicationFromAiOutput } from "@/lib/social-content/meta/publisher";
import { listMetaConnectionsForUser } from "@/lib/social-content/meta/repository";

export async function POST(req: Request) {
  const guard = await requireAuthenticated();
  if (!guard.ok) return guard.response;

  const body = await safeJson(req);
  const outputId = stringField(body.outputId);
  const connectionId = stringField(body.connectionId);
  const platform = stringField(body.platform) || "facebook";
  const caption = nullableStringField(body.caption);
  const scheduledAt = nullableStringField(body.scheduledAt);
  const mediaUrls = Array.isArray(body.mediaUrls)
    ? body.mediaUrls.map((url) => String(url).trim()).filter(Boolean)
    : [];

  if (!outputId || !connectionId) {
    return NextResponse.json({ ok: false, error: "outputId and connectionId are required." }, { status: 400 });
  }

  const allowed = await userCanUseConnection(guard.user!.id, roleOf(guard.user), connectionId);
  if (!allowed) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });

  try {
    const publication = await scheduleMetaPublicationFromAiOutput({
      outputId,
      connectionId,
      platform,
      caption,
      mediaUrls,
      scheduledAt,
      actorId: guard.user!.id,
    });
    return NextResponse.json({ ok: true, publication });
  } catch (error) {
    if (error instanceof SocialPublishBlockedError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to schedule Meta publication." },
      { status: 500 },
    );
  }
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

function nullableStringField(value: unknown) {
  const normalized = stringField(value);
  return normalized || null;
}
