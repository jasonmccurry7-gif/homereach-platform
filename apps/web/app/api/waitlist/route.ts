import { NextResponse } from "next/server";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  aiWorkforceActivityLogs,
  aiWorkforceTasks,
  db,
  waitlistEntries,
} from "@homereach/db";
import { checkRateLimit } from "@/lib/security/rate-limit";

const PROCUREMENT_REVIEW_PRODUCT_INTENT = "procurement-savings-review";
const LOCAL_SEO_PRODUCT_INTENT = "local-seo";
const LOCAL_SEO_RELATED_OPPORTUNITY = "local-seo-landing-pages";
const LOCAL_GROWTH_REVIEW_PRODUCT_INTENT = "local-growth-review";
const LOCAL_GROWTH_REVIEW_RELATED_OPPORTUNITY = "local-growth-review";
const REPUTATION_PRODUCT_INTENT = "reputation";
const REPUTATION_FOLLOW_UP_RELATED_OPPORTUNITY = "reputation-follow-up";
const SOCIAL_CONTENT_PRODUCT_INTENT = "social-content";
const SOCIAL_CONTENT_RELATED_OPPORTUNITY = "social-content-drafting";
const CONTRACTOS_PRODUCT_INTENTS = new Set([
  "government-contracts",
  "contractos-readiness-scan",
  "contractos-managed-bid-help",
  "contractos-document-review",
  "contractos-watchlist",
]);
const CONTRACTOS_RELATED_OPPORTUNITY = "contractos";
const PUBLIC_PRODUCT_INTENTS = [
  PROCUREMENT_REVIEW_PRODUCT_INTENT,
  "ai-website-assistant",
  LOCAL_SEO_PRODUCT_INTENT,
  LOCAL_GROWTH_REVIEW_PRODUCT_INTENT,
  REPUTATION_PRODUCT_INTENT,
  SOCIAL_CONTENT_PRODUCT_INTENT,
  "government-contracts",
  "contractos-readiness-scan",
  "contractos-managed-bid-help",
  "contractos-document-review",
  "contractos-watchlist",
] as const;

