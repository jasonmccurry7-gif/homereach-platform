import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { logPlatformAuditEvent } from "@/lib/audit/platform-audit";
import { assertSocialPublishAllowed, SocialPublishBlockedError, SocialPublishSource } from "@/lib/social-content/publish-guard";

export type GrowthIntegrationVendor = "arvow" | "blotato" | "rss_cms";
export type GrowthIntegrationRuntimeState = "ready" | "review_only" | "needs_config" | "blocked";

export type GrowthIntegrationEnvStatus = {
  name: string;
  required: boolean;
  present: boolean;
};

export type GrowthIntegrationStatus = {
  vendor: GrowthIntegrationVendor;
  label: string;
  state: GrowthIntegrationRuntimeState;
  mode: string;
  canCallApi: boolean;
  canPublish: boolean;
  env: GrowthIntegrationEnvStatus[];
  lastCheckedAt: string;
  issue: string | null;
  nextAction: string;
};

type JsonRecord = Record<string, unknown>;

export type ArvowBatchInput = {
  keyword?: string;
  title?: string;
  context?: string;
  includeKeywords?: string[];
  dryRun?: boolean;
};

export type BlotatoScheduleInput = {
  accountId?: string;
  pageId?: string;
  platform?: string;
  text?: string;
  mediaUrls?: string[];
  scheduledTime?: string;
  useNextFreeSlot?: boolean;
  approved?: boolean;
  dryRun?: boolean;
  actorId?: string;
  source?: SocialPublishSource;
};

const ARVOW_BASE_URL = "https://api.arvow.com";
const BLOTATO_BASE_URL = "https://backend.blotato.com/v2";

function envPresent(name: string) {
  return Boolean(process.env[name]?.trim());
}

function envValue(name: string, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function boolEnv(name: string, fallback: boolean) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return value === "true" || value === "1" || value === "yes";
}

function jsonRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeJsonString(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function statusFromEnv(
  vendor: GrowthIntegrationVendor,
  label: string,
  mode: string,
  env: GrowthIntegrationEnvStatus[],
  nextAction: string,
): GrowthIntegrationStatus {
  const missingRequired = env.filter((item) => item.required && !item.present).map((item) => item.name);
  const reviewOnly = mode !== "live" && mode !== "publish_after_review";
  const state: GrowthIntegrationRuntimeState = missingRequired.length
    ? "needs_config"
    : reviewOnly
      ? "review_only"
      : "ready";

  return {
    vendor,
    label,
    state,
    mode,
    canCallApi: !missingRequired.length,
    canPublish: state === "ready" && vendor !== "arvow",
    env,
    lastCheckedAt: new Date().toISOString(),
    issue: missingRequired.length ? `Missing ${missingRequired.join(", ")}` : null,
    nextAction: missingRequired.length ? `Add ${missingRequired.join(", ")} in Vercel environment variables.` : nextAction,
  };
}

export function getGrowthIntegrationStatuses(): GrowthIntegrationStatus[] {
  const seoMode = envValue("SEO_PUBLISHING_MODE", "review_only");
  const socialMode = envValue("SOCIAL_PUBLISHING_MODE", "review_only");

  return [
    statusFromEnv(
      "arvow",
      "Arvow",
      seoMode,
      [
        { name: "ARVOW_API_KEY", required: true, present: envPresent("ARVOW_API_KEY") },
        { name: "SEO_WEBHOOK_SECRET", required: true, present: envPresent("SEO_WEBHOOK_SECRET") },
        { name: "SEO_PUBLISHING_MODE", required: false, present: envPresent("SEO_PUBLISHING_MODE") },
        { name: "CMS_WEBHOOK_URL", required: false, present: envPresent("CMS_WEBHOOK_URL") },
        { name: "ARVOW_WORKSPACE_ID", required: false, present: envPresent("ARVOW_WORKSPACE_ID") },
        { name: "ARVOW_BRAND_ID", required: false, present: envPresent("ARVOW_BRAND_ID") },
      ],
      "Use the admin action to create a reviewed Arvow batch; generated content stays draft-only in HomeReach.",
    ),
    statusFromEnv(
      "blotato",
      "Blotato",
      socialMode,
      [
        { name: "BLOTATO_API_KEY", required: true, present: envPresent("BLOTATO_API_KEY") },
        { name: "SOCIAL_PUBLISHING_MODE", required: false, present: envPresent("SOCIAL_PUBLISHING_MODE") },
        { name: "SOCIAL_REVIEW_REQUIRED", required: false, present: envPresent("SOCIAL_REVIEW_REQUIRED") },
        { name: "DEFAULT_SOCIAL_TIMEZONE", required: false, present: envPresent("DEFAULT_SOCIAL_TIMEZONE") },
      ],
      "Fetch connected accounts, then schedule only approved social drafts.",
    ),
    statusFromEnv(
      "rss_cms",
      "RSS / CMS",
      envValue("RSS_REPURPOSING_ENABLED", "review_only"),
      [
        { name: "RSS_REPURPOSING_ENABLED", required: false, present: envPresent("RSS_REPURPOSING_ENABLED") },
        { name: "CMS_API_KEY", required: false, present: envPresent("CMS_API_KEY") },
        { name: "CMS_WEBHOOK_URL", required: false, present: envPresent("CMS_WEBHOOK_URL") },
      ],
      "Keep repurposing outputs in Human Review until a CMS or RSS source is selected.",
    ),
  ];
}

function buildArvowPayload(input: ArvowBatchInput) {
  const keyword = textValue(input.keyword, "AI-powered local growth execution platform");
  const title = textValue(input.title, "How HomeReach Helps Local Businesses Win With Operational Growth Intelligence");
  const context = textValue(
    input.context,
    "HomeReach helps local businesses, political campaigns, and organizations win locally through coordinated direct mail, AI-assisted follow-up, procurement savings, campaign execution, and operational visibility. Keep claims practical, premium, and review-first.",
  );
  const tags = envValue("ARVOW_ARTICLE_TAGS", "HomeReach,growth-engine,review-needed")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    key: envValue("ARVOW_API_KEY"),
    formula: {
      generation: {
        entries: [{ keyword, title }],
      },
      content: {
        languageCode: "en",
        countryCode: "US",
        formality: "formal",
        pointOfView: "first-plural",
        tone: "premium, clear, practical, emotionally intelligent, operationally credible",
        context,
        customPrompt:
          "Create a draft article for HomeReach. Avoid unsupported guarantees, fake testimonials, hard ROI claims, and claims that content is live or published. Include practical next steps and label assumptions clearly.",
        includeKeywords: input.includeKeywords?.filter(Boolean) ?? ["HomeReach", "local growth", "AI-powered operations"],
      },
      knowledge: {
        brandId: envValue("ARVOW_BRAND_ID") || null,
        serp: true,
      },
      formatting: {
        bold: true,
        lists: true,
        tables: false,
        quotes: false,
        headingCase: "title",
      },
      structure: {
        faq: true,
        keyTakeaways: true,
        conclusion: true,
        size: "md",
        ctaUrl: envValue("NEXT_PUBLIC_SITE_URL", "https://home-reach.com"),
      },
    },
    workspaceId: envValue("ARVOW_WORKSPACE_ID") || null,
    articleTags: tags,
  };
}

