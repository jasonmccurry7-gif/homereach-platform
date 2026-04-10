import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  integer,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { cities } from "./cities.js";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const productTypeEnum = pgEnum("product_type", [
  "postcard",
  "print",
  "digital",
  "automation",
  "addon",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Products
// Individual items that can be sold (postcards, digital, automation, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  type: productTypeEnum("type").notNull(),
  description: text("description"),
  basePrice: numeric("base_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
  // Flexible metadata: print specs, digital file types, automation triggers, etc.
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Bundles
// Named packages of products sold together at a fixed price.
// cityId = null means available in all cities (global bundle).
// ─────────────────────────────────────────────────────────────────────────────

export const bundles = pgTable("bundles", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull().default("0.00"),
  isActive: boolean("is_active").notNull().default(true),
  cityId: uuid("city_id").references(() => cities.id, { onDelete: "set null" }),
  // Scarcity + display config:
  // { spotType: "anchor"|"front"|"back", maxSpots: 1|3|6,
  //   features: string[], badgeText?: string, highlight?: boolean }
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Bundle ↔ Products junction
// Defines which products are in each bundle and how many of each.
// ─────────────────────────────────────────────────────────────────────────────

export const bundleProducts = pgTable("bundle_products", {
  id: uuid("id").primaryKey().defaultRandom(),
  bundleId: uuid("bundle_id")
    .notNull()
    .references(() => bundles.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const productsRelations = relations(products, ({ many }) => ({
  bundleProducts: many(bundleProducts),
  orderItems: many(orderItems),
}));

export const bundlesRelations = relations(bundles, ({ one, many }) => ({
  city: one(cities, {
    fields: [bundles.cityId],
    references: [cities.id],
  }),
  bundleProducts: many(bundleProducts),
  orders: many(orders),
}));

export const bundleProductsRelations = relations(bundleProducts, ({ one }) => ({
  bundle: one(bundles, {
    fields: [bundleProducts.bundleId],
    references: [bundles.id],
  }),
  product: one(products, {
    fields: [bundleProducts.productId],
    references: [products.id],
  }),
}));

// Circular refs
import { orderItems, orders } from "./orders.js";
