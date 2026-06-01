import { NextResponse } from "next/server";
import { z } from "zod";
import { buildMarketCaptureDraftRows, buildMarketCaptureTaskRows } from "@/lib/market-capture/campaign";
import { buildCompetitorAreaMetadata, summarizeCompetitorArea } from "@/lib/market-capture/competitor-area";
import {
  getMarketCapturePricingTier,
  isMarketCaptureDraftsEnabled,
  isMarketCaptureIntakeEnabled,
  parseDollarInputToCents,
} from "@/lib/market-capture/config";
import { buildDigitalDirectMailBundleMetadata, summarizeDigitalDirectMailBundle } from "@/lib/market-capture/digital-direct-mail";
import { buildEventAreaMetadata, summarizeEventArea } from "@/lib/market-capture/event-area";
import { buildJobsiteHaloMetadata, summarizeJobsiteHalo } from "@/lib/market-capture/jobsite-halo";
import { buildNeighborhoodSaturationMetadata, summarizeNeighborhoodSaturation } from "@/lib/market-capture/neighborhood-saturation";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { signPublicFlowToken } from "@/lib/security/signed-token";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const ASSET_BUCKET = "market-capture-assets";

const IntakeSchema = z.object({
  businessName: z.string().trim().min(1).max(180),
  contactName: z.string().trim().min(1).max(140),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(60),
  website: z.string().trim().max(240).optional(),
  industry: z.string().trim().min(1).max(120),
  requestedPlan: z.string().trim().max(40).default("starter"),
  monthlyAdBudgetCents: z.number().int().min(0),
  objectives: z.array(z.string().trim().min(1)).min(1),
  targetingTypes: z.array(z.string().trim().min(1)).min(1),
  targetArea: z.string().trim().min(1).max(4000),
  jobsiteAddresses: z.string().trim().max(5000).optional(),
  jobsiteRadiusPreference: z.string().trim().max(40).optional(),
  jobsiteProofNotes: z.string().trim().max(2000).optional(),
  neighborhoodAreas: z.string().trim().max(5000).optional(),
  neighborhoodZipCodes: z.string().trim().max(1000).optional(),
  neighborhoodRouteClusters: z.string().trim().max(5000).optional(),
  neighborhoodSaturationGoal: z.string().trim().max(1200).optional(),
  neighborhoodDirectMailQuantity: z.string().trim().max(40).optional(),
  neighborhoodNotes: z.string().trim().max(2000).optional(),
  competitorLocations: z.string().trim().max(5000).optional(),
  competitorRadiusPreference: z.string().trim().max(40).optional(),
  competitorCampaignGoal: z.string().trim().max(1200).optional(),
  competitorComplianceAcknowledged: z.boolean(),
  eventLocations: z.string().trim().max(5000).optional(),
  eventRadiusPreference: z.string().trim().max(40).optional(),
  eventStartDate: z.string().trim().max(40).optional(),
  eventEndDate: z.string().trim().max(40).optional(),
  eventPromotionWindow: z.string().trim().max(160).optional(),
  eventCampaignGoal: z.string().trim().max(1200).optional(),
  eventSourceConfirmed: z.boolean(),
  eventComplianceAcknowledged: z.boolean(),
  preferredStartDate: z.string().trim().max(40).optional(),
  campaignOffer: z.string().trim().max(2000).optional(),
  directMailPath: z.string().trim().max(80).optional(),
  directMailQuantity: z.string().trim().max(40).optional(),
  directMailFormat: z.string().trim().max(120).optional(),
  directMailDropWindow: z.string().trim().max(120).optional(),
  directMailTrackingDestination: z.string().trim().max(240).optional(),
  directMailProofContact: z.string().trim().max(160).optional(),
  sameAreaForMail: z.boolean(),
  directMailBundleNotes: z.string().trim().max(2000).optional(),
  postcardAddon: z.boolean(),
  landingPageNeeded: z.boolean(),
  creativePackageNeeded: z.boolean(),
  consent: z.literal(true),
  compliance: z.literal(true),
});

type IntakeData = z.infer<typeof IntakeSchema>;

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

function getFiles(form: FormData, key: string) {
  return form
    .getAll(key)
    .filter((value): value is File => value instanceof File && value.size > 0);
}

function sanitizeFileName(value: string) {
  return value
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 140);
}

async function assertWrite<T>(
  label: string,
  operation: PromiseLike<{ data: T | null; error: { message: string } | null }>,
) {
  const { data, error } = await operation;
  if (error) throw new Error(`${label} failed: ${error.message}`);
  return data as T;
}

