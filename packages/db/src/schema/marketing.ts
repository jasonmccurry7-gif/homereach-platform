import {
  pgTable,
  uuid,
  integer,
  numeric,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses";
import { cities } from "./cities";
import { categories } from "./cities";
import { bundles } from "./products";
import { orders } from "./orders";
import { profiles } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const marketingCampaignStatusEnum = pgEnum("marketing_campaign_status", [
  "upcoming",    // paid, not yet live
  "active",      // currently mailing
  "completed",   // campaign period ended
  "paused",      // temporarily on hold
  "cancelled",   // cancelled/refunded
]);

// ─────────────────────────────────────────────────────────────────────────────
// Postcard Campaigns
// One record per order. Created automatically when Stripe confirms payment.
// Separate from outreach campaigns (SMS/email).
// ─────────────────────────────────────────────────────────────────────────────

export const marketingCampaigns = pgTable("marketing_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  orderId: uuid("order_id")
    .notNull()
    .unique()
    .references(() => orders.id, { onDelete: "cascade" }),
  cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  bundleId: uuid("bundle_id").references(() => bundles.id, { onDelete: "set null" }),

  status: marketingCampaignStatusEnum("status").notNull().default("upcoming"),

  // Campaign period
  startDate: timestamp("start_date", { withTimezone: true }),
  endDate: timestamp("end_date", { withTimezone: true }),
  renewalDate: timestamp("renewal_date", { withTimezone: true }),
  nextDropDate: timestamp("next_drop_date", { withTimezone: true }),

  // Drop cadence — number of postcard drops included
  totalDrops: integer("total_drops").notNull().default(1),
  dropsCompleted: integer("drops_completed").notNull().default(0),

  // Homes reached per drop (from bundle config, captured at creation)
  homesPerDrop: integer("homes_per_drop").notNull().default(2500),

  // Internal notes
  notes: text("notes"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Campaign Metrics
// One row per month per campaign. Written by admin or future automation.
// qrScans and leads are 0 until real tracking is wired up (Phase 4+).
// ─────────────────────────────────────────────────────────────────────────────

export const campaignMetrics = pgTable("campaign_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => marketingCampaigns.id, { onDelete: "cascade" }),

  // Period this row covers
  periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),

  // Real data
  impressions: integer("impressions").notNull().default(0),   // homes reached this period
  mailpieces: integer("mailpieces").notNull().default(0),     // postcards physically mailed

  // Tracked (Phase 4+)
  qrScans: integer("qr_scans").notNull().default(0),
  phoneLeads: integer("phone_leads").notNull().default(0),
  formLeads: integer("form_leads").notNull().default(0),
  totalLeads: integer("total_leads").notNull().default(0),    // derived but stored

  // Optional estimated ROI (admin-entered or calculated)
  estimatedRevenue: numeric("estimated_revenue", { precision: 10, scale: 2 }),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const marketingCampaignsRelations = relations(
  marketingCampaigns,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [marketingCampaigns.businessId],
      references: [businesses.id],
    }),
    order: one(orders, {
      fields: [marketingCampaigns.orderId],
      references: [orders.id],
    }),
    city: one(cities, {
      fields: [marketingCampaigns.cityId],
      references: [cities.id],
    }),
    category: one(categories, {
      fields: [marketingCampaigns.categoryId],
      references: [categories.id],
    }),
    bundle: one(bundles, {
      fields: [marketingCampaigns.bundleId],
      references: [bundles.id],
    }),
    metrics: many(campaignMetrics),
  })
);

export const campaignMetricsRelations = relations(campaignMetrics, ({ one }) => ({
  campaign: one(marketingCampaigns, {
    fields: [campaignMetrics.campaignId],
    references: [marketingCampaigns.id],
  }),
}));
