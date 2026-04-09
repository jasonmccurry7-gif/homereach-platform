// ─────────────────────────────────────────────────────────────────────────────
// Mock Reservation Repository
// In-memory implementation of IReservationRepository.
// ─────────────────────────────────────────────────────────────────────────────

import type { Reservation, ReservationStatus } from "../../types";
import type {
  IReservationRepository,
  CreateReservationInput,
  ReservationFilter,
} from "../interfaces";

// Seed with realistic active reservations
const SEED: Reservation[] = [
  {
    id: "res-1",
    spotId: "spot-med-hvac",
    cityId: "city-medina",
    categoryId: "cat-hvac",
    businessId: "biz-1",
    businessName: "Townsend HVAC",
    leadId: "lead-3",
    status: "active",
    createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString(),
    expiresAt: new Date(Date.now() + 18 * 3_600_000).toISOString(),
    ttlHours: 24,
  },
  {
    id: "res-2",
    spotId: "spot-hud-realtor",
    cityId: "city-hudson",
    categoryId: "cat-realtor",
    businessId: "biz-9",
    businessName: "Frost Realty",
    leadId: "lead-8",
    status: "active",
    createdAt: new Date(Date.now() - 14 * 3_600_000).toISOString(),
    expiresAt: new Date(Date.now() + 10 * 3_600_000).toISOString(),
    ttlHours: 24,
  },
];

export class MockReservationRepository implements IReservationRepository {
  private store: Map<string, Reservation> = new Map(SEED.map((r) => [r.id, r]));

  async create(input: CreateReservationInput): Promise<Reservation> {
    const ttlHours = input.ttlHours ?? 24;
    const now = Date.now();
    const reservation: Reservation = {
      id: `res-${now}`,
      spotId:       input.spotId,
      cityId:       input.cityId,
      categoryId:   input.categoryId,
      businessId:   input.businessId,
      businessName: input.businessName,
      leadId:       input.leadId,
      status:       "active",
      createdAt:    new Date(now).toISOString(),
      expiresAt:    new Date(now + ttlHours * 3_600_000).toISOString(),
      ttlHours,
    };
    this.store.set(reservation.id, reservation);
    return reservation;
  }

  async getById(reservationId: string): Promise<Reservation | null> {
    return this.store.get(reservationId) ?? null;
  }

  async getActiveForSpot(spotId: string): Promise<Reservation | null> {
    for (const r of this.store.values()) {
      if (
        r.spotId === spotId &&
        r.status === "active" &&
        new Date(r.expiresAt).getTime() > Date.now()
      ) {
        return r;
      }
    }
    return null;
  }

  async getAll(filter?: ReservationFilter): Promise<Reservation[]> {
    let results = [...this.store.values()];

    if (filter?.status)     results = results.filter((r) => r.status === filter.status);
    if (filter?.cityId)     results = results.filter((r) => r.cityId === filter.cityId);
    if (filter?.leadId)     results = results.filter((r) => r.leadId === filter.leadId);
    if (filter?.activeOnly) {
      results = results.filter(
        (r) => r.status === "active" && new Date(r.expiresAt).getTime() > Date.now()
      );
    }

    return results.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async updateStatus(
    reservationId: string,
    status: ReservationStatus,
    note?: string
  ): Promise<Reservation> {
    const existing = this.store.get(reservationId);
    if (!existing) throw new Error(`Reservation not found: ${reservationId}`);
    const updated = { ...existing, status, ...(note ? { adminNote: note } : {}) };
    this.store.set(reservationId, updated);
    return updated;
  }

  async extend(reservationId: string, ttlHours = 24): Promise<Reservation> {
    const existing = this.store.get(reservationId);
    if (!existing) throw new Error(`Reservation not found: ${reservationId}`);
    const updated = {
      ...existing,
      expiresAt: new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
    };
    this.store.set(reservationId, updated);
    return updated;
  }

  async delete(reservationId: string): Promise<void> {
    this.store.delete(reservationId);
  }
}