const WaitlistSchema = z
  .object({
    email: z.string().email(),
    name: z.string().min(1).optional(),
    businessName: z.string().min(1).optional(),
    phone: z.string().optional(),
    cityId: z.preprocess(emptyStringToUndefined, z.string().uuid().optional()),
    categoryId: z.preprocess(
      emptyStringToUndefined,
      z.string().uuid().optional(),
    ),
    productIntent: z.preprocess(
      emptyStringToUndefined,
      z.enum(PUBLIC_PRODUCT_INTENTS).optional(),
    ),
    productContext: z
      .object({
        businessType: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(80).optional(),
        ),
        monthlySupplySpend: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(80).optional(),
        ),
        biggestProcurementPain: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        primarySuppliers: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(500).optional(),
        ),
        smsConsent: z.preprocess(
          booleanToStringOrEmptyStringToUndefined,
          z.string().trim().max(10).optional(),
        ),
        smsConsentSource: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        optInSource: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        website: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(240).optional(),
        ),
        seoPrimaryService: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        seoTargetGeography: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(180).optional(),
        ),
        seoPageGoal: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        seoPageType: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        seoExistingPageUrl: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(300).optional(),
        ),
        seoProofPoints: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(900).optional(),
        ),
        reputationGoal: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        recentCustomerCount: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(80).optional(),
        ),
        reviewProfileUrl: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(300).optional(),
        ),
        growthIndustry: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        primaryMarket: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(160).optional(),
        ),
        growthGoal: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        currentMarketing: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        monthlyGrowthBudget: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(80).optional(),
        ),
        growthNotes: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(900).optional(),
        ),
        contentPackage: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        contentGoal: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        contentChannels: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(240).optional(),
        ),
        contentAudience: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(240).optional(),
        ),
        contentPrimaryOffer: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(240).optional(),
        ),
        contentBrandVoice: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(180).optional(),
        ),
        contentAssetsStatus: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        contentApprovalOwner: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(180).optional(),
        ),
        contentNotes: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(900).optional(),
        ),
        contractosRequestType: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        contractosIndustry: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(140).optional(),
        ),
        contractosGovStatus: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(160).optional(),
        ),
        contractosOpportunityUrl: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(500).optional(),
        ),
        contractosDeadline: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(120).optional(),
        ),
        contractosSupportNeed: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(180).optional(),
        ),
        contractosNotes: z.preprocess(
          emptyStringToUndefined,
          z.string().trim().max(1000).optional(),
        ),
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.productIntent && CONTRACTOS_PRODUCT_INTENTS.has(value.productIntent)) {
      const requiredFields: Array<[boolean, (string | number)[], string]> = [
        [
          Boolean(value.name?.trim()),
          ["name"],
          "Name is required for ContractOS support.",
        ],
        [
          Boolean(value.businessName?.trim()),
          ["businessName"],
          "Business name is required for ContractOS support.",
        ],
        [
          Boolean(value.productContext?.contractosRequestType),
          ["productContext", "contractosRequestType"],
          "Request type is required for ContractOS support.",
        ],
        [
          Boolean(value.productContext?.contractosIndustry),
          ["productContext", "contractosIndustry"],
          "Business type is required for ContractOS support.",
        ],
        [
          Boolean(value.productContext?.contractosGovStatus),
          ["productContext", "contractosGovStatus"],
          "Government contracting status is required for ContractOS support.",
        ],
        [
          Boolean(value.productContext?.contractosSupportNeed),
          ["productContext", "contractosSupportNeed"],
          "Support need is required for ContractOS support.",
        ],
      ];

      for (const [isPresent, path, message] of requiredFields) {
        if (isPresent) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message,
        });
      }

      return;
    }

    if (value.productIntent === LOCAL_SEO_PRODUCT_INTENT) {
      const requiredFields: Array<[boolean, (string | number)[], string]> = [
        [
          Boolean(value.name?.trim()),
          ["name"],
          "Name is required for a local SEO plan.",
        ],
        [
          Boolean(value.businessName?.trim()),
          ["businessName"],
          "Business name is required for a local SEO plan.",
        ],
        [
          Boolean(value.productContext?.seoPrimaryService),
          ["productContext", "seoPrimaryService"],
          "Primary service is required for a local SEO plan.",
        ],
        [
          Boolean(value.productContext?.seoTargetGeography),
          ["productContext", "seoTargetGeography"],
          "Target geography is required for a local SEO plan.",
        ],
        [
          Boolean(value.productContext?.seoPageGoal),
          ["productContext", "seoPageGoal"],
          "Page goal is required for a local SEO plan.",
        ],
        [
          Boolean(value.productContext?.seoPageType),
          ["productContext", "seoPageType"],
          "Page type is required for a local SEO plan.",
        ],
      ];

      for (const [isPresent, path, message] of requiredFields) {
        if (isPresent) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message,
        });
      }

      return;
    }

    if (value.productIntent === LOCAL_GROWTH_REVIEW_PRODUCT_INTENT) {
      const requiredFields: Array<[boolean, (string | number)[], string]> = [
        [
          Boolean(value.name?.trim()),
          ["name"],
          "Name is required for a local growth review.",
        ],
        [
          Boolean(value.businessName?.trim()),
          ["businessName"],
          "Business name is required for a local growth review.",
        ],
        [
          Boolean(value.productContext?.growthIndustry),
          ["productContext", "growthIndustry"],
          "Industry is required for a local growth review.",
        ],
        [
          Boolean(value.productContext?.primaryMarket),
          ["productContext", "primaryMarket"],
          "Primary city or service area is required for a local growth review.",
        ],
        [
          Boolean(value.productContext?.growthGoal),
          ["productContext", "growthGoal"],
          "Main growth goal is required for a local growth review.",
        ],
        [
          Boolean(value.productContext?.currentMarketing),
          ["productContext", "currentMarketing"],
          "Current main marketing channel is required for a local growth review.",
        ],
      ];

      for (const [isPresent, path, message] of requiredFields) {
        if (isPresent) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message,
        });
      }

      return;
    }

    if (value.productIntent === SOCIAL_CONTENT_PRODUCT_INTENT) {
      const requiredFields: Array<[boolean, (string | number)[], string]> = [
        [
          Boolean(value.name?.trim()),
          ["name"],
          "Name is required for social content support.",
        ],
        [
          Boolean(value.businessName?.trim()),
          ["businessName"],
          "Business name is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentPackage),
          ["productContext", "contentPackage"],
          "Content package is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentGoal),
          ["productContext", "contentGoal"],
          "Main content goal is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentChannels),
          ["productContext", "contentChannels"],
          "Primary channels are required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentAudience),
          ["productContext", "contentAudience"],
          "Target audience is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentPrimaryOffer),
          ["productContext", "contentPrimaryOffer"],
          "Offer, topic, or promotion is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentAssetsStatus),
          ["productContext", "contentAssetsStatus"],
          "Asset status is required for social content support.",
        ],
        [
          Boolean(value.productContext?.contentApprovalOwner),
          ["productContext", "contentApprovalOwner"],
          "Approval owner is required for social content support.",
        ],
      ];

      for (const [isPresent, path, message] of requiredFields) {
        if (isPresent) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message,
        });
      }

      return;
    }

    if (value.productIntent === REPUTATION_PRODUCT_INTENT) {
      const requiredFields: Array<[boolean, (string | number)[], string]> = [
        [
          Boolean(value.name?.trim()),
          ["name"],
          "Name is required for reputation support.",
        ],
        [
          Boolean(value.businessName?.trim()),
          ["businessName"],
          "Business name is required for reputation support.",
        ],
        [
          Boolean(value.productContext?.reputationGoal),
          ["productContext", "reputationGoal"],
          "Main reputation goal is required for reputation support.",
        ],
        [
          Boolean(value.productContext?.recentCustomerCount),
          ["productContext", "recentCustomerCount"],
          "Recent customer range is required for reputation support.",
        ],
      ];

      for (const [isPresent, path, message] of requiredFields) {
        if (isPresent) continue;
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message,
        });
      }

      return;
    }

    if (value.productIntent !== PROCUREMENT_REVIEW_PRODUCT_INTENT) return;

    const requiredFields: Array<[boolean, (string | number)[], string]> = [
      [
        Boolean(value.name?.trim()),
        ["name"],
        "Name is required for a supply cost review.",
      ],
      [
        Boolean(value.businessName?.trim()),
        ["businessName"],
        "Business name is required for a supply cost review.",
      ],
      [
        Boolean(value.phone?.trim()),
        ["phone"],
        "Phone is required for a supply cost review.",
      ],
      [
        Boolean(value.productContext?.businessType),
        ["productContext", "businessType"],
        "Business type is required for a supply cost review.",
      ],
      [
        Boolean(value.productContext?.monthlySupplySpend),
        ["productContext", "monthlySupplySpend"],
        "Monthly supply spend is required for a supply cost review.",
      ],
      [
        Boolean(value.productContext?.biggestProcurementPain),
        ["productContext", "biggestProcurementPain"],
        "Purchasing priority is required for a supply cost review.",
      ],
    ];

    for (const [isPresent, path, message] of requiredFields) {
      if (isPresent) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message,
      });
    }
  });

