// ─────────────────────────────────────────────────────────────────────────────
// Mock Replit Legacy Export
//
// Simulates a real Replit database export: messy field names, inconsistent
// statuses, some duplicate entries, missing fields, mixed casing, etc.
// This is what the importer will receive and needs to normalize.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  LegacyExport, LegacyBusiness, LegacyOutreach,
  LegacyConversation, LegacyMessage, LegacyCustomer,
} from "./types";

// ── Simulated Replit businesses table ────────────────────────────────────────
// Intentional mess: some have phone_number, some phone; some status="Customer",
// some status="lead"; alternate field names throughout.

const LEGACY_BUSINESSES: LegacyBusiness[] = [
  // ── ACTIVE CUSTOMERS (do not re-scrape, do not re-contact) ─────────────────
  {
    id: 1, name: "Townsend HVAC", phone: "(330) 867-4200",
    email: "greg@townsend-hvac.com", website: "https://townsend-hvac.com",
    city: "Akron", state: "OH", category: "hvac",
    status: "Customer", source: "gmb_scrape",
    notes: "Signed March 2025. Anchor slot. Paying $399/mo.",
    created_at: "2025-01-15T10:00:00Z", scraped_at: "2025-01-14T09:00:00Z",
  },
  {
    id: 2, business_name: "Medina Plumbing Co.", phone_number: "(330) 722-1100",
    email_address: "tom@medinaplumbing.com",
    city: "Medina", state: "OH", vertical: "plumbing",
    status: "active_customer", source: "csv_import",
    notes: "Long-term client. Do not disturb.",
    created_at: "2025-02-01T08:00:00Z",
  },
  {
    id: 3, name: "Stow Auto & Tire", phone: "330-555-0808",
    email: "kevin@stowauto.com", website: "stowauto.com",
    city: "Stow", state: "OH", category: "auto_repair",
    status: "CUSTOMER", source: "gmb_scrape",
    monthly_value: 299,
    created_at: "2025-01-20T11:00:00Z",
  },
  {
    id: 4, name: "North Hill Dental", phone: "(330) 784-1122",
    email: "info@northhilldental.com",
    city: "Akron", state: "OH", category: "dentist",
    status: "paying", source: "manual",
    created_at: "2024-12-10T14:00:00Z",
  },
  {
    id: 5, name: "Hudson Fitness Studio", phone: "(330) 655-4433",
    city: "Hudson", state: "OH", business_type: "gym",
    status: "Active", source: "gmb_scrape",
    created_at: "2025-03-01T09:00:00Z",
  },

  // ── REPLIED / INTERESTED (active conversation, do not restart funnel) ──────
  {
    id: 6, name: "Fairlawn Roofing LLC", phone: "(330) 867-1234",
    email: "mike@fairlawnroofing.com",
    city: "Fairlawn", state: "OH", category: "roofing",
    status: "replied", source: "gmb_scrape",
    notes: "Replied to SMS, set up a call for next week.",
    created_at: "2025-03-10T10:00:00Z",
  },
  {
    id: 7, name: "Barberton Window & Door", phone: "(330) 745-8800",
    city: "Barberton", state: "OH", category: "windows",
    status: "Interested", source: "gmb_scrape",
    notes: "Expressed interest via email. Awaiting intake.",
    created_at: "2025-03-12T11:00:00Z",
  },
  {
    id: 8, name: "Green Thumb Landscaping", phone: "(330) 999-1234",
    email: "info@greenthumbakron.com",
    city: "Akron", state: "OH", category: "landscaping",
    status: "intake_sent", source: "gmb_scrape",
    notes: "Intake form sent 2025-03-20.",
    created_at: "2025-03-05T10:00:00Z",
  },

  // ── CONTACTED / NO REPLY (outreach sent, safe to follow up but not restart) ─
  {
    id: 9, name: "Coventry Exteriors Inc.", phone: "(330) 644-7700",
    city: "Coventry Township", state: "OH", category: "siding",
    status: "contacted", source: "gmb_scrape",
    created_at: "2025-02-28T09:00:00Z",
  },
  {
    id: 10, name: "Tallmadge Pest Control", phone: "(330) 633-5500",
    email: "service@tallmadgepest.com",
    city: "Tallmadge", state: "OH", category: "pest_control",
    status: "outreach_sent", source: "gmb_scrape",
    created_at: "2025-02-25T12:00:00Z",
  },
  {
    id: 11, name: "Cuyahoga Falls Painting", phone: "(330) 922-3300",
    city: "Cuyahoga Falls", state: "OH", category: "painting",
    status: "SMS_sent", source: "gmb_scrape",
    created_at: "2025-03-01T10:00:00Z",
  },
  {
    id: 12, name: "Silver Lake Realty", phone: "(330) 688-1000",
    email: "info@silverlakerealty.com",
    city: "Silver Lake", state: "OH", category: "real_estate",
    status: "email_sent", source: "gmb_scrape",
    created_at: "2025-02-20T08:00:00Z",
  },

  // ── DO NOT CONTACT ──────────────────────────────────────────────────────────
  {
    id: 13, name: "Akron Direct Mail Co.", phone: "(330) 762-0000",
    city: "Akron", state: "OH", category: "marketing",
    status: "DNC", source: "manual",
    notes: "Competitor. Do not reach out.",
    created_at: "2025-01-01T00:00:00Z",
  },
  {
    id: 14, name: "Valley Insurance Group", phone: "(330) 867-9999",
    city: "Akron", state: "OH", category: "insurance",
    status: "do_not_contact", source: "gmb_scrape",
    notes: "Requested removal from list.",
    created_at: "2025-02-10T10:00:00Z",
  },

  // ── SCRAPED ONLY / NOT CONTACTED YET (safe for outreach) ───────────────────
  {
    id: 15, name: "Summit Electrical Services", phone: "(330) 867-2200",
    city: "Akron", state: "OH", category: "electrician",
    status: "scraped", source: "gmb_scrape",
    created_at: "2025-04-01T10:00:00Z", scraped_at: "2025-04-01T09:55:00Z",
  },
  {
    id: 16, name: "Twinsburg Garage Doors", phone: "(330) 425-5500",
    city: "Twinsburg", state: "OH", category: "garage_door",
    status: "new", source: "gmb_scrape",
    created_at: "2025-04-01T10:05:00Z",
  },
  {
    id: 17, name: "Bath Township Cleaning", phone: "(330) 867-4400",
    email: "clean@bathclean.com",
    city: "Bath Township", state: "OH", category: "cleaning",
    status: "pending", source: "csv_import",
    created_at: "2025-03-28T10:00:00Z",
  },
  {
    id: 18, name: "Copley Tree Service", phone: "(330) 666-7700",
    city: "Copley", state: "OH", category: "tree_service",
    status: null, source: "gmb_scrape",
    created_at: "2025-04-02T08:00:00Z",
  },

  // ── CLOSED / LOST ───────────────────────────────────────────────────────────
  {
    id: 19, name: "Mogadore Gutters", phone: "(330) 628-4000",
    city: "Mogadore", state: "OH", category: "gutters",
    status: "closed_lost", source: "gmb_scrape",
    notes: "No budget. Check back Q4.",
    created_at: "2025-02-01T10:00:00Z",
  },
  {
    id: 20, name: "Portage Lakes Flooring", phone: "(330) 644-9900",
    city: "Portage Lakes", state: "OH", category: "flooring",
    status: "lost", source: "gmb_scrape",
    created_at: "2025-01-20T10:00:00Z",
  },

  // ── DUPLICATE ENTRIES (same business, different records) ───────────────────
  // These should be caught by dedupe logic
  {
    id: 21, name: "TOWNSEND HVAC", phone: "(330) 867-4200",  // duplicate of id=1
    city: "Akron", state: "OH", category: "hvac",
    status: "lead", source: "csv_import",
    created_at: "2025-04-01T12:00:00Z",
  },
  {
    id: 22, name: "Green Thumb Landscaping", phone: "(330) 999-1234",  // duplicate of id=8
    email: "info@greenthumbakron.com",
    city: "Akron", state: "OH", category: "landscaping",
    status: "new_lead", source: "gmb_scrape",
    created_at: "2025-04-02T10:00:00Z",
  },
  {
    id: 23, name: "North Hill Dental Care",  // possible duplicate of id=4 — same phone
    phone: "(330) 784-1122",
    city: "Akron", state: "OH", category: "dentist",
    status: "lead", source: "gmb_scrape",
    created_at: "2025-04-03T09:00:00Z",
  },
];

