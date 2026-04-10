// ─────────────────────────────────────────────────────────────────────────────
// Mock Spot Repository
// In-memory implementation of ISpotRepository.
// Used in development and tests. Swap for SupabaseSpotRepository in production.
// ─────────────────────────────────────────────────────────────────────────────

import type { Spot } from "../../types";
import type {
  ISpotRepository,
  UpdateSpotStatusInput,
  AssignSpotInput,
} from "../interfaces";
import { MOCK_SPOTS } from "../../availability";

const STATUS_SORT_ORDER = { "in-progress": 0, reserved: 1, available: 2, sold: 3 };

export class MockSpotRepository implements ISpotRepository {
  // Mutable in-memory store — mutations persist for the lifetime of the process
  private spots: Spot[] = structuredClone(MOCK_SPOTS);

  async getByCity(cityId: string): Promise<Spot[]> {
    return this.spots
      .filter((s) => s.cityId === cityId)
      .sort((a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]);
  }

  async getAll(): Promise<Spot[]> {
    return [...this.spots].sort(
      (a, b) => STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]
    );
  }

  async getById(spotId: string): Promise<Spot | null> {
    return this.spots.find((s) => s.id === spotId) ?? null;
  }

  async getByCityAndCategory(cityId: string, categoryId: string): Promise<Spot | null> {
    return this.spots.find((s) => s.cityId === cityId && s.categoryId === categoryId) ?? null;
  }

  async updateStatus(input: UpdateSpotStatusInput): Promise<Spot> {
    const idx = this.spots.findIndex((s) => s.id === input.spotId);
    if (idx === -1) throw new Error(`Spot not found: ${input.spotId}`);

    const updated: Spot = {
      ...this.spots[idx],
      status: input.status,
      reservedUntil: input.reservedUntil !== undefined
        ? input.reservedUntil
        : this.spots[idx].reservedUntil,
      businessId:   input.businessId   !== undefined ? input.businessId   : this.spots[idx].businessId,
      businessName: input.businessName !== undefined ? input.businessName : this.spots[idx].businessName,
    };

    this.spots[idx] = updated;
    return updated;
  }

  async assignToBusiness(input: AssignSpotInput): Promise<Spot> {
    return this.updateStatus({
      spotId:       input.spotId,
      status:       "sold",
      reservedUntil: null,
      businessId:   input.businessId,
      businessName: input.businessName,
    });
  }

  async release(spotId: string): Promise<Spot> {
    return this.updateStatus({
      spotId,
      status:       "available",
      reservedUntil: null,
      businessId:   null,
      businessName: null,
    });
  }
}