export async function createArvowBatch(input: ArvowBatchInput) {
  const status = getGrowthIntegrationStatuses().find((item) => item.vendor === "arvow");
  const payload = buildArvowPayload(input);
  const dryRun = input.dryRun !== false || envValue("SEO_PUBLISHING_MODE", "review_only") === "review_only";

  if (!status?.canCallApi) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "arvow_batch_blocked",
      provider: "arvow",
      resultStatus: "blocked",
      approvalState: "needs_review",
      severity: "medium",
      message: "Arvow batch blocked because required credentials are missing.",
      metadata: { status, requestedKeyword: input.keyword },
    });
    return { ok: false, dryRun: true, status, payload, message: status?.issue ?? "Arvow is not configured." };
  }

  if (dryRun) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "arvow_batch_dry_run",
      provider: "arvow",
      resultStatus: "pending_approval",
      approvalState: "needs_review",
      message: "Prepared Arvow batch payload in review-only mode.",
      metadata: { requestedKeyword: input.keyword, mode: envValue("SEO_PUBLISHING_MODE", "review_only") },
    });
    return { ok: true, dryRun: true, status, payload, message: "Arvow batch payload prepared. SEO publishing remains review-only." };
  }

  const response = await fetch(`${ARVOW_BASE_URL}/api/v0.1/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};

  await logPlatformAuditEvent({
    actorType: "integration",
    module: "growth_engine",
    actionType: "arvow_batch_create",
    provider: "arvow",
    resultStatus: response.ok ? "success" : "failure",
    approvalState: "needs_review",
    severity: response.ok ? "info" : "high",
    message: response.ok ? "Arvow batch created for draft SEO content." : "Arvow batch request failed.",
    errorMessage: response.ok ? null : raw,
    metadata: { responseStatus: response.status, data },
  });

  return { ok: response.ok, dryRun: false, status, payload, data, message: response.ok ? "Arvow batch created." : "Arvow request failed." };
}

export async function fetchBlotatoAccounts(platform?: string) {
  const status = getGrowthIntegrationStatuses().find((item) => item.vendor === "blotato");
  if (!status?.canCallApi) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "blotato_accounts_blocked",
      provider: "blotato",
      resultStatus: "blocked",
      approvalState: "not_required",
      severity: "medium",
      message: "Blotato account fetch blocked because BLOTATO_API_KEY is missing.",
      metadata: { status },
    });
    return { ok: false, status, message: status?.issue ?? "Blotato is not configured.", items: [] };
  }

  const url = new URL(`${BLOTATO_BASE_URL}/users/me/accounts`);
  if (platform) url.searchParams.set("platform", platform);
  const response = await fetch(url, {
    headers: { "blotato-api-key": envValue("BLOTATO_API_KEY") },
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};
  const accountItems = jsonRecord(data).items;
  const items: unknown[] = Array.isArray(accountItems) ? accountItems : [];

  await logPlatformAuditEvent({
    actorType: "integration",
    module: "growth_engine",
    actionType: "blotato_accounts_fetch",
    provider: "blotato",
    resultStatus: response.ok ? "success" : "failure",
    approvalState: "not_required",
    severity: response.ok ? "info" : "high",
    message: response.ok ? "Fetched Blotato connected accounts." : "Blotato account fetch failed.",
    errorMessage: response.ok ? null : raw,
    metadata: { responseStatus: response.status, platform, count: items.length },
  });

  return { ok: response.ok, status, data, items, message: response.ok ? `Found ${items.length} connected account(s).` : "Blotato account fetch failed." };
}

function buildBlotatoPayload(input: BlotatoScheduleInput) {
  const platform = textValue(input.platform, "linkedin");
  const mediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls.filter((url) => typeof url === "string" && url.trim()) : [];
  const target: JsonRecord = { targetType: platform };
  if (input.pageId) target.pageId = input.pageId;

  const payload: JsonRecord = {
    post: {
      accountId: input.accountId,
      content: {
        text: textValue(
          input.text,
          "HomeReach helps local businesses and campaigns turn operational clarity into growth. Draft prepared for human review.",
        ),
        mediaUrls,
        platform,
      },
      target,
    },
  };

  if (input.scheduledTime) {
    payload.scheduledTime = input.scheduledTime;
  } else {
    payload.useNextFreeSlot = input.useNextFreeSlot !== false;
  }

  return payload;
}

export async function scheduleBlotatoPost(input: BlotatoScheduleInput) {
  const status = getGrowthIntegrationStatuses().find((item) => item.vendor === "blotato");
  const publishingMode = envValue("SOCIAL_PUBLISHING_MODE", "review_only");
  const reviewRequired = boolEnv("SOCIAL_REVIEW_REQUIRED", true);
  const dryRun = input.dryRun !== false || publishingMode !== "live";
  const requestedLiveSchedule = input.dryRun === false && publishingMode === "live";

  let approvedInput = input;
  let approvalMetadata: Record<string, unknown> | null = null;
  if (requestedLiveSchedule) {
    if (!input.source) {
      await logPlatformAuditEvent({
        actorType: "integration",
        actorId: input.actorId ?? null,
        module: "growth_engine",
        actionType: "blotato_schedule_missing_approved_source",
        provider: "blotato",
        resultStatus: "blocked",
        approvalState: "needs_review",
        severity: "high",
        message: "Blotato live scheduling blocked because no persisted approved content source was provided.",
        metadata: { publishingMode, platform: input.platform },
      });
      return { ok: false, dryRun: true, status, payload: null, message: "Approved source content is required for live social scheduling." };
    }

    const approval = await assertSocialPublishAllowed({
      source: input.source,
      destination: {
        provider: "blotato",
        platform: input.platform,
        accountId: input.accountId,
        pageId: input.pageId,
      },
      action: "schedule_external",
      actorId: input.actorId,
      text: input.text,
      mediaUrls: input.mediaUrls,
    }).catch((error) => {
      if (error instanceof SocialPublishBlockedError) {
        return null;
      }
      throw error;
    });

    if (!approval) {
      return { ok: false, dryRun: true, status, payload: null, message: "Social scheduling was blocked by the approval guard." };
    }

    approvedInput = {
      ...input,
      text: approval.text,
      mediaUrls: approval.mediaUrls.length ? approval.mediaUrls : input.mediaUrls,
      approved: true,
    };
    approvalMetadata = {
      source: approval.source,
      contentHash: approval.contentHash,
      approvedBy: approval.approvedBy,
      approvedAt: approval.approvedAt,
      verificationStatus: approval.verificationStatus,
    };
  }

  const payload = buildBlotatoPayload(approvedInput);

  if (!status?.canCallApi) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "blotato_schedule_blocked",
      provider: "blotato",
      resultStatus: "blocked",
      approvalState: "needs_review",
      severity: "medium",
      message: "Blotato schedule blocked because required credentials are missing.",
      metadata: { status, payload },
    });
    return { ok: false, dryRun: true, status, payload, message: status?.issue ?? "Blotato is not configured." };
  }

  if (reviewRequired && !requestedLiveSchedule && input.approved !== true) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "blotato_schedule_needs_approval",
      provider: "blotato",
      resultStatus: "blocked",
      approvalState: "needs_review",
      severity: "medium",
      message: "Blotato schedule blocked because human approval is required.",
      metadata: { publishingMode, reviewRequired },
    });
    return {
      ok: false,
      dryRun: true,
      status,
      payload,
      message: "Human approval is required before social scheduling.",
    };
  }

  if (dryRun) {
    await logPlatformAuditEvent({
      actorType: "integration",
      module: "growth_engine",
      actionType: "blotato_schedule_dry_run",
      provider: "blotato",
      resultStatus: "pending_approval",
      approvalState: "needs_review",
      message: "Prepared Blotato scheduling payload in review-only mode.",
      metadata: { publishingMode, platform: input.platform, approval: approvalMetadata },
    });
    return { ok: true, dryRun: true, status, payload, message: "Blotato payload prepared. Social publishing remains review-only." };
  }

  if (!input.accountId) {
    return { ok: false, dryRun: false, status, payload, message: "Blotato accountId is required for live scheduling." };
  }

  const response = await fetch(`${BLOTATO_BASE_URL}/posts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "blotato-api-key": envValue("BLOTATO_API_KEY"),
    },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : {};

  await logPlatformAuditEvent({
    actorType: "integration",
    module: "growth_engine",
    actionType: "blotato_schedule_post",
    provider: "blotato",
    resultStatus: response.ok ? "success" : "failure",
    approvalState: "approved",
    severity: response.ok ? "info" : "high",
    message: response.ok ? "Submitted approved post to Blotato." : "Blotato post schedule failed.",
    errorMessage: response.ok ? null : raw,
    metadata: { responseStatus: response.status, data, approval: approvalMetadata },
  });

  return { ok: response.ok, dryRun: false, status, payload, data, message: response.ok ? "Approved post submitted to Blotato." : "Blotato request failed." };
}

