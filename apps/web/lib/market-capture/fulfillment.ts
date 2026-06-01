import { MARKET_CAPTURE_OBJECTIVE_LABELS, MARKET_CAPTURE_TARGETING_LABELS } from "./campaign";
import { buildCompetitorAreaCampaignLocationRows, getCompetitorAreaMetadata, summarizeCompetitorArea } from "./competitor-area";
import { MARKET_CAPTURE_MANAGEMENT_FEE_CENTS, formatUsd } from "./config";
import { getDigitalDirectMailBundleMetadata, summarizeDigitalDirectMailBundle } from "./digital-direct-mail";
import { buildEventAreaCampaignLocationRows, getEventAreaMetadata, summarizeEventArea } from "./event-area";
import { buildJobsiteHaloCampaignLocationRows, getJobsiteHaloMetadata, summarizeJobsiteHalo } from "./jobsite-halo";
import {
  buildNeighborhoodSaturationCampaignLocationRows,
  getNeighborhoodSaturationMetadata,
  summarizeNeighborhoodSaturation,
} from "./neighborhood-saturation";
import type { createServiceClient } from "@/lib/supabase/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

type SeedItem = {
  title: string;
  owner: "jason" | "josh" | "chelsi" | "heather";
  dueOffsetDays: number;
  priority?: "low" | "normal" | "high";
  notes?: string;
};

export const MARKET_CAPTURE_FULFILLMENT_CHECKLIST: SeedItem[] = [
  { title: "Review intake", owner: "jason", dueOffsetDays: 0 },
  { title: "Validate contact information", owner: "chelsi", dueOffsetDays: 0 },
  { title: "Validate target area", owner: "jason", dueOffsetDays: 1, priority: "high" },
  { title: "Confirm launch timing and cutoff", owner: "jason", dueOffsetDays: 1, priority: "high" },
  { title: "Review compliance and platform policy", owner: "jason", dueOffsetDays: 1, priority: "high" },
  { title: "Confirm campaign goal", owner: "jason", dueOffsetDays: 1 },
  { title: "Confirm budget", owner: "jason", dueOffsetDays: 1 },
  { title: "Collect logo", owner: "chelsi", dueOffsetDays: 2 },
  { title: "Collect images", owner: "chelsi", dueOffsetDays: 2 },
  { title: "Collect offer", owner: "josh", dueOffsetDays: 2 },
  { title: "Review assets", owner: "heather", dueOffsetDays: 3 },
  { title: "Generate ad drafts", owner: "jason", dueOffsetDays: 3 },
  { title: "Generate landing page draft", owner: "heather", dueOffsetDays: 4 },
  { title: "Generate direct mail draft", owner: "heather", dueOffsetDays: 4 },
  { title: "Client review", owner: "chelsi", dueOffsetDays: 5, priority: "high" },
  { title: "Client approval", owner: "chelsi", dueOffsetDays: 6, priority: "high" },
  { title: "Campaign ready", owner: "jason", dueOffsetDays: 7 },
  { title: "Launch complete", owner: "jason", dueOffsetDays: 8 },
  { title: "Reporting scheduled", owner: "chelsi", dueOffsetDays: 9 },
  { title: "Renewal reminder scheduled", owner: "jason", dueOffsetDays: 21 },
];

export const MARKET_CAPTURE_TEAM_TASKS: SeedItem[] = [
  { title: "Campaign setup", owner: "jason", dueOffsetDays: 0, priority: "high" },
  { title: "Asset review", owner: "heather", dueOffsetDays: 2 },
  { title: "Creative review", owner: "heather", dueOffsetDays: 3 },
  { title: "Client follow-up", owner: "chelsi", dueOffsetDays: 4 },
  { title: "Approval follow-up", owner: "chelsi", dueOffsetDays: 6, priority: "high" },
  { title: "Launch preparation", owner: "jason", dueOffsetDays: 7, priority: "high" },
  { title: "Reporting", owner: "chelsi", dueOffsetDays: 30 },
  { title: "Renewal outreach", owner: "josh", dueOffsetDays: 45 },
];

