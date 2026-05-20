// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Sales Intelligence Q&A Schema (V1a)
//
// New isolated module. Does not modify any existing schema file.
// To make these tables visible to the rest of the app, add ONE line to
// packages/db/src/schema/index.ts:
//
//     export * from "./qa";
//
// (This is the only existing file that needs to be touched.)
// ─────────────────────────────────────────────────────────────────────────────

export * from "./questions";
export * from "./answers";
export * from "./replies";
export * from "./votes";
export * from "./scripts";
export * from "./attachments";
export * from "./knowledge";
export * from "./usage";
export * from "./enums";
