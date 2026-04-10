// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Drizzle Schema Index
// All tables and relations exported from a single entry point.
// Import from "@homereach/db" in applications.
// ─────────────────────────────────────────────────────────────────────────────

// Users & Auth
export * from "./users";

// Geography
export * from "./cities";

// Catalog
export * from "./products";

// Core entities
export * from "./businesses";

// Transactions
export * from "./orders";

// Outreach engine
export * from "./outreach";

// Waitlist, nonprofit, sponsorship
export * from "./misc";

// Marketing campaigns + metrics (Phase 3)
export * from "./marketing";
