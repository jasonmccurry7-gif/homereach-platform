// ─────────────────────────────────────────────────────────────────────────────
// PostagePricingProvider — USPS EDDM Rate Management
//
// Priority order for rate resolution:
//   1. Manual admin override (highest priority)
//   2. In-memory cache from last successful live fetch
//   3. Static fallback default (always available)
//
// Future: swap TODO block for real USPS API / postal rate service call.
// ─────────────────────────────────────────────────────────────────────────────

import type { PostageRate, PricingSource } from "../types";

// ── USPS EDDM Known Rates (as of 2024) ───────────────────────────────────────
// Source: https://pe.usps.com/text/dmm300/Notice123.htm
// Update this table when USPS publishes annual rate changes.
export const USPS_EDDM_RATES = {
  /** Standard retail EDDM (post office drop, no permit required) */
  EDDM_RETAIL: { ratePerPiece: 0.242, rateName: "EDDM Retail" },
  /** Business mail entry unit drop (requires permit, higher volume) */
  EDDM_BMEU:   { ratePerPiece: 0.209, rateName: "EDDM BMEU"   },
} as const;

// Default rate used when no override or cache is present
const DEFAULT_RATE_KEY: keyof typeof USPS_EDDM_RATES = "EDDM_RETAIL";

// ── Provider Class ────────────────────────────────────────────────────────────

export class PostagePricingProvider {
  // Module-level singletons — survive across request lifecycle in Next.js dev
  private static _cache: PostageRate | null = null;
  private static _manualOverride: number | null = null;
  private static _manualOverrideNote: string = "";

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Resolve and return the current best postage rate.
   * Returns manual override > cached live > static default.
   */
  static async getRate(): Promise<PostageRate> {
    // 1. Manual admin override takes top priority
    if (this._manualOverride !== null) {
      return {
        ratePerPiece: this._manualOverride,
        rateName: this._manualOverrideNote || "Admin Override",
        source: "manual",
        fetchedAt: new Date().toISOString(),
      };
    }

    // 2. In-memory cache from a previous live fetch
    if (this._cache) {
      return { ...this._cache, source: "cached" };
    }

    // 3. Attempt live pricing fetch
    //    TODO: replace with real USPS Postal Pro API or Stamps.com rate fetch
    //    const live = await fetchUSPSLiveRate();
    //    if (live) {
    //      this._cache = { ...live, source: "live", fetchedAt: new Date().toISOString() };
    //      return this._cache;
    //    }

    // 4. Static fallback — always succeeds
    return this._buildDefault("manual");
  }

  /** Synchronous fallback for cases where you can't await */
  static getRateSync(): PostageRate {
    if (this._manualOverride !== null) {
      return {
        ratePerPiece: this._manualOverride,
        rateName: this._manualOverrideNote || "Admin Override",
        source: "manual",
        fetchedAt: new Date().toISOString(),
      };
    }
    if (this._cache) return { ...this._cache, source: "cached" };
    return this._buildDefault("manual");
  }

  // ── Admin Controls ──────────────────────────────────────────────────────────

  /** Set a manual per-piece rate that overrides everything else */
  static setManualRate(ratePerPiece: number, note?: string): void {
    this._manualOverride = ratePerPiece;
    this._manualOverrideNote = note ?? "Admin Override";
  }

  /** Remove manual override (falls back to cache or default) */
  static clearManualOverride(): void {
    this._manualOverride = null;
    this._manualOverrideNote = "";
  }

  /** Simulate receiving a live rate (call from background fetch job) */
  static updateCache(rate: PostageRate): void {
    this._cache = { ...rate, source: "live", fetchedAt: new Date().toISOString() };
  }

  /** Expire the cached live rate to force a re-fetch next call */
  static clearCache(): void {
    this._cache = null;
  }

  // ── Introspection ───────────────────────────────────────────────────────────

  static getCachedRate(): PostageRate | null {
    return this._cache;
  }

  static getManualRate(): { rate: number; note: string } | null {
    if (this._manualOverride === null) return null;
    return { rate: this._manualOverride, note: this._manualOverrideNote };
  }

  /** Returns the active source label for UI display */
  static getSourceLabel(): { source: PricingSource; label: string } {
    if (this._manualOverride !== null) return { source: "manual",  label: "Manual Override" };
    if (this._cache)                   return { source: "cached",  label: "Cached (Last Live)" };
    return                                    { source: "manual",  label: "Static Default" };
  }

  /** All available USPS EDDM rate options for admin selection */
  static getAvailableRates(): Array<{ key: string; ratePerPiece: number; rateName: string }> {
    return Object.entries(USPS_EDDM_RATES).map(([key, val]) => ({ key, ...val }));
  }

  // ── Private Helpers ─────────────────────────────────────────────────────────

  private static _buildDefault(source: PricingSource): PostageRate {
    const base = USPS_EDDM_RATES[DEFAULT_RATE_KEY];
    return {
      ratePerPiece: base.ratePerPiece,
      rateName:     base.rateName,
      source,
      fetchedAt:    new Date().toISOString(),
    };
  }
}
