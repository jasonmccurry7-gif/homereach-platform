// ─────────────────────────────────────────────────────────────────────────────
// Deduplication Engine
// Strategy: phone-first → email → business_name+city → website
// Never loses data — marks duplicates and logs merge decisions
// ─────────────────────────────────────────────────────────────────────────────

export type NormalizedLead = {
  externalId: string;
  businessName: string;
  contactName?: string;
  email?: string;
  phone?: string;
  website?: string;
  city?: string;
  category?: string;
  score?: number;
};

export type DedupeResult = {
  canonical: NormalizedLead;
  duplicates: NormalizedLead[];
  matchReason: string;
  mergeLog: string[];
};

export class DedupeEngine {
  private phoneIndex   = new Map<string, NormalizedLead>();
  private emailIndex   = new Map<string, NormalizedLead>();
  private nameCity     = new Map<string, NormalizedLead>();
  private websiteIndex = new Map<string, NormalizedLead>();

  private canonicals  = new Map<string, NormalizedLead>();  // externalId → canonical
  private duplicates  = new Map<string, string>();          // dupe externalId → canonical externalId
  private mergeLogs:  Array<{ canonical: string; duplicate: string; reason: string }> = [];

  normalizePhone(p: string | undefined): string | undefined {
    if (!p) return undefined;
    const digits = p.replace(/\D/g, "");
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
    if (digits.length >= 10) return `+1${digits.slice(-10)}`;
    return undefined;
  }

  normalizeEmail(e: string | undefined): string | undefined {
    return e?.trim().toLowerCase() || undefined;
  }

  normalizeNameCity(name: string | undefined, city: string | undefined): string | undefined {
    if (!name) return undefined;
    const n = name.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
    const c = city?.toLowerCase().trim() ?? "";
    return `${n}__${c}`;
  }

  normalizeWebsite(w: string | undefined): string | undefined {
    if (!w) return undefined;
    return w.toLowerCase()
      .replace(/^https?:\/\/(www\.)?/, "")
      .replace(/\/$/, "")
      .trim();
  }

  /**
   * Process a lead through the dedupe engine.
   * Returns: { isDuplicate: boolean; canonicalId: string | null }
   */
  process(lead: NormalizedLead): { isDuplicate: boolean; canonicalId: string | null; reason: string } {
    const phone   = this.normalizePhone(lead.phone);
    const email   = this.normalizeEmail(lead.email);
    const nameCity = this.normalizeNameCity(lead.businessName, lead.city);
    const website = this.normalizeWebsite(lead.website);

    // Check phone first (strongest signal)
    if (phone) {
      const existing = this.phoneIndex.get(phone);
      if (existing) {
        this.markDuplicate(lead, existing, "same_phone");
        return { isDuplicate: true, canonicalId: existing.externalId, reason: "same_phone" };
      }
    }

    // Check email
    if (email) {
      const existing = this.emailIndex.get(email);
      if (existing) {
        this.markDuplicate(lead, existing, "same_email");
        // Merge phone into canonical if canonical lacks it
        if (phone && !this.phoneIndex.get(phone)) {
          this.phoneIndex.set(phone, existing);
        }
        return { isDuplicate: true, canonicalId: existing.externalId, reason: "same_email" };
      }
    }

    // Check name+city
    if (nameCity) {
      const existing = this.nameCity.get(nameCity);
      if (existing) {
        this.markDuplicate(lead, existing, "same_name_city");
        return { isDuplicate: true, canonicalId: existing.externalId, reason: "same_name_city" };
      }
    }

    // Check website
    if (website) {
      const existing = this.websiteIndex.get(website);
      if (existing) {
        this.markDuplicate(lead, existing, "same_website");
        return { isDuplicate: true, canonicalId: existing.externalId, reason: "same_website" };
      }
    }

    // Not a duplicate — register
    this.canonicals.set(lead.externalId, lead);
    if (phone)    this.phoneIndex.set(phone, lead);
    if (email)    this.emailIndex.set(email, lead);
    if (nameCity) this.nameCity.set(nameCity, lead);
    if (website)  this.websiteIndex.set(website, lead);

    return { isDuplicate: false, canonicalId: null, reason: "" };
  }

  private markDuplicate(dupe: NormalizedLead, canonical: NormalizedLead, reason: string) {
    this.duplicates.set(dupe.externalId, canonical.externalId);
    this.mergeLogs.push({ canonical: canonical.externalId, duplicate: dupe.externalId, reason });
  }

  getDuplicateMap() { return this.duplicates; }
  getMergeLogs()    { return this.mergeLogs; }
  getCanonicalCount() { return this.canonicals.size; }

  getSummary() {
    return {
      canonicals: this.canonicals.size,
      duplicates: this.duplicates.size,
      mergeLogs: this.mergeLogs.length,
      byReason: this.mergeLogs.reduce((acc, log) => {
        acc[log.reason] = (acc[log.reason] ?? 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  }
}
