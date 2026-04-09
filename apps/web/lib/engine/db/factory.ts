// ─────────────────────────────────────────────────────────────────────────────
// Repository Factory
//
// Returns the correct repository implementation based on the USE_MOCK_DB
// environment variable.
//
//   USE_MOCK_DB=true   → in-memory mock (default in development)
//   USE_MOCK_DB=false  → Supabase / Drizzle (production)
//
// Usage:
//   import { getSpotRepository } from "@/lib/engine/db/factory";
//   const spots = getSpotRepository();
//   const allSpots = await spots.getAll();
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ISpotRepository,
  IReservationRepository,
  IConversationRepository,
  IPricingConfigRepository,
} from "./interfaces";

// Mock implementations (always available — no DB needed)
import { MockSpotRepository }          from "./mock/spot-repository";
import { MockReservationRepository }   from "./mock/reservation-repository";
import { MockConversationRepository }  from "./mock/conversation-repository";
import { MockPricingConfigRepository } from "./mock/pricing-config-repository";

// Supabase implementations
import { SupabaseSpotRepository }          from "./supabase/spot-repository";
import { SupabaseReservationRepository }   from "./supabase/reservation-repository";
import { SupabaseConversationRepository }  from "./supabase/conversation-repository";
import { SupabasePricingConfigRepository } from "./supabase/pricing-config-repository";

// Env validation
import { isMockDb } from "@/lib/env";

// ── Singleton instances ───────────────────────────────────────────────────────
// Created once per server process so mock state persists across requests
// (Supabase repos are stateless so singletons are harmless there too)

let _spotRepo:          ISpotRepository | null = null;
let _reservationRepo:   IReservationRepository | null = null;
let _conversationRepo:  IConversationRepository | null = null;
let _pricingConfigRepo: IPricingConfigRepository | null = null;

function useMock(): boolean {
  // isMockDb() throws if USE_MOCK_DB is not explicitly set to "true" or "false".
  // There is NO silent default — production cannot accidentally run on mock data.
  return isMockDb();
}

// ── Public factory functions ──────────────────────────────────────────────────

export function getSpotRepository(): ISpotRepository {
  if (!_spotRepo) {
    _spotRepo = useMock()
      ? new MockSpotRepository()
      : new SupabaseSpotRepository();
  }
  return _spotRepo;
}

export function getReservationRepository(): IReservationRepository {
  if (!_reservationRepo) {
    _reservationRepo = useMock()
      ? new MockReservationRepository()
      : new SupabaseReservationRepository();
  }
  return _reservationRepo;
}

export function getConversationRepository(): IConversationRepository {
  if (!_conversationRepo) {
    _conversationRepo = useMock()
      ? new MockConversationRepository()
      : new SupabaseConversationRepository();
  }
  return _conversationRepo;
}

export function getPricingConfigRepository(): IPricingConfigRepository {
  if (!_pricingConfigRepo) {
    _pricingConfigRepo = useMock()
      ? new MockPricingConfigRepository()
      : new SupabasePricingConfigRepository();
  }
  return _pricingConfigRepo;
}

// ── Test / DI helpers ─────────────────────────────────────────────────────────
// Call these in tests to inject a custom implementation and reset between runs.

export function _setSpotRepository(repo: ISpotRepository): void {
  _spotRepo = repo;
}
export function _setReservationRepository(repo: IReservationRepository): void {
  _reservationRepo = repo;
}
export function _setConversationRepository(repo: IConversationRepository): void {
  _conversationRepo = repo;
}
export function _setPricingConfigRepository(repo: IPricingConfigRepository): void {
  _pricingConfigRepo = repo;
}

/** Reset all singletons — useful in tests or hot-reload scenarios. */
export function _resetRepositories(): void {
  _spotRepo = null;
  _reservationRepo = null;
  _conversationRepo = null;
  _pricingConfigRepo = null;
}
