import { NextRequest, NextResponse } from "next/server";
import { getOwnerIdentity } from "@homereach/services/outreach";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function html(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="noindex,nofollow" />
        <title>${title}</title>
        <style>
          body { margin: 0; font-family: Arial, sans-serif; color: #0f172a; background: #f8fafc; }
          main { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
          section { width: min(560px, 100%); background: white; border: 1px solid #dbe4f0; border-radius: 18px; padding: 28px; box-shadow: 0 18px 50px rgba(15, 23, 42, .08); }
          h1 { margin: 0 0 12px; font-size: 28px; line-height: 1.1; }
          p { font-size: 16px; line-height: 1.55; color: #475569; }
          a { color: #1d4ed8; font-weight: 700; }
        </style>
      </head>
      <body>
        <main>
          <section>
            <h1>${title}</h1>
            <p>${body}</p>
          </section>
        </main>
      </body>
    </html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function getEmail(req: NextRequest) {
  const fromQuery = req.nextUrl.searchParams.get("email");
  const fromForm = req.nextUrl.searchParams.get("List-Unsubscribe");
  const value = fromQuery || fromForm || "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function manualUnsubscribeLink() {
  const identity = getOwnerIdentity();
  const email = identity.defaultReplyToEmail || identity.domainEmail || identity.personalEmail;
  const href = `mailto:${encodeURIComponent(email)}?subject=unsubscribe`;
  const label = escapeHtml(email);
  return `<a href="${href}">${label}</a>`;
}

async function unsubscribe(email: string) {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("sales_leads")
    .update({
      email_status: "unsubscribed",
      do_not_contact: true,
      updated_at: now,
    })
    .ilike("email", email);

  await supabase.from("email_events").insert({
    provider: "home-reach",
    event_type: "unsubscribe",
    recipient: email,
    error_message: error?.message ?? null,
    tags: ["one_click_unsubscribe"],
    raw_payload: {
      source: "unsubscribe_route",
      email,
      updated_at: now,
      success: !error,
    },
  });

  const { error: suppressionError } = await supabase
    .from("outreach_suppression_list")
    .insert({
      contact_email: email,
      channel: "email",
      reason: "unsubscribe",
      source_system: "unsubscribe_route",
      active: true,
      evidence: {
        source: "list_unsubscribe",
        requested_at: now,
      },
      metadata: {
        sales_leads_updated: !error,
      },
    });

  if (
    suppressionError &&
    suppressionError.code !== "23505" &&
    suppressionError.code !== "42P01"
  ) {
    console.warn("[unsubscribe] suppression insert skipped:", suppressionError.message);
  }

  const { error: consentError } = await supabase.from("revenue_consent_events").insert({
    business_line: "targeted_mailing",
    source_system: "unsubscribe_route",
    source_id: null,
    channel: "email",
    contact_email: email,
    event_type: "opt_out",
    keyword: "unsubscribe",
    evidence: {
      source: "list_unsubscribe",
      requested_at: now,
    },
    metadata: {
      sales_leads_updated: !error,
    },
  });

  if (consentError && consentError.code !== "42P01") {
    console.warn("[unsubscribe] consent event insert skipped:", consentError.message);
  }

  if (error) throw new Error(error.message);
}

export async function GET(req: NextRequest) {
  const email = getEmail(req);
  if (!email) {
    return html(
      "Unsubscribe",
      `We could not identify the email address to unsubscribe. Please email ${manualUnsubscribeLink()} and we will remove it.`,
      400,
    );
  }

  try {
    await unsubscribe(email);
    return html(
      "You are unsubscribed",
      "That email address has been removed from HomeReach marketing outreach. Transactional messages related to active orders or accounts may still be sent when required.",
    );
  } catch {
    return html(
      "Unsubscribe needs review",
      `We could not complete the unsubscribe automatically. Please email ${manualUnsubscribeLink()} and we will remove it manually.`,
      500,
    );
  }
}

export async function POST(req: NextRequest) {
  const email = getEmail(req);
  if (!email) {
    return NextResponse.json({ ok: false, error: "Valid email is required." }, { status: 400 });
  }

  try {
    await unsubscribe(email);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: "Unable to unsubscribe this email." }, { status: 500 });
  }
}
