import "server-only";

import { syncApprovalLedgerPayloads, type ApprovalLedgerPayload } from "@/lib/approvals/ledger";
import { createServiceClient } from "@/lib/supabase/service";
import { isRecentStormEvent, stormReachLookbackHours } from "./geo";
import {
  STORMREACH_OPERATOR_AGENT_NAME,
  STORMREACH_OPERATOR_WORKFLOW,
  buildStormReachOperatorConversationPlaybook,
  buildStormReachOperatorCreativeBrief,
  buildStormReachOperatorHandoffLinks,
  operatorPriority,
  renderStormReachOperatorOutput,
  type StormReachOperatorPackageInput,
} from "./operator-assets";
import { STORMREACH_CORE_CONTRACTOR_INDUSTRIES, stormReachContractorSearchRadiusMiles } from "./prospecting";
import {
  buildCampaignPackagesForStormEvent,
  loadStormReachDashboard,
  loadStormReachEventDetail,
  runStormReachContinuousSweep,
  type StormReachActor,
} from "./repository";
import type { StormDashboardEvent } from "./types";

type ServiceClient = ReturnType<typeof createServiceClient>;
type QueryBuilder = PromiseLike<{ data: unknown; error: { message: string } | null }> & {
  select: (...args: unknown[]) => QueryBuilder;
  eq: (...args: unknown[]) => QueryBuilder;
  in: (...args: unknown[]) => QueryBuilder;
  insert: (...args: unknown[]) => QueryBuilder;
  upsert: (...args: unknown[]) => QueryBuilder;
  maybeSingle: (...args: unknown[]) => QueryBuilder;
};
type Db = Omit<ServiceClient, "from"> & { from(table: string): QueryBuilder };
type JsonRecord = Record<string, unknown>;

export type StormReachOperatorRunResult = {
  ok: boolean;
  job: "stormreach_operator";
  lookbackHours: number;
  contractorSearchRadiusMiles: number;
  industries: string[];
  eventsProcessed: number;
  packagesPrepared: number;
  operatorOutputsCreated: number;
  approvalItemsSynced: number;
  workforceTasksUpserted: number;
  errors: string[];
  sweep: Awaited<ReturnType<typeof runStormReachContinuousSweep>>;
  eventResults: Array<{
    eventId: string;
    eventTitle: string;
    packagesPrepared: number;
    outputsCreated: number;
    taskId: string;
  }>;
};

