// ─────────────────────────────────────────────────────────────────────────────
// Mock Data — Admin Panel
// All data here is fake / illustrative.
// Replace each function with a real DB query when ready to connect Supabase.
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

export interface Message {
  id: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  sentAt: string;
  read: boolean;
}

export interface Conversation {
  id: string;
  leadId: string;
  leadName: string;
  businessName: string;
  phone: string;
  email: string;
  city: string;
  category: string;
  status: LeadStatus;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  channel: "sms" | "email";
  messages: Message[];
}

// ── Leads ─────────────────────────────────────────────────────────────────────

export const MOCK_LEADS: Lead[] = [
  {
    id: "lead-1",
    name: "Mike Harrington",
    businessName: "Harrington Plumbing",
    phone: "+13303041111",
    email: "mike@harringtonplumbing.com",
    city: "Medina, OH",
    category: "Plumber",
    status: "interested",
    source: "outreach",
    lastContact: "2026-04-07T14:30:00Z",
    notes: "Called back same day. Very interested in the Visibility bundle. Follow up Thursday.",
    spotId: null,
    monthlyValue: 299,
  },
  {
    id: "lead-2",
    name: "Sandra Vega",
    businessName: "Vega Dental",
    phone: "+13303042222",
    email: "sandra@vegadental.com",
    city: "Stow, OH",
    category: "Dentist",
    status: "sold",
    source: "waitlist",
    lastContact: "2026-04-05T10:00:00Z",
    notes: "Signed up for Authority bundle. First postcard mailing scheduled for May.",
    spotId: "spot-stow-dentist-1",
    monthlyValue: 549,
  },
  {
    id: "lead-3",
    name: "Derek Townsend",
    businessName: "Townsend HVAC",
    phone: "+13303043333",
    email: "derek@townsend-hvac.com",
    city: "Akron, OH",
    category: "HVAC",
    status: "lead",
    source: "outreach",
    lastContact: "2026-04-08T09:15:00Z",
    notes: "Left voicemail. No response yet.",
    spotId: null,
    monthlyValue: 0,
  },
  {
    id: "lead-4",
    name: "Priya Nair",
    businessName: "Nair Family Chiropractic",
    phone: "+13303044444",
    email: "priya@nairchiro.com",
    city: "Hudson, OH",
    category: "Chiropractor",
    status: "interested",
    source: "inbound",
    lastContact: "2026-04-06T16:45:00Z",
    notes: "Filled out intake form. Wants to discuss postcard design options.",
    spotId: null,
    monthlyValue: 399,
  },
  {
    id: "lead-5",
    name: "Carlos Mendes",
    businessName: "Mendes Landscaping",
    phone: "+13303045555",
    email: "carlos@mendeslandscaping.com",
    city: "Medina, OH",
    category: "Landscaper",
    status: "sold",
    source: "referral",
    lastContact: "2026-04-01T11:00:00Z",
    notes: "Referred by Mike H. Signed for Presence bundle.",
    spotId: "spot-medina-landscape-1",
    monthlyValue: 399,
  },
  {
    id: "lead-6",
    name: "Beth Callahan",
    businessName: "Callahan Insurance",
    phone: "+13303046666",
    email: "beth@callahanins.com",
    city: "Stow, OH",
    category: "Insurance",
    status: "churned",
    source: "outreach",
    lastContact: "2026-03-15T13:00:00Z",
    notes: "Said not interested at this time. Re-contact in 6 months.",
    spotId: null,
    monthlyValue: 0,
  },
  {
    id: "lead-7",
    name: "James Kowalski",
    businessName: "Kowalski Electric",
    phone: "+13303047777",
    email: "james@kowalskielec.com",
    city: "Akron, OH",
    category: "Electrician",
    status: "lead",
    source: "outreach",
    lastContact: "2026-04-08T08:00:00Z",
    notes: "New outreach sent this morning.",
    spotId: null,
    monthlyValue: 0,
  },
  {
    id: "lead-8",
    name: "Angela Frost",
    businessName: "Frost Realty",
    phone: "+13303048888",
    email: "angela@frostrealty.com",
    city: "Hudson, OH",
    category: "Realtor",
    status: "interested",
    source: "inbound",
    lastContact: "2026-04-07T09:00:00Z",
    notes: "Wants the full Dominance bundle. Needs to get approval from partner.",
    spotId: null,
    monthlyValue: 799,
  },
];

// ── Conversations ─────────────────────────────────────────────────────────────

