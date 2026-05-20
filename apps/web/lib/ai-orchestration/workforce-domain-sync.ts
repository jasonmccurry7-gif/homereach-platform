import { createServiceClient } from "@/lib/supabase/service";
import {
  enqueueAiWorkforceIngestionSource,
  enqueueAiWorkforceTask,
  recordAiWorkforceEvent,
  upsertAiWorkforceMemoryItem,
} from "./workforce-memory";

export interface WorkforceDomainSyncResult {
  generatedAt: string;
  actorId?: string | null;
  mode: "admin_manual";
  summary: {
    politicalMemories: number;
    procurementMemories: number;
    govContractMemories: number;
    outreachMemories: number;
    learningMemories: number;
    tasksQueued: number;
    ingestionSourcesQueued: number;
    eventsRecorded: number;
    errors: number;
  };
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
  notes: string[];
  errors: Array<{ source: string; message: string }>;
}

type DomainMemoryBucket =
  | "politicalMemories"
  | "procurementMemories"
  | "govContractMemories"
  | "outreachMemories"
  | "learningMemories";

function nowIso() {
  return new Date().toISOString();
}

function safeKey(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9:_-]+/g, "-").replace(/-+/g, "-").slice(0, 220);
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function asText(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function moneyFromCents(value: unknown) {
  const cents = Number(value);
  if (!Number.isFinite(cents) || cents <= 0) return "unknown value";
  return `$${Math.round(cents / 100).toLocaleString()}`;
}

function urgencyForDeadline(value: unknown) {
  if (!value) return "medium" as const;
  const due = new Date(String(value)).getTime();
  if (!Number.isFinite(due)) return "medium" as const;
  const days = Math.ceil((due - Date.now()) / 86_400_000);
  if (days <= 3) return "critical" as const;
  if (days <= 10) return "high" as const;
  return "medium" as const;
}

async function readSource<T>(
  result: WorkforceDomainSyncResult,
  source: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    const value = await fn();
    result.sourceHealth.push({ source, status: "ok" });
    return value;
  } catch (error) {
    result.sourceHealth.push({
      source,
      status: "unavailable",
      note: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}

async function capture(
  result: WorkforceDomainSyncResult,
  source: string,
  fn: () => Promise<"event" | "task" | "ingestion" | DomainMemoryBucket>,
) {
  try {
    const type = await fn();
    if (type === "event") result.summary.eventsRecorded += 1;
    else if (type === "task") result.summary.tasksQueued += 1;
    else if (type === "ingestion") result.summary.ingestionSourcesQueued += 1;
    else result.summary[type] += 1;
  } catch (error) {
    result.summary.errors += 1;
    result.errors.push({ source, message: error instanceof Error ? error.message : String(error) });
  }
}

export async function syncAiWorkforceDomainMemory(actorId?: string | null): Promise<WorkforceDomainSyncResult> {
  const result: WorkforceDomainSyncResult = {
    generatedAt: nowIso(),
    actorId,
    mode: "admin_manual",
    summary: {
      politicalMemories: 0,
      procurementMemories: 0,
      govContractMemories: 0,
      outreachMemories: 0,
      learningMemories: 0,
      tasksQueued: 0,
      ingestionSourcesQueued: 0,
      eventsRecorded: 0,
      errors: 0,
    },
    sourceHealth: [],
    notes: [
      "Domain memory sync is admin-triggered and advisory only.",
      "Political records remain aggregate/geographic/campaign-operational; no individual voter ideology, persuasion, or turnout scoring is created.",
      "No outreach, ordering, publishing, bidding, payment, campaign launch, or external commitment was executed.",
    ],
    errors: [],
  };

  if (!hasSupabaseEnv()) {
    result.summary.errors += 1;
    result.sourceHealth.push({ source: "supabase", status: "unavailable", note: "Supabase env is missing." });
    result.errors.push({ source: "supabase", message: "Supabase env is missing." });
    return result;
  }

  const supabase = createServiceClient();

  const [
    politicalTargets,
    politicalCreatives,
    politicalPlans,
    govOpportunities,
    revenueThreads,
    revenueApprovals,
    procurementSequences,
    learningInsights,
    learningEnhancements,
    learningAutomations,
  ] = await Promise.all([
    readSource(result, "political_candidate_agent_targets", async () => {
      const { data, error } = await supabase
        .from("political_candidate_agent_targets")
        .select("id,target_slug,display_name,office_sought,party_or_committee,campaign_frame,source_status,research_gaps,updated_at")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "political_candidate_creative_concepts", async () => {
      const { data, error } = await supabase
        .from("political_candidate_creative_concepts")
        .select("id,target_slug,strategy_key,phase_key,category,title,headline,status,updated_at")
        .in("status", ["draft", "needs_review", "revision_requested"])
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "political_mail_launch_plans", async () => {
      const { data, error } = await supabase
        .from("political_mail_launch_plans")
        .select("id,status,plan_name,total_households,total_estimated_cost_cents,confidence_score,recommended_strategy,updated_at")
        .in("status", ["draft", "needs_review", "client_review", "approved"])
        .order("updated_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "gov_contract_opportunities", async () => {
      const { data, error } = await supabase
        .from("gov_contract_opportunities")
        .select("id,title,agency,response_deadline,estimated_value_cents,pipeline_status,fit_status,fit_score,urgency_score,recommended_next_action,scoring_reason,naics_code,updated_at")
        .or("fit_status.eq.strong_fit,pipeline_status.in.(reviewing,strong_fit,need_subcontractor,bid_prep,awaiting_approval)")
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "revenue_message_threads", async () => {
      const { data, error } = await supabase
        .from("revenue_message_threads")
        .select("id,business_line,channel,display_name,organization_name,status,lead_status,latest_direction,latest_message_body,latest_message_at,unread_count,automation_mode,automation_paused,updated_at")
        .or("latest_direction.eq.inbound,unread_count.gt.0,status.in.(needs_review,waiting_on_homereach)")
        .order("latest_message_at", { ascending: false, nullsFirst: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "revenue_message_approval_queue", async () => {
      const { data, error } = await supabase
        .from("revenue_message_approval_queue")
        .select("id,business_line,channel,status,title,due_at,updated_at")
        .in("status", ["draft", "needs_review", "approved", "scheduled"])
        .order("updated_at", { ascending: false })
        .limit(12);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "auto_sequences_inventory_procurement", async () => {
      const { data, error } = await supabase
        .from("auto_sequences")
        .select("id,name,status,channel,business_line,updated_at")
        .eq("business_line", "inventory_procurement")
        .order("updated_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "ci_insights", async () => {
      const { data, error } = await supabase
        .from("ci_insights")
        .select("id,category,theme,insight_text,rationale,apex_score,status,created_at")
        .in("status", ["pending", "approved"])
        .order("apex_score", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "ci_enhancements", async () => {
      const { data, error } = await supabase
        .from("ci_enhancements")
        .select("id,category,title,description,kind,status,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
    readSource(result, "ci_automations", async () => {
      const { data, error } = await supabase
        .from("ci_automations")
        .select("id,category,title,trigger_desc,action_desc,status,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
  ]);

  for (const row of politicalTargets) {
    const baseKey = safeKey(`domain:political-target:${row.target_slug ?? row.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "political-strategy-agent",
        dashboard: "Political",
        memoryType: "summary",
        title: `${asText(row.display_name, "Candidate")} - ${asText(row.office_sought, "Office")}`,
        summary: asText(row.campaign_frame, "Candidate profile available for campaign planning."),
        source: "political_candidate_agent_targets",
        sourceId: asText(row.id),
        route: `/political/candidate-agent?candidate=${encodeURIComponent(asText(row.target_slug))}`,
        confidence: 0.82,
        impactLevel: Array.isArray(row.research_gaps) && row.research_gaps.length > 0 ? "medium" : "low",
        metadata: {
          targetSlug: row.target_slug,
          partyOrCommittee: row.party_or_committee,
          sourceStatus: row.source_status,
          researchGaps: row.research_gaps,
          compliance: "aggregate_geography_only",
        },
      });
      return "politicalMemories";
    });
  }

  for (const row of politicalCreatives) {
    const baseKey = safeKey(`domain:political-creative:${row.id}`);
    await capture(result, baseKey, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: "creative-agent",
        dashboard: "Political",
        title: `Review ${asText(row.target_slug)} creative: ${asText(row.title, row.headline)}`,
        description: `${asText(row.category)} concept for ${asText(row.strategy_key)} / ${asText(row.phase_key)} is ${asText(row.status)}.`,
        recommendedAction: "Review creative, comments, disclaimer placement, and approval status before proposal or production.",
        route: `/political/candidate-agent?candidate=${encodeURIComponent(asText(row.target_slug))}`,
        priority: row.status === "needs_review" || row.status === "revision_requested" ? "high" : "medium",
        status: "needs_approval",
        requiresHumanApproval: true,
        metadata: { source: "political_candidate_creative_concepts", conceptId: row.id },
      });
      return "task";
    });
  }

  for (const row of politicalPlans) {
    const baseKey = safeKey(`domain:political-plan:${row.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "political-strategy-agent",
        dashboard: "Political",
        memoryType: row.status === "approved" ? "decision" : "opportunity",
        title: asText(row.plan_name, "Political launch plan"),
        summary: `${Number(row.total_households ?? 0).toLocaleString()} households, ${moneyFromCents(row.total_estimated_cost_cents)}, status ${asText(row.status)}.`,
        source: "political_mail_launch_plans",
        sourceId: asText(row.id),
        route: "/political/candidate-agent",
        confidence: Math.max(0.5, Number(row.confidence_score ?? 50) / 100),
        impactLevel: row.status === "approved" ? "high" : "medium",
        metadata: {
          status: row.status,
          recommendedStrategy: row.recommended_strategy,
          compliance: "human approval required before launch",
        },
      });
      return "politicalMemories";
    });
  }

  for (const row of govOpportunities) {
    const baseKey = safeKey(`domain:gov-contract:${row.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "gov-contracts-agent",
        dashboard: "Gov Contracts",
        memoryType: row.fit_status === "strong_fit" ? "opportunity" : "summary",
        title: asText(row.title, "Government contract opportunity"),
        summary: `${asText(row.agency, "Agency not listed")} - ${asText(row.fit_status)} fit, score ${Number(row.fit_score ?? 0)}, due ${asText(row.response_deadline, "not listed")}.`,
        source: "gov_contract_opportunities",
        sourceId: asText(row.id),
        route: `/admin/gov-contracts/${row.id}`,
        confidence: Math.max(0.5, Number(row.fit_score ?? 50) / 100),
        impactLevel: urgencyForDeadline(row.response_deadline),
        metadata: {
          pipelineStatus: row.pipeline_status,
          urgencyScore: row.urgency_score,
          naicsCode: row.naics_code,
          estimatedValue: moneyFromCents(row.estimated_value_cents),
          recommendedNextAction: row.recommended_next_action,
          scoringReason: row.scoring_reason,
          safety: "No autonomous bid submission.",
        },
      });
      return "govContractMemories";
    });

    if (["strong_fit", "reviewing", "bid_prep", "awaiting_approval"].includes(asText(row.pipeline_status)) || row.fit_status === "strong_fit") {
      await capture(result, `${baseKey}:task`, async () => {
        await enqueueAiWorkforceTask({
          taskKey: `task:${baseKey}`,
          agentId: "gov-contracts-agent",
          dashboard: "Gov Contracts",
          title: `Review gov opportunity: ${asText(row.title, "Untitled")}`,
          description: asText(row.scoring_reason, "Opportunity needs human go/no-go review."),
          recommendedAction: asText(row.recommended_next_action, "Open Bid Room and complete human go/no-go review."),
          route: `/admin/gov-contracts/${row.id}`,
          priority: urgencyForDeadline(row.response_deadline),
          status: "needs_approval",
          requiresHumanApproval: true,
          metadata: { source: "gov_contract_opportunities", opportunityId: row.id },
        });
        return "task";
      });
    }
  }

  for (const row of revenueThreads) {
    const baseKey = safeKey(`domain:revenue-thread:${row.id}`);
    const isPolitical = row.business_line === "political";
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: isPolitical ? "political-outreach-agent" : "outreach-agent",
        dashboard: isPolitical ? "Political Outreach" : "Outreach",
        memoryType: row.latest_direction === "inbound" ? "opportunity" : "summary",
        title: `${asText(row.organization_name, row.display_name ?? "Lead")} replied or needs review`,
        summary: asText(row.latest_message_body, "Thread needs review.").slice(0, 500),
        source: "revenue_message_threads",
        sourceId: asText(row.id),
        route: "/admin/inbox",
        confidence: row.latest_direction === "inbound" ? 0.9 : 0.75,
        impactLevel: isPolitical || Number(row.unread_count ?? 0) > 0 ? "high" : "medium",
        metadata: {
          businessLine: row.business_line,
          channel: row.channel,
          status: row.status,
          leadStatus: row.lead_status,
          unreadCount: row.unread_count,
          automationMode: row.automation_mode,
          automationPaused: row.automation_paused,
          politicalRule: isPolitical ? "Human handoff required after response." : undefined,
        },
      });
      return "outreachMemories";
    });

    await capture(result, `${baseKey}:task`, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: isPolitical ? "political-outreach-agent" : "outreach-agent",
        dashboard: isPolitical ? "Political Outreach" : "Outreach",
        title: `Respond to ${asText(row.organization_name, row.display_name ?? "lead")}`,
        description: asText(row.latest_message_body, "Conversation needs human review.").slice(0, 700),
        recommendedAction: isPolitical
          ? "Notify Jason and draft a reply for manual approval only."
          : "Review thread, approve AI suggestion if appropriate, and move the lead to the next stage.",
        route: "/admin/inbox",
        priority: isPolitical ? "critical" : "high",
        status: "needs_approval",
        requiresHumanApproval: true,
        metadata: { source: "revenue_message_threads", threadId: row.id, businessLine: row.business_line },
      });
      return "task";
    });
  }

  for (const row of revenueApprovals) {
    const baseKey = safeKey(`domain:revenue-approval:${row.id}`);
    await capture(result, baseKey, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: "outreach-agent",
        dashboard: "Outreach",
        title: asText(row.title, "Message approval needed"),
        description: `${asText(row.business_line)} ${asText(row.channel)} message is ${asText(row.status)}.`,
        recommendedAction: "Approve, reject, edit, or schedule from the existing message approval workflow.",
        route: "/admin/inbox",
        priority: row.business_line === "political" ? "critical" : "medium",
        status: "needs_approval",
        requiresHumanApproval: true,
        dueAt: row.due_at ?? null,
        metadata: { source: "revenue_message_approval_queue", approvalId: row.id },
      });
      return "task";
    });
  }

  for (const row of procurementSequences) {
    const baseKey = safeKey(`domain:procurement-sequence:${row.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "procurement-savings-agent",
        dashboard: "Procurement",
        memoryType: row.status === "active" ? "playbook" : "risk",
        title: asText(row.name, "Inventory Procurement Email Outreach"),
        summary: `Procurement sequence is ${asText(row.status)} on ${asText(row.channel)}.`,
        source: "auto_sequences",
        sourceId: asText(row.id),
        route: "/inventory-purchasing/dashboard",
        confidence: 0.84,
        impactLevel: row.status === "active" ? "medium" : "high",
        metadata: {
          businessLine: row.business_line,
          channel: row.channel,
          status: row.status,
          safety: "No live send happens from memory sync.",
        },
      });
      return "procurementMemories";
    });
  }

  for (const row of learningInsights) {
    const baseKey = safeKey(`domain:learning-insight:${row.id}`);
    await capture(result, baseKey, async () => {
      await upsertAiWorkforceMemoryItem({
        memoryKey: `memory:${baseKey}`,
        agentId: "learning-engine-agent",
        dashboard: "Learning Engine",
        memoryType: row.status === "approved" ? "playbook" : "opportunity",
        title: asText(row.theme, `${row.category} insight`),
        summary: asText(row.insight_text, "Learning insight pending review."),
        source: "ci_insights",
        sourceId: asText(row.id),
        route: "/admin/content-intel",
        confidence: Math.min(0.95, Math.max(0.55, Number(row.apex_score ?? 12) / 20)),
        impactLevel: Number(row.apex_score ?? 0) >= 16 ? "high" : "medium",
        metadata: {
          category: row.category,
          apexScore: row.apex_score,
          rationale: row.rationale,
          status: row.status,
        },
      });
      return "learningMemories";
    });
  }

  for (const row of [...learningEnhancements, ...learningAutomations]) {
    const isAutomation = Boolean(row.trigger_desc || row.action_desc);
    const baseKey = safeKey(`domain:learning-${isAutomation ? "automation" : "enhancement"}:${row.id}`);
    await capture(result, baseKey, async () => {
      await enqueueAiWorkforceTask({
        taskKey: `task:${baseKey}`,
        agentId: "learning-engine-agent",
        dashboard: "Learning Engine",
        title: asText(row.title, isAutomation ? "Learning automation" : "Learning enhancement"),
        description: isAutomation
          ? `${asText(row.trigger_desc)} -> ${asText(row.action_desc)}`
          : asText(row.description, "Enhancement needs review."),
        recommendedAction: "Review for duplication, safety, revenue impact, and implementation priority before creating engineering work.",
        route: "/admin/content-intel",
        priority: row.status === "approved" ? "high" : "medium",
        status: "needs_approval",
        requiresHumanApproval: true,
        metadata: {
          source: isAutomation ? "ci_automations" : "ci_enhancements",
          category: row.category,
          status: row.status,
          kind: row.kind,
        },
      });
      return "task";
    });

    await capture(result, `${baseKey}:ingestion`, async () => {
      await enqueueAiWorkforceIngestionSource({
        sourceKey: `learning-review:${isAutomation ? "automation" : "enhancement"}:${row.id}`,
        sourceType: "manual",
        title: asText(row.title, isAutomation ? "Learning automation" : "Learning enhancement"),
        dashboard: "Learning Engine",
        priority: row.status === "approved" ? "high" : "medium",
        status: "needs_review",
        reviewRequired: true,
        assignedAgentId: "learning-engine-agent",
        nextStep: "Review recommendation before implementation or publication.",
        metadata: {
          source: isAutomation ? "ci_automations" : "ci_enhancements",
          sourceId: row.id,
          category: row.category,
          status: row.status,
        },
      });
      return "ingestion";
    });
  }

  await capture(result, "domain-memory-sync-event", async () => {
    await recordAiWorkforceEvent({
      eventKey: `domain-memory-sync:${new Date().toISOString().slice(0, 13)}`,
      eventType: result.summary.errors > 0 ? "failed" : "synced",
      agentId: "executive-os-agent",
      dashboard: "AI Workforce OS",
      actorType: actorId ? "admin" : "system",
      actorId,
      title: "Domain memory sync completed",
      summary: `Political ${result.summary.politicalMemories}, procurement ${result.summary.procurementMemories}, gov contracts ${result.summary.govContractMemories}, outreach ${result.summary.outreachMemories}, learning ${result.summary.learningMemories}.`,
      route: "/admin/agents",
      severity: result.summary.errors > 0 ? "warning" : "success",
      source: "workforce_domain_sync",
      metadata: {
        summary: result.summary,
        sourceHealth: result.sourceHealth,
        notes: result.notes,
      },
    });
    return "event";
  });

  return result;
}