export async function runStormReachOperatorAgent(options: {
  supabase?: ServiceClient;
  actor?: StormReachActor;
  lookbackHours?: number;
  eventLimit?: number;
  prospectLimit?: number;
  emailLimit?: number;
  assetLimit?: number;
  now?: Date;
} = {}): Promise<StormReachOperatorRunResult> {
  const supabase = options.supabase ?? createServiceClient();
  const db = asDb(supabase);
  const actor = options.actor ?? { label: "stormreach_operator_agent" };
  const lookbackHours = options.lookbackHours ?? stormReachLookbackHours();
  const eventLimit = positiveInteger(options.eventLimit, positiveInteger(process.env.STORMREACH_OPERATOR_EVENT_LIMIT, 8));
  const assetLimit = positiveInteger(options.assetLimit, positiveInteger(process.env.STORMREACH_OPERATOR_ASSET_LIMIT, 12));
  const prospectLimit = positiveInteger(options.prospectLimit, positiveInteger(process.env.STORMREACH_MAX_PROSPECTS_PER_RUN, 500));
  const emailLimit = positiveInteger(options.emailLimit, positiveInteger(process.env.STORMREACH_MAX_DRAFTS_PER_RUN, 500));
  const now = options.now ?? new Date();
  const startedAt = new Date().toISOString();
  const errors: string[] = [];
  const eventResults: StormReachOperatorRunResult["eventResults"] = [];
  let operatorOutputsCreated = 0;
  let approvalItemsSynced = 0;
  let workforceTasksUpserted = 0;

  const sweep = await runStormReachContinuousSweep({
    supabase,
    actor,
    lookbackHours,
    eventLimit,
    prospectLimit,
    emailLimit,
    now,
  });

  if (!sweep.ok) {
    errors.push(...sweep.eventResults.flatMap((result) => [
      result.prospects.error,
      result.outreach.error,
    ]).filter((value): value is string => Boolean(value)));
  }

  const dashboard = await loadStormReachDashboard(supabase);
  const recentEvents = dashboard.events
    .filter((event) => !["archived", "dismissed"].includes(event.status))
    .filter((event) => isRecentStormEvent(event, lookbackHours, now))
    .slice(0, eventLimit);

  for (const event of recentEvents) {
    try {
      await buildCampaignPackagesForStormEvent(event.id, {
        supabase,
        actor,
        industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      });

      const detail = await loadStormReachEventDetail(event.id, supabase);
      const packageRows = detail.packages
        .filter((row) => STORMREACH_CORE_CONTRACTOR_INDUSTRIES.some((industry) => sameIndustry(industry, row.industry)))
        .slice(0, assetLimit) as StormReachOperatorPackageInput[];
      const outputRows = await createOperatorOutputsForEvent(db, event, packageRows, actor);
      operatorOutputsCreated += outputRows.created;
      approvalItemsSynced += outputRows.approvalItemsSynced;

      const taskId = `STORMREACH-OPERATOR-${event.id}`;
      await upsertOperatorTask(db, {
        event,
        taskId,
        actor,
        packagesPrepared: packageRows.length,
        outputsCreated: outputRows.created,
        links: outputRows.links,
      });
      workforceTasksUpserted += 1;

      await createOperatorRecommendation(db, {
        event,
        actor,
        outputsCreated: outputRows.created,
        packagesPrepared: packageRows.length,
      });

      await logOperatorActivity(db, {
        actor,
        event,
        taskId,
        summary: `StormReach Operator prepared ${packageRows.length} campaign package handoffs and ${outputRows.created} creative/conversation assets.`,
        details: {
          packages_prepared: packageRows.length,
          outputs_created: outputRows.created,
          approval_items_synced: outputRows.approvalItemsSynced,
          proposal_links: outputRows.links.map((link) => link.proposalUrl).filter(Boolean),
          intake_links: outputRows.links.map((link) => link.intakeUrl),
          no_external_actions_performed: true,
        },
      });

      eventResults.push({
        eventId: event.id,
        eventTitle: event.title,
        packagesPrepared: packageRows.length,
        outputsCreated: outputRows.created,
        taskId,
      });
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `StormReach Operator failed for ${event.id}.`);
    }
  }

  if (eventResults.length) {
    await createRunSummaryOutput(db, {
      actor,
      lookbackHours,
      sweep,
      eventResults,
      errors,
      outputsCreated: operatorOutputsCreated,
    });
    await createAdminNotification(db, {
      title: "StormReach Operator handoffs ready",
      body: `${eventResults.length} recent storm event${eventResults.length === 1 ? "" : "s"} have approval-ready outreach, geofence, postcard, social creative, and intake/payment handoffs.`,
      severity: errors.length ? "warning" : "success",
      relatedTable: "storm_events",
      relatedId: "stormreach_operator",
      metadata: { events: eventResults.length, outputs_created: operatorOutputsCreated, approval_required: true },
    });
  }

  await db.from("storm_provider_runs").insert({
    provider_key: "stormreach_operator_agent",
    run_type: "autonomous_operator",
    status: errors.length ? "warning" : "completed",
    events_seen: recentEvents.length,
    events_upserted: operatorOutputsCreated,
    errors,
    metadata: {
      lookback_hours: lookbackHours,
      contractor_search_radius_miles: stormReachContractorSearchRadiusMiles(),
      industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
      packages_prepared: eventResults.reduce((sum, result) => sum + result.packagesPrepared, 0),
      approval_items_synced: approvalItemsSynced,
      workforce_tasks_upserted: workforceTasksUpserted,
      no_auto_send: true,
      no_auto_charge: true,
      no_auto_launch: true,
      no_external_actions_performed: true,
    },
    started_at: startedAt,
    completed_at: new Date().toISOString(),
  });

  return {
    ok: errors.length === 0 && sweep.ok,
    job: "stormreach_operator",
    lookbackHours,
    contractorSearchRadiusMiles: stormReachContractorSearchRadiusMiles(),
    industries: STORMREACH_CORE_CONTRACTOR_INDUSTRIES,
    eventsProcessed: recentEvents.length,
    packagesPrepared: eventResults.reduce((sum, result) => sum + result.packagesPrepared, 0),
    operatorOutputsCreated,
    approvalItemsSynced,
    workforceTasksUpserted,
    errors,
    sweep,
    eventResults,
  };
}

