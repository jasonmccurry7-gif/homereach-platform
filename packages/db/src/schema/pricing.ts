import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  jsonb,
  pgEnum,
  timestamp,
  numeric,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
//
// NOTE: productTypeEnum in products.ts uses DB name "product_type" for the
// product catalog. This is a DIFFERENT enum: "pricing_product_type" for the
// pricing engine. Different DB names, different variable names — no collision.
// ─────────────────────────────────────────────────────────────────────────────

export const pricingProductTypeEnum = pgEnum("pricing_product_type", [
  "spot",
  "addon",
  "automation",
  "bundle",
  "campaign",
  "setup_fee",
]);

export const spotTypeEnum = pgEnum("spot_type", [
  "anchor",
  "front_feature",
  "back_feature",
  "full_card",
]);

export const billingIntervalEnum = pgEnum("billing_interval", [
  "monthly",
  "one_time",
  "per_unit",
  "per_drop",
]);

export const discountRuleTypeEnum = pgEnum("discount_rule_type", [
  "military",
  "multi_spot",
  "promo_code",
  "future_reserved",
]);

// ─────────────────────────────────────────────────────────────────────────────
// pricing_profiles
//
// Root pricing authority for all billing amounts in HomeReach.
// Every checkout must resolve price through this table — never from
// bundles.price or any hardcoded value.
//
// Resolution order (enforced in packages/services/src/pricing/index.ts):
//   1. base_price_cents from this table
//   2. founding_price_cents if isFounding=true
//   3. bundle-level profile override
//   4. military discount (via discount_rules)
//   5. multi-spot discount (via discount_rules)
// ─────────────────────────────────────────────────────────────────────────────

export const pricingProfiles = pgTable(
  "pricing_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // Human label — used for admin display and seed lookups
    name: text("name").notNull(),

    // Product classification
    productType: pricingProductTypeEnum("product_type").notNull(),
    spotType: spotTypeEnum("spot_type"), // nullable — only set for "spot" products

    // Billing model
    billingInterval: billingIntervalEnum("billing_interval").notNull(),

    // Pricing amounts (all in US cents — never fractional dollars in DB)
    basePriceCents: integer("base_price_cents").notNull().default(0),
    compareAtPriceCents: integer("compare_at_price_cents"), // strike-through display price
    foundingPriceCents: integer("founding_price_cents"),    // applied when isFounding=true

    // Per-unit pricing (campaigns only)
    perUnitPriceCentsMin: integer("per_unit_price_cents_min"),
    perUnitPriceCentsMax: integer("per_unit_price_cents_max"),

    // Quantity constraints
    minQuantity: integer("min_quantity"),  // min homes for campaigns
    maxQuantity: integer("max_quantity"),  // null = no limit

    // Subscription term minimum (magnet=6, calendar=12, null=no min)
    minCommitmentMonths: integer("min_commitment_months"),

    // Homes mailed per drop — drives marketingCampaigns.homesPerDrop at creation
    homesPerDrop: integer("homes_per_drop"),

    // Points to the matching one_time setup_fee profile for automation tiers
    // Self-referencing FK: Lead Capture Monthly → Lead Capture Setup Fee
    setupFeeProfileId: uuid("setup_fee_profile_id").references(
      (): AnyPgColumn => pricingProfiles.id,
      { onDelete: "set null" }
    ),

    // Lifecycle
    isActive: boolean("is_active").notNull().default(true),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),

    // Extension point — not read by pricing engine
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Partial unique index: only one active profile per (product_type, spot_type, billing_interval)
    // This ensures getActivePricingProfile() is deterministic — no two active rows can match
    // the same lookup key. Inactive profiles are excluded (historical records preserved).
    activeUniqueIdx: uniqueIndex("idx_pp_active_unique_lookup")
      .on(t.productType, t.billingInterval)
      .where(/* will use SQL where clause in migration — see 04_pricing_profiles.sql */),

    productTypeIdx: index("idx_pp_product_type").on(t.productType),
    spotTypeIdx: index("idx_pp_spot_type").on(t.spotType),
    activeIdx: index("idx_pp_is_active").on(t.isActive),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// discount_rules
//
// All discount logic in data-driven format. No discount percentages are
// hardcoded in service code — they are read from this table.
//
// Evaluation order: rules are sorted by priority ASC.
// stackable=false stops processing after this rule fires.
// ─────────────────────────────────────────────────────────────────────────────

export const discountRules = pgTable("discount_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ruleType: discountRuleTypeEnum("rule_type").notNull(),
  description: text("description").notNull(),

  // Discount amount — use ONE of these, not both
  discountPct: numeric("discount_pct", { precision: 5, scale: 2 }),  // e.g. "10.00"
  discountCents: integer("discount_cents"),                            // flat amount

  // Qualification criteria — structure varies by rule_type (see service layer)
  conditions: jsonb("conditions")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  // What happens when this rule fires
  effect: jsonb("effect")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  // Processing order — lower = applied first
  priority: integer("priority").notNull().default(100),

  // When false: once this rule fires, no lower-priority rules apply
  stackable: boolean("stackable").notNull().default(false),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const pricingProfilesRelations = relations(
  pricingProfiles,
  ({ one, many }) => ({
    setupFeeProfile: one(pricingProfiles, {
      fields: [pricingProfiles.setupFeeProfileId],
      references: [pricingProfiles.id],
      relationName: "setupFee",
    }),
    // Reverse: profiles that point TO this as their setup fee
    monthliesUsingThisAsFee: many(pricingProfiles, {
      relationName: "setupFee",
    }),
    // Forward refs to tasks 1+2 tables (not yet in schema — populated later)
    // spots: many(spots),        // Task 1
    // bundles: many(bundles),    // wired in products.ts
  })
);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type PricingProfile = typeof pricingProfiles.$inferSelect;
export type NewPricingProfile = typeof pricingProfiles.$inferInsert;
export type DiscountRule = typeof discountRules.$inferSelect;
export type NewDiscountRule = typeof discountRules.$inferInsert;
