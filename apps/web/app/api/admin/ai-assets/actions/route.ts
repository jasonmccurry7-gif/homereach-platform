import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/api-guards";
import { syncAiOutputLedger } from "@/lib/approvals/ai-output-ledger";
import { createServiceClient } from "@/lib/supabase/service";

const DEFAULT_VERIFICATION_CHECKS = [
  ["Facts verified", "accuracy"],
  ["Numbers verified", "accuracy"],
  ["Pricing verified", "revenue"],
  ["Claims verified", "compliance"],
  ["Legal/compliance reviewed", "compliance"],
  ["Political targeting rules followed", "political"],
  ["No prohibited persuasion scoring", "political"],
  ["No voter belief inference", "political"],
  ["No unsupported guarantees", "sales"],
  ["No misleading ROI claims", "sales"],
  ["Brand tone reviewed", "brand"],
  ["Human approval completed", "approval"],
] as const;

type ActionPayload = Record<string, unknown> & {
  action?: string;
};

export async function POST(req: Request) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.response;

  let body: ActionPayload;
  try {
    body = (await req.json()) as ActionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase service credentials are not configured for AI Assets persistence." },
      { status: 503 },
    );
  }

  const db = createServiceClient();
  const now = new Date().toISOString();

  try {
    switch (body.action) {
      case "save_business_context": {
        const id = asString(body.id);
        const row = {
          title: asString(body.title) || "HomeReach Master Business Context",
          category: asString(body.category) || "master",
          company_overview: asString(body.companyOverview),
          offers: asString(body.offers),
          pricing: asString(body.pricing),
          target_customers: asString(body.targetCustomers),
          brand_voice: asString(body.brandVoice),
          sales_positioning: asString(body.salesPositioning),
          compliance_rules: asString(body.complianceRules),
          political_mail_rules: asString(body.politicalMailRules),
          procurement_dashboard_rules: asString(body.procurementDashboardRules),
          shared_postcard_rules: asString(body.sharedPostcardRules),
          targeted_campaign_rules: asString(body.targetedCampaignRules),
          sam_gov_rules: asString(body.samGovRules),
          human_approval_requirements: asString(body.humanApprovalRequirements),
          tags: toArray(body.tags),
          notes: asString(body.notes) || null,
          status: "active",
          owner_user_id: guard.user?.id ?? null,
          updated_at: now,
        };
        const query = id.startsWith("seed-")
          ? db.from("ai_business_context").insert(row).select("id").single()
          : db.from("ai_business_context").update(row).eq("id", id).select("id").single();
        const { data, error } = await query;
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Business context saved." });
      }

      case "create_prompt_sop": {
        const { data, error } = await db
          .from("ai_prompt_sops")
          .insert({
            prompt_name: requiredString(body.promptName, "Prompt name"),
            category: requiredString(body.category, "Category"),
            purpose: asString(body.purpose),
            required_inputs: toArray(body.requiredInputs),
            prompt_text: requiredString(body.promptText, "Prompt text"),
            output_format: asString(body.outputFormat) || "Draft, assumptions, verification risks, next action.",
            approval_requirement:
              asString(body.approvalRequirement) ||
              "Human approval required before customer-facing or high-stakes use.",
            tags: toArray(body.tags),
            related_workflow: asString(body.relatedWorkflow) || null,
            related_offer: asString(body.relatedOffer) || null,
            notes: asString(body.notes) || null,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Prompt SOP saved." });
      }

      case "create_data_source": {
        const { data, error } = await db
          .from("ai_data_sources")
          .insert({
            title: requiredString(body.title, "Title"),
            category: requiredString(body.category, "Category"),
            description: asString(body.description),
            content: asString(body.content),
            tags: toArray(body.tags),
            related_workflow: asString(body.relatedWorkflow) || null,
            related_offer: asString(body.relatedOffer) || null,
            quality_rating: clampRating(body.qualityRating),
            notes: asString(body.notes) || null,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Data source saved." });
      }

      case "create_agent_profile": {
        const { data, error } = await db
          .from("ai_agent_profiles")
          .insert({
            agent_name: requiredString(body.agentName, "Agent name"),
            mission: asString(body.mission),
            allowed_actions: toArray(body.allowedActions),
            disallowed_actions: toArray(body.disallowedActions),
            required_data_sources: toArray(body.requiredDataSources),
            required_prompt_sops: toArray(body.requiredPromptSops),
            approval_rules: asString(body.approvalRules),
            compliance_rules: asString(body.complianceRules),
            escalation_rules: asString(body.escalationRules),
            output_format: asString(body.outputFormat),
            tone_rules: asString(body.toneRules),
            success_metrics: toArray(body.successMetrics),
            notes: asString(body.notes) || null,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Agent profile saved." });
      }

      case "create_ai_output": {
        const { data, error } = await db
          .from("ai_outputs")
          .insert({
            title: requiredString(body.title, "Title"),
            agent_name: asString(body.agentName) || null,
            workflow: asString(body.workflow) || null,
            output_type: asString(body.outputType) || "draft",
            content: requiredString(body.content, "Output content"),
            data_sources: toArray(body.dataSources),
            prompt_sop_name: asString(body.promptSopName) || null,
            chain_name: asString(body.chainName) || null,
            approval_status: "needs_review",
            verification_status: "pending",
            notes: asString(body.notes) || null,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;

        await db.from("ai_verification_checks").insert(
          DEFAULT_VERIFICATION_CHECKS.map(([label, category]) => ({
            output_id: data.id,
            label,
            category,
            required: true,
          })),
        );

        const ledgerResult = await syncAiOutputLedger(
          {
            id: data.id,
            title: String(data.title ?? "AI output"),
            agentName: data.agent_name,
            workflow: data.workflow,
            outputType: data.output_type,
            approvalStatus: String(data.approval_status ?? "needs_review"),
            verificationStatus: data.verification_status,
            winningOutput: Boolean(data.winning_output),
            metadata: isRecord(data.metadata) ? data.metadata : {},
            ownerUserId: data.owner_user_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          },
          {
            actorId: guard.user?.id ?? null,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_created",
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai output create sync skipped:", ledgerResult.error);
        }

        return NextResponse.json({ ok: true, id: data.id, message: "AI output queued for review." });
      }

      case "update_output_status": {
        const id = requiredString(body.id, "Output id");
        const status = normalizeApprovalStatus(body.status);
        if (status === "approved") {
          const checksVerified = await requiredChecksVerified(db, id);
          if (!checksVerified) {
            return NextResponse.json(
              {
                error:
                  "All required verification checks must be completed before approval.",
              },
              { status: 409 },
            );
          }
        }
        const { data: output, error } = await db
          .from("ai_outputs")
          .update({
            approval_status: status,
            verification_status: status === "approved" ? "verified" : "needs_review",
            updated_at: now,
          })
          .eq("id", id)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;

        await db.from("ai_output_reviews").insert({
          output_id: id,
          reviewer_user_id: guard.user?.id ?? null,
          review_status: status,
          review_notes: asString(body.reviewNotes) || null,
          checklist: isRecord(body.checklist) ? body.checklist : {},
        });

        const ledgerResult = await syncAiOutputLedger(
          {
            id: output.id,
            title: String(output.title ?? "AI output"),
            agentName: output.agent_name,
            workflow: output.workflow,
            outputType: output.output_type,
            approvalStatus: String(output.approval_status ?? status),
            verificationStatus: output.verification_status,
            winningOutput: Boolean(output.winning_output),
            metadata: isRecord(output.metadata) ? output.metadata : {},
            ownerUserId: output.owner_user_id,
            createdAt: output.created_at,
            updatedAt: output.updated_at,
          },
          {
            actorId: guard.user?.id ?? null,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_status_updated",
            eventNotes: asString(body.reviewNotes) || undefined,
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai output status sync skipped:", ledgerResult.error);
        }

        return NextResponse.json({ ok: true, message: `Output marked ${status.replaceAll("_", " ")}.` });
      }

      case "approve_output_artifact": {
        const id = requiredString(body.id, "Output id");
        const checks = await ensureOutputVerificationChecks(db, id);
        const requiredChecks = checks.filter((check) => check.required);
        const verificationNote =
          asString(body.verificationNotes) ||
          "Human reviewer approved this reusable AI artifact record. Separate workflow approval is still required before public, outbound, financial, political, procurement, SAM.gov, payment, or campaign-setting use.";

        const { error: checksError } = await db
          .from("ai_verification_checks")
          .update({
            status: "verified",
            notes: verificationNote,
            completed_by: guard.user?.id ?? null,
            completed_at: now,
            updated_at: now,
          })
          .eq("output_id", id)
          .eq("required", true);
        if (checksError) throw checksError;

        const { data: output, error: outputError } = await db
          .from("ai_outputs")
          .update({
            approval_status: "approved",
            verification_status: "verified",
            updated_at: now,
          })
          .eq("id", id)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (outputError) throw outputError;

        await db.from("ai_output_reviews").insert({
          output_id: id,
          reviewer_user_id: guard.user?.id ?? null,
          review_status: "approved",
          review_notes:
            asString(body.reviewNotes) ||
            "Artifact approved inside AI Assets. This does not approve sending, publishing, submitting, charging, changing pricing, changing campaigns, or committing spend.",
          checklist: {
            artifactApproval: true,
            verifiedAt: now,
            verifiedRequiredChecks: requiredChecks.map((check) => check.label),
            safetyBoundary:
              "Reusable artifact approval only. Execution approval remains required in the owning workflow.",
          },
        });

        const ledgerResult = await syncAiOutputLedger(
          {
            id: output.id,
            title: String(output.title ?? "AI output"),
            agentName: output.agent_name,
            workflow: output.workflow,
            outputType: output.output_type,
            approvalStatus: String(output.approval_status ?? "approved"),
            verificationStatus: output.verification_status,
            winningOutput: Boolean(output.winning_output),
            metadata: isRecord(output.metadata) ? output.metadata : {},
            ownerUserId: output.owner_user_id,
            createdAt: output.created_at,
            updatedAt: output.updated_at,
          },
          {
            actorId: guard.user?.id ?? null,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_artifact_approved",
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai artifact approval sync skipped:", ledgerResult.error);
        }

        return NextResponse.json({
          ok: true,
          message: "Artifact approved and required verification checks recorded.",
        });
      }

      case "mark_winning_output": {
        const id = requiredString(body.id, "Output id");
        const output = await fetchOutput(db, id);
        if (
          output.approval_status !== "approved" ||
          output.verification_status !== "verified"
        ) {
          return NextResponse.json(
            {
              error:
                "Only approved and verified AI outputs can be marked as winning outputs.",
            },
            { status: 409 },
          );
        }
        const { data: updated, error } = await db
          .from("ai_outputs")
          .update({ winning_output: true, updated_at: now })
          .eq("id", id)
          .select("id,title,agent_name,workflow,output_type,approval_status,verification_status,winning_output,metadata,owner_user_id,created_at,updated_at")
          .single();
        if (error) throw error;

        const ledgerResult = await syncAiOutputLedger(
          {
            id: updated.id,
            title: String(updated.title ?? "AI output"),
            agentName: updated.agent_name,
            workflow: updated.workflow,
            outputType: updated.output_type,
            approvalStatus: String(updated.approval_status ?? "approved"),
            verificationStatus: updated.verification_status,
            winningOutput: Boolean(updated.winning_output),
            metadata: isRecord(updated.metadata) ? updated.metadata : {},
            ownerUserId: updated.owner_user_id,
            createdAt: updated.created_at,
            updatedAt: updated.updated_at,
          },
          {
            actorId: guard.user?.id ?? null,
            actorLabel: guard.user?.email ?? "admin",
            eventType: "ai_output_marked_winning",
          },
        );
        if (!ledgerResult.ok && ledgerResult.error) {
          console.warn("[approval-ledger] ai output winning sync skipped:", ledgerResult.error);
        }
        return NextResponse.json({ ok: true, message: "Marked as winning output." });
      }

      case "save_output_as_sop": {
        const output = await fetchOutput(db, requiredString(body.id, "Output id"));
        const { data, error } = await db
          .from("ai_prompt_sops")
          .insert({
            prompt_name: `${output.title} SOP`,
            category: output.workflow || "Prior winning prompts",
            purpose: `Reusable SOP generated from reviewed output: ${output.title}`,
            required_inputs: ["HomeReach business context", "Relevant data source", "Workflow inputs"],
            prompt_text: output.content,
            output_format: "Winning output pattern. Include assumptions, verification risks, and next action.",
            approval_requirement: "Human approval required before customer-facing or high-stakes use.",
            tags: ["winning-output", "saved-from-review"],
            related_workflow: output.workflow,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Saved as reusable SOP." });
      }

      case "add_output_to_data_sources": {
        const output = await fetchOutput(db, requiredString(body.id, "Output id"));
        const { data, error } = await db
          .from("ai_data_sources")
          .insert({
            title: output.title,
            category: "Prior winning prompts",
            description: `Reusable AI output from ${output.agent_name ?? "HomeReach AI"}.`,
            content: output.content,
            tags: ["winning-output", output.output_type ?? "draft"].filter(Boolean),
            related_workflow: output.workflow,
            quality_rating: output.winning_output ? 5 : 4,
            owner_user_id: guard.user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        return NextResponse.json({ ok: true, id: data.id, message: "Added to data sources." });
      }

      case "update_verification_check": {
        const id = requiredString(body.id, "Check id");
        const status = normalizeVerificationStatus(body.status);
        const { error } = await db
          .from("ai_verification_checks")
          .update({
            status,
            notes: asString(body.notes) || null,
            completed_by: status === "verified" ? guard.user?.id ?? null : null,
            completed_at: status === "verified" ? now : null,
            updated_at: now,
          })
          .eq("id", id);
        if (error) throw error;
        return NextResponse.json({ ok: true, message: "Verification check updated." });
      }

      default:
        return NextResponse.json({ error: "Unknown AI Assets action." }, { status: 400 });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI Assets action failed.";
    const status = message.includes("does not exist") || message.includes("relation") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(value: unknown, label: string): string {
  const text = asString(value);
  if (!text) throw new Error(`${label} is required.`);
  return text;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  return asString(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function clampRating(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.min(5, Math.max(1, Math.round(parsed)));
}

function normalizeApprovalStatus(value: unknown) {
  const status = asString(value);
  if (["approved", "rejected", "revision_needed", "archived", "draft"].includes(status)) return status;
  return "needs_review";
}

function normalizeVerificationStatus(value: unknown) {
  const status = asString(value);
  if (["verified", "failed", "needs_review"].includes(status)) return status;
  return "not_started";
}

async function fetchOutput(db: ReturnType<typeof createServiceClient>, id: string) {
  const { data, error } = await db
    .from("ai_outputs")
    .select("id,title,agent_name,workflow,output_type,content,winning_output,approval_status,verification_status")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as {
    id: string;
    title: string;
    agent_name: string | null;
    workflow: string | null;
    output_type: string | null;
    content: string;
    winning_output: boolean;
    approval_status: string | null;
    verification_status: string | null;
  };
}

async function requiredChecksVerified(
  db: ReturnType<typeof createServiceClient>,
  outputId: string,
) {
  const data = await ensureOutputVerificationChecks(db, outputId);
  const requiredChecks = data.filter((check) => check.required);

  return Boolean(requiredChecks.length) && requiredChecks.every((check) => check.status === "verified");
}

async function ensureOutputVerificationChecks(
  db: ReturnType<typeof createServiceClient>,
  outputId: string,
) {
  const existing = await fetchOutputVerificationChecks(db, outputId);
  if (existing.length > 0) return existing;

  const { error } = await db.from("ai_verification_checks").insert(
    DEFAULT_VERIFICATION_CHECKS.map(([label, category]) => ({
      output_id: outputId,
      label,
      category,
      required: true,
      notes: "Required artifact-level verification check.",
    })),
  );
  if (error) throw error;

  return fetchOutputVerificationChecks(db, outputId);
}

async function fetchOutputVerificationChecks(
  db: ReturnType<typeof createServiceClient>,
  outputId: string,
) {
  const { data, error } = await db
    .from("ai_verification_checks")
    .select("id,label,status,required")
    .eq("output_id", outputId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    label: string;
    status: string | null;
    required: boolean;
  }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
