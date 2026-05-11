import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getOwnerIdentity } from "@homereach/services/outreach";

// ─────────────────────────────────────────────────────────────────────────────
// Anchor Agent — Client Retention & Renewal Management
// POST /api/admin/agents/anchor
//
// Tracks renewals and churn risk. Sends win-back SMS for paused spots and
// retention reminders for approaching renewals.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SpotAssignment {
  id: string;
  business_id: string | null;
  city_id: string;
  status: "active" | "paused" | "churned" | "cancelled" | "pending";
  commitment_ends_at: string | null;
  activated_at: string | null;
  created_at: string;
}

interface Business {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
}

interface AnchorResult {
  success: boolean;
  summary: {
    spots_processed: number;
    renewals_approaching: number;
    win_backs_sent: number;
    retention_sent: number;
    errors: number;
  };
  details?: Array<{
    spot_id: string;
    business_id: string | null;
    status: "sent" | "skipped" | "error";
    action?: string;
    reason?: string;
  }>;
}

interface AgentIdentity {
  name: string;
  email: string;
  phone: string;
}

const OWNER_IDENTITY = getOwnerIdentity();

// ─── Territory → Agent Mapping ────────────────────────────────────────────────

const TERRITORY_AGENT_MAP: Record<string, AgentIdentity> = {
  "Wooster": { name: "Heather", email: "heather@home-reach.com", phone: "+13306626331" },
  "Medina": { name: "Heather", email: "heather@home-reach.com", phone: "+13306626331" },
  "Massillon": { name: "Josh", email: "josh@home-reach.com", phone: "+13304224396" },
  "Ravenna": { name: "Josh", email: "josh@home-reach.com", phone: "+13304224396" },
  "Green": { name: "Chris", email: "chris@home-reach.com", phone: "+13305949713" },
  "Stow": { name: "Chris", email: "chris@home-reach.com", phone: "+13305949713" },
  "Cuyahoga Falls": { name: OWNER_IDENTITY.name, email: OWNER_IDENTITY.domainEmail, phone: OWNER_IDENTITY.cellPhone },
  "Hudson": { name: OWNER_IDENTITY.name, email: OWNER_IDENTITY.domainEmail, phone: OWNER_IDENTITY.cellPhone },
  "Canton": { name: OWNER_IDENTITY.name, email: OWNER_IDENTITY.domainEmail, phone: OWNER_IDENTITY.cellPhone },
  "Akron": { name: OWNER_IDENTITY.name, email: OWNER_IDENTITY.domainEmail, phone: OWNER_IDENTITY.cellPhone },
};

const DEFAULT_AGENT: AgentIdentity = {
  name: OWNER_IDENTITY.name,
  email: OWNER_IDENTITY.domainEmail,
  phone: OWNER_IDENTITY.cellPhone,
};

// ─── Helper: Get agent by city ────────────────────────────────────────────────

function getAgentByCity(city: string | null): AgentIdentity {
  if (!city) return DEFAULT_AGENT;
  return TERRITORY_AGENT_MAP[city] || DEFAULT_AGENT;
}

// ─── Helper: Calculate days until renewal ────────────────────────────────────

