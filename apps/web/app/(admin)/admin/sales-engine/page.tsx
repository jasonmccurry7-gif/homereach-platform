// ─────────────────────────────────────────────────────────────────────────────
// Sales Engine Dashboard — Server Component (Real DB Data)
//
// Replaces all mock data with live queries against:
//   - leads          (pipeline stage, contact info)
//   - conversations  (message history, category, business name)
//   - orders         (revenue / closed-won)
//   - spot_assignments (active MRR)
// ─────────────────────────────────────────────────────────────────────────────

import { db, leads, conversations, orders, spotAssignments } from "@homereach/db";
import { desc, inArray, eq, and, gte, sum } from "drizzle-orm";
import { classifyAll }      from "@/lib/sales-engine/classifier";
import { getAllAlerts }     from "@/lib/sales-engine/alert-engine";
import { SalesEngineClient } from "./sales-engine-client";
import type {
  SalesLead,
  SalesMessage,
  SalesEngineStats,
  HotLeadAlert,
  ConversationStage,
  ConversationControl,
  EscalationStatus,
  QualificationData,
  MessageRole,
} from "@/lib/sales-engine/types";

export const dynamic   = "force-dynamic";
export const metadata  = { title: "Sales Engine | HomeReach" };

// ─────────────────────────────────────────────────────────────────────────────
// Map lead DB status → ConversationStage
// ─────────────────────────────────────────────────────────────────────────────

function statusToStage(status: string): ConversationStage {
  const map: Record<string, ConversationStage> = {
    new:              "initial_contact",
    contacted:        "awaiting_response",
    intake_sent:      "intake_sent",
    intake_started:   "qualifying",
    intake_complete:  "warm_engaged",
    paid:             "closed_won",
    active:           "closed_won",
    mailed:           "closed_won",
    review_requested: "closed_won",
  };
  return map[status] ?? "initial_contact";
}

// ─────────────────────────────────────────────────────────────────────────────
// Map conversation rows → SalesMessage[]
// ─────────────────────────────────────────────────────────────────────────────