async function createOperatorOutputsForEvent(
  db: Db,
  event: StormDashboardEvent,
  packageRows: StormReachOperatorPackageInput[],
  actor?: StormReachActor,
) {
  const links = packageRows.map((packageRow) => buildStormReachOperatorHandoffLinks({ event, packageRow }));
  const titles = packageRows.map((packageRow) => operatorOutputTitle(event, packageRow));
  const existing = titles.length
    ? await db
      .from("ai_outputs")
      .select("id,title")
      .eq("agent_name", STORMREACH_OPERATOR_AGENT_NAME)
      .in("title", titles)
    : { data: [], error: null };
  if (existing.error) throw new Error(existing.error.message);

  const existingTitles = new Set(((existing.data ?? []) as JsonRecord[]).map((row) => String(row.title)));
  const rows = packageRows
    .map((packageRow, index) => {
      const title = operatorOutputTitle(event, packageRow);
      const handoffLinks = links[index] ?? buildStormReachOperatorHandoffLinks({ event, packageRow });
      const conversation = buildStormReachOperatorConversationPlaybook({ event, packageRow, links: handoffLinks });
      const creative = buildStormReachOperatorCreativeBrief({ event, packageRow, links: handoffLinks });

      return {
        title,
        agent_name: STORMREACH_OPERATOR_AGENT_NAME,
        workflow: STORMREACH_OPERATOR_WORKFLOW,
        output_type: "stormreach_operator_handoff",
        content: renderStormReachOperatorOutput({ event, packageRow, links: handoffLinks, conversation, creative }),
        data_sources: ["storm_events", "storm_business_prospects", "storm_outreach_messages", "storm_marketing_packages", "storm_geofence_campaigns", "storm_postcard_campaigns", "approval_ledger"],
        prompt_sop_name: "StormReach Operator Workflow",
        chain_name: "StormReach Post-Storm Revenue Workflow",
        approval_status: "needs_review",
        verification_status: "needs_review",
        status: "active",
        owner_user_id: actor?.id ?? null,
        notes: "Prepared by StormReach Operator Agent. Draft-only until admin approval.",
        metadata: {
          storm_event_id: event.id,
          event_id: event.event_id,
          event_type: event.event_type,
          event_source: event.source,
          event_source_url: event.source_url,
          marketing_package_id: packageRow.id ?? null,
          package_name: packageRow.package_name ?? null,
          industry: packageRow.industry ?? null,
          proposal_url: handoffLinks.proposalUrl,
          intake_url: handoffLinks.intakeUrl,
          payment_status: handoffLinks.paymentStatus,
          payment_action: handoffLinks.paymentAction,
          conversation,
          creative,
          approval_required: true,
          no_auto_send: true,
          no_auto_charge: true,
          no_auto_launch: true,
          no_auto_order: true,
        },
      };
    })
    .filter((row) => !existingTitles.has(row.title));

  if (!rows.length) return { created: 0, approvalItemsSynced: 0, links };

  const { data, error } = await db.from("ai_outputs").insert(rows).select("*");
  if (error) throw new Error(error.message);

  const outputRows = (data ?? []) as JsonRecord[];
  const ledger = await syncApprovalLedgerPayloads(outputRows.map((row) => operatorOutputLedgerPayload(row, event)), {
    actorId: actor?.id ?? null,
    actorLabel: actor?.label ?? STORMREACH_OPERATOR_AGENT_NAME,
    eventType: "stormreach_operator_handoff_synced",
    syncSource: "stormreach_operator",
  });
  if (!ledger.ok && ledger.error) throw new Error(ledger.error);

  return {
    created: outputRows.length,
    approvalItemsSynced: ledger.synced,
    links,
  };
}

