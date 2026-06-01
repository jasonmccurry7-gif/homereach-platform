// ─────────────────────────────────────────────────────────────────────────────
// Hybrid Sales Engine — Public API
// ─────────────────────────────────────────────────────────────────────────────

// Types
export type {
  LeadTemperature, HotSignalType, HotSignal, LeadClassification,
  ConversationControl, EscalationStatus, ConversationStage,
  QualificationData, MessageRole, MessageChannel, SalesMessage,
  SalesLead, HotLeadAlert, FollowUpVariant, SalesEngineStats,
  AIResponseIntent, AIResponseContext, AIResponseResult,
} from "./types";

// Classifier
export { classifyLead, classifyFromMessage, classifyAll,
         scoreToTemperature, getTemperatureMeta }          from "./classifier";

// Hot Lead Detector
export { detectSignals, isHotSignalPresent,
         buildHotLeadSummary }                             from "./hot-lead-detector";

// Conversation Engine
export { generateResponse, determineIntent,
         canSendAIMessage, buildInitialOutreach }          from "./conversation-engine";

// Alert Engine
export { fireHotLeadAlert, shouldSendAlert, buildAlertRecord,
         buildAlertMessage, getAllAlerts, getAlertsForLead,
         getAlertsToday, seedMockAlerts,
         ALERT_CONFIG }                                    from "./alert-engine";

// Escalation Engine
export { triggerEscalation, humanTakeover, returnToAI,
         markResolved, getEscalationMeta, getControlMeta,
         shouldAutoEscalate }                              from "./escalation-engine";

// Follow-Up Engine
export { getNextFollowUp, buildFollowUpMessage,
         recordFollowUpSent, getLeadsDueForFollowUp,
         isFollowUpExhausted, FOLLOW_UP_SCHEDULE }         from "./followup-engine";

// Growth Engine
export { buildSalesGrowthPlan }                            from "./growth-engine";
export type { SalesGrowthPlan, GrowthOpportunity,
              GrowthPriority, SourceGrowthSummary,
              GrowthQuickAction }                          from "./growth-engine";

// Outreach Governance
export { auditDeliverabilityCopy, buildAiOutputContent,
         buildOutreachSourceAttribution, buildOutreachThrottleStatus,
         evaluateAutomationLiveSendGate, evaluateOutboundApprovalGate,
         firstNameFromLead, scoreNextBestAction }           from "./outreach-governance";
export type { DeliverabilityAudit, GovernedOutreachChannel,
              NextBestAction, OutreachApprovalStatus,
              OutreachLeadLike, OutreachSourceAttribution,
              OutreachThrottleStatus }                      from "./outreach-governance";

// Mock Data
export { MOCK_SALES_LEADS, MOCK_HOT_ALERTS,
         computeSalesStats }                               from "./mock-sales-data";