function emptyStringToUndefined(value: unknown) {
  return value === "" || value === null ? undefined : value;
}

function booleanToStringOrEmptyStringToUndefined(value: unknown) {
  if (typeof value === "boolean") return value ? "true" : "false";
  return emptyStringToUndefined(value);
}

export async function POST(req: Request) {
  try {
    const limited = checkRateLimit(req, {
      key: "waitlist",
      limit: 10,
      windowMs: 10 * 60 * 1000,
    });
    if (limited) return limited;

    const body = await req.json();
    const parsed = WaitlistSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const {
      email,
      name,
      businessName,
      phone,
      cityId,
      categoryId,
      productIntent,
      productContext,
    } = parsed.data;

    let entryId = productIntent
      ? await findExistingWaitlistEntryIdForProduct(email, productIntent)
      : undefined;
    if (entryId) {
      await updateExistingWaitlistEntry(entryId, {
        name,
        businessName,
        phone,
        cityId,
        categoryId,
      });
    } else {
      const inserted = await db
        .insert(waitlistEntries)
        .values({
          email,
          name: name ?? null,
          businessName: businessName ?? null,
          phone: phone ?? null,
          cityId: cityId ?? null,
          categoryId: categoryId ?? null,
        })
        .onConflictDoNothing()
        .returning({ id: waitlistEntries.id });

      entryId = inserted[0]?.id;
    }
    if (!entryId) {
      entryId = await findExistingWaitlistEntryId(email);
    }
    const compactedProductContext = productContext
      ? compactProductContext(productContext)
      : {};

    if (entryId && productIntent) {
      await tagWaitlistProductIntent(entryId, productIntent);
    }
    if (entryId && productContext) {
      await storeWaitlistProductContext(entryId, compactedProductContext);
    }
    if (entryId && productIntent === PROCUREMENT_REVIEW_PRODUCT_INTENT) {
      await createProcurementReviewTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }
    if (entryId && productIntent === LOCAL_SEO_PRODUCT_INTENT) {
      await createLocalSeoPlanTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }
    if (entryId && productIntent === LOCAL_GROWTH_REVIEW_PRODUCT_INTENT) {
      await createLocalGrowthReviewTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }
    if (entryId && productIntent === REPUTATION_PRODUCT_INTENT) {
      await createReputationFollowUpTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }
    if (entryId && productIntent === SOCIAL_CONTENT_PRODUCT_INTENT) {
      await createSocialContentDraftingTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }
    if (entryId && productIntent && CONTRACTOS_PRODUCT_INTENTS.has(productIntent)) {
      await createContractOSSupportTask({
        entryId,
        email,
        name,
        businessName,
        phone,
        cityId,
        categoryId,
        productIntent,
        productContext: compactedProductContext,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[/api/waitlist]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function findExistingWaitlistEntryId(email: string) {
  const [existing] = await db
    .select({ id: waitlistEntries.id })
    .from(waitlistEntries)
    .where(eq(waitlistEntries.email, email))
    .orderBy(desc(waitlistEntries.createdAt))
    .limit(1);

  return existing?.id;
}

async function findExistingWaitlistEntryIdForProduct(
  email: string,
  productIntent: string,
) {
  try {
    const [existing] = await db
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.email, email),
          eq(waitlistEntries.productIntent, productIntent),
        ),
      )
      .orderBy(desc(waitlistEntries.createdAt))
      .limit(1);

    return existing?.id;
  } catch (err) {
    if (isMissingProductIntentColumnError(err)) return undefined;
    throw err;
  }
}

async function updateExistingWaitlistEntry(
  entryId: string,
  input: {
    name?: string | null;
    businessName?: string | null;
    phone?: string | null;
    cityId?: string | null;
    categoryId?: string | null;
  },
) {
  await db
    .update(waitlistEntries)
    .set({
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      phone: input.phone ?? null,
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    })
    .where(eq(waitlistEntries.id, entryId));
}

async function createProcurementReviewTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-PROC-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = procurementPriority(input.productContext.monthlySupplySpend);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: "/waitlist?product=procurement-savings-review",
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    procurementIntake: input.productContext,
    approvalGate:
      "Human approval required before outbound contact, vendor recommendations, savings claims, or procurement commitments.",
    nextAction:
      "Review intake, qualify fit, prepare a short savings-review agenda, and draft approval-gated follow-up.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "Procurement Chain",
        requestor: "Public procurement savings review form",
        assignedAgent: "Procurement Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare an internal procurement intake brief with likely savings angles, missing data, source requirements, approval status, and a human-approved next outreach step.",
        dependencies: [
          "waitlist_entries",
          "ai_assets_procurement_examples",
          "human_follow_up_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: "procurement-savings-review",
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "Procurement Agent",
      eventType: "waitlist_procurement_review_received",
      status: "new",
      summary: `Procurement savings review request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        procurementIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved follow-up before making any savings, vendor, or pricing claims.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved procurement waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function createLocalSeoPlanTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-SEO-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = localSeoPriority(input.productContext);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: "/waitlist?product=local-seo",
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    localSeoIntake: input.productContext,
    approvalGate:
      "Human approval required before SEO copy, metadata, schema, redirects, indexing controls, citation/profile updates, local claims, CTA changes, or publishing.",
    nextAction:
      "Review intake, choose route type, collect source/proof gaps, prepare a local SEO or landing page brief, and keep all public changes approval-gated.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "SEO Authority Chain",
        requestor: "Public local SEO landing page form",
        assignedAgent: "Local SEO Authority Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare a review-ready local SEO or landing page brief with route type, geography, search intent, conversion path, proof gaps, metadata/schema recommendations, approval status, and next action.",
        dependencies: [
          "waitlist_entries",
          "ai_assets_seo_examples",
          "seo_pages",
          "human_publish_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: LOCAL_SEO_RELATED_OPPORTUNITY,
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "Local SEO Authority Agent",
      eventType: "waitlist_local_seo_plan_received",
      status: "new",
      summary: `Local SEO landing page request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        localSeoIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved local SEO plan before changing copy, metadata, schema, redirects, indexing, citations, CTAs, or publishing.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved local SEO waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function createLocalGrowthReviewTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-GROWTH-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = localGrowthPriority(input.productContext);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: "/waitlist?product=local-growth-review",
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    localGrowthIntake: input.productContext,
    approvalGate:
      "Human approval required before outbound contact, pricing or proposal changes, campaign actions, public claims, or revenue estimates.",
    nextAction:
      "Review intake, check available HomeReach context, prepare a one-page local growth opportunity brief, and label assumptions clearly.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "Growth Intelligence Chain",
        requestor: "Public local growth review form",
        assignedAgent: "Content Strategy Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare an internal one-page local growth review with the top practical opportunity, why it matters, missing proof, recommended next action, approval status, and safe follow-up draft.",
        dependencies: [
          "waitlist_entries",
          "growth_intelligence_admin_entries",
          "business_memory",
          "human_follow_up_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: LOCAL_GROWTH_REVIEW_RELATED_OPPORTUNITY,
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "Content Strategy Agent",
      eventType: "waitlist_local_growth_review_received",
      status: "new",
      summary: `Local growth review request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        localGrowthIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved local growth review before making claims, proposals, outreach, or campaign recommendations customer-facing.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved local growth waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function createReputationFollowUpTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-REP-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = reputationPriority(input.productContext.reputationGoal);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: "/waitlist?product=reputation",
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    reputationIntake: input.productContext,
    approvalGate:
      "Human approval required before review requests, referral requests, public replies, testimonial use, or customer-facing outreach.",
    nextAction:
      "Review intake, verify review/profile links, confirm outreach basis, and draft an approval-gated reputation follow-up plan.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "Reputation Chain",
        requestor: "Public reputation support form",
        assignedAgent: "Reputation Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare an internal reputation intake brief with review, referral, and testimonial opportunities, missing links, consent/approval requirements, and a human-approved next outreach step.",
        dependencies: [
          "waitlist_entries",
          "ai_assets_reputation_examples",
          "human_follow_up_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: REPUTATION_FOLLOW_UP_RELATED_OPPORTUNITY,
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "Reputation Agent",
      eventType: "waitlist_reputation_follow_up_received",
      status: "new",
      summary: `Reputation follow-up request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        reputationIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved follow-up before sending review, referral, testimonial, or public reply messaging.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved reputation waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function createSocialContentDraftingTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-SOCIAL-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = socialContentPriority(input.productContext);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: "/waitlist?product=social-content",
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    socialContentIntake: input.productContext,
    approvalGate:
      "Human approval required before posts, DMs, social ads, political messages, public claims, testimonials, scheduling, publishing, or outbound use.",
    nextAction:
      "Review intake, confirm channels and approval owner, prepare a draft-only content plan, and route customer-facing copy through approval before use.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "Content Strategy Chain",
        requestor: "Public social content drafting form",
        assignedAgent: "Content Strategy Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare a review-ready social content plan with monthly package recommendation, channel plan, draft themes, example post angles, creative asset needs, compliance notes, approval owner, and next action. Do not publish, schedule, send, or make unsupported claims.",
        dependencies: [
          "waitlist_entries",
          "ai_assets_best_posts",
          "ai_assets_content_sops",
          "content_review_queue",
          "human_publish_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: SOCIAL_CONTENT_RELATED_OPPORTUNITY,
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "Content Strategy Agent",
      eventType: "waitlist_social_content_request_received",
      status: "new",
      summary: `Social content drafting request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        socialContentIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved content plan before using posts, DMs, ads, political content, testimonials, claims, schedules, or publishing actions.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved social content waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function createContractOSSupportTask(input: {
  entryId: string;
  email: string;
  name?: string | null;
  businessName?: string | null;
  phone?: string | null;
  cityId?: string | null;
  categoryId?: string | null;
  productIntent: string;
  productContext: Record<string, string>;
}) {
  const clientLabel = input.businessName ?? input.name ?? input.email;
  const taskPublicId = `WF-CONTRACTOS-WAITLIST-${input.entryId.slice(0, 8).toUpperCase()}`;
  const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const priority = contractOSPriority(input.productIntent, input.productContext);
  const inputData = {
    source: "public_waitlist",
    sourceRoute: `/waitlist?product=${input.productIntent}`,
    waitlistEntryId: input.entryId,
    productIntent: input.productIntent,
    contact: {
      name: input.name ?? null,
      businessName: input.businessName ?? null,
      email: input.email,
      phone: input.phone ?? null,
    },
    location: {
      cityId: input.cityId ?? null,
      categoryId: input.categoryId ?? null,
    },
    contractOSIntake: input.productContext,
    approvalGate:
      "Human approval required before bid/no-bid decisions, customer-facing proposal delivery, pricing commitments, certifications, compliance claims, subcontractor commitments, payment changes, award acceptance, or official SAM.gov submission.",
    nextAction:
      "Review intake, verify official opportunity/source links, identify readiness gaps, draft a bid/no-bid or readiness brief, and keep every customer-facing or submission action approval-gated.",
  };

  try {
    const task = await db
      .insert(aiWorkforceTasks)
      .values({
        taskId: taskPublicId,
        workflowName: "SAM.gov Chain",
        requestor: "Public ContractOS request form",
        assignedAgent: "SAM.gov Contract Agent",
        priority,
        status: "new",
        inputPath: `/admin/waitlist?entry=${input.entryId}`,
        inputData,
        expectedOutput:
          "Prepare a review-ready ContractOS intake brief with readiness gaps, opportunity/source notes, bid/no-bid risks, missing documents, pricing/compliance guardrails, recommended package, approval status, and next action. Do not submit, certify, price, bind, or send without human approval.",
        dependencies: [
          "waitlist_entries",
          "gov_contract_opportunities",
          "official_solicitation_source",
          "AI Assets SAM.gov rules",
          "human_bid_and_payment_approval",
        ],
        dueDate,
        approvalRequired: true,
        relatedClient: clientLabel,
        relatedOpportunity: CONTRACTOS_RELATED_OPPORTUNITY,
      })
      .onConflictDoNothing()
      .returning({ id: aiWorkforceTasks.id, taskId: aiWorkforceTasks.taskId });

    const taskRow = task[0];
    if (!taskRow) return;

    await db.insert(aiWorkforceActivityLogs).values({
      taskId: taskRow.id,
      taskPublicId: taskRow.taskId,
      agentName: "SAM.gov Contract Agent",
      eventType: "waitlist_contractos_request_received",
      status: "new",
      summary: `ContractOS request received from ${clientLabel}.`,
      details: {
        source: "public_waitlist",
        waitlistEntryId: input.entryId,
        productIntent: input.productIntent,
        contractOSIntake: input.productContext,
        approvalRequired: true,
        nextAction:
          "Qualify the request and draft a human-approved ContractOS readiness or opportunity review before any customer-facing, financial, certification, pricing, or submission action.",
      },
      approvalStatus: "needs_review",
    });
  } catch (err) {
    if (isMissingAiWorkforceTableError(err)) {
      console.warn(
        "[/api/waitlist] AI Workforce tables missing; saved ContractOS waitlist entry without task",
      );
      return;
    }

    throw err;
  }
}

async function tagWaitlistProductIntent(
  entryId: string,
  productIntent: string,
) {
  try {
    await db.execute(sql`
      update waitlist_entries
      set product_intent = ${productIntent}
      where id = ${entryId}
    `);
  } catch (err) {
    if (isMissingProductIntentColumnError(err)) {
      console.warn(
        "[/api/waitlist] product_intent column missing; saved waitlist entry without product tag",
      );
      return;
    }

    throw err;
  }
}

async function storeWaitlistProductContext(
  entryId: string,
  productContext: Record<string, string>,
) {
  if (Object.keys(productContext).length === 0) return;

  try {
    await db.execute(sql`
      update waitlist_entries
      set product_context = ${JSON.stringify(productContext)}::jsonb
      where id = ${entryId}
    `);
  } catch (err) {
    if (isMissingProductContextColumnError(err)) {
      console.warn(
        "[/api/waitlist] product_context column missing; saved waitlist entry without product details",
      );
      return;
    }

    throw err;
  }
}

function compactProductContext(
  productContext: NonNullable<z.infer<typeof WaitlistSchema>["productContext"]>,
) {
  return Object.fromEntries(
    Object.entries(productContext).filter(
      (entry): entry is [string, string] =>
        typeof entry[1] === "string" && entry[1].trim().length > 0,
    ),
  );
}

function isMissingProductIntentColumnError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("product_intent");
}

function isMissingProductContextColumnError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("product_context");
}

function isMissingAiWorkforceTableError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes("ai_workforce_tasks") ||
    message.includes("ai_workforce_activity_logs")
  );
}

function procurementPriority(monthlySupplySpend?: string) {
  if (monthlySupplySpend === "$25,000+") return "high";
  if (monthlySupplySpend === "$10,000 - $25,000") return "high";
  if (monthlySupplySpend === "$2,500 - $10,000") return "medium";
  return "medium";
}

function localSeoPriority(productContext: Record<string, string>) {
  const goal = String(productContext.seoPageGoal ?? "").toLowerCase();
  const pageType = String(productContext.seoPageType ?? "").toLowerCase();
  if (pageType.includes("qr") || goal.includes("qr")) return "high";
  if (pageType.includes("campaign") || goal.includes("campaign")) return "high";
  if (goal.includes("conversion")) return "high";
  if (productContext.seoExistingPageUrl) return "medium";
  return "medium";
}

function localGrowthPriority(productContext: Record<string, string>) {
  const budget = productContext.monthlyGrowthBudget;
  const goal = String(productContext.growthGoal ?? "").toLowerCase();
  if (budget === "$2,500+") return "high";
  if (
    goal.includes("direct mail") ||
    goal.includes("competitor") ||
    goal.includes("new neighborhood")
  ) {
    return "high";
  }
  if (budget === "$1,000 - $2,500") return "high";
  return "medium";
}

function reputationPriority(reputationGoal?: string) {
  const goal = String(reputationGoal ?? "").toLowerCase();
  if (goal.includes("response")) return "high";
  if (goal.includes("testimonial")) return "high";
  if (goal.includes("google")) return "medium";
  if (goal.includes("referral")) return "medium";
  return "medium";
}

function socialContentPriority(productContext: Record<string, string>) {
  const contentPackage = String(productContext.contentPackage ?? "").toLowerCase();
  const goal = String(productContext.contentGoal ?? "").toLowerCase();
  const notes = String(productContext.contentNotes ?? "").toLowerCase();
  if (contentPackage.includes("16")) return "high";
  if (contentPackage.includes("launch")) return "high";
  if (goal.includes("political")) return "high";
  if (goal.includes("event")) return "high";
  if (goal.includes("direct mail")) return "high";
  if (notes.includes("urgent") || notes.includes("deadline")) return "high";
  return "medium";
}

function contractOSPriority(
  productIntent: string,
  productContext: Record<string, string>,
) {
  const deadline = String(productContext.contractosDeadline ?? "").toLowerCase();
  const supportNeed = String(productContext.contractosSupportNeed ?? "").toLowerCase();
  if (
    productIntent === "contractos-managed-bid-help" ||
    productIntent === "contractos-document-review"
  ) {
    return "high";
  }
  if (
    deadline.includes("today") ||
    deadline.includes("tomorrow") ||
    deadline.includes("week") ||
    supportNeed.includes("proposal") ||
    supportNeed.includes("bid")
  ) {
    return "high";
  }
  return "medium";
}
