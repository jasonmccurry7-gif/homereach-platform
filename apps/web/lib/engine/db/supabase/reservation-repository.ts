// ─────────────────────────────────────────────────────────────────────────────
// Supabase Reservation Repository
//
// No reservations table exists in the schema yet.
// Returns safe empty results instead of throwing, so the admin hub
// and availability pages do not crash.
// ─────────────────────────────────────────────────────────────────────────────

import type { Reservation, ReservationStatus } from "../../types";
import type { IReservationRepository, CreateReservationInput, ReservationFilter } from "../interfaces";

export class SupabaseReservationRepository implements IReservationRepository {

  async create(_input: CreateReservationInput): Promise<Reservation> {
    // No reservations table yet — return a stub record so UI doesn't crash.
    // Replace with real DB insert once reservations table is added to schema.
    const stub: Reservation = {
      id:           `res-${Date.now()}`,
      spotId:       _input.spotId,
      cityId:       _input.cityId,
      categoryId:   _input.categoryId,
      businessId:   _input.businessId ?? null,
      businessName: _input.businessName ?? null,
      leadId:       _input.leadId ?? null,
      status:       "active",
      expiresAt:    new Date(Date.now() + (_input.ttlHours ?? 24) * 3_600_000).toISOString(),
      ttlHours:     _input.ttlHours ?? 24,
      createdBy:    _input.createdBy ?? "system",
      adminNote:    null,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };
    return stub;
  }

  async getById(_reservationId: string): Promise<Reservation | null> {
    return null;
  }

  async getActiveForSpot(_spotId: string): Promise<Reservation | null> {
    return null;
  }

  async getAll(_filter?: ReservationFilter): Promise<Reservation[]> {
    return [];
  }

  async updateStatus(reservationId: string, status: ReservationStatus, _note?: string): Promise<Reservation> {
    return {
      id:           reservationId,
      spotId:       "",
      cityId:       "",
      categoryId:   "",
      businessId:   null,
      businessName: null,
      leadId:       null,
      status,
      expiresAt:    new Date().toISOString(),
      ttlHours:     24,
      createdBy:    "system",
      adminNote:    _note ?? null,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };
  }

  async extend(reservationId: string, ttlHours = 24): Promise<Reservation> {
    return {
      id:           reservationId,
      spotId:       "",
      cityId:       "",
      categoryId:   "",
      businessId:   null,
      businessName: null,
      leadId:       null,
      status:       "active",
      expiresAt:    new Date(Date.now() + ttlHours * 3_600_000).toISOString(),
      ttlHours,
      createdBy:    "system",
      adminNote:    null,
      createdAt:    new Date().toISOString(),
      updatedAt:    new Date().toISOString(),
    };
  }

  async delete(_reservationId: string): Promise<void> {
    // No-op — no table
  }
}
