import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { sendVerificationEmail } from "@/lib/email-infrastructure/verification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SendTestPayload = {
  senderEmail?: string;
  destinationEmail?: string;
};

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let payload: SendTestPayload;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload." }, { status: 400 });
  }

  if (!payload.senderEmail) {
    return NextResponse.json({ ok: false, error: "senderEmail is required." }, { status: 400 });
  }

  try {
    const result = await sendVerificationEmail({
      senderEmail: payload.senderEmail,
      recipientEmail: payload.destinationEmail,
      requestedBy: guard.user?.id ?? null,
    });

    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
}