export const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    leadId: "lead-1",
    leadName: "Mike Harrington",
    businessName: "Harrington Plumbing",
    phone: "+13303041111",
    email: "mike@harringtonplumbing.com",
    city: "Medina, OH",
    category: "Plumber",
    status: "interested",
    lastMessage: "Yeah that sounds good, send me the link",
    lastMessageAt: "2026-04-07T14:30:00Z",
    unreadCount: 1,
    channel: "sms",
    messages: [
      {
        id: "m1-1",
        direction: "outbound",
        channel: "sms",
        body: "Hey Mike, this is Jason from HomeReach. We help local businesses get their name in front of homeowners in Medina every single month with postcards. Do you have 2 minutes to hear how it works?",
        sentAt: "2026-04-07T09:00:00Z",
        read: true,
      },
      {
        id: "m1-2",
        direction: "inbound",
        channel: "sms",
        body: "Sure what's the deal",
        sentAt: "2026-04-07T11:22:00Z",
        read: true,
      },
      {
        id: "m1-3",
        direction: "outbound",
        channel: "sms",
        body: "We lock in one business per category per zip code — so if you grab the plumber spot in Medina, no other plumber can get in. 15,000 homes get your postcard every month. Starting at $299/mo. Want me to send you the full breakdown?",
        sentAt: "2026-04-07T11:35:00Z",
        read: true,
      },
      {
        id: "m1-4",
        direction: "inbound",
        channel: "sms",
        body: "Yeah that sounds good, send me the link",
        sentAt: "2026-04-07T14:30:00Z",
        read: false,
      },
    ],
  },
  {
    id: "conv-2",
    leadId: "lead-4",
    leadName: "Priya Nair",
    businessName: "Nair Family Chiropractic",
    phone: "+13303044444",
    email: "priya@nairchiro.com",
    city: "Hudson, OH",
    category: "Chiropractor",
    status: "interested",
    lastMessage: "Can we schedule a call to go over design?",
    lastMessageAt: "2026-04-06T16:45:00Z",
    unreadCount: 1,
    channel: "email",
    messages: [
      {
        id: "m2-1",
        direction: "inbound",
        channel: "email",
        body: "Hi, I found HomeReach online and I'm really interested in the postcard program. I'm a chiropractor in Hudson and I've been looking for a way to reach local homeowners. Can we schedule a call to go over design options and pricing?",
        sentAt: "2026-04-06T16:45:00Z",
        read: false,
      },
    ],
  },
  {
    id: "conv-3",
    leadId: "lead-8",
    leadName: "Angela Frost",
    businessName: "Frost Realty",
    phone: "+13303048888",
    email: "angela@frostrealty.com",
    city: "Hudson, OH",
    category: "Realtor",
    status: "interested",
    lastMessage: "I'll get back to you by Friday once I talk to my partner",
    lastMessageAt: "2026-04-07T09:00:00Z",
    unreadCount: 0,
    channel: "sms",
    messages: [
      {
        id: "m3-1",
        direction: "outbound",
        channel: "sms",
        body: "Hey Angela, Jason from HomeReach here. Saw you filled out our form — the realtor spot in Hudson is still available. That one goes fast because every agent in the area wants it. Want to jump on a quick call today?",
        sentAt: "2026-04-06T10:00:00Z",
        read: true,
      },
      {
        id: "m3-2",
        direction: "inbound",
        channel: "sms",
        body: "I'm definitely interested in the Dominance package. I just need to loop in my business partner before I commit. Can I have until Friday?",
        sentAt: "2026-04-06T10:45:00Z",
        read: true,
      },
      {
        id: "m3-3",
        direction: "outbound",
        channel: "sms",
        body: "Absolutely — I'll hold the spot until Friday. Just so you know, I did have another realtor reach out yesterday, so I can't guarantee it past then. Talk soon!",
        sentAt: "2026-04-06T11:00:00Z",
        read: true,
      },
      {
        id: "m3-4",
        direction: "inbound",
        channel: "sms",
        body: "I'll get back to you by Friday once I talk to my partner",
        sentAt: "2026-04-07T09:00:00Z",
        read: true,
      },
    ],
  },
  {
    id: "conv-4",
    leadId: "lead-3",
    leadName: "Derek Townsend",
    businessName: "Townsend HVAC",
    phone: "+13303043333",
    email: "derek@townsend-hvac.com",
    city: "Akron, OH",
    category: "HVAC",
    status: "lead",
    lastMessage: "Hey Derek, left you a voicemail — give us a call back when you get a chance!",
    lastMessageAt: "2026-04-08T09:15:00Z",
    unreadCount: 0,
    channel: "sms",
    messages: [
      {
        id: "m4-1",
        direction: "outbound",
        channel: "sms",
        body: "Hey Derek, left you a voicemail — give us a call back when you get a chance!",
        sentAt: "2026-04-08T09:15:00Z",
        read: true,
      },
    ],
  },
];

// ── Dashboard Stats ───────────────────────────────────────────────────────────

export const MOCK_STATS = {
  totalLeads: 24,
  newLeadsThisWeek: 7,
  activeClients: 8,
  openSpots: 14,
  mrr: 3591,
  mrrGrowth: 12.4,
  waitlistCount: 31,
  conversionsThisMonth: 3,
};

export const MOCK_CITIES = [
  { name: "Medina, OH", spotsTotal: 12, spotsSold: 5, mrr: 1897, leads: 9 },
  { name: "Stow, OH",   spotsTotal: 10, spotsSold: 4, mrr: 1694, leads: 7 },
  { name: "Hudson, OH", spotsTotal: 8,  spotsSold: 3, mrr: 1347, leads: 5 },
  { name: "Akron, OH",  spotsTotal: 20, spotsSold: 2, mrr: 598,  leads: 3 },
];

export const MOCK_RECENT_ACTIVITY = [
  { id: "a1", type: "sold",      text: "Sandra Vega (Vega Dental) signed — Stow, OH",       time: "2 days ago" },
  { id: "a2", type: "reply",     text: "Mike Harrington replied: 'send me the link'",        time: "Yesterday" },
  { id: "a3", type: "waitlist",  text: "New waitlist signup — HVAC · Medina, OH",            time: "3 hrs ago" },
  { id: "a4", type: "sold",      text: "Carlos Mendes (Mendes Landscaping) signed — Medina", time: "1 week ago" },
  { id: "a5", type: "reply",     text: "Angela Frost replied about Friday deadline",          time: "Yesterday" },
  { id: "a6", type: "outreach",  text: "7 new outreach messages sent — Akron batch",         time: "Today, 8am" },
];
