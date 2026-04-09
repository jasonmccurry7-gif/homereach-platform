import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses.js";
import { bundles, products } from "./products.js";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const orderStatusEnum = pgEnum("order_status", [
  "pending",    // checkout session created, not yet paid
  "paid",       // Stripe confirmed payment
  "processing", // fulfillment in progress
  "active",     // campaign is live / product delivered
  "completed",  // campaign concluded
  "cancelled",  // cancelled before fulfillment
  "refunded",   // refund issued
]);

// ─────────────────────────────────────────────────────────────────────────────
// Orders
// One order per Stripe checkout session.
// Linked to a business and (usually) a bundle.
// ─────────────────────────────────────────────────────────────────────────────

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "restrict" }),
  bundleId: uuid("bundle_id").references(() => bundles.id, {
    onDelete: "set null",
  }),
  status: orderStatusEnum("status").notNull().default("pending"),
  // Stripe identifiers — set after payment confirmed
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeCheckoutSessionId: text("stripe_checkout_session_id").unique(),
  // Pricing snapshot (store at time of purchase, never derive from live catalog)
  subtotal: numeric("subtotal", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  total: numeric("total", { precision: 10, scale: 2 })
    .notNull()
    .default("0.00"),
  // Timestamps
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Order Items
// Line items within an order (bundle contents + add-ons).
// Prices are snapshotted at purchase time.
// ─────────────────────────────────────────────────────────────────────────────

export const orderItems = pgTable("order_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict" }),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const ordersRelations = relations(orders, ({ one, many }) => ({
  business: one(businesses, {
    fields: [orders.businessId],
    references: [businesses.id],
  }),
  bundle: one(bundles, {
    fields: [orders.bundleId],
    references: [bundles.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));