function convRowToSalesMessage(row: {
  id:          string;
  direction:   string;
  channel:     string;
  message:     string;
  sentAt:      Date | null;
  isRead:      boolean;
  aiGenerated: boolean;
}): SalesMessage {
  const role: MessageRole =
    row.direction === "inbound"
      ? "lead"
      : row.aiGenerated
      ? "ai"
      : "human_agent";

  return {
    id:          row.id,
    role,
    channel:     row.channel as "sms" | "email",
    body:        row.message,
    sentAt:      row.sentAt?.toISOString() ?? new Date().toISOString(),
    isRead:      row.isRead,
    intentScore: 0,      // will be re-scored by classifier
    signals:     [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build SalesLead from DB row + messages
// ─────────────────────────────────────────────────────────────────────────────

function buildSalesLead(
  lead: {
    id:           string;
    name:         string | null;
    businessName: string | null;
    phone:        string | null;
    email:        string | null;
    city:         string | null;
    source:       string;
    status:       string;
    createdAt:    Date;
    updatedAt:    Date;
  },
  convRows: {
    id:          string;
    direction:   string;
    channel:     string;
    message:     string;
    sentAt:      Date | null;
    isRead:      boolean;
    aiGenerated: boolean;
    category:    string | null;
    businessName: string | null;
    automationMode: string;
  }[]
): SalesLead {
  // Sort oldest → newest
  const sorted = [...convRows].sort(
    (a, b) => (a.sentAt?.getTime() ?? 0) - (b.sentAt?.getTime() ?? 0)
  );

  const salesMsgs = sorted.map(convRowToSalesMessage);

  const inbound  = salesMsgs.filter((m) => m.role === "lead");
  const lastMsg  = salesMsgs[salesMsgs.length - 1];
  const latestConv = convRows[0]; // first row is most-recent (DESC order from query)

  const hasReplied   = inbound.length > 0;
  const category     = latestConv?.category ?? "";
  const businessName = lead.businessName ?? latestConv?.businessName ?? "Unknown";
  const stage        = statusToStage(lead.status);
  const isClosedWon  = stage === "closed_won";

  const control: ConversationControl = isClosedWon
    ? "human"
    : latestConv?.automationMode === "manual"
    ? "human"
    : hasReplied
    ? "ai_assist"
    : "ai";

  const escalation: EscalationStatus = isClosedWon ? "resolved" : "none";

  const qualification: QualificationData = {
    city:          lead.city ?? undefined,
    category:      category || undefined,
    businessName:  businessName,
    interestLevel: isClosedWon
      ? "ready"
      : hasReplied
      ? "curious"
      : "none",
    timeline:      isClosedWon ? "now" : "unknown",
    hasReplied,
    messageCount:  inbound.length,
  };

  const summary = isClosedWon
    ? `${businessName} — closed won. Active client.`
    : hasReplied
    ? `${businessName} has replied. ${inbound.length} inbound message(s).`
    : `Initial outreach sent to ${businessName}. No reply yet.`;

  return {
    id:              lead.id,
    businessName,
    contactName:     lead.name ?? undefined,
    phone:           lead.phone ?? undefined,
    email:           lead.email ?? undefined,
    city:            lead.city ?? "",
    category,
    source:          lead.source,
    classification: {
      temperature:  "cold",   // re-classified below via classifyAll()
      score:        0,
      signals:      [],
      lastUpdated:  new Date().toISOString(),
      reasoning:    "Pending classification",
    },
    stage,
    control,
    escalation,
    qualification,
    messages:        salesMsgs,
    summary,
    lastMessageAt:   lastMsg?.sentAt ?? lead.createdAt.toISOString(),
    lastMessageBody: lastMsg?.body ?? "",
    lastMessageRole: lastMsg?.role ?? "ai",
    followUpCount:   0,
    maxFollowUps:    3,
    alertCount:      0,
    createdAt:       lead.createdAt.toISOString(),
    updatedAt:       lead.updatedAt.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Compute Stats from real classified leads + orders
// ─────────────────────────────────────────────────────────────────────────────

function computeRealStats(
  classifiedLeads: SalesLead[],
  activeMrrCents:  number,
  alerts:          HotLeadAlert[]
): SalesEngineStats {
  const hot         = classifiedLeads.filter((l) => l.classification.temperature === "hot").length;
  const warm        = classifiedLeads.filter((l) => l.classification.temperature === "warm").length;
  const cold        = classifiedLeads.filter((l) => l.classification.temperature === "cold").length;
  const escalated   = classifiedLeads.filter((l) => l.escalation !== "none").length;
  const humanActive = classifiedLeads.filter((l) => l.control === "human").length;
  const closedWon   = classifiedLeads.filter((l) => l.stage === "closed_won");

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const alertsToday = alerts.filter((a) => new Date(a.sentAt) >= today).length;

  const conversionRate = classifiedLeads.length > 0
    ? Math.round((closedWon.length / classifiedLeads.length) * 100)
    : 0;

  return {
    totalLeads:         classifiedLeads.length,
    hot,
    warm,
    cold,
    escalated,
    humanActive,
    alertsSentToday:    alertsToday,
    avgResponseTimeMin: 0,   // TODO: compute from message timestamps
    conversionRate,
    totalMRR:           Math.round(activeMrrCents / 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export default async function SalesEnginePage() {

  // ── 1. Fetch leads (most recent 200) ────────────────────────────────────────
  const leadRows = await db
    .select()
    .from(leads)
    .orderBy(desc(leads.createdAt))
    .limit(200)
    .catch(() => [] as typeof leads.$inferSelect[]);

  // ── 2. Fetch all conversations for these leads in one query ──────────────────
  const leadIds = leadRows
    .map((l) => l.id)
    .filter(Boolean) as string[];

  const convRows = leadIds.length > 0
    ? await db
        .select()
        .from(conversations)
        .where(inArray(conversations.leadId, leadIds))
        .orderBy(desc(conversations.sentAt))
        .catch(() => [] as typeof conversations.$inferSelect[])
    : [];

  // Group conversations by lead_id
  const convByLead = new Map<string, typeof convRows>();
  for (const row of convRows) {
    if (!row.leadId) continue;
    const bucket = convByLead.get(row.leadId) ?? [];
    bucket.push(row);
    convByLead.set(row.leadId, bucket);
  }

  // ── 3. Build SalesLead objects ───────────────────────────────────────────────
  const rawLeads: SalesLead[] = leadRows.map((lead) =>
    buildSalesLead(lead, convByLead.get(lead.id) ?? [])
  );

  // ── 4. Classify all (re-score based on message content) ─────────────────────
  const classifiedLeads = classifyAll(rawLeads);

  // ── 5. Active MRR from spot_assignments ─────────────────────────────────────
  let activeMrrCents = 0;
  try {
    const [mrrRow] = await db
      .select({ total: sum(spotAssignments.monthlyValueCents) })
      .from(spotAssignments)
      .where(eq(spotAssignments.status, "active"));
    activeMrrCents = Number(mrrRow?.total ?? 0);
  } catch { /* non-fatal */ }

  // ── 6. Alerts (in-memory from alert engine — fires this session) ─────────────
  const alerts: HotLeadAlert[] = getAllAlerts();

  // ── 7. Stats ─────────────────────────────────────────────────────────────────
  const stats = computeRealStats(classifiedLeads, activeMrrCents, alerts);

  return <SalesEngineClient leads={classifiedLeads} stats={stats} alerts={alerts} />;
}
