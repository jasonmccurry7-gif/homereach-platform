import { z } from "zod";
import { db, opcopilotActionRequests } from "@homereach/db";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { isOperationsCopilotEnabled } from "@/lib/operations-copilot/feature-flag";
import {
  approvalLockedPayload,
  guardSupplifyMutation,
  jsonNoStore,
  sanitizeConfidence,
  sanitizeMoneyCents,
  sanitizeText,
} from "@/lib/operations-copilot/governance";
import { readApprovedSupplierCheckoutUrl } from "@/lib/operations-copilot/supplier-checkout";

export const dynamic = "force-dynamic";

const supplierCheckoutSchema = z.object({
  itemName: z.string().max(160).optional(),
  recommendedSupplier: z.string().max(160).optional(),
  checkoutUrl: z.string().max(2_000).optional().nullable(),
  estimatedSavingsCents: z.number().optional(),
  trueLandedCostCents: z.number().optional(),
  confidence: z.string().optional(),
}).passthrough();

export async function POST(req: Request) {
  if (!isOperationsCopilotEnabled()) {
    return jsonNoStore({ error: "Not found" }, { status: 404 });
  }

  const user = await getOperationsCopilotSessionUser();
  if (!user) return jsonNoStore({ error: "Unauthorized" }, { status: 401 });

  const guard = guardSupplifyMutation(req, {
    key: "opcopilot_supplier_checkout",
    limit: 25,
    userId: user.id,
  });
  if (guard) return guard;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonNoStore({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = supplierCheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore(
      { error: "Invalid supplier action", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const submittedCheckoutUrl =
    typeof parsed.data.checkoutUrl === "string" && parsed.data.checkoutUrl.trim()
      ? parsed.data.checkoutUrl.trim()
      : null;
  const checkoutUrl = readApprovedSupplierCheckoutUrl(submittedCheckoutUrl);
  const checkoutUrlRequiresApproval = Boolean(submittedCheckoutUrl && !checkoutUrl);

  const itemName = sanitizeText(parsed.data.itemName, "Supply item", 160);
  const supplierName = sanitizeText(parsed.data.recommendedSupplier, "Supplier", 160);
  const estimatedSavingsCents = sanitizeMoneyCents(parsed.data.estimatedSavingsCents);
  const estimatedSpendCents = sanitizeMoneyCents(parsed.data.trueLandedCostCents);
  const confidence = sanitizeConfidence(parsed.data.confidence);
  const actionType = checkoutUrl
    ? "supplier_checkout_redirect"
    : "supplier_quote_request";
  const title = checkoutUrl
    ? `Supplier checkout reviewed: ${itemName}`
    : checkoutUrlRequiresApproval
      ? `Supplier checkout URL needs approval: ${itemName}`
    : `Supplier quote requested: ${itemName}`;

  try {
    const [request] = await db
      .insert(opcopilotActionRequests)
      .values({
        userId: user.id,
        actionType,
        title,
        proposedBy: "owner",
        autonomyLevel: 1,
        status: checkoutUrl ? "tracked" : "pending_approval",
        estimatedSpendCents,
        estimatedSavingsCents,
        confidence,
        riskScore: checkoutUrl ? 20 : 35,
        approvalRequired: !checkoutUrl,
        requestPayload: approvalLockedPayload({
          ...parsed.data,
          requestedFrom: "operations_copilot_supplier_checkout",
          supplierPaymentProcessedByHomeReach: false,
          supplierPaymentOwnerControlled: true,
          checkoutTrackedAt: new Date().toISOString(),
          checkoutUrl,
          blockedCheckoutUrl: checkoutUrlRequiresApproval
            ? sanitizeText(submittedCheckoutUrl, "", 2_000)
            : null,
          supplierReferenceUrlApproved: Boolean(checkoutUrl),
          supplierReferenceApprovalReason: checkoutUrlRequiresApproval
            ? "URL did not match an approved supplier connector pattern"
            : null,
        }),
        auditLog: [
          {
            at: new Date().toISOString(),
            actor: "owner",
            event: checkoutUrl
              ? "supplier_checkout_redirect_tracked"
              : checkoutUrlRequiresApproval
                ? "supplier_checkout_url_blocked_for_approval"
              : "supplier_quote_request_created",
            supplierName,
            supplierPaymentProcessedByHomeReach: false,
            approvalRequired: !checkoutUrl,
            supplierReferenceUrlApproved: Boolean(checkoutUrl),
          },
        ],
      })
      .returning();

    if (!request) {
      return jsonNoStore(
        { error: "Supplier checkout action could not be tracked" },
        { status: 500 }
      );
    }

    return jsonNoStore({
      id: request.id,
      status: request.status,
      approvalRequired: request.approvalRequired,
      checkoutUrl,
      supplierReferenceUrlApproved: Boolean(checkoutUrl),
      message: checkoutUrlRequiresApproval
        ? "Supplier reference URL requires approval before it can be opened"
        : undefined,
    }, checkoutUrlRequiresApproval ? { status: 409 } : undefined);
  } catch {
    return jsonNoStore(
      { error: "Supplier checkout action could not be tracked" },
      { status: 500 }
    );
  }
}
