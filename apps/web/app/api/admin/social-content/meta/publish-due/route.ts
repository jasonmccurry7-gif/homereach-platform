import { NextResponse } from "next/server";
import { requireAdminOrCron } from "@/lib/auth/api-guards";
import { SocialPublishBlockedError } from "@/lib/social-content/publish-guard";
import { publishDueMetaPublications } from "@/lib/social-content/meta/publisher";

export async function POST(req: Request) {
  const guard = await requireAdminOrCron(req);
  if (!guard.ok) return guard.response;

  const body = await safeJson(req);
  const limit = Number(body.limit ?? 10);

  try {
    const results = await publishDueMetaPublications({
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 25) : 10,
      actorId: guard.user?.id ?? null,
    });
    return NextResponse.json({ ok: true, results });
  } catch (error) {
    if (error instanceof SocialPublishBlockedError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to publish due Meta posts." },
      { status: 500 },
    );
  }
}

async function safeJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
