import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses";
import { cities, categories } from "./cities";

// ─────────────────────────────────────────────────────────────────────────────
// Enums — must match Migration 15 exactly
// ─────────────────────────────────────────────────────────────────────────────

export const spotAssignmentStatusEnum = pgEnum("spot_assignment_status", [
  "pending",
  "active",
  "paused",
  "churned",
  "cancelled",
]);

export const spotTypeEnum = pgEnum("spot_type", [
  "anchor",
  "front_feature",
  "back_feature",
  "full_card",
]);

// ─────────────────────────────────────────────────────────────────────────────
// spot_assignments
//
// Inventory table for shared postcard spots.
// One active/pending row per city+category enforced by partial unique index
// in Migration 15. Drizzle does not know about the partial index — do not
// attempt to express it here; the DB enforces it.
//
// Lifecycle:
//   pending   → checkout started, spot reserved, awaiting Stripe confirmation
//   active    → subscription paid, business is live on the postcard
//   paused    → invoice.payment_failed, grace period running
//   churned   → subscription cancelled or grace period expired — slot is free
//   cancelled → abandoned checkout (never paid) — slot is free
// ─────────────────────────────────────────────────────────────────────────────

export const spotAssignments = pgTable("spot_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Which business holds this spot (null during checkout before business exists)
  businessId: uuid("business_id").references(() => businesses.id, {
    onDelete: "restrict",
  }),

  // Market + category — both required
  cityId: uuid("city_id")
    .notNull()
    .references(() => cities.id, { onDelete: "restrict" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "restrict" }),

  // What type of spot was purchased
  spotType: spotTypeEnum("spot_type").notNull().default("anchor"),

  // Lifecycle status
  status: spotAssignmentStatusEnum("status").notNull().default("pending"),

  // Stripe identifiers
  stripeSubscriptionId: text("stripe_subscription_id").unique(),
  stripeCustomerId: text("stripe_customer_id"),

  // Commitment tracking
  // Set to activated_at + 90 days when subscription.created fires
  commitmentEndsAt: timestamp("commitment_ends_at", { withTimezone: true }),
  activatedAt: timestamp("activated_at", { withTimezone: true }),
  releasedAt: timestamp("released_at", { withTimezone: true }),

  // Pricing (in cents)
  monthlyValueCents: integer("monthly_value_cents").notNull().default(0),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const spotAssignmentsRelations = relations(
  spotAssignments,
  ({ one, many }) => ({
    business: one(businesses, {
      fields: [spotAssignments.businessId],
      references: [businesses.id],
    }),
    city: one(cities, {
      fields: [spotAssignments.cityId],
      references: [cities.id],
    }),
    category: one(categories, {
      fields: [spotAssignments.categoryId],
      references: [categories.id],
    }),
    intakeSubmissions: many(intakeSubmissions),
  })
);

// Circular ref
import { intakeSubmissions } from "./intake";