function formDataToInput(form: FormData): IntakeData {
  const parsed = IntakeSchema.safeParse({
    businessName: stringValue(form, "businessName"),
    contactName: stringValue(form, "contactName"),
    email: stringValue(form, "email"),
    phone: stringValue(form, "phone"),
    website: stringValue(form, "website") || undefined,
    industry: stringValue(form, "industry"),
    requestedPlan: stringValue(form, "requestedPlan") || "starter",
    monthlyAdBudgetCents: parseDollarInputToCents(stringValue(form, "monthlyAdBudget")),
    objectives: stringValues(form, "objectives"),
    targetingTypes: stringValues(form, "targetingTypes"),
    targetArea: stringValue(form, "targetArea"),
    jobsiteAddresses: stringValue(form, "jobsiteAddresses") || undefined,
    jobsiteRadiusPreference: stringValue(form, "jobsiteRadiusPreference") || undefined,
    jobsiteProofNotes: stringValue(form, "jobsiteProofNotes") || undefined,
    neighborhoodAreas: stringValue(form, "neighborhoodAreas") || undefined,
    neighborhoodZipCodes: stringValue(form, "neighborhoodZipCodes") || undefined,
    neighborhoodRouteClusters: stringValue(form, "neighborhoodRouteClusters") || undefined,
    neighborhoodSaturationGoal: stringValue(form, "neighborhoodSaturationGoal") || undefined,
    neighborhoodDirectMailQuantity: stringValue(form, "neighborhoodDirectMailQuantity") || undefined,
    neighborhoodNotes: stringValue(form, "neighborhoodNotes") || undefined,
    competitorLocations: stringValue(form, "competitorLocations") || undefined,
    competitorRadiusPreference: stringValue(form, "competitorRadiusPreference") || undefined,
    competitorCampaignGoal: stringValue(form, "competitorCampaignGoal") || undefined,
    competitorComplianceAcknowledged: boolValue(form, "competitorComplianceAcknowledged"),
    eventLocations: stringValue(form, "eventLocations") || undefined,
    eventRadiusPreference: stringValue(form, "eventRadiusPreference") || undefined,
    eventStartDate: stringValue(form, "eventStartDate") || undefined,
    eventEndDate: stringValue(form, "eventEndDate") || undefined,
    eventPromotionWindow: stringValue(form, "eventPromotionWindow") || undefined,
    eventCampaignGoal: stringValue(form, "eventCampaignGoal") || undefined,
    eventSourceConfirmed: boolValue(form, "eventSourceConfirmed"),
    eventComplianceAcknowledged: boolValue(form, "eventComplianceAcknowledged"),
    preferredStartDate: stringValue(form, "preferredStartDate") || undefined,
    campaignOffer: stringValue(form, "campaignOffer") || undefined,
    directMailPath: stringValue(form, "directMailPath") || undefined,
    directMailQuantity: stringValue(form, "directMailQuantity") || undefined,
    directMailFormat: stringValue(form, "directMailFormat") || undefined,
    directMailDropWindow: stringValue(form, "directMailDropWindow") || undefined,
    directMailTrackingDestination: stringValue(form, "directMailTrackingDestination") || undefined,
    directMailProofContact: stringValue(form, "directMailProofContact") || undefined,
    sameAreaForMail: boolValue(form, "sameAreaForMail"),
    directMailBundleNotes: stringValue(form, "directMailBundleNotes") || undefined,
    postcardAddon: boolValue(form, "postcardAddon"),
    landingPageNeeded: boolValue(form, "landingPageNeeded"),
    creativePackageNeeded: boolValue(form, "creativePackageNeeded"),
    consent: boolValue(form, "consent"),
    compliance: boolValue(form, "compliance"),
  });

  if (!parsed.success) throw parsed.error;
  return parsed.data;
}

