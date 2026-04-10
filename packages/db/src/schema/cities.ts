import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Cities
// Markets where HomeReach operates.
// ─────────────────────────────────────────────────────────────────────────────

export const cities = pgTable("cities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  state: text("state").notNull(),        // e.g. "TX"
  slug: text("slug").notNull().unique(), // e.g. "austin-tx"
  isActive: boolean("is_active").notNull().default(false),
  launchedAt: timestamp("launched_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Categories
// Business types (e.g. Restaurant, Salon, Auto, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  icon: text("icon"), // icon name or URL
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const citiesRelations = relations(cities, ({ many }) => ({
  businesses: many(businesses),
  bundles: many(bundles),
  waitlistEntries: many(waitlistEntries),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  businesses: many(businesses),
  waitlistEntries: many(waitlistEntries),
}));

// Circular refs resolved in index
import { businesses } from "./businesses";
import { bundles } from "./products";
import { waitlistEntries } from "./misc";
