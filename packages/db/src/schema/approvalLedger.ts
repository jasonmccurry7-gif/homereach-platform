import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./users.js";

export const approvalLedger = pgTable(
  "approval_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceKey: text("source_key").notNull(),
    sourceSystem: text("source_system").notNull(),
    sourceTable: text("source_table"),
    sourceId: text("source_id").notNull(),
    sourceHref: text("source_href"),
    domain: text("domain").notNull(),
    approvalKind: text("approval_kind").notNull().default("manual_review"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    sourceStatus: text("source_status").notNull().default("needs_review"),
    approvalState: text("approval_state").notNull().default("needs_review"),
    lane: text("lane").notNull().default("needs_approval"),
    priority: text("priority").notNull().default("normal"),
    approvalRequired: boolean("approval_required").notNull().default(true),
    humanApprovalRequired: boolean("human_approval_required").notNull().default(true),
    sensitiveAction: boolean("sensitive_action").notNull().default(true),
    requestedBy: uuid("requested_by").references(() => profiles.id, { onDelete: "set null" }),
    assignedTo: uuid("assigned_to").references(() => profiles.id, { onDelete: "set null" }),
    decidedBy: uuid("decided_by").references(() => profiles.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    customerId: uuid("customer_id"),
    campaignId: uuid("campaign_id"),
    channel: text("channel"),
    provider: text("provider"),
    nextAction: text("next_action").notNull().default(""),
    guardrail: text("guardrail").notNull().default(""),
    policyFlags: text("policy_flags").array().notNull().default([]),
    complianceNotes: text("compliance_notes"),
    actionTarget: jsonb("action_target").$type<Record<string, unknown>>().notNull().default({}),
    evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    dueAt: timestamp("due_at", { withTimezone: true }),
    sourceCreatedAt: timestamp("source_created_at", { withTimezone: true }),
    sourceUpdatedAt: timestamp("source_updated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sourceKeyIdx: uniqueIndex("approval_ledger_source_key_uidx").on(t.sourceKey),
    stateIdx: index("approval_ledger_state_idx").on(t.approvalState, t.priority, t.updatedAt),
    laneIdx: index("approval_ledger_lane_idx").on(t.lane, t.priority, t.updatedAt),
    domainIdx: index("approval_ledger_domain_idx").on(t.domain, t.approvalKind, t.updatedAt),
    sourceIdx: index("approval_ledger_source_idx").on(t.sourceSystem, t.sourceTable, t.sourceId),
  }),
);

export const approvalLedgerEvents = pgTable(
  "approval_ledger_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    approvalId: uuid("approval_id")
      .notNull()
      .references(() => approvalLedger.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull().default("state_snapshot"),
    fromState: text("from_state"),
    toState: text("to_state"),
    actorUserId: uuid("actor_user_id").references(() => profiles.id, { onDelete: "set null" }),
    actorLabel: text("actor_label"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    approvalIdx: index("approval_ledger_events_approval_idx").on(t.approvalId, t.createdAt),
    eventTypeIdx: index("approval_ledger_events_type_idx").on(t.eventType, t.createdAt),
  }),
);

export type ApprovalLedger = typeof approvalLedger.$inferSelect;
export type NewApprovalLedger = typeof approvalLedger.$inferInsert;
export type ApprovalLedgerEvent = typeof approvalLedgerEvents.$inferSelect;
export type NewApprovalLedgerEvent = typeof approvalLedgerEvents.$inferInsert;