export function verifyArvowWebhookSecret(headers: Headers, url: string) {
  const configuredSecret = envValue("SEO_WEBHOOK_SECRET");
  if (!configuredSecret) {
    return { ok: false, status: 503, message: "SEO_WEBHOOK_SECRET is not configured." };
  }

  const auth = headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  const provided =
    bearer ||
    headers.get("x-seo-webhook-secret") ||
    headers.get("x-webhook-secret") ||
    new URL(url).searchParams.get("secret") ||
    "";

  if (provided !== configuredSecret) {
    return { ok: false, status: 401, message: "Invalid webhook secret." };
  }

  return { ok: true, status: 200, message: "Verified." };
}

export async function storeArvowWebhookDraft(payload: unknown) {
  const record = jsonRecord(payload);
  const article = jsonRecord(record.article ?? record.data ?? record.payload);
  const title = textValue(record.title, textValue(article.title, "Arvow SEO article draft"));
  const content = textValue(
    record.markdown,
    textValue(article.markdown, textValue(record.content, textValue(article.content, textValue(record.html, textValue(article.html, safeJsonString(payload)))))),
  );

  try {
    const db = createServiceClient();
    const { data, error } = await db
      .from("ai_outputs")
      .insert({
        title,
        agent_name: "SEO Agent",
        workflow: "growth_engine_arvow_webhook",
        output_type: "seo_article_draft",
        content,
        data_sources: ["Arvow webhook"],
        prompt_sop_name: "skills/content-strategy/SKILL.md",
        approval_status: "needs_review",
        verification_status: "needs_review",
        metadata: {
          provider: "arvow",
          raw_payload: payload,
          received_at: new Date().toISOString(),
        },
      })
      .select("id,title")
      .single();

    if (error && error.code !== "42P01") {
      return { stored: false, error: error.message, id: null };
    }

    return { stored: Boolean(data?.id), error: null, id: data?.id ?? null };
  } catch (err) {
    return { stored: false, error: err instanceof Error ? err.message : String(err), id: null };
  }
}
