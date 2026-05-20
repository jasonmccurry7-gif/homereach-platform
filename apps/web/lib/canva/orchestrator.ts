import type { AdExportSchema } from "@/lib/ad-engine/types";
import {
  getCanvaConfigStatus,
  getCanvaTemplateByKey,
  getCanvaTemplateId,
  HOMEREACH_CANVA_BRAND_SYSTEM,
  HOMEREACH_CANVA_FOLDERS,
  HOMEREACH_CANVA_TEMPLATES,
  type CanvaExportType,
} from "./config";
import { CanvaConnectClient, type CanvaAutofillFieldValue } from "./client";

export type HomeReachCanvaDesignContext =
  | "political_presentation"
  | "political_postcard"
  | "shared_postcard"
  | "targeted_campaign"
  | "sales_proposal"
  | "dashboard_asset"
  | "social_graphic"
  | "map_report";

export type HomeReachCanvaJobInput = {
  context: HomeReachCanvaDesignContext;
  templateKey: string;
  title: string;
  fields: Record<string, CanvaAutofillFieldValue>;
  exportTypes?: CanvaExportType[];
  source?: {
    system: string;
    recordId?: string;
    route?: string;
  };
};

export type HomeReachCanvaJobPlan = {
  mode: "dry_run" | "live";
  title: string;
  templateKey: string;
  templateId: string | null;
  context: HomeReachCanvaDesignContext;
  requiredFields: string[];
  missingFields: string[];
  exportTypes: CanvaExportType[];
  folderPath: string;
  brandSystem: typeof HOMEREACH_CANVA_BRAND_SYSTEM;
  canvaPayload: {
    brand_template_id: string | null;
    data: Record<string, CanvaAutofillFieldValue>;
    title: string;
  };
  nextActions: string[];
};

export function createCanvaJobPlan(input: HomeReachCanvaJobInput): HomeReachCanvaJobPlan {
  const template = getCanvaTemplateByKey(input.templateKey);
  if (!template) {
    throw new Error(`Unknown Canva template key: ${input.templateKey}`);
  }

  const config = getCanvaConfigStatus();
  const templateId = getCanvaTemplateId(template);
  const missingFields = template.requiredFields.filter((field) => isBlank(input.fields[field]));
  const exportTypes = input.exportTypes?.length ? input.exportTypes : template.recommendedExportTypes;

  return {
    mode: config.mode === "live_token_ready" && templateId ? "live" : "dry_run",
    title: input.title,
    templateKey: input.templateKey,
    templateId,
    context: input.context,
    requiredFields: template.requiredFields,
    missingFields,
    exportTypes,
    folderPath: resolveFolderPath(input.context),
    brandSystem: HOMEREACH_CANVA_BRAND_SYSTEM,
    canvaPayload: {
      brand_template_id: templateId,
      title: input.title,
      data: input.fields,
    },
    nextActions: buildNextActions(config.mode, templateId, missingFields),
  };
}

export async function runCanvaAutofill(input: HomeReachCanvaJobInput) {
  const plan = createCanvaJobPlan(input);
  if (plan.mode !== "live" || !plan.templateId) {
    return { ok: true, dryRun: true, plan };
  }
  if (plan.missingFields.length) {
    return {
      ok: false,
      dryRun: false,
      error: "Missing required Canva template fields",
      missingFields: plan.missingFields,
      plan,
    };
  }

  const client = new CanvaConnectClient();
  const job = await client.createAutofillJob({
    brand_template_id: plan.templateId,
    title: input.title,
    data: input.fields,
  });

  return { ok: true, dryRun: false, plan, job };
}

export function convertAdExportToCanvaFields(ad: AdExportSchema): Record<string, CanvaAutofillFieldValue> {
  const textElements = ad.elements.filter((element) => element.type === "text" || element.type === "button");
  const fields: Record<string, CanvaAutofillFieldValue> = {
    ad_id: ad.adId,
    slot_type: ad.slotType,
    width_in: ad.dimensions.widthIn,
    height_in: ad.dimensions.heightIn,
    bleed_in: ad.dimensions.bleedIn,
    safe_margin_in: ad.dimensions.safeMarginIn,
    primary_color: ad.colorPalette.primary,
    secondary_color: ad.colorPalette.secondary,
    accent_color: ad.colorPalette.accent,
    layout_elements_json: JSON.stringify(ad.elements),
  };

  textElements.slice(0, 12).forEach((element, index) => {
    fields[`copy_zone_${index + 1}`] = element.content ?? "";
  });

  return fields;
}

export function buildHomeReachCanvaOperatingModel() {
  return {
    status: getCanvaConfigStatus(),
    folders: HOMEREACH_CANVA_FOLDERS,
    templates: HOMEREACH_CANVA_TEMPLATES,
    brandSystem: HOMEREACH_CANVA_BRAND_SYSTEM,
    architecture: [
      "HomeReach remains the source of truth for campaign, pricing, route, intake, and approval records.",
      "Codex/HomeReach generates strategy, copy, structured fields, quote-safe guardrails, and export requests.",
      "Canva is the primary visual execution engine for editable decks, postcards, reports, social graphics, and assets.",
      "Final print, proposal, checkout, and production actions remain human-approved and source-locked.",
    ],
  };
}

function resolveFolderPath(context: HomeReachCanvaDesignContext) {
  switch (context) {
    case "political_presentation":
      return "HomeReach/Campaigns/Political/Statewide";
    case "political_postcard":
      return "HomeReach/Templates/Postcards";
    case "shared_postcard":
    case "targeted_campaign":
      return "HomeReach/Campaigns/Shared Postcards";
    case "dashboard_asset":
      return "HomeReach/Templates/Dashboard Assets";
    case "social_graphic":
      return "HomeReach/Templates/Social";
    case "map_report":
      return "HomeReach/Templates/Dashboard Assets";
    case "sales_proposal":
    default:
      return "HomeReach/Templates/Proposals";
  }
}

function buildNextActions(mode: string, templateId: string | null, missingFields: string[]) {
  const actions: string[] = [];
  if (mode === "not_configured") {
    actions.push("Configure CANVA_CLIENT_ID, CANVA_CLIENT_SECRET, and CANVA_REDIRECT_URI.");
  }
  if (mode !== "live_token_ready") {
    actions.push("Connect a Canva account through OAuth or configure CANVA_ACCESS_TOKEN for server-side jobs.");
  }
  if (!templateId) {
    actions.push("Add the Canva Brand Template ID for this template key in Vercel environment variables.");
  }
  if (missingFields.length) {
    actions.push(`Populate required template fields: ${missingFields.join(", ")}.`);
  }
  if (!actions.length) {
    actions.push("Ready for Canva Brand Template autofill and export job creation.");
  }
  return actions;
}

function isBlank(value: CanvaAutofillFieldValue | undefined) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  return false;
}
