import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import {
  getGrowthIntegrationStatuses,
  type GrowthIntegrationStatus,
} from "@/lib/growth-engine/integrations";
import type { ApprovalSpineItem, ApprovalSpineSummary } from "./types";
import {
  loadApprovalLedgerQueue,
  loadApprovalLedgerStatus,
  type ApprovalLedgerStatus,
} from "./ledger-status";

type GenericRow = Record<string, unknown>;
type ApprovalSpineDraft = Omit<
  ApprovalSpineItem,
  "sourceKey" | "sourceSystem" | "sourceTable" | "sourceId" | "domain" | "approvalKind"
> &
  Partial<
    Pick<ApprovalSpineItem, "sourceKey" | "sourceSystem" | "sourceTable" | "sourceId" | "domain" | "approvalKind">
  >;

export type ApprovalSpineData = {
  queue: ApprovalSpineItem[];
  summary: ApprovalSpineSummary;
  ledgerStatus: ApprovalLedgerStatus;
  queueSource: "projected" | "ledger";
  integrationStatuses: GrowthIntegrationStatus[];
  errors: string[];
};

type ApprovalSpineOptions = {
  mode?: "view" | "sync";
};

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function formatCents(value: unknown) {
  const cents = Number(value ?? 0);
  if (!Number.isFinite(cents) || cents === 0) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function priorityRank(priority: ApprovalSpineItem["priority"]) {
  if (priority === "critical") return 3;
  if (priority === "high") return 2;
  return 1;
}

function sourceMetadata(item: ApprovalSpineDraft) {
  const bySource: Record<
    string,
    Pick<ApprovalSpineItem, "sourceSystem" | "sourceTable" | "domain" | "approvalKind">
  > = {
    "Daily Content": {
      sourceSystem: "daily_content",
      sourceTable: "daily_video_content",
      domain: "daily_content",
      approvalKind: "content_video_review",
    },
    "Platform Post": {
      sourceSystem: "daily_content",
      sourceTable: "daily_video_platform_posts",
      domain: "social",
      approvalKind: "platform_post_review",
    },
    "AI Assets": {
      sourceSystem: "ai_assets",
      sourceTable: "ai_outputs",
      domain: "ai_assets",
      approvalKind: "ai_output_review",
    },
    "Revenue Approval": {
      sourceSystem: "revenue_messaging",
      sourceTable: "revenue_message_approval_queue",
      domain: "revenue",
      approvalKind: "outbound_message_review",
    },
    "Content Intel": {
      sourceSystem: "content_intelligence",
      sourceTable: "ci_insights",
      domain: "operations",
      approvalKind: "learning_signal_review",
    },
    Publication: {
      sourceSystem: "social_content",
      sourceTable: "social_publication_records",
      domain: "social",
      approvalKind: "publication_record_review",
    },
    "Facebook Draft": {
      sourceSystem: "facebook",
      sourceTable: "facebook_messages",
      domain: "revenue",
      approvalKind: "facebook_reply_review",
    },
    Creative: {
      sourceSystem: "creative_studio",
      sourceTable: "creative_assets",
      domain: "creative",
      approvalKind: "creative_asset_review",
    },
    Procurement: {
      sourceSystem: "operations_copilot",
      sourceTable: null,
      domain: "procurement",
      approvalKind: "procurement_review",
    },
    "Gov Contracts": {
      sourceSystem: "gov_contracts",
      sourceTable: null,
      domain: "gov_contracts",
      approvalKind: "bid_review",
    },
    Political: {
      sourceSystem: "political",
      sourceTable: "political_mail_launch_plans",
      domain: "political",
      approvalKind: "political_plan_review",
    },
    SEO: {
      sourceSystem: "seo_engine",
      sourceTable: "seo_pages",
      domain: "seo",
      approvalKind: "seo_page_review",
    },
    "Agent Execution": {
      sourceSystem: "agent_execution",
      sourceTable: "agent_execution_queue",
      domain: "operations",
      approvalKind: "agent_execution_task",
    },
  };
  const metadata = bySource[item.source] ?? {
    sourceSystem: "unknown",
    sourceTable: null,
    domain: "other" as const,
    approvalKind: "manual_review",
  };

  return {
    ...metadata,
    sourceId: item.id,
    sourceKey: `${metadata.sourceSystem}:${metadata.sourceTable ?? item.actionTarget.kind}:${item.id}`,
  };
}

function pushQueueItem(queue: ApprovalSpineItem[], item: ApprovalSpineDraft) {
  queue.push({
    ...sourceMetadata(item),
    ...item,
  });
}

function buildSourceKey(sourceTable: string, sourceId: unknown, approvalKind: string) {
  return `${sourceTable}:${String(sourceId)}:${approvalKind}`;
}

async function queryMaybe<T extends GenericRow[]>(
  label: string,
  run: () => PromiseLike<{ data: T | null; error: { message?: string; code?: string } | null }>,
): Promise<{ data: T; error: string | null }> {
  try {
    const result = await run();
    if (result.error) return { data: [] as unknown as T, error: `${label}: ${result.error.message ?? result.error.code}` };
    return { data: (result.data ?? []) as T, error: null };
  } catch (error) {
    return { data: [] as unknown as T, error: `${label}: ${error instanceof Error ? error.message : "unknown error"}` };
  }
}

function buildSummary(
  queue: ApprovalSpineItem[],
  integrationStatuses: GrowthIntegrationStatus[],
): ApprovalSpineSummary {
  const summary: ApprovalSpineSummary = {
    total: queue.length,
    blocked: queue.filter((item) => item.lane === "blocked").length,
    needsApproval: queue.filter((item) => item.lane === "needs_approval").length,
    readyToSend: queue.filter((item) => item.lane === "ready_to_send").length,
    readyToPublish: queue.filter((item) => item.lane === "ready_to_publish").length,
    learning: queue.filter((item) => item.lane === "learning").length,
    highPriority: queue.filter((item) => item.priority !== "normal").length,
    providerBlocked: integrationStatuses.filter((status) => status.state === "needs_config" || status.state === "blocked").length,
    publishReady: integrationStatuses.filter((status) => status.canPublish).length,
    nextFocus: "Review blocked and ready-to-send items first, then approve new content drafts.",
    sourceCounts: {
      revenue: queue.filter((item) => item.source === "Revenue Approval").length,
      procurement: queue.filter((item) => item.source === "Procurement").length,
      govContracts: queue.filter((item) => item.source === "Gov Contracts").length,
      political: queue.filter((item) => item.source === "Political").length,
      aiAssets: queue.filter((item) => item.source === "AI Assets").length,
      creative: queue.filter((item) => item.source === "Creative").length,
      dailyContent: queue.filter((item) => item.source === "Daily Content").length,
      platformPosts: queue.filter((item) => item.source === "Platform Post").length,
      facebookDrafts: queue.filter((item) => item.source === "Facebook Draft").length,
    },
  };

  if (summary.blocked > 0) {
    summary.nextFocus = "Clear blocked publish or provider issues before creating more content volume.";
  } else if (summary.readyToSend > 0) {
    summary.nextFocus = "Send only approved one-to-one messages that still fit deliverability and owner timing.";
  } else if (summary.readyToPublish > 0) {
    summary.nextFocus = "Publish approved packets manually, then capture proof URLs and metrics.";
  } else if (summary.needsApproval > 0) {
    summary.nextFocus = "Approve or revise drafts so production can keep moving.";
  }

  return summary;
}

export async function loadApprovalSpine(
  options: ApprovalSpineOptions = {},
): Promise<ApprovalSpineData> {
  const db = createServiceClient();
  const integrationStatuses = getGrowthIntegrationStatuses();
  const mode = options.mode ?? "view";
  const sourceLimit = mode === "sync" ? 200 : undefined;
  const finalQueueLimit = mode === "sync" ? null : 60;

  const [
    dailyVideos,
    platformPosts,
    aiOutputs,
    revenueApprovals,
    contentIntel,
    publications,
    facebookDrafts,
    creativeAssets,
    procurementSavings,
    procurementInvoiceAudits,
    procurementActionRequests,
    adTechApprovals,
    adTechLaunchPackages,
    govBidRooms,
    govSubmissionPackages,
    politicalPlans,
    seoPages,
    politicalProposals,
    agentExecutionTasks,
  ] = await Promise.all([
    queryMaybe("daily videos", () =>
      db
        .from("daily_video_content")
        .select("id,title,status,approval_status,content_date,vertical,video_hook,created_at")
        .in("status", ["awaiting_approval", "needs_revision", "approved", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("platform posts", () =>
      db
        .from("daily_video_platform_posts")
        .select("id,video_id,platform,status,recommended_posting_time,external_url,published_at,created_at")
        .in("status", ["draft", "approved", "manual_publish_ready", "scheduled", "failed"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 30),
    ),
    queryMaybe("AI outputs", () =>
      db
        .from("ai_outputs")
        .select("id,title,approval_status,verification_status,workflow,output_type,winning_output,created_at")
        .in("approval_status", ["needs_review", "revision_needed", "approved"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 25),
    ),
    queryMaybe("revenue approvals", () =>
      db
        .from("revenue_message_approval_queue")
        .select("id,title,status,channel,business_line,message_body,created_at,due_at")
        .in("status", ["draft", "needs_review", "approved", "scheduled"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 25),
    ),
    queryMaybe("content intelligence", () =>
      db
        .from("ci_insights")
        .select("id,category,theme,insight_text,status,apex_score,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("publication records", () =>
      db
        .from("social_publication_records")
        .select("id,platform,status,approval_status,external_url,published_at,created_at")
        .in("status", ["manual_publish_ready", "scheduled", "failed", "blocked"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 25),
    ),
    queryMaybe("Facebook drafts", () =>
      db
        .from("facebook_messages")
        .select("id,lead_id,message,delivery_status,approval_status,requires_approval,proposed_action,source,error_detail,sent_at")
        .eq("delivery_status", "draft")
        .in("approval_status", ["pending", "approved", "rejected"])
        .order("sent_at", { ascending: false })
        .limit(sourceLimit ?? 30),
    ),
    queryMaybe("creative assets", () =>
      db
        .from("creative_assets")
        .select("id,offer_key,asset_type,platform,status,approval_status,compliance_review_status,quality_score,best_use_case,recommended_improvement,created_at")
        .in("approval_status", ["needs_review", "needs_revision", "approved"])
        .order("created_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("procurement savings", () =>
      db
        .from("opcopilot_savings_recommendations")
        .select("id,title,summary,status,approval_required,projected_monthly_savings_cents,confidence,created_at,updated_at")
        .in("status", ["pending_approval", "needs_review", "open"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("procurement invoice audits", () =>
      db
        .from("opcopilot_invoice_audits")
        .select("id,issue_summary,recommended_action,status,variance_cents,created_at,updated_at")
        .in("status", ["needs_review", "open", "pending_approval"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("procurement action requests", () =>
      db
        .from("opcopilot_action_requests")
        .select("id,action_type,title,status,estimated_spend_cents,estimated_savings_cents,confidence,risk_score,created_at,updated_at")
        .in("status", ["pending_approval", "approved", "rejected"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("ad-tech approvals", () =>
      db
        .from("campaign_approvals")
        .select("id,approval_type,status,notes,requested_by,responded_at,updated_at,created_at")
        .in("status", ["awaiting_approval", "needs_changes", "approved", "rejected", "question"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 30),
    ),
    queryMaybe("ad-tech launch packages", () =>
      db
        .from("campaign_launch_packages")
        .select("id,package_name,package_status,readiness_score,ready_status,recommended_next_action,client_approval_status,admin_approval_status,updated_at,created_at")
        .in("package_status", ["needs_review", "ready_for_launch", "launch_completed_manually"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("gov contract bid rooms", () =>
      db
        .from("gov_contract_bid_rooms")
        .select("id,opportunity_id,bid_stage,approval_status,submission_readiness_score,updated_at,created_at")
        .in("approval_status", ["not_requested", "needs_review", "ready_to_submit"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("gov contract submission packages", () =>
      db
        .from("gov_contract_submission_packages")
        .select("id,opportunity_id,package_name,status,approval_status,deadline_at,created_at,updated_at")
        .in("approval_status", ["not_requested", "needs_review", "ready_to_submit"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("political launch plans", () =>
      db
        .from("political_mail_launch_plans")
        .select("id,plan_name,status,candidate_summary,recommended_strategy,total_estimated_cost_cents,confidence_score,created_at,updated_at")
        .in("status", ["draft", "needs_review", "proposal_ready", "production_ready"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("seo pages", () =>
      db
        .from("seo_pages")
        .select("id,slug,page_type,status,title_tag,h1,meta_description,created_at,updated_at")
        .in("status", ["draft", "review", "approved"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("political proposals", () =>
      db
        .from("political_proposals")
        .select("id,status,households,drops,total_pieces,total_investment_cents,delivery_window_text,expires_at,created_at,updated_at")
        .in("status", ["sent", "viewed"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
    queryMaybe("agent execution tasks", () =>
      db
        .from("agent_execution_queue")
        .select("id,task_id,mini_app_id,source_agent,task_type,target_system,target_url,permission_scope,status,human_approval_required,approved_at,manual_takeover_required,dry_run_enabled,failure_reason,retry_allowed,sensitive_action_flags,created_at,updated_at")
        .in("status", ["pending_approval", "approved", "dry_run_ready", "failed", "manual_takeover_required", "manual_takeover_needed"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit ?? 20),
    ),
  ]);

  const queue: ApprovalSpineItem[] = [];

  dailyVideos.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("daily_video_content", row.id, "content_approval"),
      sourceSystem: "daily_content",
      sourceTable: "daily_video_content",
      sourceId: String(row.id),
      domain: "daily_content",
      approvalKind: "content_approval",
      source: "Daily Content",
      title: String(row.title ?? "Daily video draft"),
      detail: `${String(row.vertical ?? "content")} - ${String(row.video_hook ?? "")}`,
      status: String(row.status ?? row.approval_status ?? "needs_review"),
      href: "/admin/daily-content",
      priority: row.status === "needs_revision" ? "high" : "normal",
      lane: "needs_approval",
      nextAction: row.status === "needs_revision"
        ? "Review revision notes and approve only after the draft is production-ready."
        : "Approve or request revision before any platform packet is prepared.",
      guardrail: "Approval updates the content record only. It does not publish or schedule externally.",
      createdAt: asString(row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "daily_video",
        id: String(row.id),
        status: String(row.status ?? row.approval_status ?? "needs_review"),
      },
    });
  });

  platformPosts.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("daily_video_platform_posts", row.id, "manual_publish_packet"),
      sourceSystem: "daily_content",
      sourceTable: "daily_video_platform_posts",
      sourceId: String(row.id),
      domain: "social",
      approvalKind: "manual_publish_packet",
      source: "Platform Post",
      title: `${String(row.platform ?? "social")} post`,
      detail: `Recommended time: ${String(row.recommended_posting_time ?? "not set")}`,
      status: String(row.status ?? "draft"),
      href: "/admin/daily-content",
      priority: row.status === "failed" ? "critical" : row.status === "manual_publish_ready" ? "high" : "normal",
      lane: row.status === "failed" ? "blocked" : row.status === "manual_publish_ready" ? "ready_to_publish" : "needs_approval",
      nextAction:
        row.status === "failed"
          ? "Open the platform post, review failure details, and reset only after the destination issue is clear."
          : row.status === "manual_publish_ready"
            ? "Use the manual packet to post from the approved platform workflow."
            : "Prepare the manual publish packet after the parent content is approved.",
      guardrail: "Platform actions still require approved source content and destination-specific checks.",
      createdAt: asString(row.created_at),
      dueAt: asString(row.recommended_posting_time),
      actionTarget: {
        kind: "platform_post",
        id: String(row.id),
        videoId: String(row.video_id ?? ""),
        status: String(row.status ?? "draft"),
      },
    });
  });

  aiOutputs.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("ai_outputs", row.id, "ai_output_review"),
      sourceSystem: "ai_assets",
      sourceTable: "ai_outputs",
      sourceId: String(row.id),
      domain: "ai_assets",
      approvalKind: "ai_output_review",
      source: "AI Assets",
      title: String(row.title ?? "AI output"),
      detail: `${String(row.workflow ?? "workflow")} - ${String(row.output_type ?? "draft")}`,
      status: `${String(row.approval_status ?? "needs_review")} / ${String(row.verification_status ?? "pending")}`,
      href: "/admin/ai-assets",
      priority: row.approval_status === "approved" && row.verification_status !== "verified" ? "high" : "normal",
      lane: row.approval_status === "approved" && row.verification_status === "verified" ? "learning" : "needs_approval",
      nextAction:
        row.approval_status === "approved" && row.verification_status === "verified"
          ? "Mark as a winning pattern only if it should shape future generation."
          : "Approve, reject, or request revision before the artifact is reused.",
      guardrail: "AI artifact approval does not authorize outbound use, publishing, charging, pricing changes, or campaign changes.",
      createdAt: asString(row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "ai_output",
        id: String(row.id),
        status: `${String(row.approval_status ?? "needs_review")} / ${String(row.verification_status ?? "pending")}`,
        isWinning: Boolean(row.winning_output),
      },
    });
  });

  revenueApprovals.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("revenue_message_approval_queue", row.id, "outbound_message"),
      sourceSystem: "revenue_messaging",
      sourceTable: "revenue_message_approval_queue",
      sourceId: String(row.id),
      domain: "revenue",
      approvalKind: "outbound_message",
      source: "Revenue Approval",
      title: String(row.title ?? "Message approval"),
      detail: `${String(row.business_line ?? "revenue")} - ${String(row.channel ?? "message")}`,
      status: String(row.status ?? "needs_review"),
      href: "/admin/revenue-operations",
      priority: row.status === "approved" || row.status === "scheduled" ? "high" : "normal",
      lane: row.status === "approved" && String(row.channel ?? "").toLowerCase() === "email" ? "ready_to_send" : "needs_approval",
      nextAction:
        row.status === "approved" && String(row.channel ?? "").toLowerCase() === "email"
          ? "Send only if the owner is ready for this one approved email to go out."
          : "Review the draft and approve or reject before any customer-facing action.",
      guardrail: "Revenue draft approval is separate from sending and never changes pricing, payments, or campaigns.",
      createdAt: asString(row.created_at),
      dueAt: asString(row.due_at),
      actionTarget: {
        kind: "revenue_approval",
        id: String(row.id),
        status: String(row.status ?? "needs_review"),
        channel: String(row.channel ?? "message"),
        messageBody: asString(row.message_body),
      },
    });
  });

  contentIntel.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("ci_insights", row.id, "content_signal_review"),
      sourceSystem: "content_intel",
      sourceTable: "ci_insights",
      sourceId: String(row.id),
      domain: "operations",
      approvalKind: "content_signal_review",
      source: "Content Intel",
      title: String(row.theme ?? row.category ?? "Content signal"),
      detail: String(row.insight_text ?? ""),
      status: `APEX ${String(row.apex_score ?? "n/a")} - ${String(row.status ?? "pending")}`,
      href: "/admin/content-intel",
      priority: Number(row.apex_score ?? 0) >= 15 ? "high" : "normal",
      lane: "learning",
      nextAction: "Use this signal to shape drafts only if it fits the approved HomeReach positioning.",
      guardrail: "Content intelligence is advisory until reviewed and connected to an approved workflow.",
      createdAt: asString(row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.status ?? "pending"),
      },
    });
  });

  publications.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("social_publication_records", row.id, "publication_record"),
      sourceSystem: "social_content",
      sourceTable: "social_publication_records",
      sourceId: String(row.id),
      domain: "social",
      approvalKind: "publication_record",
      source: "Publication",
      title: `${String(row.platform ?? "social")} publication`,
      detail: String(row.external_url ?? "No public URL captured yet"),
      status: String(row.status ?? "manual_publish_ready"),
      href: "/admin/daily-content",
      priority: row.status === "failed" || row.status === "blocked" ? "critical" : "high",
      lane: row.status === "failed" || row.status === "blocked" ? "blocked" : "ready_to_publish",
      nextAction:
        row.status === "failed" || row.status === "blocked"
          ? "Resolve the destination, approval, or account issue before another publish attempt."
          : "Capture proof, external URL, and metrics after the manual publish step is complete.",
      guardrail: "Publication records are operational evidence; they do not bypass human approval.",
      createdAt: asString(row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.status ?? "manual_publish_ready"),
      },
    });
  });

  facebookDrafts.data.forEach((row) => {
    const status = String(row.approval_status ?? "pending");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("facebook_messages", row.id, "facebook_dm"),
      sourceSystem: "facebook",
      sourceTable: "facebook_messages",
      sourceId: String(row.id),
      domain: "social",
      approvalKind: "facebook_dm",
      source: "Facebook Draft",
      title: status === "approved" ? "Approved Facebook reply" : status === "rejected" ? "Rejected Facebook reply" : "Facebook reply needs approval",
      detail: String(row.message ?? ""),
      status: `${status} / ${String(row.proposed_action ?? row.source ?? "manual review")}`,
      href: "/admin/facebook",
      priority: status === "approved" || status === "pending" ? "high" : "normal",
      lane: status === "approved" ? "ready_to_send" : status === "pending" ? "needs_approval" : "learning",
      nextAction: status === "approved" ? "Send only if this specific DM has been human-approved for this lead." : "Approve or reject the reply draft before any outbound message.",
      guardrail: "Facebook sends remain one-at-a-time behind approval, reputation, and account controls.",
      createdAt: asString(row.sent_at),
      dueAt: null,
      actionTarget: {
        kind: "facebook_draft",
        id: String(row.id),
        status: `${status} / ${String(row.proposed_action ?? row.source ?? "manual review")}`,
      },
    });
  });

  creativeAssets.data.forEach((row) => {
    const approvalStatus = String(row.approval_status ?? "needs_review");
    const complianceStatus = String(row.compliance_review_status ?? "not_required");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("creative_assets", row.id, "creative_review"),
      sourceSystem: "creative_studio",
      sourceTable: "creative_assets",
      sourceId: String(row.id),
      domain: "creative",
      approvalKind: "creative_review",
      source: "Creative",
      title: `${String(row.offer_key ?? "creative")} ${String(row.asset_type ?? "asset").replaceAll("_", " ")}`,
      detail: `${String(row.platform ?? "platform")} - quality ${String(row.quality_score ?? 0)}/10. ${String(row.best_use_case ?? row.recommended_improvement ?? "")}`,
      status: `${approvalStatus} / compliance ${complianceStatus}`,
      href: "/admin/creative-studio",
      priority: complianceStatus === "blocked" ? "critical" : approvalStatus === "needs_review" || complianceStatus === "needs_review" ? "high" : "normal",
      lane: complianceStatus === "blocked" ? "blocked" : approvalStatus === "approved" && complianceStatus === "approved" ? "learning" : "needs_approval",
      nextAction: "Approve, revise, or block the creative asset before it is used in campaigns, proposals, posts, or outreach.",
      guardrail: "Creative review does not publish, send, mark print-ready, or attach the asset to a live campaign.",
      createdAt: asString(row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: `${approvalStatus} / ${complianceStatus}`,
      },
    });
  });

  procurementSavings.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("opcopilot_savings_recommendations", row.id, "savings_recommendation"),
      sourceSystem: "operations_copilot",
      sourceTable: "opcopilot_savings_recommendations",
      sourceId: String(row.id),
      domain: "procurement",
      approvalKind: "savings_recommendation",
      source: "Procurement",
      title: String(row.title ?? "Savings recommendation"),
      detail: `${formatCents(row.projected_monthly_savings_cents)} monthly signal - ${String(row.summary ?? "")}`,
      status: String(row.status ?? "pending_approval"),
      href: "/admin/procurement",
      priority: Number(row.projected_monthly_savings_cents ?? 0) >= 50000 ? "high" : "normal",
      lane: "needs_approval",
      nextAction: "Review the savings basis and owner impact before recommending any vendor, purchasing, or spend action.",
      guardrail: "Procurement review may recommend but never places orders, switches vendors, or commits spend.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.status ?? "pending_approval"),
      },
    });
  });

  procurementInvoiceAudits.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("opcopilot_invoice_audits", row.id, "invoice_audit"),
      sourceSystem: "operations_copilot",
      sourceTable: "opcopilot_invoice_audits",
      sourceId: String(row.id),
      domain: "procurement",
      approvalKind: "invoice_audit",
      source: "Procurement",
      title: String(row.issue_summary ?? "Invoice audit needs review"),
      detail: `${formatCents(row.variance_cents)} variance - ${String(row.recommended_action ?? "")}`,
      status: String(row.status ?? "needs_review"),
      href: "/admin/procurement",
      priority: Math.abs(Number(row.variance_cents ?? 0)) >= 25000 ? "high" : "normal",
      lane: "needs_approval",
      nextAction: "Confirm invoice details and owner approval before requesting vendor changes, credits, or purchasing action.",
      guardrail: "Invoice review does not dispute charges, approve credits, or change supplier behavior automatically.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.status ?? "needs_review"),
      },
    });
  });

  procurementActionRequests.data.forEach((row) => {
    const riskScore = Number(row.risk_score ?? 0);
    const spend = Number(row.estimated_spend_cents ?? 0);
    const status = String(row.status ?? "pending_approval");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("opcopilot_action_requests", row.id, "procurement_action_request"),
      sourceSystem: "operations_copilot",
      sourceTable: "opcopilot_action_requests",
      sourceId: String(row.id),
      domain: "procurement",
      approvalKind: "procurement_action_request",
      source: "Procurement",
      title: String(row.title ?? "Procurement action request"),
      detail: `${String(row.action_type ?? "action")} - spend ${formatCents(spend)} - savings ${formatCents(row.estimated_savings_cents)}`,
      status,
      href: "/admin/procurement",
      priority: spend >= 100000 || riskScore >= 75 ? "high" : "normal",
      lane: status === "pending_approval" ? "needs_approval" : "learning",
      nextAction:
        status === "pending_approval"
          ? "Approve or reject the procurement action request before any spend-sensitive work advances."
          : "Carry approved procurement requests forward manually; rejected requests stay closed unless reworked.",
      guardrail: "Procurement action requests may recommend owner actions but do not place orders or commit spend.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  adTechApprovals.data.forEach((row) => {
    const status = String(row.status ?? "awaiting_approval");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("campaign_approvals", row.id, "ad_tech_campaign_approval"),
      sourceSystem: "ad_tech",
      sourceTable: "campaign_approvals",
      sourceId: String(row.id),
      domain: "ad_tech",
      approvalKind: "ad_tech_campaign_approval",
      source: "Ad-Tech",
      title: `${String(row.approval_type ?? "campaign").replaceAll("_", " ")} approval`,
      detail: String(row.notes ?? "Campaign approval requires explicit human review before launch."),
      status,
      href: "/admin/ad-tech",
      priority: row.approval_type === "launch_package" ? "high" : "normal",
      lane: status === "approved" || status === "rejected" ? "learning" : "needs_approval",
      nextAction:
        status === "approved"
          ? "Keep the campaign package moving only through the approved manual launch workflow."
          : "Approve, reject, or request changes before any paid launch action advances.",
      guardrail: "Ad-Tech approvals prepare manual launch readiness only. They never authorize automatic paid spend.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: asString(row.responded_at),
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  adTechLaunchPackages.data.forEach((row) => {
    const packageStatus = String(row.package_status ?? "needs_review");
    const readinessScore = Number(row.readiness_score ?? 0);
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("campaign_launch_packages", row.id, "ad_tech_launch_package"),
      sourceSystem: "ad_tech",
      sourceTable: "campaign_launch_packages",
      sourceId: String(row.id),
      domain: "ad_tech",
      approvalKind: "ad_tech_launch_package",
      source: "Ad-Tech",
      title: String(row.package_name ?? "Ad-Tech launch package"),
      detail: `Readiness ${readinessScore}% - client ${String(row.client_approval_status ?? "awaiting_approval")} / admin ${String(row.admin_approval_status ?? "needs_review")}`,
      status: packageStatus,
      href: "/admin/ad-tech",
      priority: readinessScore >= 100 ? "critical" : readinessScore >= 70 ? "high" : "normal",
      lane:
        packageStatus === "launch_completed_manually"
          ? "learning"
          : packageStatus === "ready_for_launch"
            ? "ready_to_publish"
            : "needs_approval",
      nextAction:
        packageStatus === "ready_for_launch"
          ? "Admin may complete the manual launch step only after owner timing and platform checks are confirmed."
          : String(row.recommended_next_action ?? "Clear missing launch items before any paid campaign action."),
      guardrail: "Launch packages record manual launch readiness only. They never trigger automatic paid spend.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: packageStatus,
      },
    });
  });

  govBidRooms.data.forEach((row) => {
    const readinessScore = Number(row.submission_readiness_score ?? 0);
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("gov_contract_bid_rooms", row.id, "bid_room_review"),
      sourceSystem: "gov_contracts",
      sourceTable: "gov_contract_bid_rooms",
      sourceId: String(row.id),
      domain: "gov_contracts",
      approvalKind: "bid_room_review",
      source: "Gov Contracts",
      title: `Bid room ${String(row.bid_stage ?? "discovered").replaceAll("_", " ")}`,
      detail: `Submission readiness ${readinessScore}%. Opportunity ${String(row.opportunity_id ?? "unlinked")}`,
      status: String(row.approval_status ?? "not_requested"),
      href: row.opportunity_id ? `/admin/gov-contracts/${encodeURIComponent(String(row.opportunity_id))}/bid-room` : "/admin/gov-contracts",
      priority: readinessScore >= 70 ? "high" : "normal",
      lane: "needs_approval",
      nextAction: "Review bid/no-bid, pricing, compliance, subcontractor, and evidence status in Gov Contracts before submission readiness advances.",
      guardrail: "Gov Contracts is the canonical approval owner. ContractOS packaging cannot submit, certify, approve pricing, or commit subcontractors.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.approval_status ?? "not_requested"),
      },
    });
  });

  govSubmissionPackages.data.forEach((row) => {
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("gov_contract_submission_packages", row.id, "submission_package_review"),
      sourceSystem: "gov_contracts",
      sourceTable: "gov_contract_submission_packages",
      sourceId: String(row.id),
      domain: "gov_contracts",
      approvalKind: "submission_package_review",
      source: "Gov Contracts",
      title: String(row.package_name ?? "Submission package"),
      detail: `Status ${String(row.status ?? "draft")} for opportunity ${String(row.opportunity_id ?? "unlinked")}`,
      status: String(row.approval_status ?? "not_requested"),
      href: row.opportunity_id ? `/admin/gov-contracts/${encodeURIComponent(String(row.opportunity_id))}/review-packet` : "/admin/gov-contracts",
      priority: row.approval_status === "ready_to_submit" ? "critical" : "high",
      lane: row.approval_status === "ready_to_submit" ? "ready_to_send" : "needs_approval",
      nextAction: "Review the packet, deadline, submission method, pricing, and compliance evidence before recording any external submission.",
      guardrail: "This queue records approval state only. It never submits a bid or binds HomeReach.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: asString(row.deadline_at),
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status: String(row.approval_status ?? "not_requested"),
      },
    });
  });

  politicalPlans.data.forEach((row) => {
    const status = String(row.status ?? "draft");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("political_mail_launch_plans", row.id, "political_mail_plan"),
      sourceSystem: "political",
      sourceTable: "political_mail_launch_plans",
      sourceId: String(row.id),
      domain: "political",
      approvalKind: "political_mail_plan",
      source: "Political",
      title: String(row.plan_name ?? "Political mail plan"),
      detail: `${formatCents(row.total_estimated_cost_cents)} estimated cost - ${String(row.recommended_strategy ?? row.candidate_summary ?? "")}`,
      status,
      href: "/admin/political",
      priority: status === "production_ready" ? "critical" : status === "proposal_ready" || status === "needs_review" ? "high" : "normal",
      lane: status === "production_ready" ? "ready_to_publish" : "needs_approval",
      nextAction: "Review geography, timing, cost, compliance notes, and campaign-provided facts before proposal, creative, or outreach use.",
      guardrail: "Political review may use geography and logistics only; it must not infer voter beliefs or create persuasion targeting from ideology.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  seoPages.data.forEach((row) => {
    const status = String(row.status ?? "draft");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("seo_pages", row.id, "seo_page_review"),
      sourceSystem: "seo_engine",
      sourceTable: "seo_pages",
      sourceId: String(row.id),
      domain: "seo",
      approvalKind: "seo_page_review",
      source: "SEO",
      title: String(row.h1 ?? row.title_tag ?? `SEO page /${String(row.slug ?? "")}`),
      detail: `${String(row.page_type ?? "seo_page").replaceAll("_", " ")} page at /${String(row.slug ?? "")}`,
      status,
      href: "/admin/seo-engine",
      priority: status === "approved" || status === "review" ? "high" : "normal",
      lane: status === "approved" ? "ready_to_publish" : "needs_approval",
      nextAction:
        status === "approved"
          ? "Publish only after the approved SEO page passes the final quality, inventory, cap, and rate-limit checks."
          : "Review the SEO page and approve it before any publish action.",
      guardrail: "SEO review never publishes automatically, changes redirects, or bypasses human approval for public-facing claims.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: null,
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  politicalProposals.data.forEach((row) => {
    const status = String(row.status ?? "sent");
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("political_proposals", row.id, "political_proposal"),
      sourceSystem: "political",
      sourceTable: "political_proposals",
      sourceId: String(row.id),
      domain: "political",
      approvalKind: "political_proposal",
      source: "Political",
      title: `Political proposal ${String(row.id).slice(0, 8)}`,
      detail: `${Number(row.households ?? 0).toLocaleString()} households / ${String(row.drops ?? 0)} drops / ${Number(row.total_pieces ?? 0).toLocaleString()} pieces / ${formatCents(row.total_investment_cents)}`,
      status,
      href: "/admin/political",
      priority: status === "viewed" ? "high" : "normal",
      lane: "needs_approval",
      nextAction:
        status === "viewed"
          ? "Follow up on the viewed proposal without changing pricing, terms, or production assumptions outside review."
          : "Wait for the campaign to review the proposal before contract, payment, or production steps advance.",
      guardrail: "Political proposal approval does not authorize production, pricing changes, payment capture outside approved checkout, or prohibited voter targeting.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: asString(row.expires_at),
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  agentExecutionTasks.data.forEach((row) => {
    const status = String(row.status ?? "pending_approval");
    const sensitiveFlags = Array.isArray(row.sensitive_action_flags)
      ? row.sensitive_action_flags.map(String).filter(Boolean)
      : [];
    pushQueueItem(queue, {
      id: String(row.id),
      sourceKey: buildSourceKey("agent_execution_queue", row.id, "agent_execution_task"),
      sourceSystem: "agent_execution",
      sourceTable: "agent_execution_queue",
      sourceId: String(row.id),
      domain: "operations",
      approvalKind: "agent_execution_task",
      source: "Agent Execution",
      title: `${String(row.target_system ?? "External system")} ${String(row.task_type ?? "execution task").replaceAll("_", " ")}`,
      detail: `${String(row.source_agent ?? "agent")} / ${String(row.mini_app_id ?? "mini app")} / ${String(row.permission_scope ?? "read_only")}${typeof row.target_url === "string" && row.target_url ? ` / ${row.target_url}` : ""}`,
      status,
      href: "/admin/agent-execution",
      priority:
        status === "failed" || status === "manual_takeover_required" || status === "manual_takeover_needed"
          ? "critical"
          : sensitiveFlags.length > 0 || String(row.permission_scope ?? "").includes("approval")
            ? "high"
            : "normal",
      lane:
        status === "failed" || status === "manual_takeover_required" || status === "manual_takeover_needed"
          ? "blocked"
          : "needs_approval",
      nextAction:
        status === "pending_approval"
          ? "Review the execution task scope, dry-run checklist, and sensitive-action flags before approving any browser or operator handoff."
          : status === "approved" || status === "dry_run_ready"
            ? "Keep execution in dry-run, draft-only, or manual-takeover mode until the operator confirms the next step."
            : status === "failed"
              ? "Resolve the failure reason and approval scope before retrying the execution task."
              : "An operator needs to take over manually; do not let the task proceed autonomously.",
      guardrail: "Agent Execution prepares dry runs, approval checkpoints, screenshots, and audit logs only. It must not directly automate sensitive external actions without manual governance.",
      createdAt: asString(row.updated_at ?? row.created_at),
      dueAt: asString(row.approved_at),
      actionTarget: {
        kind: "link_only",
        id: String(row.id),
        status,
      },
    });
  });

  const sortedQueue = queue
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority) || Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  const selectedQueue =
    typeof finalQueueLimit === "number" ? sortedQueue.slice(0, finalQueueLimit) : sortedQueue;

  const ledgerStatus = await loadApprovalLedgerStatus(selectedQueue.map((item) => item.sourceKey));
  const ledgerQueue =
    mode === "view" && ledgerStatus.available && ledgerStatus.missingRows === 0
      ? await loadApprovalLedgerQueue(selectedQueue)
      : { items: null, error: null };
  const effectiveQueue = ledgerQueue.items ?? selectedQueue;

  return {
    queue: effectiveQueue,
    summary: buildSummary(effectiveQueue, integrationStatuses),
    ledgerStatus,
    queueSource: ledgerQueue.items ? "ledger" : "projected",
    integrationStatuses,
    errors: [
      dailyVideos.error,
      platformPosts.error,
      aiOutputs.error,
      revenueApprovals.error,
      contentIntel.error,
      publications.error,
      facebookDrafts.error,
      creativeAssets.error,
      procurementSavings.error,
      procurementInvoiceAudits.error,
      procurementActionRequests.error,
      adTechApprovals.error,
      adTechLaunchPackages.error,
      govBidRooms.error,
      govSubmissionPackages.error,
      politicalPlans.error,
      seoPages.error,
      politicalProposals.error,
      agentExecutionTasks.error,
      ledgerStatus.error,
      ledgerQueue.error,
    ].filter(Boolean) as string[],
  };
}