// ── Simulated outreach history ────────────────────────────────────────────────

const LEGACY_OUTREACH: LegacyOutreach[] = [
  {
    id: 101, business_id: 1, business_name: "Townsend HVAC",
    type: "sms", status: "replied",
    body: "Hi Greg! HomeReach here — we help HVAC companies get booked with local homeowners. Interested in a free spot?",
    sent_at: "2025-01-16T10:00:00Z", replied_at: "2025-01-16T10:45:00Z",
    to_number: "(330) 867-4200",
  },
  {
    id: 102, business_id: 1, business_name: "Townsend HVAC",
    type: "email", status: "sent",
    subject: "Free local marketing for HVAC businesses in Akron",
    body: "Hi Greg, we'd love to connect...",
    sent_at: "2025-01-16T09:55:00Z",
    to_number: "greg@townsend-hvac.com",
  },
  {
    id: 103, business_id: 2, business_name: "Medina Plumbing Co.",
    channel: "sms", status: "delivered",
    body: "Hey Tom! HomeReach local marketing — got an open spot for plumbers in Medina.",
    sent_at: "2025-02-02T09:00:00Z",
    to_number: "(330) 722-1100",
  },
  {
    id: 104, business_id: 6, business_name: "Fairlawn Roofing LLC",
    type: "sms", status: "replied",
    body: "Hi Mike! Spots open for roofers in Fairlawn — HomeReach direct mail system.",
    sent_at: "2025-03-10T09:00:00Z", replied_at: "2025-03-10T11:00:00Z",
    to_number: "(330) 867-1234",
  },
  {
    id: 105, business_id: 7, business_name: "Barberton Window & Door",
    type: "email", status: "replied",
    subject: "Local marketing for window companies in Barberton",
    body: "Hi there, HomeReach has...",
    sent_at: "2025-03-12T10:00:00Z", replied_at: "2025-03-13T08:30:00Z",
  },
  {
    id: 106, business_id: 8, business_name: "Green Thumb Landscaping",
    type: "sms", status: "delivered",
    body: "Hey! HomeReach landscaping spot open in Akron. Interested?",
    sent_at: "2025-03-06T10:00:00Z",
    to_number: "(330) 999-1234",
  },
  {
    id: 107, business_id: 8, business_name: "Green Thumb Landscaping",
    type: "email", status: "sent",
    subject: "Intake form — HomeReach Akron Landscaping",
    body: "Hi! Here's your intake form link...",
    sent_at: "2025-03-20T14:00:00Z",
  },
  {
    id: 108, business_id: 9, business_name: "Coventry Exteriors Inc.",
    type: "sms", status: "delivered",
    body: "Hi! Open spot for siding companies in Coventry Township — HomeReach.",
    sent_at: "2025-02-28T10:00:00Z",
    to_number: "(330) 644-7700",
  },
  {
    id: 109, business_id: 10, business_name: "Tallmadge Pest Control",
    type: "email", status: "sent",
    subject: "Pest control spots available in Tallmadge",
    body: "Hi there...",
    sent_at: "2025-02-25T13:00:00Z",
  },
  {
    id: 110, business_id: 11, business_name: "Cuyahoga Falls Painting",
    type: "sms", status: "delivered",
    body: "Hey! HomeReach has an open spot for painters in Cuyahoga Falls.",
    sent_at: "2025-03-01T11:00:00Z",
    to_number: "(330) 922-3300",
  },
  {
    id: 111, business_id: 12, business_name: "Silver Lake Realty",
    type: "email", status: "sent",
    subject: "Real estate marketing in Silver Lake — HomeReach",
    body: "Hi...",
    sent_at: "2025-02-20T09:00:00Z",
  },
];

