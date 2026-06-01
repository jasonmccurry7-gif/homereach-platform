import {
  boolean,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./businesses.js";
import { outreachContacts } from "./outreach.js";
import { profiles } from "./users.js";

export const agentMiniApps = pgTable(
  "agent_mini_apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id"),
    miniAppType: text("mini_app_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    sourceAgent: text("source_agent").notNull().default("Orchestrator Agent"),
    relatedModule: text("related_module").notNull().default("ai_workforce"),
    relatedBusinessId: uuid("related_business_id").references(() => businesses.id, { onDelete: "set null" }),
    relatedContactId: uuid("related_contact_id").references(() => outreachContacts.id, { onDelete: "set null" }),
    relatedCampaignId: uuid("related_campaign_id"),
    relatedClientId: uuid("related_client_id").references(() => profiles.id, { onDelete: "set null" }),
    status: text("status").notNull().default("generated"),
    priority: text("priority").notNull().default("normal"),
    confidenceScore: numeric("confidence_score", { precision: 5, scale: 2 }).notNull().default("0"),
    riskLevel: text("risk_level").notNull().default("medium"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    estimatedRevenue: numeric("estimated_revenue", { precision: 12, scale: 2 }).notNull().default("0"),
    estimatedSavings: numeric("estimated_savings", { precision: 12, scale: 2 }).notNull().default("0"),
    estimatedCost: numeric("estimated_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    recommendedAction: text("recommended_action").notNull().default(""),
    payloadJson: jsonb("payload_json").$type<Record<string, unknown>>().notNull().default({}),
    editedPayloadJson: jsonb("edited_payload_json").$type<Record<string, unknown> | null>(),
    decision: text("decision"),
    decisionReason: text("decision_reason"),
    assignedUserId: uuid("assigned_user_id").references(() => profiles.id, { onDelete: "set null" }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    createdBy: uuid("created_by").references(() => profiles.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => ({
    todayStackIdx: index("agent_mini_apps_today_stack_idx").on(t.status, t.priority, t.dueAt, t.updatedAt),
    typeIdx: index("agent_mini_apps_type_idx").on(t.miniAppType, t.status, t.updatedAt),
    riskIdx: index("agent_mini_apps_risk_idx").on(t.riskLevel, t.approvalRequired, t.updatedAt),
    assignedIdx: index("agent_mini_apps_assigned_idx").on(t.assignedUserId, t.status, t.dueAt),
    relatedModuleIdx: index("agent_mini_apps_related_module_idx").on(t.relatedModule, t.status, t.updatedAt),
  }),
);

export const agentMiniAppEvents = pgTable(
  "agent_mini_app_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    miniAppId: uuid("mini_app_id").notNull().references(() => agentMiniApps.id),
    eventType: text("event_type").notNull(),
    previousStatus: text("previous_status"),
    newStatus: text("new_status"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorType: text("actor_type").notNull().default("user"),
    eventSummary: text("event_summary").notNull().default(""),
    eventPayloadJson: jsonb("event_payload_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    miniAppIdx: index("agent_mini_app_events_mini_app_idx").on(t.miniAppId, t.createdAt),
    eventTypeIdx: index("agent_mini_app_events_type_idx").on(t.eventType, t.createdAt),
  }),
);

export type AgentMiniApp = typeof agentMiniApps.$inferSelect;
export type NewAgentMiniApp = typeof agentMiniApps.$inferInsert;
export type AgentMiniAppEvent = typeof agentMiniAppEvents.$inferSelect;
export type NewAgentMiniAppEvent = typeof agentMiniAppEvents.$inferInsert;
