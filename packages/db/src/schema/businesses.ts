import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { profiles } from "./users";
import { cities, categories } from "./cities";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const businessStatusEnum = pgEnum("business_status", [
  "pending",
  "active",
  "paused",
  "churned",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Businesses
// Core entity. A business is the paying customer unit.
// Nonprofits are also businesses with isNonprofit = true.
// ─────────────────────────────────────────────────────────────────────────────

export const businesses = pgTable("businesses", {
  id: uuid("id").primaryKey().defaultRandom(),
  // The authenticated user who owns/manages this business
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  categoryId: uuid("category_id").references(() => categories.id, {
    onDelete: "set null",
  }),
  cityId: uuid("city_id").references(() => cities.id, {
    onDelete: "set null",
  }),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  website: text("website"),
  status: businessStatusEnum("status").notNull().default("pending"),
  // Nonprofit flags
  isNonprofit: boolean("is_nonprofit").notNull().default(false),
  nonprofitVerifiedAt: timestamp("nonprofit_verified_at", {
    withTimezone: true,
  }),
  // Internal admin notes
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [businesses.ownerId],
    references: [profiles.id],
  }),
  category: one(categories, {
    fields: [businesses.categoryId],
    references: [categories.id],
  }),
  city: one(cities, {
    fields: [businesses.cityId],
    references: [cities.id],
  }),
  orders: many(orders),
  campaigns: many(campaigns),
  outreachContacts: many(outreachContacts),
  outreachReplies: many(outreachReplies),
  nonprofitApplication: many(nonprofitApplications),
}));

// Circular refs
import { orders } from "./orders";
import { campaigns, outreachContacts, outreachReplies } from "./outreach";
import { nonprofitApplications } from "./misc";
