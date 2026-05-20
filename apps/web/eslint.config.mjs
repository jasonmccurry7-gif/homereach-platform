import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      ".codex-next/**",
      ".codex-next-smoke/**",
      "next-env.d.ts",
      "node_modules/**",
      "out/**",
      "dist/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-require-imports": "warn",
      "@typescript-eslint/prefer-as-const": "warn",
      "prefer-const": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
];

export default eslintConfig;