function dueDate(start: Date, offset: number) {
  const date = new Date(start);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

function labelList(value: string | null | undefined, labels: Record<string, string>) {
  return String(value ?? "")
    .split(",")
    .map((item) => labels[item.trim()] ?? item.trim().replace(/_/g, " "))
    .filter(Boolean)
    .join(", ");
}

function defaultLocationType(targetingType: string | null | undefined) {
  const value = String(targetingType ?? "");
  if (value.includes("jobsite_halo")) return "jobsite";
  if (value.includes("competitor_area")) return "competitor";
  if (value.includes("service_area")) return "service_area";
  if (value.includes("event_area")) return "event";
  if (value.includes("political_geography")) return "political_geography";
  if (value.includes("neighborhood_saturation")) return "target_geography";
  return "custom_area";
}

function fulfillmentDraftRows(input: {
  leadId: string;
  businessName: string;
  contactName: string;
  objective: string;
  targeting: string;
  targetArea: string;
  offer: string;
  adBudgetCents: number;
  directMailRequested: boolean;
}) {
  const budget = formatUsd(input.adBudgetCents);
  const directMailLine = input.directMailRequested
    ? "The direct mail add-on should mirror the same target area for repeated exposure."
    : "Direct mail can be proposed if the client wants matching mailbox exposure.";

  const rows = [
    {
      draft_type: "meta_ad",
      label: "Meta Ad Draft",
      content: `${input.businessName} can stay visible around ${input.targetArea}. ${input.offer} Built for ${input.objective.toLowerCase()} with a ${budget}/month client-funded ad budget. Results vary and platform approval is required.`,
    },
    {
      draft_type: "display_ad",
      label: "Display Ad Draft",
      content: `Local homeowners near ${input.targetArea}: ${input.offer}. HomeReach Market Capture keeps ${input.businessName} visible in the areas that matter most.`,
    },
    {
      draft_type: "landing_page_headline",
      label: "Landing Page Headline",
      content: `${input.businessName}: Local help for homeowners in ${input.targetArea}`,
    },
    {
      draft_type: "landing_page_body",
      label: "Landing Page Body",
      content: `HomeReach is preparing a Market Capture campaign for ${input.businessName} focused on ${input.targeting.toLowerCase()}. The campaign offer is: ${input.offer}.`,
    },
    {
      draft_type: "postcard_headline",
      label: "Postcard Headline",
      content: `Now serving your neighborhood`,
    },
    {
      draft_type: "postcard_copy",
      label: "Postcard Copy",
      content: `${input.businessName} is helping homeowners near ${input.targetArea}. ${input.offer} ${directMailLine}`,
    },
    {
      draft_type: "email_follow_up",
      label: "Email Follow-Up",
      content: `Hi ${input.contactName}, your Market Capture campaign is moving through setup. We are reviewing the target area, assets, offer, and approval checklist now.`,
    },
    {
      draft_type: "sms_follow_up",
      label: "SMS Follow-Up",
      content: `Hi ${input.contactName}, HomeReach is setting up the Market Capture campaign for ${input.businessName}. Next step: review assets and approval items. Reply STOP to opt out.`,
    },
    {
      draft_type: "dm_follow_up",
      label: "DM Follow-Up",
      content: `Your Market Capture setup is underway. We are confirming the target area, assets, offer, and launch readiness before anything goes live.`,
    },
    {
      draft_type: "launch_email",
      label: "Launch Email",
      content: `Subject: Your Market Capture campaign is live\n\nHi ${input.contactName},\n\nYour Market Capture campaign for ${input.businessName} is now live. HomeReach will monitor the campaign and prepare the first report when metrics are available.\n\nResults vary, and ad platform availability can change, but the campaign is now set up for repeated local visibility.`,
    },
    {
      draft_type: "monthly_report_summary",
      label: "Monthly Report Summary",
      content: `This month, the Market Capture campaign focused on ${input.targetArea}. Recommended next action: review spend, clicks, leads/calls where available, and decide whether to expand the target area or add direct mail saturation.`,
    },
    {
      draft_type: "renewal_recommendation",
      label: "Renewal Recommendation",
      content: `Renew Market Capture for another month if the client wants continued visibility in ${input.targetArea}. Consider a direct mail add-on if the target area is stable and the offer is approved.`,
    },
  ];

  return rows.map((row) => ({
    market_capture_lead_id: input.leadId,
    draft_type: row.draft_type,
    label: row.label,
    content: row.content,
    created_by: "fulfillment_draft_generator",
  }));
}

async function assertOk(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await result;
  if (error) throw new Error(`${label} failed: ${error.message}`);
}

export async function ensureMarketCaptureFulfillment(input: {
  supabase: ServiceClient;
  leadId: string;
  createdBy?: string;
}) {
  const supabase = input.supabase as any;
  const now = new Date().toISOString();
  const start = new Date();

  const [{ data: lead, error: leadError }, { data: pipeline }] = await Promise.all([
    supabase.from("market_capture_leads").select("*").eq("id", input.leadId).single(),
    supabase.from("market_capture_pipeline").select("*").eq("market_capture_lead_id", input.leadId).limit(1).maybeSingle(),
  ]);

  if (leadError || !lead) {
    throw new Error(`Market Capture lead lookup failed: ${leadError?.message ?? input.leadId}`);
  }

  const { data: existingCampaign } = await supabase
    .from("market_capture_campaigns")
    .select("*")
    .eq("market_capture_lead_id", input.leadId)
    .maybeSingle();

  const bundle = getDigitalDirectMailBundleMetadata(lead.metadata);
  const competitorArea = getCompetitorAreaMetadata(lead.metadata);
  const eventArea = getEventAreaMetadata(lead.metadata);
  const directMailRequested = Boolean(lead.postcard_addon || bundle?.enabled);
  const directMailStatus = directMailRequested ? "requested" : "not_requested";
  const recommendedNextAction =
    eventArea?.enabled && eventArea.nextAction !== "No Event Area Campaign requested."
      ? eventArea.nextAction
      : competitorArea?.enabled && competitorArea.nextAction !== "No Competitor Area Campaign requested."
      ? competitorArea.nextAction
      : bundle?.enabled
        ? bundle.nextAction
        : "Validate target area and collect missing assets";

  let campaign = existingCampaign;
  if (!campaign) {
    const { data: inserted, error: insertError } = await supabase
      .from("market_capture_campaigns")
      .insert({
        market_capture_lead_id: lead.id,
        pipeline_id: pipeline?.id ?? null,
        client_id: lead.client_id ?? null,
        campaign_name: `${lead.business_name} Market Capture`,
        campaign_status: "campaign_setup",
        launch_status: "not_started",
        direct_mail_status: directMailStatus,
        direct_mail_requested: directMailRequested,
        creative_status: "missing",
        approval_status: "awaiting_approval",
        reporting_status: "not_started",
        target_geography: lead.target_area,
        monthly_ad_budget: Number(lead.monthly_ad_budget ?? 0),
        monthly_management_fee: Number(lead.monthly_management_fee ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS),
        payment_status: lead.payment_status ?? "payment_required",
        owner: lead.owner ?? "jason",
        reviewer: "jason",
        designer: "heather",
        account_manager: "chelsi",
        next_best_action: recommendedNextAction,
        notes: lead.notes ?? null,
        metadata: {
          phase: "1B_fulfillment_engine",
          targeting_objective: lead.targeting_objective,
          targeting_type: lead.targeting_type,
          competitor_area: competitorArea,
          event_area: eventArea,
          digital_direct_mail_bundle: bundle,
          initialized_by: input.createdBy ?? "system",
        },
      })
      .select("*")
      .single();

    if (insertError || !inserted) {
      throw new Error(`Market Capture fulfillment campaign creation failed: ${insertError?.message ?? "No row returned"}`);
    }
    campaign = inserted;
  } else {
    const { data: updated, error: updateError } = await supabase
      .from("market_capture_campaigns")
      .update({
        payment_status: lead.payment_status ?? existingCampaign.payment_status,
        monthly_ad_budget: Number(lead.monthly_ad_budget ?? existingCampaign.monthly_ad_budget ?? 0),
        monthly_management_fee: Number(lead.monthly_management_fee ?? existingCampaign.monthly_management_fee ?? MARKET_CAPTURE_MANAGEMENT_FEE_CENTS),
        direct_mail_requested: Boolean(directMailRequested || existingCampaign.direct_mail_requested),
        direct_mail_status: directMailRequested && existingCampaign.direct_mail_status === "not_requested" ? "requested" : existingCampaign.direct_mail_status,
        updated_at: now,
      })
      .eq("id", existingCampaign.id)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error(`Market Capture campaign refresh failed: ${updateError?.message ?? existingCampaign.id}`);
    campaign = updated;
  }

  const [{ count: locationCount }, { count: checklistCount }, { count: fulfillmentTaskCount }, { count: approvalCount }, { count: draftCount }] =
    await Promise.all([
      supabase.from("market_capture_campaign_locations").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
      supabase.from("market_capture_checklists").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
      supabase.from("market_capture_tasks").select("id", { count: "exact", head: true }).eq("market_capture_lead_id", lead.id).eq("task_type", "fulfillment"),
      supabase.from("market_capture_approvals").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id),
      supabase.from("market_capture_drafts").select("id", { count: "exact", head: true }).eq("market_capture_lead_id", lead.id).eq("created_by", "fulfillment_draft_generator"),
    ]);

  const objective = labelList(lead.targeting_objective, MARKET_CAPTURE_OBJECTIVE_LABELS) || "local visibility";
  const targeting = labelList(lead.targeting_type, MARKET_CAPTURE_TARGETING_LABELS) || "target geography";
  const offer = String(lead.campaign_offer ?? "").trim() || "a clear local offer";
  const jobsiteHalo = getJobsiteHaloMetadata(lead.metadata);
  const jobsiteLocationRows = buildJobsiteHaloCampaignLocationRows({
    campaignId: campaign.id,
    metadata: lead.metadata,
    fallbackTargetArea: lead.target_area,
  });
  const neighborhoodSaturation = getNeighborhoodSaturationMetadata(lead.metadata);
  const neighborhoodLocationRows = buildNeighborhoodSaturationCampaignLocationRows({
    campaignId: campaign.id,
    metadata: lead.metadata,
    fallbackTargetArea: lead.target_area,
  });
  const competitorLocationRows = buildCompetitorAreaCampaignLocationRows({
    campaignId: campaign.id,
    metadata: lead.metadata,
    fallbackTargetArea: lead.target_area,
  });
  const eventLocationRows = buildEventAreaCampaignLocationRows({
    campaignId: campaign.id,
    metadata: lead.metadata,
    fallbackTargetArea: lead.target_area,
  });

  if ((locationCount ?? 0) === 0) {
    const structuredLocationRows = [...jobsiteLocationRows, ...neighborhoodLocationRows, ...competitorLocationRows, ...eventLocationRows];
    const locationRows =
      structuredLocationRows.length > 0
        ? structuredLocationRows
        : [
            {
              campaign_id: campaign.id,
              location_type: defaultLocationType(lead.targeting_type),
              name: targeting,
              address: null,
              radius_miles: null,
              notes: lead.target_area,
            },
          ];

    await assertOk("Market Capture default location creation", supabase.from("market_capture_campaign_locations").insert(locationRows));
  }

  if ((checklistCount ?? 0) === 0) {
    await assertOk(
      "Market Capture checklist creation",
      supabase.from("market_capture_checklists").insert(
        MARKET_CAPTURE_FULFILLMENT_CHECKLIST.map((item, index) => ({
          campaign_id: campaign.id,
          title: item.title,
          owner: item.owner,
          status: "open",
          due_date: dueDate(start, item.dueOffsetDays),
          notes: item.notes ?? null,
          item_order: index + 1,
        })),
      ),
    );
  }

  if ((fulfillmentTaskCount ?? 0) === 0) {
    await assertOk(
      "Market Capture fulfillment task creation",
      supabase.from("market_capture_tasks").insert(
        MARKET_CAPTURE_TEAM_TASKS.map((item, index) => ({
          market_capture_lead_id: lead.id,
          pipeline_id: pipeline?.id ?? null,
          title: item.title,
          owner: item.owner,
          status: "open",
          due_date: dueDate(start, item.dueOffsetDays),
          notes: item.notes ?? null,
          task_order: 100 + index,
          task_type: "fulfillment",
          priority: item.priority ?? "normal",
          assigned_role: item.title.toLowerCase(),
        })),
      ),
    );
  }

  if ((approvalCount ?? 0) === 0) {
    await assertOk(
      "Market Capture approval creation",
      supabase.from("market_capture_approvals").insert({
        campaign_id: campaign.id,
        approval_type: "creative",
        status: "awaiting_approval",
        client_name: lead.contact_name,
        client_email: lead.email,
        content_summary: `Creative approval for ${lead.business_name} Market Capture.`,
      }),
    );
  }

  if ((draftCount ?? 0) === 0) {
    await assertOk(
      "Market Capture fulfillment draft creation",
      supabase.from("market_capture_drafts").insert(
        fulfillmentDraftRows({
          leadId: lead.id,
          businessName: lead.business_name,
          contactName: lead.contact_name,
          objective,
          targeting,
          targetArea: lead.target_area,
          offer,
          adBudgetCents: Number(lead.monthly_ad_budget ?? 0),
          directMailRequested,
        }),
      ),
    );
  }

  await Promise.all([
    supabase
      .from("market_capture_pipeline")
      .update({
        stage: "campaign_setup",
        status: "won",
        next_action: recommendedNextAction,
        last_activity_at: now,
        updated_at: now,
      })
      .eq("market_capture_lead_id", lead.id),
    supabase.from("market_capture_notes").insert({
      market_capture_lead_id: lead.id,
      author: input.createdBy ?? "system",
      note_type: "fulfillment",
      content: `Market Capture fulfillment campaign initialized. ${summarizeJobsiteHalo(jobsiteHalo)} ${summarizeNeighborhoodSaturation(neighborhoodSaturation)} ${summarizeCompetitorArea(competitorArea)} ${summarizeEventArea(eventArea)} ${summarizeDigitalDirectMailBundle(bundle)}`,
      metadata: {
        campaign_id: campaign.id,
        jobsite_halo: jobsiteHalo,
        neighborhood_saturation: neighborhoodSaturation,
        competitor_area: competitorArea,
        event_area: eventArea,
        digital_direct_mail_bundle: bundle,
      },
    }),
  ]);

  await recomputeMarketCaptureReadiness({ supabase: input.supabase, campaignId: campaign.id });
  return campaign;
}