function operatorOutputLedgerPayload(output: JsonRecord, event: StormDashboardEvent): ApprovalLedgerPayload {
  const metadata = asObject(output.metadata);
  return {
    source_key: `ai_outputs:${String(output.id)}:stormreach_operator_handoff`,
    source_system: "stormreach",
    source_table: "ai_outputs",
    source_id: String(output.id),
    source_href: `/admin/stormreach/${event.id}?tab=agent`,
    domain: "campaigns",
    approval_kind: "stormreach_operator_handoff",
    title: String(output.title ?? "StormReach Operator handoff"),
    detail: String(output.content ?? "").slice(0, 500),
    source_status: String(output.approval_status ?? "needs_review"),
    approval_state: "needs_review",
    lane: "needs_approval",
    priority: ledgerPriority(event.severity_level),
    approval_required: true,
    human_approval_required: true,
    sensitive_action: true,
    channel: "email",
    next_action: "Approve, revise, or reject the operator handoff before outreach, proposal send, payment link, ad launch, social publishing, or postcard production.",
    guardrail: "StormReach Operator prepares assets only. It does not send, publish, charge, order, or launch without approval.",
    policy_flags: ["no_auto_send", "no_auto_charge", "no_auto_launch", "suppression_required", "can_spam_review", "creative_review_required"],
    compliance_notes: "Keep weather claims source-backed and avoid damage certainty, insurance guarantees, fear tactics, or government affiliation.",
    action_target: {
      kind: "review_only",
      output_id: String(output.id),
      proposal_url: metadata.proposal_url ?? null,
      intake_url: metadata.intake_url ?? null,
      payment_status: metadata.payment_status ?? "approval_required",
    },
    evidence: {
      storm_event_id: event.id,
      event_id: event.event_id,
      event_source: event.source,
      event_source_url: event.source_url,
    },
    metadata: {
      source_label: STORMREACH_OPERATOR_AGENT_NAME,
      ...(metadata ?? {}),
    },
    source_created_at: nullableString(output.created_at),
    source_updated_at: nullableString(output.updated_at) ?? nullableString(output.created_at),
    updated_at: new Date().toISOString(),
  };
}

async function upsertOperatorTask(db: Db, input: {
  event: StormDashboardEvent;
  taskId: string;
  actor?: StormReachActor;
  packagesPrepared: number;
  outputsCreated: number;
  links: Array<{ proposalUrl: string | null; intakeUrl: string; paymentAction: string }>;
}) {
  await db.from("ai_workforce_tasks").upsert({
    task_id: input.taskId,
    workflow_name: STORMREACH_OPERATOR_WORKFLOW,
    requestor: "StormReach System",
    assigned_agent: STORMREACH_OPERATOR_AGENT_NAME,
    priority: operatorPriority(input.event.severity_level),
    status: "awaiting_approval",
    input_path: `/admin/stormreach/${input.event.id}`,
    input_data: {
      event_id: input.event.event_id,
      event_type: input.event.event_type,
      event_title: input.event.title,
      severity_level: input.event.severity_level,
      severity_score: input.event.severity_score,
      source: input.event.source,
      source_url: input.event.source_url,
      packages_prepared: input.packagesPrepared,
      operator_outputs_created: input.outputsCreated,
      proposal_links: input.links.map((link) => link.proposalUrl).filter(Boolean),
      intake_links: input.links.map((link) => link.intakeUrl),
      payment_actions: [...new Set(input.links.map((link) => link.paymentAction))],
      approval_boundary: "No outreach send, conversation send, payment link send, ad launch, social publish, or postcard order without admin approval.",
    },
    expected_output: "Admin reviews StormReach Operator handoffs, approves or revises outreach/conversation drafts, sends approved intake/proposal/payment links, and launches geofence/postcard/social campaigns only after approval.",
    dependencies: ["StormReach weather source", "Suppression list", "Approval ledger", "Campaign package review", "Creative review", "Stripe/payment approval", "External ad platform setup approval"],
    approval_required: true,
    related_campaign: "StormReach",
    related_opportunity: input.event.event_id,
    owner_user_id: input.actor?.id ?? null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "task_id" });
}

async function createOperatorRecommendation(db: Db, input: {
  event: StormDashboardEvent;
  actor?: StormReachActor;
  packagesPrepared: number;
  outputsCreated: number;
}) {
  const title = "StormReach Operator handoff ready";
  const existing = await db
    .from("storm_agent_improvements")
    .select("id")
    .eq("storm_event_id", input.event.id)
    .eq("recommendation_type", "operator_handoff")
    .eq("title", title)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) return;

  await db.from("storm_agent_improvements").insert({
    storm_event_id: input.event.id,
    recommendation_type: "operator_handoff",
    title,
    description: `Review ${input.packagesPrepared} StormReach campaign package handoff${input.packagesPrepared === 1 ? "" : "s"} with outreach, conversation, intake/payment, geofence, postcard, and social creative assets.`,
    priority: operatorPriority(input.event.severity_level),
    status: "needs_review",
    source: "stormreach_operator_agent",
    confidence_score: 86,
    approval_status: "needs_review",
    recommended_by: STORMREACH_OPERATOR_AGENT_NAME,
    metadata: {
      outputs_created: input.outputsCreated,
      packages_prepared: input.packagesPrepared,
      approval_required: true,
      no_auto_send: true,
      no_auto_charge: true,
      no_auto_launch: true,
    },
    created_by: input.actor?.id ?? null,
  });
}