// ── Simulated conversation threads ───────────────────────────────────────────

const LEGACY_CONVERSATIONS: LegacyConversation[] = [
  {
    id: 201, business_id: 1, phone: "(330) 867-4200",
    business_name: "Townsend HVAC",
    status: "closed", last_message: "Great, let's move forward!",
    last_message_at: "2025-01-17T09:00:00Z",
    created_at: "2025-01-16T10:00:00Z",
  },
  {
    id: 202, business_id: 6, phone: "(330) 867-1234",
    business_name: "Fairlawn Roofing LLC",
    status: "active", last_message: "Yeah I'd be interested. Can we chat Thursday?",
    last_message_at: "2025-03-10T11:00:00Z",
    created_at: "2025-03-10T09:00:00Z",
  },
  {
    id: 203, business_id: 7, phone: "(330) 745-8800",
    business_name: "Barberton Window & Door",
    status: "active", last_message: "Send me the intake form when you can.",
    last_message_at: "2025-03-13T08:30:00Z",
    created_at: "2025-03-12T10:00:00Z",
  },
];

// ── Simulated message history ────────────────────────────────────────────────

const LEGACY_MESSAGES: LegacyMessage[] = [
  // Townsend HVAC thread
  {
    id: 301, conversation_id: 201, business_id: 1,
    direction: "outbound", channel: "sms",
    body: "Hi Greg! HomeReach here — we help HVAC companies get booked with local homeowners. Interested in a free spot?",
    status: "delivered", sent_at: "2025-01-16T10:00:00Z",
  },
  {
    id: 302, conversation_id: 201, business_id: 1,
    direction: "inbound", channel: "sms",
    body: "Yeah actually what's this about? Send me info.",
    status: "received", sent_at: "2025-01-16T10:45:00Z",
  },
  {
    id: 303, conversation_id: 201, business_id: 1,
    direction: "outbound", channel: "sms",
    body: "Awesome! We do exclusive direct mail postcard campaigns. One business per category per area. Your spot would cover Akron-area homeowners. Interested in getting set up?",
    status: "delivered", sent_at: "2025-01-16T11:00:00Z",
  },
  {
    id: 304, conversation_id: 201, business_id: 1,
    direction: "inbound", channel: "sms",
    body: "Great, let's move forward!",
    status: "received", sent_at: "2025-01-17T09:00:00Z",
  },
  // Fairlawn Roofing thread
  {
    id: 305, conversation_id: 202, business_id: 6,
    direction: "outbound", channel: "sms",
    body: "Hi Mike! Spots open for roofers in Fairlawn — HomeReach direct mail system.",
    status: "delivered", sent_at: "2025-03-10T09:00:00Z",
  },
  {
    id: 306, conversation_id: 202, business_id: 6,
    direction: "inbound", channel: "sms",
    body: "Yeah I'd be interested. Can we chat Thursday?",
    status: "received", sent_at: "2025-03-10T11:00:00Z",
  },
  // Barberton Window thread
  {
    id: 307, conversation_id: 203, business_id: 7,
    direction: "outbound", channel: "email",
    subject: "Local marketing for window companies in Barberton",
    body: "Hi there, HomeReach has an exclusive spot open for window & door companies in Barberton...",
    status: "delivered", sent_at: "2025-03-12T10:00:00Z",
  },
  {
    id: 308, conversation_id: 203, business_id: 7,
    direction: "inbound", channel: "email",
    body: "Send me the intake form when you can.",
    status: "received", sent_at: "2025-03-13T08:30:00Z",
  },
];

