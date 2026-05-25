// ─────────────────────────────────────────────────────────────────────────────
// POST /api/targeted-campaign
//
// Saves a targeted direct-mail campaign enquiry to waitlist_entries and
// fires an SMS alert to Jason so he can follow up immediately.
// ─────────────────────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, waitlistEntries } from "@homereach/db";
import {
  checkPublicRateLimit,
  publicRateLimitHeaders,
} from "@/lib/security/public-rate-limit";

const Schema = z.object({
  businessName: z.string().min(1),
  contactName:  z.string().optional(),
  phone:        z.string().min(7),
  email:        z.string().email(),
  notes:        z.string().optional(),
  cityId:       z.string().uuid().optional(),
  cityName:     z.string().optional(),
  totalHomes:   z.number().int().optional(),
  totalPrice:   z.number().optional(),
  routeCount:   z.number().int().optional(),
  tierLabel:    z.string().optional(),
});

const TARGETED_CAMPAIGN_LEAD_RATE_LIMIT = {
  scope: "lead-capture:targeted-campaign",
  limit: 10,
  windowMs: 10 * 60_000,
};

export async function POST(req: NextRequest) {
  const rateLimit = checkPublicRateLimit(req, TARGETED_CAMPAIGN_LEAD_RATE_LIMIT);
  const headers = publicRateLimitHeaders(rateLimit);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many targeted campaign requests." },
      { status: 429, headers }
    );
  }

  try {
    const body = await req.json();
    const data = Schema.parse(body);

    // ── Save to waitlist_entries ──────────────────────────────────────────────
    await db.insert(waitlistEntries).values({
      email:        data.email,
      phone:        data.phone,
      name:         data.contactName ?? data.businessName,
      cityId:       data.cityId ?? null,
      businessName: data.businessName,
    });

    // ── SMS alert to Jason ────────────────────────────────────────────────────
    try {
      const { getOwnerIdentity, sendSms } = await import("@homereach/services/outreach");
      const owner = getOwnerIdentity();

      const price  = data.totalPrice   != null ? `$${data.totalPrice.toLocaleString()}`    : "TBD";
      const homes  = data.totalHomes   != null ? data.totalHomes.toLocaleString() + " homes" : "";
      const routes = data.routeCount   != null ? `${data.routeCount} routes`                 : "";
      const tier   = data.tierLabel    != null ? ` (${data.tierLabel})`                      : "";
      const city   = data.cityName                                                            ?? "";

      const lines = [
        `📬 TARGETED CAMPAIGN LEAD`,
        `${data.businessName}${city ? ` – ${city}` : ""}`,
        [homes, routes].filter(Boolean).join(", ") + tier,
        `Est: ${price}`,
        `📞 ${data.phone} | ${data.email}`,
        data.notes ? `Note: "${data.notes}"` : null,
      ].filter(Boolean).join("\n");

      await sendSms({ body: lines, to: owner.cellPhone, intent: "internal" });
    } catch (smsErr) {
      // Non-fatal — lead is already saved; log and continue
      console.error("[TargetedCampaign] SMS alert failed:", smsErr);
    }

    return NextResponse.json({ success: true }, { headers });
  } catch (err) {
    console.error("[TargetedCampaign] Error:", err);
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400, headers });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers });
  }
}
