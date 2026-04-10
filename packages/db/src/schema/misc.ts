import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses";
import { cities } from "./cities";
import { categories } from "./cities";
import { profiles } from "./users";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const nonprofitApplicationStatusEnum = pgEnum(
  "nonprofit_application_status",
  ["pending", "approved", "rejected"]
);

export const sponsorshipTierEnum = pgEnum("sponsorship_tier", [
  "bronze",
  "silver",
  "gold",
  "platinum",
]);

export const sponsorshipStatusEnum = pgEnum("sponsorship_status", [
  "pending",
  "active",
  "expired",
  "cancelled",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Waitlist Entries
// Pre-launch signups per city.
// convertedToBusinessId is set when the waitlist entry becomes a real business.
// ─────────────────────────────────────────────────────────────────────────────

export const waitlistEntries = pgTable("waitlist_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  phone: text("phone"),
  name: text("name"),
  cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  businessName: text("business_name"),
  convertedToBusinessId: uuid("converted_to_business_id").references(
    () => businesses.id,
    { onDelete: "set null" }
  ),
  convertedAt: timestamp("converted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Nonprofit Applications
// Submitted when a business requests nonprofit pricing/status.
// Requires admin review before isNonprofit flag is set on business.
// ─────────────────────────────────────────────────────────────────────────────

export const nonprofitApplications = pgTable("nonprofit_applications", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  status: nonprofitApplicationStatusEnum("status").notNull().default("pending"),
  ein: text("ein"), // Employer Identification Number (501c3)
  orgName: text("org_name").notNull(),
  documentUrl: text("document_url"), // uploaded 501c3 document
  reviewedBy: uuid("reviewed_by").references(() => profiles.id, {
    onDelete: "set null",
  }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Sponsorships
// A business sponsoring a campaign, city, or nonprofit.
// Phase 6 — schema defined now, feature built later.
// ─────────────────────────────────────────────────────────────────────────────

export const sponsorships = pgTable("sponsorships", {
  id: uuid("id").primaryKey().defaultRandom(),
  sponsorBusinessId: uuid("sponsor_business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  tier: sponsorshipTierEnum("tier").notNull().default("bronze"),
  status: sponsorshipStatusEnum("status").notNull().default("pending"),
  amount: numeric("amount", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const waitlistEntriesRelations = relations(
  waitlistEntries,
  ({ one }) => ({
    city: one(cities, {
      fields: [waitlistEntries.cityId],
      references: [cities.id],
    }),
    category: one(categories, {
      fields: [waitlistEntries.categoryId],
      references: [categories.id],
    }),
    convertedBusiness: one(businesses, {
      fields: [waitlistEntries.convertedToBusinessId],
      references: [businesses.id],
    }),
  })
);

export const nonprofitApplicationsRelations = relations(
  nonprofitApplications,
  ({ one }) => ({
    business: one(businesses, {
      fields: [nonprofitApplications.businessId],
      references: [businesses.id],
    }),
    reviewer: one(profiles, {
      fields: [nonprofitApplications.reviewedBy],
      references: [profiles.id],
    }),
  })
);

export const sponsorshipsRelations = relations(sponsorships, ({ one }) => ({
  sponsorBusiness: one(businesses, {
    fields: [sponsorships.sponsorBusinessId],
    references: [businesses.id],
  }),
}));
