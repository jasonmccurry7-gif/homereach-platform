import { relations } from "drizzle-orm";
import { date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { businesses } from "./businesses.js";

export const websiteProjectStatusEnum = pgEnum("website_project_status", [
  "intake_received",
  "awaiting_assets",
  "building",
  "client_review",
  "revisions",
  "ready_for_launch",
  "live",
  "paused",
  "cancelled",
]);

export const websiteAccountStatusEnum = pgEnum("website_account_status", [
  "active",
  "past_due",
  "cancelled",
]);

export const websiteMaintenanceRequestTypeEnum = pgEnum("website_maintenance_request_type", [
  "change_phone_number",
  "add_service",
  "replace_image",
  "add_testimonial",
  "new_page_request",
  "content_update",
  "technical_issue",
  "other",
]);

export const websiteMaintenancePriorityEnum = pgEnum("website_maintenance_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const websiteMaintenanceStatusEnum = pgEnum("website_maintenance_status", [
  "new",
  "assigned",
  "in_progress",
  "waiting_on_client",
  "completed",
  "cancelled",
]);

export type WebsiteAssetChecklist = {
  logoReceived?: boolean;
  photosReceived?: boolean;
  testimonialsReceived?: boolean;
  businessDescriptionReceived?: boolean;
  contactInformationVerified?: boolean;
  domainPurchased?: boolean;
  hostingActive?: boolean;
  contentApproved?: boolean;
  launchApproved?: boolean;
};

export type WebsiteIntakeSnapshot = {
  businessInformation?: string;
  serviceAreas?: string[];
  servicesOffered?: string[];
  customerAvatar?: string;
  photosReceived?: string;
  testimonialsReceived?: string;
  logoReceived?: string;
  domainInformation?: string;
  websiteGoals?: string;
  specialRequests?: string;
};

export const websiteProjects = pgTable(
  "website_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    clientName: text("client_name").notNull().default(""),
    businessName: text("business_name").notNull(),
    businessType: text("business_type"),
    phoneNumber: text("phone_number"),
    email: text("email"),
    domain: text("domain"),
    websiteUrl: text("website_url"),
    hostingProvider: text("hosting_provider"),
    githubRepositoryUrl: text("github_repository_url"),
    deploymentUrl: text("deployment_url"),
    hostingDashboardUrl: text("hosting_dashboard_url"),
    domainRegistrarUrl: text("domain_registrar_url"),
    googleBusinessProfileUrl: text("google_business_profile_url"),
    facebookPageUrl: text("facebook_page_url"),
    analyticsDashboardUrl: text("analytics_dashboard_url"),
    monthlyPlanAmountCents: integer("monthly_plan_amount_cents").notNull().default(0),
    setupFeeCents: integer("setup_fee_cents").notNull().default(0),
    lastPaymentDate: date("last_payment_date"),
    nextBillingDate: date("next_billing_date"),
    revenueToDateCents: integer("revenue_to_date_cents").notNull().default(0),
    accountStatus: websiteAccountStatusEnum("account_status").notNull().default("active"),
    status: websiteProjectStatusEnum("status").notNull().default("intake_received"),
    launchDate: date("launch_date"),
    assignedTeamMember: text("assigned_team_member"),
    notes: text("notes"),
    intake: jsonb("intake").$type<WebsiteIntakeSnapshot>().notNull().default({}),
    assetChecklist: jsonb("asset_checklist").$type<WebsiteAssetChecklist>().notNull().default({}),
    futureAuditHooks: jsonb("future_audit_hooks").$type<Record<string, unknown>>().notNull().default({}),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    businessIdx: index("website_projects_business_idx").on(table.businessId),
    statusIdx: index("website_projects_status_idx").on(table.status, table.accountStatus, table.updatedAt),
    billingIdx: index("website_projects_billing_idx").on(table.nextBillingDate, table.accountStatus),
  }),
);

export const websiteProjectsRelations = relations(websiteProjects, ({ one }) => ({
  business: one(businesses, {
    fields: [websiteProjects.businessId],
    references: [businesses.id],
  }),
}));

export const websiteMaintenanceRequests = pgTable(
  "website_maintenance_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteProjectId: uuid("website_project_id")
      .notNull()
      .references(() => websiteProjects.id, { onDelete: "cascade" }),
    requestType: websiteMaintenanceRequestTypeEnum("request_type").notNull().default("other"),
    description: text("description").notNull(),
    priority: websiteMaintenancePriorityEnum("priority").notNull().default("medium"),
    status: websiteMaintenanceStatusEnum("status").notNull().default("new"),
    assignedTo: text("assigned_to"),
    completedDate: date("completed_date"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    websiteIdx: index("website_maintenance_requests_website_idx").on(table.websiteProjectId, table.status),
    statusIdx: index("website_maintenance_requests_status_idx").on(table.status, table.priority, table.updatedAt),
  }),
);

export const websiteMaintenanceRequestsRelations = relations(websiteMaintenanceRequests, ({ one }) => ({
  websiteProject: one(websiteProjects, {
    fields: [websiteMaintenanceRequests.websiteProjectId],
    references: [websiteProjects.id],
  }),
}));

export type WebsiteProject = typeof websiteProjects.$inferSelect;
export type NewWebsiteProject = typeof websiteProjects.$inferInsert;
export type WebsiteMaintenanceRequest = typeof websiteMaintenanceRequests.$inferSelect;
export type NewWebsiteMaintenanceRequest = typeof websiteMaintenanceRequests.$inferInsert;
