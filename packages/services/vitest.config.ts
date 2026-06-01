import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@homereach/db/schema": resolve(rootDir, "test/mocks/db-schema.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
