// ─────────────────────────────────────────────────────────────────────────────
// Shared header validation. Each importer spec defines an alias map for
// vendor-vs-canonical column names; this utility uses that map to compute
// "missing required" and "unknown" header columns.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param headers           Lowercased CSV headers as parsed by the CSV reader.
 * @param required          Canonical names that must be satisfied.
 * @param optional          Canonical names that we recognize but don't require.
 * @param aliases           canonical → list of accepted header names. Always
 *                          include the canonical name itself in its alias list.
 */
export function verifyAgainstAliases(
  headers: string[],
  required: readonly string[],
  optional: readonly string[],
  aliases: Record<string, readonly string[]>,
): { missing: string[]; unknown: string[] } {
  const headerSet = new Set(headers.filter((h) => h.length > 0));

  const isSatisfied = (canonical: string): boolean => {
    const candidates = aliases[canonical] ?? [canonical];
    for (const c of candidates) {
      if (headerSet.has(c)) return true;
    }
    return false;
  };

  const missing: string[] = [];
  for (const req of required) {
    if (!isSatisfied(req)) missing.push(req);
  }

  // Unknown = headers not matched by any alias of any known canonical.
  const allKnownAliases = new Set<string>();
  for (const c of [...required, ...optional]) {
    for (const alias of aliases[c] ?? [c]) {
      allKnownAliases.add(alias);
    }
  }

  const unknown: string[] = [];
  for (const h of headerSet) {
    if (!allKnownAliases.has(h)) unknown.push(h);
  }

  return { missing, unknown };
}
