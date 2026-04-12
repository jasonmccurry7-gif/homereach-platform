import {
  pgTable,
  uuid,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { businesses } from "./businesses";
import { spotAssignments } from "./spots";

// ─────────────────────────────────────────────────────────────────────────────
// intake_submissions
//
// Post-payment onboarding form for the shared postcard product.
// Created automatically by the subscription.created webhook handler.
// Customer completes at: /intake/[access_token]
//
// access_token is a UUID used as a public URL parameter.
// Never expose the spot_assignment_id or id in the URL.
// ─────────────────────────────────────────────────────────────────────────────

export const intakeSubmissions = pgTable("intake_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),

  // Foreign keys
  spotAssignmentId: uuid("spot_assignment_id")
    .notNull()
    .references(() => spotAssignments.id, { onDelete: "cascade" }),
  businessId: uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),

  // Public URL token — unique, never guessable
  accessToken: uuid("access_token").notNull().defaultRandom(),

  // Lifecycle
  // pending     → created, awaiting customer submission
  // submitted   → customer submitted form
  // reviewed    → admin has reviewed and actioned
  status: text("status").notNull().default("pending"),

  // Form fields (nullable — filled in by customer at /intake/[token])
  serviceArea: text("service_area"),
  targetCustomer: text("target_customer"),
  keyOffer: text("key_offer"),
  differentiators: text("differentiators"),
  additionalNotes: text("additional_notes"),

  // Timestamps
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const intakeSubmissionsRelations = relations(
  intakeSubmissions,
  ({ one }) => ({
    spotAssignment: one(spotAssignments, {
      fields: [intakeSubmissions.spotAssignmentId],
      references: [spotAssignments.id],
    }),
    business: one(businesses, {
      fields: [intakeSubmissions.businessId],
      references: [businesses.id],
    }),
  })
);
