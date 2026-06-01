import "server-only";

import { createHash } from "node:crypto";

export function buildContentHash(parts: unknown[]) {
  const normalized = parts
    .map((part) => {
      if (part === null || part === undefined) return "";
      if (typeof part === "string") return part.trim();
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .join("\n---\n");

  return createHash("sha256").update(normalized).digest("hex");
}
