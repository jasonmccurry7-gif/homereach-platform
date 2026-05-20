import { relations } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  boolean,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { businesses } from "./businesses";
import { categories, cities } from "./cities";
import { orders } from "./orders";
import { bundles } from "./products";
import { spotAssignments } from "./spots";

export const aiIntakeSessions = pgTable(
  "ai_intake_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id"),
    status: text("status").notNull().default("draft"),
    currentStep: text("current_step").notNull().default("cities"),
    selectedCityIds: uuid("selected_city_ids").array().notNull().default([]),
    selectedCategoryIds: uuid("selected_category_ids").array().notNull().default([]),
    businessName: text("business_name"),
    contactName: text("contact_name"),
    phone: text("phone"),
    email: text("email"),
    websiteUrl: text("website_url"),
    facebookUrl: text("facebook_url"),
    logoUrl: text("logo_url"),
    logoFileName: text("logo_file_name"),
    offerHeadline: text("offer_headline"),
    aiGenerateOffer: boolean("ai_generate_offer").notNull().default(false),
    militaryDiscountRequested: boolean("military_discount_requested").notNull().default(false),
    militaryDiscountEligible: boolean("military_discount_eligible").notNull().default(false),
    militaryDiscountNote: text("military_discount_note"),
    foundingPricingSeen: boolean("founding_pricing_seen").notNull().default(true),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalMonthlyCents: integer("total_monthly_cents").notNull().default(0),
    termMonths: integer("term_months").notNull().default(3),
    totalContractValueCents: integer("total_contract_value_cents").notNull().default(0),
    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripeCustomerId: text("stripe_customer_id"),
    checkoutUrl: text("checkout_url"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("ai_intake_sessions_status_idx").on(t.status, t.createdAt),
    userIdx: index("ai_intake_sessions_user_idx").on(t.userId, t.createdAt),
  }),
);

export const aiIntakeMessages = pgTable(
  "ai_intake_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiIntakeSessions.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    message: text("message").notNull(),
    stepKey: text("step_key"),
    structuredPayload: jsonb("structured_payload")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("ai_intake_messages_session_idx").on(t.sessionId, t.createdAt),
  }),
);

export const aiIntakeCartItems = pgTable(
  "ai_intake_cart_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiIntakeSessions.id, { onDelete: "cascade" }),
    cityId: uuid("city_id")
      .notNull()
      .references(() => cities.id, { onDelete: "restrict" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    placementType: text("placement_type").notNull(),
    spotPosition: integer("spot_position"),
    quantity: integer("quantity").notNull().default(1),
    pricingTier: text("pricing_tier").notNull().default("standard"),
    discountCode: text("discount_code"),
    monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
    termMonths: integer("term_months").notNull().default(3),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    availabilityStatus: text("availability_status").notNull().default("available"),
    availabilitySource: text("availability_source"),
    availabilityMessage: text("availability_message"),
    cityNameSnapshot: text("city_name_snapshot").notNull(),
    categoryNameSnapshot: text("category_name_snapshot").notNull(),
    placementLabel: text("placement_label").notNull(),
    bundleId: uuid("bundle_id").references(() => bundles.id, { onDelete: "set null" }),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "set null" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    spotAssignmentId: uuid("spot_assignment_id").references(() => spotAssignments.id, {
      onDelete: "set null",
    }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("ai_intake_cart_items_session_idx").on(t.sessionId, t.createdAt),
    cityCategoryIdx: index("ai_intake_cart_items_city_category_idx").on(
      t.cityId,
      t.categoryId,
      t.availabilityStatus,
    ),
  }),
);

export const aiIntakeConfirmations = pgTable(
  "ai_intake_confirmations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => aiIntakeSessions.id, { onDelete: "cascade" }),
    confirmedByUserId: uuid("confirmed_by_user_id"),
    confirmationStatus: text("confirmation_status").notNull().default("confirmed"),
    cartSnapshot: jsonb("cart_snapshot").$type<unknown[]>().notNull().default([]),
    businessSnapshot: jsonb("business_snapshot")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    totalMonthlyCents: integer("total_monthly_cents").notNull().default(0),
    totalContractValueCents: integer("total_contract_value_cents").notNull().default(0),
    adminStatus: text("admin_status").notNull().default("pending"),
    adminNotes: text("admin_notes"),
    overrideReason: text("override_reason"),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index("ai_intake_confirmations_session_idx").on(t.sessionId, t.createdAt),
  }),
);

export const aiIntakeSessionsRelations = relations(aiIntakeSessions, ({ many }) => ({
  messages: many(aiIntakeMessages),
  cartItems: many(aiIntakeCartItems),
  confirmations: many(aiIntakeConfirmations),
}));

export const aiIntakeMessagesRelations = relations(aiIntakeMessages, ({ one }) => ({
  session: one(aiIntakeSessions, {
    fields: [aiIntakeMessages.sessionId],
    references: [aiIntakeSessions.id],
  }),
}));

export const aiIntakeCartItemsRelations = relations(aiIntakeCartItems, ({ one }) => ({
  session: one(aiIntakeSessions, {
    fields: [aiIntakeCartItems.sessionId],
    references: [aiIntakeSessions.id],
  }),
  city: one(cities, { fields: [aiIntakeCartItems.cityId], references: [cities.id] }),
  category: one(categories, {
    fields: [aiIntakeCartItems.categoryId],
    references: [categories.id],
  }),
}));

export const aiIntakeConfirmationsRelations = relations(aiIntakeConfirmations, ({ one }) => ({
  session: one(aiIntakeSessions, {
    fields: [aiIntakeConfirmations.sessionId],
    references: [aiIntakeSessions.id],
  }),
}));
