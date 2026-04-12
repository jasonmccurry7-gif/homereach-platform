// ─────────────────────────────────────────────────────────────────────────────
// Shared Lead type for admin/leads page.
// The source-of-truth is now the DB (waitlist_entries + businesses).
// This type is used by both the server page and the client component.
// ─────────────────────────────────────────────────────────────────────────────

export type LeadStatus = "lead" | "interested" | "sold" | "churned";

export interface Lead {
  id: string;
  name: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  category: string;
  status: LeadStatus;
  source: "outreach" | "waitlist" | "referral" | "inbound";
  lastContact: string; // ISO date string
  notes: string;
  spotId: string | null;
  monthlyValue: number;
  automationMode?: "auto" | "manual";
  intakeFormSent?: boolean;
  intakeFormCompletedAt?: string;
}
