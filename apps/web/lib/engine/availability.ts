// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Availability Engine
//
// Real-time spot availability, scarcity messaging, and fill-rate logic.
//
// Usage (with repository injected — preferred):
//   const engine = new AvailabilityEngine(getSpotRepository());
//   const cityData = await engine.getCityAvailability("city-medina");
//
// Pure utility methods remain static and synchronous so UI components can
// call them without awaiting (e.g. getUrgencyMessage, getDominanceMessage).
// ─────────────────────────────────────────────────────────────────────────────

import type { Spot, SpotStatus, CityAvailability, CategoryAvailability } from "./types";
import type { ISpotRepository } from "./db/interfaces";
import { getSpotRepository } from "./db/factory";

// ── Status priority for sorting ───────────────────────────────────────────────
const STATUS_SORT: Record<SpotStatus, number> = {
  "in-progress": 0,
  reserved:      1,
  available:     2,
  sold:          3,
};

// ── Engine ────────────────────────────────────────────────────────────────────

export class AvailabilityEngine {
  private repo: ISpotRepository;

  constructor(repo?: ISpotRepository) {
    this.repo = repo ?? getSpotRepository();
  }

  // ── Instance methods (async, repo-backed) ─────────────────────────────────

  /**
   * Full availability breakdown for a single city.
   */
  async getCityAvailability(cityId: string): Promise<CityAvailability> {
    const spots = (await this.repo.getByCity(cityId)).sort(
      (a, b) => STATUS_SORT[a.status] - STATUS_SORT[b.status]
    );

    const total     = spots.length;
    const available = spots.filter((s) => s.status === "available").length;
    const reserved  = spots.filter((s) => s.status === "reserved" || s.status === "in-progress").length;
    const sold      = spots.filter((s) => s.status === "sold").length;
    const fillPct   = total > 0 ? Math.round(((sold + reserved) / total) * 100) : 0;

    return {
      cityId,
      cityName: spots[0]?.cityName ?? cityId,
      totalSpots: total,
      availableSpots: available,
      reservedSpots: reserved,
      soldSpots: sold,
      isFullCardAvailable: available === total,
      fillPercent: fillPct,
      urgencyLevel: AvailabilityEngine.getUrgencyLevel(available, total),
      spots,
    };
  }

  /**
   * All cities with their summary stats.
   */
  async getAllCities(): Promise<CityAvailability[]> {
    const all = await this.repo.getAll();
    const cityIds = [...new Set(all.map((s) => s.cityId))];

    return Promise.all(cityIds.map((id) => this.getCityAvailability(id)));
  }

  /**
   * Category availability within a specific city.
   */
  async getCategoryAvailability(cityId: string, categoryId: string): Promise<CategoryAvailability | null> {
    const spot = await this.repo.getByCityAndCategory(cityId, categoryId);
    if (!spot) return null;
    return {
      categoryId: spot.categoryId,
      categoryName: spot.categoryName,
      cityId: spot.cityId,
      status: spot.status,
      reservedUntil: spot.reservedUntil,
      isLocked: spot.status === "sold" || spot.status === "reserved",
    };
  }

  /**
   * Check whether the full-card is still purchasable in a city (every spot available).
   */
  async isFullCardAvailable(cityId: string): Promise<boolean> {
    const spots = await this.repo.getByCity(cityId);
    return spots.length > 0 && spots.every((s) => s.status === "available");
  }

  // ── Pure static utilities (sync, no repo) ────────────────────────────────

  /** Map available/total → urgency tier */
  static getUrgencyLevel(available: number, total: number): "low" | "medium" | "high" | "critical" {
    if (total === 0) return "low";
    const pct = available / total;
    if (pct <= 0.15) return "critical";
    if (pct <= 0.35) return "high";
    if (pct <= 0.6)  return "medium";
    return "low";
  }

  /** Scarcity message copy for UI display */
  static getUrgencyMessage(available: number, total: number): string {
    const level = AvailabilityEngine.getUrgencyLevel(available, total);
    if (level === "critical") return `🔴 Only ${available} spot${available !== 1 ? "s" : ""} left — almost full!`;
    if (level === "high")     return `🟠 ${available} of ${total} spots remaining`;
    if (level === "medium")   return `🟡 ${available} spots still available`;
    return `🟢 ${available} spots available`;
  }

  /** Category-level scarcity message */
  static getCategoryMessage(status: SpotStatus, reservedUntil: string | null): string {
    if (status === "sold") return "🔴 This category is taken";
    if (status === "reserved" || status === "in-progress") {
      if (reservedUntil) {
        const hoursLeft = Math.max(
          0,
          Math.round((new Date(reservedUntil).getTime() - Date.now()) / 3_600_000)
        );
        return `🟠 Reserved — ${hoursLeft}h remaining on hold`;
      }
      return "🟠 Currently reserved";
    }
    return "🟢 Available — claim your exclusive spot";
  }

  /** Visibility dominance copy (for multi-spot selection UI) */
  static getDominanceMessage(selectedCount: number, totalSpots: number): string {
    const pct = Math.round((selectedCount / totalSpots) * 100);
    if (selectedCount === 0)              return "Select spots to build your presence";
    if (selectedCount === 1)              return `${pct}% of postcard secured`;
    if (selectedCount >= totalSpots)      return "🏆 Full card — 100% dominance. You own this market.";
    return `${selectedCount} of ${totalSpots} positions secured — ${pct}% visibility dominance`;
  }
}