async function createRunSummaryOutput(db: Db, input: {
  actor?: StormReachActor;
  lookbackHours: number;
  sweep: Awaited<ReturnType<typeof runStormReachContinuousSweep>>;
  eventResults: StormReachOperatorRunResult["eventResults"];
  errors: string[];
  outputsCreated: number;
}) {
  await db.from("ai_outputs").insert({
    title: `StormReach Operator Run - ${new Date().toISOString()}`,
    agent_name: STORMREACH_OPERATOR_AGENT_NAME,
    workflow: STORMREACH_OPERATOR_WORKFLOW,
    output_type: "operator_run_report",
    content: [
      `StormReach Operator processed ${input.eventResults.length} event(s) in the last ${input.lookbackHours} hours.`,
      `Prospects inserted: ${input.sweep.prospectsInserted}`,
      `Emails drafted: ${input.sweep.emailsDrafted}`,
      `Operator handoff outputs created: ${input.outputsCreated}`,
      `Approval boundary: no outreach, payment, ad launch, social publishing, or postcard order occurred.`,
      input.errors.length ? `Errors: ${input.errors.join("; ")}` : "Errors: none",
    ].join("\n"),
    data_sources: ["storm_events", "storm_business_prospects", "storm_outreach_messages", "storm_marketing_packages", "ai_workforce_tasks", "approval_ledger"],
    prompt_sop_name: "StormReach Operator Workflow",
    approval_status: "needs_review",
    verification_status: "needs_review",
    status: "active",
    owner_user_id: input.actor?.id ?? null,
    notes: "Run report only. External actions remain approval-gated.",
    metadata: {
      event_results: input.eventResults,
      sweep: {
        events_processed: input.sweep.eventsProcessed,
        prospects_inserted: input.sweep.prospectsInserted,
        emails_drafted: input.sweep.emailsDrafted,
      },
      errors: input.errors,
      no_external_actions_performed: true,
    },
  });
}

async function logOperatorActivity(db: Db, input: {
  actor?: StormReachActor;
  event: StormDashboardEvent;
  taskId: string;
  summary: string;
  details: JsonRecord;
}) {
  await db.from("storm_audit_logs").insert({
    storm_event_id: input.event.id,
    related_table: "ai_workforce_tasks",
    related_id: input.taskId,
    actor_user_id: input.actor?.id ?? null,
    actor_label: input.actor?.label ?? STORMREACH_OPERATOR_AGENT_NAME,
    action: "operator_handoff_prepared",
    status: "awaiting_approval",
    summary: input.summary,
    details: input.details,
    approval_status: "needs_review",
  });

  await db.from("ai_workforce_activity_logs").insert({
    task_public_id: input.taskId,
    agent_name: STORMREACH_OPERATOR_AGENT_NAME,
    event_type: "operator_handoff_prepared",
    status: "awaiting_approval",
    summary: input.summary,
    details: input.details,
    approval_status: "needs_review",
    created_by: input.actor?.id ?? null,
  });
}

async function createAdminNotification(db: Db, input: {
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "critical";
  relatedTable: string;
  relatedId: string;
  metadata?: JsonRecord;
}) {
  await db.from("notifications").insert({
    channel: "in_app",
    severity: input.severity,
    title: input.title,
    body: input.body,
    status: "queued",
    related_table: input.relatedTable,
    related_id: input.relatedId,
    metadata_json: {
      source: "stormreach_operator",
      approval_required: true,
      ...(input.metadata ?? {}),
    },
  });
}

function operatorOutputTitle(event: StormDashboardEvent, packageRow: StormReachOperatorPackageInput) {
  return `${event.event_id} - ${String(packageRow.package_name ?? packageRow.industry ?? "StormReach package")} - Operator handoff`;
}

function sameIndustry(expected: string, value: unknown) {
  return String(value ?? "").trim().toLowerCase() === expected.trim().toLowerCase();
}

function ledgerPriority(severityLevel: string | null | undefined): ApprovalLedgerPayload["priority"] {
  if (severityLevel === "Extreme") return "critical";
  if (severityLevel === "High") return "high";
  return "normal";
}

function asDb(supabase?: ServiceClient): Db {
  return ((supabase ?? createServiceClient()) as unknown) as Db;
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function nullableString(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function positiveInteger(value: unknown, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback;
}
