import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { leads } from "./leads.js";
import { profiles } from "./users.js";

export const digitalTargetingCampaigns = pgTable("digital_targeting_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  clientId: uuid("client_id").references(() => profiles.id, { onDelete: "set null" }),
  leadId: uuid("lead_id").references(() => leads.id, { onDelete: "set null" }),
  businessName: text("business_name").notNull(),
  contactName: text("contact_name"),
  email: text("email").notNull(),
  phone: text("phone"),
  website: text("website"),
  industry: text("industry"),
  objective: text("objective").notNull(),
  targetingType: text("targeting_type").notNull(),
  monthlyManagementFee: integer("monthly_management_fee").notNull().default(49900),
  monthlyAdSpend: integer("monthly_ad_spend").notNull().default(0),
  setupFee: integer("setup_fee").notNull().default(0),
  paymentStatus: text("payment_status").notNull().default("payment_required"),
  campaignStatus: text("campaign_status").notNull().default("intake_complete"),
  startDate: date("start_date"),
  landingPageUrl: text("landing_page_url"),
  directMailAddon: boolean("direct_mail_addon").notNull().default(false),
  creativePackageAddon: boolean("creative_package_addon").notNull().default(false),
  landingPageNeeded: boolean("landing_page_needed").notNull().default(false),
  launchMode: text("launch_mode").notNull().default("manual"),
  adSpendConfirmed: boolean("ad_spend_confirmed").notNull().default(false),
  creativeApproved: boolean("creative_approved").notNull().default(false),
  adminApprovedForLaunch: boolean("admin_approved_for_launch").notNull().default(false),
  trackingUrl: text("tracking_url"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripeCustomerId: text("stripe_customer_id"),
  notes: text("notes"),
  campaignMetadata: jsonb("campaign_metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const digitalTargetLocations = pgTable("digital_target_locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
  locationType: text("location_type").notNull(),
  name: text("name"),
  address: text("address").notNull(),
  latitude: numeric("latitude", { precision: 10, scale: 7 }),
  longitude: numeric("longitude", { precision: 10, scale: 7 }),
  radiusMiles: numeric("radius_miles", { precision: 6, scale: 2 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const digitalCampaignAssets = pgTable("digital_campaign_assets", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
  assetType: text("asset_type").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  status: text("status").notNull().default("uploaded"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const digitalCampaignTasks = pgTable("digital_campaign_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  status: text("status").notNull().default("open"),
  owner: text("owner").notNull().default("jason"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  notes: text("notes"),
  taskOrder: integer("task_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const digitalCampaignMetrics = pgTable("digital_campaign_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
  reportingPeriodStart: date("reporting_period_start").notNull(),
  reportingPeriodEnd: date("reporting_period_end").notNull(),
  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),
  spend: integer("spend").notNull().default(0),
  leads: integer("leads").notNull().default(0),
  calls: integer("calls").notNull().default(0),
  landingPageVisits: integer("landing_page_visits").notNull().default(0),
  qrScans: integer("qr_scans").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const digitalCampaignDrafts = pgTable("digital_campaign_drafts", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => digitalTargetingCampaigns.id, { onDelete: "cascade" }),
  draftType: text("draft_type").notNull(),
  content: text("content").notNull(),
  createdBy: text("created_by").notNull().default("ai_draft_generator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
