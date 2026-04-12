// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Shared Types
// Single source of truth for all domain types used across apps and packages.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "client" | "nonprofit" | "sponsor";

export type BusinessStatus = "pending" | "active" | "paused" | "churned";

export type ProductType =
  | "postcard"
  | "print"
  | "digital"
  | "automation"
  | "addon";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "active"
  | "completed"
  | "cancelled"
  | "refunded";

export type OutreachChannel = "sms" | "email";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "paused"
  | "cancelled";

export type MessageStatus =
  | "queued"
  | "sent"
  | "delivered"
  | "failed"
  | "bounced";

export type NonprofitApplicationStatus = "pending" | "approved" | "rejected";

export type SponsorshipTier = "bronze" | "silver" | "gold" | "platinum";

export type SponsorshipStatus =
  | "pending"
  | "active"
  | "expired"
  | "cancelled";

// ─── Domain Models ────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  role: UserRole;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface City {
  id: string;
  name: string;
  state: string;
  slug: string;
  isActive: boolean;
  launchedAt: Date | null;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  type: ProductType;
  description: string | null;
  basePrice: number;
  isActive: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  isActive: boolean;
  cityId: string | null; // null = available in all cities
  createdAt: Date;
  updatedAt: Date;
}

export interface BundleProduct {
  id: string;
  bundleId: string;
  productId: string;
  quantity: number;
}

export interface Business {
  id: string;
  ownerId: string;
  name: string;
  categoryId: string | null;
  cityId: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: BusinessStatus;
  isNonprofit: boolean;
  nonprofitVerifiedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  businessId: string;
  bundleId: string | null;
  status: OrderStatus;
  stripePaymentIntentId: string | null;
  stripeCustomerId: string | null;
  subtotal: number;
  total: number;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface WaitlistEntry {
  id: string;
  email: string;
  phone: string | null;
  name: string | null;
  cityId: string | null;
  categoryId: string | null;
  businessName: string | null;
  convertedToBusinessId: string | null;
  convertedAt: Date | null;
  createdAt: Date;
}

// ─── Outreach ────────────────────────────────────────────────────────────────

export interface OutreachContact {
  id: string;
  businessId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  optedOut: boolean;
  optedOutAt: Date | null;
  source: string | null;
  createdAt: Date;
}

export interface Campaign {
  id: string;
  businessId: string;
  name: string;
  type: OutreachChannel | "both";
  status: CampaignStatus;
  subject: string | null; // email only
  messageBody: string;
  scheduledAt: Date | null;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OutreachMessage {
  id: string;
  campaignId: string;
  contactId: string;
  channel: OutreachChannel;
  status: MessageStatus;
  externalId: string | null; // Twilio SID or Resend ID
  sentAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
}

export interface OutreachReply {
  id: string;
  messageId: string | null;
  contactId: string;
  businessId: string;
  channel: OutreachChannel;
  body: string;
  receivedAt: Date;
  isRead: boolean;
}

// ─── Nonprofit / Sponsorship ─────────────────────────────────────────────────

export interface NonprofitApplication {
  id: string;
  businessId: string;
  status: NonprofitApplicationStatus;
  ein: string | null;
  orgName: string;
  documentUrl: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}

export interface Sponsorship {
  id: string;
  sponsorBusinessId: string;
  tier: SponsorshipTier;
  status: SponsorshipStatus;
  amount: number;
  startsAt: Date;
  endsAt: Date | null;
  createdAt: Date;
}

// ─── API / Response Helpers ───────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ─── Funnel State ─────────────────────────────────────────────────────────────

export interface FunnelState {
  cityId: string | null;
  categoryId: string | null;
  spotId: string | null;
  bundleId: string | null;
  addonIds: string[];
  businessName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

export interface CheckoutSessionPayload {
  bundleId: string;
  addonIds?: string[];
  businessName: string;
  cityId: string;
  categoryId: string;
  email: string;
  phone?: string;
  successUrl: string;
  cancelUrl: string;
}

// ─── Pricing Engine (Task 20) ─────────────────────────────────────────────────
export * from "./pricing";