export async function recomputeMarketCaptureReadiness(input: {
  supabase: ServiceClient;
  campaignId: string;
}) {
  const supabase = input.supabase as any;
  const { data: campaign } = await supabase
    .from("market_capture_campaigns")
    .select("*")
    .eq("id", input.campaignId)
    .single();

  if (!campaign) throw new Error(`Market Capture campaign not found: ${input.campaignId}`);

  const [{ data: checklists }, { data: assets }, { data: approvals }] = await Promise.all([
    supabase.from("market_capture_checklists").select("status").eq("campaign_id", input.campaignId),
    supabase.from("market_capture_assets").select("status, approval_status").eq("market_capture_lead_id", campaign.market_capture_lead_id),
    supabase.from("market_capture_approvals").select("status").eq("campaign_id", input.campaignId),
  ]);

  const checklistRows = checklists ?? [];
  const assetRows = assets ?? [];
  const approvalRows = approvals ?? [];
  const checklistComplete = checklistRows.length > 0 && checklistRows.every((item: any) => item.status === "completed");
  const assetApproved = assetRows.some((item: any) => item.approval_status === "approved" || item.status === "approved");
  const approvalReady = campaign.approval_status === "approved" || approvalRows.some((item: any) => item.status === "approved");

  const factors = [
    { key: "payment", ready: campaign.payment_status === "paid", missing: "Confirm payment" },
    { key: "target", ready: Boolean(String(campaign.target_geography ?? "").trim()), missing: "Validate target area" },
    { key: "assets", ready: assetApproved || ["approved", "uploaded"].includes(String(campaign.creative_status)), missing: "Collect and approve creative assets" },
    { key: "creative", ready: campaign.creative_status === "approved", missing: "Approve creative" },
    { key: "approval", ready: approvalReady, missing: "Get client approval" },
    { key: "tracking", ready: Boolean(campaign.tracking_url || campaign.landing_page_url || ["ready", "live", "manual_launch_complete"].includes(String(campaign.launch_status))), missing: "Add landing or tracking URL" },
    { key: "checklist", ready: checklistComplete, missing: "Complete fulfillment checklist" },
  ];
  const [paymentFactor, targetFactor, assetsFactor, creativeFactor, approvalFactor, trackingFactor, checklistFactor] = factors;

  const readyCount = factors.filter((factor) => factor.ready).length;
  const missingItems = factors.filter((factor) => !factor.ready).map((factor) => factor.missing);
  const readinessScore = Math.round((readyCount / factors.length) * 100);
  const recommendedNextAction = missingItems[0] ?? "Campaign ready for launch";
  const now = new Date().toISOString();

  const { data: existing } = await supabase
    .from("market_capture_launch_readiness")
    .select("id")
    .eq("campaign_id", input.campaignId)
    .maybeSingle();

  const payload = {
    campaign_id: input.campaignId,
    readiness_score: readinessScore,
    payment_ready: paymentFactor?.ready ?? false,
    target_area_ready: targetFactor?.ready ?? false,
    assets_ready: assetsFactor?.ready ?? false,
    creative_ready: creativeFactor?.ready ?? false,
    approval_ready: approvalFactor?.ready ?? false,
    tracking_ready: trackingFactor?.ready ?? false,
    checklist_ready: checklistFactor?.ready ?? false,
    missing_items: missingItems,
    recommended_next_action: recommendedNextAction,
    calculated_at: now,
    updated_at: now,
  };

  if (existing?.id) {
    await assertOk(
      "Market Capture readiness update",
      supabase.from("market_capture_launch_readiness").update(payload).eq("id", existing.id),
    );
  } else {
    await assertOk("Market Capture readiness creation", supabase.from("market_capture_launch_readiness").insert(payload));
  }

  await assertOk(
    "Market Capture campaign next action update",
    supabase
      .from("market_capture_campaigns")
      .update({
        next_best_action: recommendedNextAction,
        launch_status: readinessScore === 100 && campaign.launch_status === "not_started" ? "ready" : campaign.launch_status,
        updated_at: now,
      })
      .eq("id", input.campaignId),
  );

  return { readinessScore, missingItems, recommendedNextAction };
}
