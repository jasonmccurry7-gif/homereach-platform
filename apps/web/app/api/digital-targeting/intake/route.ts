import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { signPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";
import {
  DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS,
  isGeofenceIntakeEnabled,
  parseDollarInputToCents,
} from "@/lib/digital-targeting/config";
import { buildDigitalDraftRows, buildDigitalTaskRows } from "@/lib/digital-targeting/campaign";
import {
  notifyAdminDigitalIntake,
  sendDigitalIntakeConfirmation,
} from "@/lib/digital-targeting/messaging";

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ASSET_BUCKET = "digital-campaign-assets";

const IntakeSchema = z.object({
  businessName: z.string().trim().min(1).max(180),
  contactName: z.string().trim().min(1).max(140),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(60),
  website: z.string().trim().max(240).optional(),
  industry: z.string().trim().min(1).max(120),
  objectives: z.array(z.string().trim().min(1)).min(1),
  targetingTypes: z.array(z.string().trim().min(1)).min(1),
  monthlyAdSpendCents: z.number().int().min(0),
  preferredStartDate: z.string().trim().max(40).optional(),
  targetLocations: z.string().trim().min(1).max(4000),
  radiusPreference: z.string().trim().max(120).optional(),
  competitorLocations: z.string().trim().max(3000).optional(),
  eventLocations: z.string().trim().max(3000).optional(),
  campaignOffer: z.string().trim().min(1).max(2000),
  directMailAddon: z.boolean(),
  landingPageNeeded: z.boolean(),
  creativePackageAddon: z.boolean(),
  consent: z.literal(true),
});

type IntakeData = z.infer<typeof IntakeSchema>;

async function assertSupabaseWrite<T>(
  label: string,
  operation: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await operation;
  if (error) {
    throw new Error(`${label} failed: ${error.message}`);
  }
  return data;
}

function stringValue(form: FormData, key: string) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function boolValue(form: FormData, key: string) {
  return stringValue(form, key) === "true";
}

function stringValues(form: FormData, key: string) {
  return form
    .getAll(key)
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function splitLines(value: string | undefined) {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function primaryLocationType(targetingType: string) {
  if (targetingType.includes("competitor_area")) return "competitor";
  if (targetingType.includes("event_area")) return "event";
  if (targetingType.includes("service_area")) return "service_area";
  if (targetingType.includes("political_geography")) return "political_geography";
  if (targetingType.includes("custom_area")) return "custom";
  if (targetingType.includes("jobsite_neighborhood")) return "jobsite";
  return "neighborhood";
}

function parseRadiusMiles(value: string | undefined) {
  if (!value) return null;
  const matched = value.match(/[\d.]+/);
  if (!matched) return null;
  const parsed = Number(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

function getFiles(form: FormData, key: string) {
  return form
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

async function uploadAsset(input: {
  supabase: ReturnType<typeof createServiceClient>;
  campaignId: string;
  assetType: "logo" | "image" | "postcard";
  file: File;
}) {
  const { supabase, campaignId, assetType, file } = input;
  const base = {
    campaign_id: campaignId,
    asset_type: assetType,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };

  if (file.size > MAX_ASSET_BYTES) {
    return {
      ...base,
      status: "needs_admin_upload",
      notes: "File was larger than the 10MB intake upload limit.",
    };
  }

  const path = `${campaignId}/${Date.now()}-${assetType}-${sanitizeFileName(file.name)}`;
  const { error } = await supabase.storage.from(ASSET_BUCKET).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    return {
      ...base,
      status: "needs_admin_upload",
      notes: `Storage upload failed: ${error.message}`,
    };
  }

  return {
    ...base,
    status: "uploaded",
    file_url: `storage://${ASSET_BUCKET}/${path}`,
  };
}

async function createAiWorkforceAudit(input: {
  supabase: ReturnType<typeof createServiceClient>;
  campaignId: string;
  businessName: string;
  objective: string;
  targetingType: string;
}) {
  const taskId = `DT-${input.campaignId.slice(0, 8).toUpperCase()}-FULFILLMENT`;
  await input.supabase
    .from("ai_workforce_tasks")
    .upsert(
      {
        task_id: taskId,
        workflow_name: "Neighborhood Digital Targeting",
        requestor: input.businessName,
        assigned_agent: "Orchestrator Agent",
        priority: "high",
        status: "assigned",
        input_data: {
          campaign_id: input.campaignId,
          objective: input.objective,
          targeting_type: input.targetingType,
        },
        expected_output:
          "Fulfillment checklist, campaign drafts, manual launch plan, approval gates, and monthly reporting path.",
        dependencies: ["Digital Targeting intake", "Payment confirmation", "Ad spend confirmation", "Creative approval"],
        approval_required: true,
        related_campaign: input.campaignId,
        related_client: input.businessName,
      },
      { onConflict: "task_id" },
    );

  await input.supabase.from("ai_workforce_activity_logs").insert({
    task_public_id: taskId,
    agent_name: "Orchestrator Agent",
    event_type: "digital_targeting_intake",
    status: "completed",
    summary: "Digital targeting campaign intake captured and routed to manual fulfillment queue.",
    details: {
      campaign_id: input.campaignId,
      business_name: input.businessName,
      human_approval_required: true,
    },
    approval_status: "needs_review",
  });
}

function formDataToInput(form: FormData): IntakeData {
  const parsed = IntakeSchema.safeParse({
    businessName: stringValue(form, "businessName"),
    contactName: stringValue(form, "contactName"),
    email: stringValue(form, "email"),
    phone: stringValue(form, "phone"),
    website: stringValue(form, "website") || undefined,
    industry: stringValue(form, "industry"),
    objectives: stringValues(form, "objectives"),
    targetingTypes: stringValues(form, "targetingTypes"),
    monthlyAdSpendCents: parseDollarInputToCents(stringValue(form, "monthlyAdSpend")),
    preferredStartDate: stringValue(form, "preferredStartDate") || undefined,
    targetLocations: stringValue(form, "targetLocations"),
    radiusPreference: stringValue(form, "radiusPreference") || undefined,
    competitorLocations: stringValue(form, "competitorLocations") || undefined,
    eventLocations: stringValue(form, "eventLocations") || undefined,
    campaignOffer: stringValue(form, "campaignOffer"),
    directMailAddon: boolValue(form, "directMailAddon"),
    landingPageNeeded: boolValue(form, "landingPageNeeded"),
    creativePackageAddon: boolValue(form, "creativePackageAddon"),
    consent: boolValue(form, "consent"),
  });

  if (!parsed.success) {
    throw parsed.error;
  }

  return parsed.data;
}

export async function POST(req: Request) {
  try {
    if (!isGeofenceIntakeEnabled()) {
      return NextResponse.json({ error: "Digital targeting intake is disabled." }, { status: 404 });
    }

    const limited = checkRateLimit(req, {
      key: "digital-targeting-intake",
      limit: 8,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const form = await req.formData();
    let data: IntakeData;
    try {
      data = formDataToInput(form);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json({ error: "Invalid input", details: err.flatten() }, { status: 400 });
      }
      throw err;
    }

    const supabase = createServiceClient();
    const objective = data.objectives.join(",");
    const targetingType = data.targetingTypes.join(",");

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        name: data.contactName,
        business_name: data.businessName,
        phone: data.phone,
        email: data.email,
        source: "web",
        status: "intake_complete",
        notes: `Neighborhood Digital Targeting intake. Objective: ${objective}. Targeting: ${targetingType}.`,
        intake_submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (leadError || !lead) {
      throw new Error(`Lead creation failed: ${leadError?.message ?? "unknown error"}`);
    }

    const { data: campaign, error: campaignError } = await supabase
      .from("digital_targeting_campaigns")
      .insert({
        lead_id: lead.id,
        business_name: data.businessName,
        contact_name: data.contactName,
        email: data.email,
        phone: data.phone,
        website: data.website ?? null,
        industry: data.industry,
        objective,
        targeting_type: targetingType,
        monthly_management_fee: DIGITAL_TARGETING_MANAGEMENT_FEE_CENTS,
        monthly_ad_spend: data.monthlyAdSpendCents,
        setup_fee: 0,
        payment_status: "payment_required",
        campaign_status: "intake_complete",
        start_date: data.preferredStartDate || null,
        direct_mail_addon: data.directMailAddon,
        creative_package_addon: data.creativePackageAddon,
        landing_page_needed: data.landingPageNeeded,
        campaign_metadata: {
          objectives: data.objectives,
          targeting_types: data.targetingTypes,
          radius_preference: data.radiusPreference ?? null,
          campaign_offer: data.campaignOffer,
          consent_acknowledged: true,
          political_guardrail:
            data.objectives.includes("political_awareness") || data.targetingTypes.includes("political_geography")
              ? "Geography-only political awareness. No individual ideology inference or voter persuasion scoring."
              : null,
        },
        notes: data.campaignOffer,
      })
      .select("id")
      .single();

    if (campaignError || !campaign) {
      throw new Error(`Campaign creation failed: ${campaignError?.message ?? "unknown error"}`);
    }

    const radius = parseRadiusMiles(data.radiusPreference);
    const primaryType = primaryLocationType(targetingType);
    const locationRows = [
      ...splitLines(data.targetLocations).map((address) => ({
        campaign_id: campaign.id,
        location_type: primaryType,
        address,
        radius_miles: radius,
        notes: data.radiusPreference ?? null,
      })),
      ...splitLines(data.competitorLocations).map((address) => ({
        campaign_id: campaign.id,
        location_type: "competitor",
        address,
        radius_miles: radius,
        notes: "Competitor area. Use only where platform rules allow.",
      })),
      ...splitLines(data.eventLocations).map((address) => ({
        campaign_id: campaign.id,
        location_type: "event",
        address,
        radius_miles: radius,
        notes: "Event location/date details provided by client.",
      })),
    ];

    await Promise.all([
      locationRows.length > 0
        ? assertSupabaseWrite("Target location creation", supabase.from("digital_target_locations").insert(locationRows))
        : Promise.resolve(null),
      assertSupabaseWrite("Fulfillment task creation", supabase.from("digital_campaign_tasks").insert(buildDigitalTaskRows(campaign.id))),
      assertSupabaseWrite(
        "Campaign draft creation",
        supabase.from("digital_campaign_drafts").insert(
          buildDigitalDraftRows({
            campaignId: campaign.id,
            businessName: data.businessName,
            industry: data.industry,
            objective,
            targetingType,
            monthlyAdSpendCents: data.monthlyAdSpendCents,
            offer: data.campaignOffer,
            directMailAddon: data.directMailAddon,
            landingPageNeeded: data.landingPageNeeded,
          }),
        ),
      ),
    ]);

    const assetRows = (
      await Promise.all([
        ...getFiles(form, "logo").map((file) => uploadAsset({ supabase, campaignId: campaign.id, assetType: "logo", file })),
        ...getFiles(form, "images").map((file) => uploadAsset({ supabase, campaignId: campaign.id, assetType: "image", file })),
        ...getFiles(form, "postcard").map((file) => uploadAsset({ supabase, campaignId: campaign.id, assetType: "postcard", file })),
      ])
    ).filter(Boolean);

    if (assetRows.length > 0) {
      await assertSupabaseWrite("Campaign asset registration", supabase.from("digital_campaign_assets").insert(assetRows));
    }

    await createAiWorkforceAudit({
      supabase,
      campaignId: campaign.id,
      businessName: data.businessName,
      objective,
      targetingType,
    }).catch((err) => console.error("[digital-targeting/intake] workforce audit failed:", err));

    const checkoutToken = signPublicFlowToken({
      scope: "digital_targeting_checkout",
      campaignId: campaign.id,
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://www.home-reach.com";
    const checkoutUrl = `${baseUrl.replace(/\/+$/, "")}/digital-targeting/checkout?token=${encodeURIComponent(checkoutToken)}`;

    await Promise.all([
      notifyAdminDigitalIntake({
        campaignId: campaign.id,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone,
        objective,
        targetingType,
      }),
      sendDigitalIntakeConfirmation({
        campaignId: campaign.id,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        checkoutUrl,
      }),
    ]).catch((err) => console.error("[digital-targeting/intake] notification failed:", err));

    return NextResponse.json({
      success: true,
      checkoutToken,
      campaign: { id: campaign.id, status: "intake_complete" },
    }, { status: 201 });
  } catch (err) {
    console.error("[api/digital-targeting/intake] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
