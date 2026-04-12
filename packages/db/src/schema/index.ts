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

// Pricing engine — profiles + discount rules (Task 20)
export * from "./pricing";

// Lead capture — Facebook + external leads
export * from "./leads";

// Targeted Route Campaign product
export * from "./targeted";

// Shared Postcard spot inventory (Migration 15)
export * from "./spots";

// Post-payment intake onboarding (Migration 16)
export * from "./intake";

// Persistent conversation log (Migration 17)
export * from "./conversations";

// Growth intelligence — daily activity tracking (Migration 19)
export * from "./growth";

// Sales execution system — outbound leads + event tracking (Migration 20)
export * from "./sales";