function daysUntilRenewal(commitmentEndsAt: string): number {
  const now = new Date();
  const renewalDate = new Date(commitmentEndsAt);
  const diffMs = renewalDate.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// ─── Helper: Send SMS via /api/admin/sales/event ────────────────────────────

async function sendRetentionSms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  businessId: string | null,
  businessPhone: string,
  businessName: string,
  city: string | null,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const agent = getAgentByCity(city);

    // Find or create a temporary lead record for tracking
    // For now, we'll just call the event endpoint without a lead_id
    const payload = {
      agent_id: agent.email === OWNER_IDENTITY.domainEmail ? "jason-agent-id" : `${agent.name.toLowerCase()}-agent-id`,
      action_type: "follow_up_sent",
      channel: "sms",
      city,
      message,
      to_address: businessPhone,
    };

    const response = await fetch(
      `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/admin/sales/event`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return {
        success: false,
        error: `Event endpoint returned ${response.status}: ${error}`,
      };
    }

    return { success: true };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    return { success: false, error };
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const supabase = await createClient();
  const details: AnchorResult["summary"] = {
    spots_processed: 0,
    renewals_approaching: 0,
    win_backs_sent: 0,
    retention_sent: 0,
    errors: 0,
  };

  const detailLog: AnchorResult["details"] = [];

  try {
    // 1. Fetch spot assignments to monitor
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    // Active spots approaching renewal (within 30 days)
    const { data: renewalSpots, error: renewalError } = await supabase
      .from("spot_assignments")
      .select(
        `
        id,
        business_id,
        city_id,
        status,
        commitment_ends_at,
        activated_at,
        created_at
        `
      )
      .eq("status", "active")
      .not("commitment_ends_at", "is", null)
      .lte("commitment_ends_at", thirtyDaysFromNow)
      .gte("commitment_ends_at", new Date().toISOString());

    if (renewalError) {
      throw new Error(`Failed to fetch renewal spots: ${renewalError.message}`);
    }

    // Paused spots (payment failed, win-back candidates)
    const { data: pausedSpots, error: pausedError } = await supabase
      .from("spot_assignments")
      .select(
        `
        id,
        business_id,
        city_id,
        status,
        created_at
        `
      )
      .eq("status", "paused");

    if (pausedError) {
      throw new Error(`Failed to fetch paused spots: ${pausedError.message}`);
    }

    // Combine all spots to process
    const allSpots = [...(renewalSpots || []), ...(pausedSpots || [])];
    const processedSpotIds = new Set<string>();

    // 2. Process paused spots (win-back)
    if (pausedSpots) {
      for (const spot of pausedSpots) {
        const typedSpot = spot as SpotAssignment;

        if (processedSpotIds.has(typedSpot.id)) continue;
        processedSpotIds.add(typedSpot.id);
        details.spots_processed++;

        try {
          // Get city name
          const { data: cityData } = await supabase
            .from("cities")
            .select("name")
            .eq("id", typedSpot.city_id)
            .maybeSingle();

          const cityName = cityData?.name || "your area";

          if (!typedSpot.business_id) {
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: null,
              status: "skipped",
              reason: "No business associated",
            });
            continue;
          }

          // Get business phone
          const { data: business } = await supabase
            .from("businesses")
            .select("name, phone, email, city")
            .eq("id", typedSpot.business_id)
            .maybeSingle();

          if (!business?.phone) {
            details.errors++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "error",
              reason: "No phone number",
            });
            continue;
          }

          const agent = getAgentByCity(business.city);
          const winBackMessage = `Hi ${business.name}, your HomeReach spot in ${cityName} is paused due to a billing issue. Update your payment to keep your exclusive spot: https://home-reach.com/dashboard`;

          const result = await sendRetentionSms(
            supabase,
            typedSpot.business_id,
            business.phone,
            business.name,
            business.city,
            winBackMessage
          );

          if (result.success) {
            details.win_backs_sent++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "sent",
              action: "win_back",
            });
          } else {
            details.errors++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "error",
              action: "win_back",
              reason: result.error,
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.error(`[anchor] error processing paused spot ${typedSpot.id}:`, error);
          details.errors++;
          detailLog.push({
            spot_id: typedSpot.id,
            business_id: typedSpot.business_id,
            status: "error",
            reason: error,
          });
        }
      }
    }

    // 3. Process renewal-approaching spots
    if (renewalSpots) {
      for (const spot of renewalSpots) {
        const typedSpot = spot as SpotAssignment;

        if (processedSpotIds.has(typedSpot.id)) continue;
        processedSpotIds.add(typedSpot.id);
        details.spots_processed++;

        try {
          if (!typedSpot.commitment_ends_at || !typedSpot.business_id) {
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "skipped",
              reason: "Missing commitment date or business",
            });
            continue;
          }

          const daysLeft = daysUntilRenewal(typedSpot.commitment_ends_at);

          // Only send at 30 days and 7 days
          if (daysLeft !== 30 && daysLeft !== 7) {
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "skipped",
              reason: `Not renewal trigger day (${daysLeft} days out)`,
            });
            continue;
          }

          // Get city name
          const { data: cityData } = await supabase
            .from("cities")
            .select("name")
            .eq("id", typedSpot.city_id)
            .maybeSingle();

          const cityName = cityData?.name || "your area";

          // Get business
          const { data: business } = await supabase
            .from("businesses")
            .select("name, phone, email, city")
            .eq("id", typedSpot.business_id)
            .maybeSingle();

          if (!business?.phone) {
            details.errors++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "error",
              reason: "No phone number",
            });
            continue;
          }

          const retentionMessage = `Hi ${business.name}! Your HomeReach spot renews in ${daysLeft} days. You're locking in [homes] homes per month. Any questions? Reply here.`;

          const result = await sendRetentionSms(
            supabase,
            typedSpot.business_id,
            business.phone,
            business.name,
            business.city,
            retentionMessage
          );

          if (result.success) {
            details.retention_sent++;
            details.renewals_approaching++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "sent",
              action: "renewal_reminder",
            });
          } else {
            details.errors++;
            detailLog.push({
              spot_id: typedSpot.id,
              business_id: typedSpot.business_id,
              status: "error",
              action: "renewal_reminder",
              reason: result.error,
            });
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          console.error(`[anchor] error processing renewal spot ${typedSpot.id}:`, error);
          details.errors++;
          detailLog.push({
            spot_id: typedSpot.id,
            business_id: typedSpot.business_id,
            status: "error",
            reason: error,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      summary: details,
      details: detailLog,
    } as AnchorResult);
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[anchor] fatal error:", error);
    return NextResponse.json(
      { success: false, error, summary: details },
      { status: 500 }
    );
  }
}

// ─── GET Handler: Anchor Status ───────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient();

    // Count spots approaching renewal
    const thirtyDaysFromNow = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { count: renewalCount } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact" })
      .eq("status", "active")
      .not("commitment_ends_at", "is", null)
      .lte("commitment_ends_at", thirtyDaysFromNow)
      .gte("commitment_ends_at", new Date().toISOString());

    // Count paused spots (churn risk)
    const { count: pausedCount } = await supabase
      .from("spot_assignments")
      .select("id", { count: "exact" })
      .eq("status", "paused");

    return NextResponse.json({
      status: "operational",
      renewals_approaching: renewalCount ?? 0,
      churn_risk_spots: pausedCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[anchor] status check failed:", error);
    return NextResponse.json(
      { status: "error", error },
      { status: 500 }
    );
  }
}
