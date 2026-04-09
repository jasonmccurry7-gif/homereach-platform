import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

// Load from root .env or local .env
config({ path: "../../.env" });
config({ path: ".env" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for Drizzle migrations");
}

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Verbose output during migration
  verbose: true,
  strict: true,
});