// ── Simulated customer/subscription records ───────────────────────────────────

const LEGACY_CUSTOMERS: LegacyCustomer[] = [
  {
    id: 401, business_id: 1, business_name: "Townsend HVAC",
    phone: "(330) 867-4200", email: "greg@townsend-hvac.com",
    city: "Akron", category: "hvac",
    plan: "anchor", monthly_value: 399,
    start_date: "2025-03-01", active: true, status: "active",
    agent_id: "agent-1", campaign_id: "camp-001",
    created_at: "2025-03-01T09:00:00Z",
  },
  {
    id: 402, business_id: 2, business_name: "Medina Plumbing Co.",
    phone: "(330) 722-1100",
    city: "Medina", category: "plumbing",
    plan: "standard", mrr: 249,
    start_date: "2025-02-15", active: 1, status: "active",
    agent_id: "agent-2",
    created_at: "2025-02-15T10:00:00Z",
  },
  {
    id: 403, business_id: 3, business_name: "Stow Auto & Tire",
    phone: "(330) 555-0808",
    city: "Stow", category: "auto_repair",
    plan: "standard", monthly_value: "299",  // note: string, not number
    start_date: "2025-01-20", active: true, status: "active",
    agent_id: "agent-3",
    created_at: "2025-01-20T11:00:00Z",
  },
  {
    id: 404, business_id: 4, business_name: "North Hill Dental",
    phone: "(330) 784-1122",
    city: "Akron", category: "dentist",
    plan: "anchor", monthly_value: 399,
    start_date: "2024-12-10", active: "yes",  // note: string boolean
    status: "active",
    created_at: "2024-12-10T14:00:00Z",
  },
  {
    id: 405, business_id: 5, business_name: "Hudson Fitness Studio",
    phone: "(330) 655-4433",
    city: "Hudson", category: "gym",
    plan: "standard", monthly_value: 249,
    start_date: "2025-03-01", active: true, status: "active",
    agent_id: "agent-1",
    created_at: "2025-03-01T09:00:00Z",
  },
];

// ── The Full Export Payload ───────────────────────────────────────────────────

export const MOCK_LEGACY_EXPORT: LegacyExport = {
  exportedAt:    "2025-04-09T07:00:00Z",
  exportVersion: "1.0",
  source:        "replit",
  businesses:    LEGACY_BUSINESSES,
  outreach:      LEGACY_OUTREACH,
  conversations: LEGACY_CONVERSATIONS,
  messages:      LEGACY_MESSAGES,
  customers:     LEGACY_CUSTOMERS,
};

export {
  LEGACY_BUSINESSES,
  LEGACY_OUTREACH,
  LEGACY_CONVERSATIONS,
  LEGACY_MESSAGES,
  LEGACY_CUSTOMERS,
};
