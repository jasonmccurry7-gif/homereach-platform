// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Drizzle Schema Index
// All tables and relations exported from a single entry point.
// Import from "@homereach/db" in applications.
// ─────────────────────────────────────────────────────────────────────────────

// Users & Auth
export * from "./users.js";

// Geography
export * from "./cities.js";

// Catalog
export * from "./products.js";

// Core entities
export * from "./businesses.js";

// Transactions
export * from "./orders.js";

// Outreach engine
export * from "./outreach.js";

// Waitlist, nonprofit, sponsorship
export * from "./misc.js";

// Marketing campaigns + metrics (Phase 3)
export * from "./marketing.js";