async function uploadAsset(input: {
  supabase: ReturnType<typeof createServiceClient>;
  marketCaptureLeadId: string;
  assetType: "logo" | "image" | "postcard";
  file: File;
}) {
  const { supabase, marketCaptureLeadId, assetType, file } = input;
  const base = {
    market_capture_lead_id: marketCaptureLeadId,
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

  const path = `${marketCaptureLeadId}/${Date.now()}-${assetType}-${sanitizeFileName(file.name)}`;
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

export async function POST(req: Request) {
  try {
    if (!isMarketCaptureIntakeEnabled()) {
      return NextResponse.json({ error: "Market Capture intake is disabled." }, { status: 404 });
    }

    const limited = checkRateLimit(req, {
      key: "market-capture-intake",
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
    const requestedTier = getMarketCapturePricingTier(data.requestedPlan);
    const managementFeeCents = requestedTier.managementFeeCents;
    const jobsiteHalo = buildJobsiteHaloMetadata({
      industry: data.industry,
      rawAddresses: data.jobsiteAddresses,
      radiusPreference: data.jobsiteRadiusPreference,
      proofNotes: data.jobsiteProofNotes,
    });
    const neighborhoodSaturation = buildNeighborhoodSaturationMetadata({
      industry: data.industry,
      monthlyAdBudgetCents: data.monthlyAdBudgetCents,
      postcardAddon: data.postcardAddon,
      campaignOffer: data.campaignOffer,
      rawAreas: data.neighborhoodAreas,
      zipCodes: data.neighborhoodZipCodes,
      routeClusters: data.neighborhoodRouteClusters,
      saturationGoal: data.neighborhoodSaturationGoal,
      directMailQuantity: data.neighborhoodDirectMailQuantity,
      planningNotes: data.neighborhoodNotes,
    });
    const competitorArea = buildCompetitorAreaMetadata({
      targetingTypes: data.targetingTypes,
      objectives: data.objectives,
      industry: data.industry,
      targetArea: data.targetArea,
      rawLocations: data.competitorLocations,
      radiusPreference: data.competitorRadiusPreference,
      campaignGoal: data.competitorCampaignGoal,
      complianceAcknowledged: data.competitorComplianceAcknowledged,
    });
    const eventArea = buildEventAreaMetadata({
      targetingTypes: data.targetingTypes,
      objectives: data.objectives,
      industry: data.industry,
      targetArea: data.targetArea,
      rawEvents: data.eventLocations,
      radiusPreference: data.eventRadiusPreference,
      eventStartDate: data.eventStartDate,
      eventEndDate: data.eventEndDate,
      promotionWindow: data.eventPromotionWindow,
      campaignGoal: data.eventCampaignGoal,
      sourceConfirmed: data.eventSourceConfirmed,
      complianceAcknowledged: data.eventComplianceAcknowledged,
    });
    const digitalDirectMailBundle = buildDigitalDirectMailBundleMetadata({
      postcardAddon: data.postcardAddon,
      targetingTypes: data.targetingTypes,
      targetArea: data.targetArea,
      campaignOffer: data.campaignOffer,
      directMailPath: data.directMailPath,
      directMailQuantity: data.directMailQuantity,
      directMailFormat: data.directMailFormat,
      directMailDropWindow: data.directMailDropWindow,
      directMailTrackingDestination: data.directMailTrackingDestination,
      directMailProofContact: data.directMailProofContact,
      sameAreaForMail: data.sameAreaForMail,
      directMailBundleNotes: data.directMailBundleNotes,
    });
    const now = new Date().toISOString();

    const lead = await assertWrite<{ id: string }>(
      "Lead creation",
      supabase
        .from("leads")
        .insert({
          name: data.contactName,
          business_name: data.businessName,
          phone: data.phone,
          email: data.email,
          source: "web",
          status: "intake_complete",
          notes: `Market Capture intake. Objective: ${objective}. Targeting: ${targetingType}. ${summarizeJobsiteHalo(jobsiteHalo)} ${summarizeNeighborhoodSaturation(neighborhoodSaturation)} ${summarizeCompetitorArea(competitorArea)} ${summarizeEventArea(eventArea)} ${summarizeDigitalDirectMailBundle(digitalDirectMailBundle)}`,
          intake_submitted_at: now,
        })
        .select("id")
        .single(),
    );

    const marketLead = await assertWrite<{ id: string }>(
      "Market Capture lead creation",
      supabase
        .from("market_capture_leads")
        .insert({
          lead_id: lead.id,
          business_name: data.businessName,
          contact_name: data.contactName,
          email: data.email,
          phone: data.phone,
          website: data.website ?? null,
          industry: data.industry,
          monthly_ad_budget: data.monthlyAdBudgetCents,
          targeting_objective: objective,
          targeting_type: targetingType,
          target_area: data.targetArea,
          preferred_start_date: data.preferredStartDate || null,
          campaign_offer: data.campaignOffer ?? null,
          postcard_addon: data.postcardAddon,
          landing_page_needed: data.landingPageNeeded,
          creative_package_needed: data.creativePackageNeeded,
          consent_acknowledged: true,
          compliance_acknowledged: true,
          monthly_management_fee: managementFeeCents,
          payment_status: "payment_required",
          owner: "jason",
          status: "active",
          notes: data.campaignOffer ?? null,
          metadata: {
            objectives: data.objectives,
            targeting_types: data.targetingTypes,
            requested_plan: requestedTier.id,
            requested_plan_name: requestedTier.name,
            recommended_ad_spend_cents: requestedTier.recommendedAdSpendCents,
            jobsite_halo: jobsiteHalo,
            neighborhood_saturation: neighborhoodSaturation,
            competitor_area: competitorArea,
            event_area: eventArea,
            digital_direct_mail_bundle: digitalDirectMailBundle,
            phase: "1A_sales_engine",
            political_guardrail:
              data.objectives.includes("political_awareness") || data.targetingTypes.includes("political_geography")
                ? "Geography-only awareness. No individual ideology inference or voter persuasion scoring."
                : null,
          },
        })
        .select("id")
        .single(),
    );

    const pipeline = await assertWrite<{ id: string }>(
      "Market Capture pipeline creation",
      supabase
        .from("market_capture_pipeline")
        .insert({
          market_capture_lead_id: marketLead.id,
          stage: "intake_complete",
          owner: "jason",
          status: "open",
          estimated_mrr_cents: managementFeeCents,
          pipeline_value_cents: managementFeeCents,
          next_action: "Review intake",
          notes: "New Market Capture intake submitted.",
          last_activity_at: now,
        })
        .select("id")
        .single(),
    );
    const marketCaptureTaskRows = buildMarketCaptureTaskRows({
      leadId: marketLead.id,
      pipelineId: pipeline.id,
    });
    if (competitorArea.enabled) {
      const due = new Date();
      due.setDate(due.getDate() + 1);
      marketCaptureTaskRows.push({
        market_capture_lead_id: marketLead.id,
        pipeline_id: pipeline.id,
        title: "Review competitor-area compliance",
        owner: "jason",
        status: "open",
        due_date: due.toISOString(),
        notes: "Confirm all language is geography-based visibility. Remove spying, surveillance, or individual-level targeting claims before approval.",
        task_order: marketCaptureTaskRows.length + 1,
      });
    }
    if (eventArea.enabled) {
      const due = new Date();
      due.setDate(due.getDate() + (eventArea.deadlineStatus === "too_close" || eventArea.deadlineStatus === "rush_review" ? 0 : 1));
      marketCaptureTaskRows.push({
        market_capture_lead_id: marketLead.id,
        pipeline_id: pipeline.id,
        title: "Review event timing and launch cutoff",
        owner: "jason",
        status: "open",
        due_date: due.toISOString(),
        notes: "Confirm event source, launch cutoff, promotion window, and whether rush review is required before accepting launch.",
        task_order: marketCaptureTaskRows.length + 1,
      });
    }

    await Promise.all([
      assertWrite(
        "Market Capture task creation",
        supabase.from("market_capture_tasks").insert(marketCaptureTaskRows),
      ),
      isMarketCaptureDraftsEnabled()
        ? assertWrite(
            "Market Capture draft creation",
            supabase.from("market_capture_drafts").insert(
              buildMarketCaptureDraftRows({
                leadId: marketLead.id,
                businessName: data.businessName,
                contactName: data.contactName,
                industry: data.industry,
                objective,
                targetingType,
                monthlyAdBudgetCents: data.monthlyAdBudgetCents,
                monthlyManagementFeeCents: managementFeeCents,
                targetArea: data.targetArea,
                campaignOffer: data.campaignOffer,
                postcardAddon: data.postcardAddon,
                landingPageNeeded: data.landingPageNeeded,
              }),
            ),
          )
        : Promise.resolve(null),
      assertWrite(
        "Market Capture activity creation",
        supabase.from("market_capture_notes").insert({
          market_capture_lead_id: marketLead.id,
          author: "system",
          note_type: "activity",
          content: "Market Capture intake submitted and sales pipeline created.",
          metadata: {
            lead_id: lead.id,
            pipeline_id: pipeline.id,
            jobsite_halo: jobsiteHalo,
            neighborhood_saturation: neighborhoodSaturation,
            competitor_area: competitorArea,
            event_area: eventArea,
            digital_direct_mail_bundle: digitalDirectMailBundle,
          },
        }),
      ),
    ]);

    const assetRows = (
      await Promise.all([
        ...getFiles(form, "logo").map((file) =>
          uploadAsset({ supabase, marketCaptureLeadId: marketLead.id, assetType: "logo", file }),
        ),
        ...getFiles(form, "images").map((file) =>
          uploadAsset({ supabase, marketCaptureLeadId: marketLead.id, assetType: "image", file }),
        ),
        ...getFiles(form, "jobsitePhotos").map((file) =>
          uploadAsset({ supabase, marketCaptureLeadId: marketLead.id, assetType: "image", file }),
        ),
        ...getFiles(form, "postcard").map((file) =>
          uploadAsset({ supabase, marketCaptureLeadId: marketLead.id, assetType: "postcard", file }),
        ),
      ])
    ).filter(Boolean);

    if (assetRows.length > 0) {
      await assertWrite("Market Capture asset registration", supabase.from("market_capture_assets").insert(assetRows));
    }

    const checkoutToken = signPublicFlowToken({
      scope: "market_capture_checkout",
      marketCaptureLeadId: marketLead.id,
    });

    return NextResponse.json(
      {
        success: true,
        checkoutToken,
        lead: { id: marketLead.id, stage: "intake_complete" },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("[api/market-capture/intake] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
