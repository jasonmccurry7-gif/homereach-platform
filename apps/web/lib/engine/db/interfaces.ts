// ─────────────────────────────────────────────────────────────────────────────
// HomeReach Engine — Repository Interfaces
//
// These interfaces are the ONLY way engines talk to storage.
// Swap the implementation (mock → Supabase) in factory.ts without
// touching a single engine file.
//
// Design rules:
//   • All methods are async (returns Promise<T>)
//   • All mutations accept a typed input, return the persisted record
//   • No raw SQL or Supabase imports here — pure TypeScript contracts
// ─────────────────────────────────────────────────────────────────────────────

import type {
  Spot,
  SpotStatus,
  Reservation,
  ReservationStatus,
  AutomationMessage,
  AutomationMode,
  IntentType,
  ConversationContext,
  LeadStatus,
  DiscountConfig,
} from "../types";

// ─────────────────────────────────────────────────────────────────────────────
// SPOT REPOSITORY
// Supabase table: spots
// ─────────────────────────────────────────────────────────────────────────────

export interface ISpotRepository {
  /** All spots for a city, sorted by status priority */
  getByCity(cityId: string): Promise<Spot[]>;

  /** All spots across every city */
  getAll(): Promise<Spot[]>;

  /** Single spot by ID */
  getById(spotId: string): Promise<Spot | null>;

  /** Single spot by city + category (one spot per category per city) */
  getByCityAndCategory(cityId: string, categoryId: string): Promise<Spot | null>;

  /**
   * Persist a status change.
   * Called whenever a spot is reserved, sold, released, or overridden.
   */
  updateStatus(input: UpdateSpotStatusInput): Promise<Spot>;

  /**
   * Assign a spot to a business after successful payment.
   */
  assignToBusiness(input: AssignSpotInput): Promise<Spot>;

  /**
   * Release a spot back to 'available' (reservation expired or cancelled).
   */
  release(spotId: string): Promise<Spot>;
}

export interface UpdateSpotStatusInput {
  spotId: string;
  status: SpotStatus;
  reservedUntil?: string | null;   // ISO timestamp; null = clear the hold
  businessId?: string | null;
  businessName?: string | null;
  updatedBy?: string;              // admin user ID for audit trail
}

export interface AssignSpotInput {
  spotId: string;
  businessId: string;
  businessName: string;
  assignedBy?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RESERVATION REPOSITORY
// Supabase table: reservations
// ─────────────────────────────────────────────────────────────────────────────

export interface IReservationRepository {
  /** Create a new reservation record */
  create(input: CreateReservationInput): Promise<Reservation>;

  /** Fetch by reservation ID */
  getById(reservationId: string): Promise<Reservation | null>;

  /** Active (non-expired) reservation for a spot, if any */
  getActiveForSpot(spotId: string): Promise<Reservation | null>;

  /** All reservations, optionally filtered */
  getAll(filter?: ReservationFilter): Promise<Reservation[]>;

  /** Update reservation status (expire, convert, cancel) */
  updateStatus(reservationId: string, status: ReservationStatus, note?: string): Promise<Reservation>;

  /** Extend expiry by ttlHours from now */
  extend(reservationId: string, ttlHours?: number): Promise<Reservation>;

  /** Permanently delete (use sparingly — prefer status=cancelled) */
  delete(reservationId: string): Promise<void>;
}

export interface CreateReservationInput {
  spotId: string;
  cityId: string;
  categoryId: string;
  businessId: string;
  businessName: string;
  leadId: string;
  ttlHours?: number;           // default: 24
  createdBy?: string;          // admin user ID
}

export interface ReservationFilter {
  status?: ReservationStatus;
  cityId?: string;
  leadId?: string;
  activeOnly?: boolean;        // excludes expired + cancelled
}

// ─────────────────────────────────────────────────────────────────────────────
// CONVERSATION REPOSITORY
// Supabase tables: conversations, conversation_messages
// ─────────────────────────────────────────────────────────────────────────────

export interface IConversationRepository {
  /** All conversations (sorted by most recent message) */
  getAll(): Promise<ConversationContext[]>;

  /** Single conversation by ID */
  getById(conversationId: string): Promise<ConversationContext | null>;

  /** Conversations for a lead (may be multiple channels) */
  getByLeadId(leadId: string): Promise<ConversationContext[]>;

  /**
   * Create or update a conversation.
   * Used on first message + on every context change.
   */
  upsert(input: UpsertConversationInput): Promise<ConversationContext>;

  /**
   * Persist a single message and return it with its generated ID.
   * Updates the conversation's lastMessage + lastMessageAt.
   */
  addMessage(conversationId: string, message: CreateMessageInput): Promise<AutomationMessage>;

  /** All messages for a conversation, sorted oldest → newest */
  getMessages(conversationId: string): Promise<AutomationMessage[]>;

  /** Toggle auto/manual mode — persists immediately */
  setAutomationMode(conversationId: string, mode: AutomationMode): Promise<void>;

  /** Update detected intent on the conversation record */
  setLastIntent(conversationId: string, intent: IntentType): Promise<void>;

  /** Mark all unread inbound messages as read */
  markRead(conversationId: string): Promise<void>;

  /** Unread message count across all conversations */
  getUnreadCount(): Promise<number>;
}

export interface UpsertConversationInput {
  id?: string;                  // if provided, update; otherwise create
  leadId: string;
  leadName: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  category: string;
  status: LeadStatus;
  channel: "sms" | "email";
  automationMode?: AutomationMode;
}

export interface CreateMessageInput {
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  intent?: IntentType;
  isAutoGenerated?: boolean;
  sentAt?: string;              // ISO timestamp; defaults to now
}

// ─────────────────────────────────────────────────────────────────────────────
// PRICING CONFIG REPOSITORY
// Supabase tables: pricing_tiers, discount_configs, promo_codes
// ─────────────────────────────────────────────────────────────────────────────

export interface IPricingConfigRepository {
  /**
   * Base pricing config: spot price, full card price, founding member settings.
   * Cached aggressively — changes infrequently.
   */
  getConfig(): Promise<PricingConfigRecord>;

  /** All active discount tiers (multi-spot schedules, bundle discounts) */
  getDiscountTiers(): Promise<DiscountTierRecord[]>;

  /** Validate a promo code and return its discount if active */
  getPromoCode(code: string): Promise<PromoCodeRecord | null>;

  /** How many founding member slots have been used */
  getFoundingMemberCount(): Promise<number>;

  /** Increment founding member count when a new one signs up */
  incrementFoundingMemberCount(): Promise<void>;
}

export interface PricingConfigRecord {
  baseSpotPrice: number;
  fullCardPrice: number;
  foundingMemberRate: number;
  foundingMemberLimit: number;
  militaryDiscountPct: number;
  updatedAt: string;
}

export interface DiscountTierRecord {
  id: string;
  type: "multispot" | "bundle";
  minSpots: number;
  discountPct: number;
  label: string;
  active: boolean;
}

export interface PromoCodeRecord {
  code: string;
  discountPct: number;
  label: string;
  active: boolean;
  usageLimit: number | null;
  usageCount: number;
  expiresAt: string | null;
}
