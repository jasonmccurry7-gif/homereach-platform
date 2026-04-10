// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Reservation Engine
//
// Soft-locks spots when a lead begins intake or is marked "interested."
// Prevents double-booking during the sales window.
//
// Usage (with repository injected — preferred):
//   const engine = new ReservationEngine(getReservationRepository());
//   const result = await engine.reserve({ spotId, cityId, ... });
//
// Pure utility methods (isExpired, hoursRemaining, countdownLabel) remain
// static and synchronous for convenience in UI components.
// ─────────────────────────────────────────────────────────────────────────────

import type { Reservation, ReservationResult, ReservationStatus } from "./types";
import type { IReservationRepository } from "./db/interfaces";
import { getReservationRepository } from "./db/factory";

// ── Engine ────────────────────────────────────────────────────────────────────

export class ReservationEngine {
  private repo: IReservationRepository;

  constructor(repo?: IReservationRepository) {
    this.repo = repo ?? getReservationRepository();
  }

  // ── Instance methods (async, repo-backed) ─────────────────────────────────

  /**
   * Reserve a spot for a lead.  Creates a time-limited soft lock.
   * ttlHours defaults to 24 — configurable per use case.
   */
  async reserve(params: {
    spotId: string;
    cityId: string;
    categoryId: string;
    businessId: string;
    businessName: string;
    leadId: string;
    ttlHours?: number;
    createdBy?: string;
  }): Promise<ReservationResult> {
    // Reject if spot already has an active, non-expired reservation
    const existing = await this.repo.getActiveForSpot(params.spotId);
    if (existing && !ReservationEngine.isExpired(existing)) {
      return { success: false, error: "already_reserved" };
    }

    const reservation = await this.repo.create({
      spotId:       params.spotId,
      cityId:       params.cityId,
      categoryId:   params.categoryId,
      businessId:   params.businessId,
      businessName: params.businessName,
      leadId:       params.leadId,
      ttlHours:     params.ttlHours ?? 24,
      createdBy:    params.createdBy,
    });

    return { success: true, reservation };
  }

  /**
   * Get active (non-expired) reservation for a spot, or null.
   */
  async getActiveForSpot(spotId: string): Promise<Reservation | null> {
    const res = await this.repo.getActiveForSpot(spotId);
    if (!res || ReservationEngine.isExpired(res)) return null;
    return res;
  }

  /**
   * All active (non-expired) reservations, sorted soonest-expiring first.
   */
  async getAllActive(): Promise<Reservation[]> {
    const all = await this.repo.getAll({ activeOnly: true });
    return all
      .filter((r) => !ReservationEngine.isExpired(r))
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }

  /**
   * All reservations regardless of status, sorted newest first.
   */
  async getAll(): Promise<Reservation[]> {
    return this.repo.getAll();
  }

  /**
   * Admin override: force-release, extend TTL, or mark converted.
   */
  async adminOverride(
    reservationId: string,
    action: "release" | "extend" | "convert",
    adminNote?: string
  ): Promise<boolean> {
    const res = await this.repo.getById(reservationId);
    if (!res) return false;

    if (action === "release") {
      await this.repo.updateStatus(reservationId, "cancelled", adminNote);
    } else if (action === "extend") {
      await this.repo.extend(reservationId, res.ttlHours);
    } else if (action === "convert") {
      await this.repo.updateStatus(reservationId, "converted", adminNote);
    }

    return true;
  }

  /**
   * Release a reservation (lead declined or intake not completed).
   */
  async release(reservationId: string): Promise<boolean> {
    const res = await this.repo.getById(reservationId);
    if (!res) return false;
    await this.repo.updateStatus(reservationId, "cancelled");
    return true;
  }

  // ── Pure static utilities (sync, no repo) ────────────────────────────────

  /** True if the reservation's expiry has passed */
  static isExpired(reservation: Reservation): boolean {
    return new Date(reservation.expiresAt).getTime() < Date.now();
  }

  /** Hours remaining on a reservation (returns 0 if expired) */
  static hoursRemaining(reservation: Reservation): number {
    return Math.max(
      0,
      Math.round((new Date(reservation.expiresAt).getTime() - Date.now()) / 3_600_000)
    );
  }

  /** Human-readable countdown string for UI display */
  static countdownLabel(reservation: Reservation): string {
    const hrs = ReservationEngine.hoursRemaining(reservation);
    if (hrs === 0) return "Expired";
    if (hrs < 1)   return "< 1 hour remaining";
    return `${hrs}h remaining`;
  }
}
