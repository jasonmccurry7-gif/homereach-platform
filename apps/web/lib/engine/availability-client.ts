import type { SpotStatus } from "./types";

export class AvailabilityClientEngine {
  static getUrgencyLevel(available: number, total: number): "low" | "medium" | "high" | "critical" {
    if (total === 0) return "low";
    const pct = available / total;
    if (pct <= 0.15) return "critical";
    if (pct <= 0.35) return "high";
    if (pct <= 0.6) return "medium";
    return "low";
  }

  static getUrgencyMessage(available: number, total: number): string {
    const level = AvailabilityClientEngine.getUrgencyLevel(available, total);
    if (level === "critical") return `Only ${available} spot${available !== 1 ? "s" : ""} left - almost full!`;
    if (level === "high") return `${available} of ${total} spots remaining`;
    if (level === "medium") return `${available} spots still available`;
    return `${available} spots available`;
  }

  static getCategoryMessage(status: SpotStatus, reservedUntil: string | null): string {
    if (status === "sold") return "This category is taken";
    if (status === "reserved" || status === "in-progress") {
      if (reservedUntil) {
        const hoursLeft = Math.max(
          0,
          Math.round((new Date(reservedUntil).getTime() - Date.now()) / 3_600_000)
        );
        return `Reserved - ${hoursLeft}h remaining on hold`;
      }
      return "Currently reserved";
    }
    return "Available - claim your exclusive spot";
  }

  static getDominanceMessage(selectedCount: number, totalSpots: number): string {
    const pct = Math.round((selectedCount / totalSpots) * 100);
    if (selectedCount === 0) return "Select spots to build your presence";
    if (selectedCount === 1) return `${pct}% of postcard secured`;
    if (selectedCount >= totalSpots) return "Full card - 100% dominance. You own this market.";
    return `${selectedCount} of ${totalSpots} positions secured - ${pct}% visibility dominance`;
  }
}

export { AvailabilityClientEngine as AvailabilityEngine };
