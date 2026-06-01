import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "client",
  "nonprofit",
  "sponsor",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Profiles
// Extends Supabase auth.users — one row per authenticated user.
// The `id` column matches auth.users.id exactly.
// ─────────────────────────────────────────────────────────────────────────────

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // matches auth.users.id
  role: userRoleEnum("role").notNull().default("client"),
  fullName: text("full_name").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const profilesRelations = relations(profiles, ({ many }) => ({
  businesses: many(businesses),
}));

// Circular ref resolved via lazy import in index
import { businesses } from "./businesses.js";
