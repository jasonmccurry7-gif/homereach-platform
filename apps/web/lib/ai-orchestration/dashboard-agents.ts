export type DashboardAgentStatus = "ready" | "partial" | "blocked";

export type DashboardAutonomyLevel =
  | "manual"
  | "advisory"
  | "human_approval"
  | "scheduled_monitor"
  | "assisted_autopilot";

export interface DashboardAgentDefinition {
  id: string;
  name: string;
  dashboard: string;
  route: string;
  mission: string;
  currentAutonomy: DashboardAutonomyLevel;
  targetAutonomy: DashboardAutonomyLevel;
  connectedSystems: string[];
  primaryData: string[];
  requiredEnv: string[];
  optionalEnv?: string[];
  manualBlockers?: string[];
  guardrails: string[];
  nextActions: string[];
  phaseNow: string;
  phaseNext: string;
}

export interface DashboardAgentRuntime extends DashboardAgentDefinition {
  status: DashboardAgentStatus;
  missingRequiredEnv: string[];
  missingOptionalEnv: string[];
  readinessScore: number;
}

const DASHBOARD_AGENT_DEFINITIONS: DashboardAgentDefinition[] = [
  {
    id: "executive-os-agent",
    name: "Executive OS Agent",
    dashboard: "OS / Admin Control Center",
    route: "/os",
    mission: "Summarize system health, revenue risk, active work, and the highest-value action across HomeReach.",
    currentAutonomy: "scheduled_monitor",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["health", "operator summary", "Apex orchestration", "admin alerts"],
    primaryData: ["apex_command_log", "sales_leads", "orders", "internal_alerts"],
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CRON_SECRET"],
    optionalEnv: ["ALERT_PHONE_NUMBER"],
    guardrails: ["Never mutates revenue, payment, or outreach state without an explicit action.", "Escalates failures instead of masking them."],
    nextActions: ["Unify dashboard action items into one next-best-action queue.", "Add cross-dashboard morning and evening briefings."],
    phaseNow: "Health and operator summaries exist.",
    phaseNext: "Central action queue and daily executive briefing.",
  },
  {
    id: "sales-revenue-agent",
    name: "Sales Revenue Agent",
    dashboard: "Sales / Agent View / CRM",
    route: "/admin/sales-dashboard",
    mission: "Prioritize hot leads, draft follow-up, protect revenue paths, and surface closing actions.",
    currentAutonomy: "human_approval",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["sales engine", "CRM", "Postmark", "Twilio", "Stripe"],
    primaryData: ["sales_leads", "sales_events", "auto_sequences", "revenue_message_threads"],
    requiredEnv: ["POSTMARK_API_TOKEN", "POSTMARK_FROM_EMAIL", "STRIPE_SECRET_KEY"],
    optionalEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "OUTREACH_SMS_FROM_NUMBER"],
    manualBlockers: ["Twilio A2P approval is required before SMS prospecting can move beyond guarded/manual mode."],
    guardrails: ["No high-volume sends without approval.", "Opt-out and suppression rules stay enforced."],
    nextActions: ["Add reply classification to the revenue message thread view.", "Convert stale payment links into next-best-action cards."],
    phaseNow: "Email and CRM follow-up foundation is active.",
    phaseNext: "Human-approved AI replies and sales-ready opportunity scoring.",
  },
  {
    id: "outreach-messaging-agent",
    name: "Outreach Messaging Agent",
    dashboard: "Inbox / Revenue Messaging",
    route: "/admin/inbox",
    mission: "Centralize email, SMS, replies, suggested responses, escalation, and suppression-safe follow-up.",
    currentAutonomy: "human_approval",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["revenue messaging", "Postmark", "Twilio", "lead timelines", "notification rules"],
    primaryData: ["revenue_message_threads", "revenue_messages", "message_events", "suppression_list"],
    requiredEnv: ["POSTMARK_API_TOKEN", "POSTMARK_FROM_EMAIL"],
    optionalEnv: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "OUTREACH_SMS_FROM_NUMBER", "OPENAI_API_KEY"],
    manualBlockers: ["SMS remains approval/manual until Twilio A2P is accepted and production send caps are confirmed."],
    guardrails: ["Political replies pause automation and notify Jason.", "Every outbound message must respect opt-out and quiet-hour rules."],
    nextActions: ["Add one shared reply classifier.", "Show pending approvals and hot replies on the admin home action center."],
    phaseNow: "Postmark email path and revenue messaging tables exist.",
    phaseNext: "Unified inbox actions and AI-assisted reply drafting.",
  },
  {
    id: "political-command-agent",
    name: "Political Command Agent",
    dashboard: "Political Command / Candidate Agent",
    route: "/political/candidate-agent",
    mission: "Maintain candidate-specific campaign intelligence, map coverage options, creative plans, readiness gates, and live chat context.",
    currentAutonomy: "advisory",
    targetAutonomy: "human_approval",
    connectedSystems: ["candidate intelligence", "coverage planner", "map plans", "political proposal guardrails"],
    primaryData: ["political_candidate_agent_targets", "political_candidate_creative_concepts", "political_mail_launch_plans"],
    requiredEnv: ["ENABLE_POLITICAL"],
    optionalEnv: ["OPENAI_API_KEY", "FEC_API_KEY", "GOOGLE_CIVIC_API_KEY", "SERPAPI_KEY"],
    guardrails: [
      "No individual voter ideology inference or persuasion scoring.",
      "Proposal, checkout, and production remain locked until USPS counts, pricing, timestamps, and approval are verified.",
    ],
    nextActions: ["Persist chat transcripts per candidate.", "Schedule candidate intelligence refreshes with source freshness checks."],
    phaseNow: "Top Ohio candidate selector, coverage tiers, maps, and chat fallback exist.",
    phaseNext: "Live AI chat and recurring candidate intelligence refresh.",
  },
  {
    id: "procurement-savings-agent",
    name: "Procurement Savings Agent",
    dashboard: "Inventory / Procurement",
    route: "/inventory-purchasing/dashboard",
    mission: "Find recurring supply savings, reorder risk, vendor drift, and owner-ready smart-buy actions.",
    currentAutonomy: "human_approval",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["procurement email sequence", "revenue messaging", "Postmark"],
    primaryData: ["auto_sequences", "revenue_business_line_settings", "revenue_message_threads"],
    requiredEnv: ["POSTMARK_API_TOKEN", "POSTMARK_FROM_EMAIL"],
    optionalEnv: ["OPENAI_API_KEY"],
    guardrails: ["Never places external orders without owner approval.", "Savings estimates must be labeled when fees or taxes are not verified."],
    nextActions: ["Add supplier-item connector abstraction to the dashboard.", "Create owner-mode action cards for approvals and weekly savings reports."],
    phaseNow: "Procurement email automation is routed through central sender.",
    phaseNext: "Savings recommendations and smart-buy approval workflow.",
  },
  {
    id: "gov-contracts-agent",
    name: "Gov Contracts Agent",
    dashboard: "Gov Contracts",
    route: "/admin/gov-contracts",
    mission: "Discover SAM.gov opportunities, score fit, prioritize home-services work, and organize bid-room actions.",
    currentAutonomy: "scheduled_monitor",
    targetAutonomy: "human_approval",
    connectedSystems: ["SAM.gov", "Vercel Cron", "Gov Contracts bid room", "audit logs"],
    primaryData: ["gov_contract_opportunities", "gov_contract_sync_runs", "gov_contract_audit_logs"],
    requiredEnv: ["SAM_GOV_API_KEY", "CRON_SECRET", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    optionalEnv: ["ALERT_PHONE_NUMBER"],
    guardrails: ["No autonomous bid submission.", "No pricing, certification, or subcontractor commitments without approval."],
    nextActions: ["Add strong-fit alert queue.", "Add subcontractor RFQ drafting behind approval."],
    phaseNow: "Home-services SAM.gov sync is scheduled and verified.",
    phaseNext: "Strong-fit alerts and bid-room work queues.",
  },
  {
    id: "growth-seo-agent",
    name: "Growth SEO Agent",
    dashboard: "Growth / Traffic Engine / SEO",
    route: "/admin/growth",
    mission: "Identify revenue SEO pages, draft content, run quality gates, and push items through human review.",
    currentAutonomy: "human_approval",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["SEO engine", "content intelligence", "traffic engine", "human review"],
    primaryData: ["seo_pages", "ci_market_signals", "ci_pipeline_items", "growth_activity_logs"],
    requiredEnv: ["ANTHROPIC_API_KEY"],
    optionalEnv: ["ENABLE_CONTENT_INTEL", "ENABLE_SEO_DRAFT_GENERATION"],
    guardrails: ["No auto-publish without quality checks and approval.", "No fake testimonials or unsupported claims."],
    nextActions: ["Connect top 25 revenue page planner to review queue.", "Add weekly growth report into admin control center."],
    phaseNow: "SEO pages and content intelligence foundations exist.",
    phaseNext: "Unified review queue and publishing calendar.",
  },
  {
    id: "learning-engine-agent",
    name: "Learning Engine Agent",
    dashboard: "Learning Engine / Content Intelligence",
    route: "/admin/content-intel",
    mission: "Continuously ingest trusted business, automation, AI, outreach, SEO, political, procurement, and competitor ideas and turn them into review-ready HomeReach improvements.",
    currentAutonomy: "human_approval",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["content intelligence", "YouTube ingestion", "transcript ingestion", "APEX scoring", "feedback learning", "Action Center"],
    primaryData: [
      "ci_ingestion_queue",
      "ci_insights",
      "ci_actions",
      "ci_scripts",
      "ci_offers",
      "ci_automations",
      "ci_enhancements",
      "ci_patterns",
      "ci_competitor_sources",
      "ci_competitor_insights",
    ],
    requiredEnv: ["ENABLE_CONTENT_INTEL", "YOUTUBE_API_KEY", "YT_TRANSCRIPT_API_KEY", "ANTHROPIC_API_KEY", "CONTENT_INTEL_CRON_SECRET"],
    optionalEnv: ["CONTENT_INTEL_DAILY_CAP", "DISABLE_CONTENT_INTEL_AI"],
    guardrails: [
      "No automatic code deployment, publishing, outreach, payment actions, or customer-facing changes.",
      "Every recommendation must pass human review before becoming an implementation task.",
      "Browser automation remains secondary to APIs and approved source ingestion.",
    ],
    nextActions: ["Broaden category taxonomy beyond home services.", "Connect approved insights to Unified Action Center implementation tasks."],
    phaseNow: "Existing Content Intelligence pipeline is exposed as an admin Learning Engine.",
    phaseNext: "Source-type expansion, duplicate detection, implementation tickets, and weekly executive learning briefings.",
  },
  {
    id: "targeted-campaign-agent",
    name: "Targeted Campaign Agent",
    dashboard: "Targeted Campaigns",
    route: "/targeted",
    mission: "Guide quote, route selection, postcard review, checkout readiness, and launch handoff for targeted mail campaigns.",
    currentAutonomy: "advisory",
    targetAutonomy: "human_approval",
    connectedSystems: ["targeted flows", "route planning", "pricing", "Stripe", "proposal actions"],
    primaryData: ["targeted_campaigns", "orders", "marketing_campaigns", "stripe checkout sessions"],
    requiredEnv: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"],
    optionalEnv: ["OPENAI_API_KEY", "POSTMARK_API_TOKEN"],
    guardrails: ["No checkout unless price, quantity, geography, and customer handoff data are present.", "No route count is displayed as final unless source timestamp exists."],
    nextActions: ["Add quote readiness cards.", "Connect route recommendations to proposal and checkout guardrails."],
    phaseNow: "Targeted campaign and Stripe paths exist.",
    phaseNext: "Launch readiness checklist and AI quote assistant.",
  },
  {
    id: "shared-campaign-agent",
    name: "Shared Campaign Agent",
    dashboard: "Shared Campaigns / Availability",
    route: "/get-started",
    mission: "Protect city/category exclusivity, explain available spots, guide intake, and surface revenue-ready signups.",
    currentAutonomy: "advisory",
    targetAutonomy: "human_approval",
    connectedSystems: ["availability", "category exclusivity", "intake", "Stripe", "admin availability"],
    primaryData: ["businesses", "claimed_categories", "city_availability", "orders"],
    requiredEnv: ["STRIPE_SECRET_KEY", "NEXT_PUBLIC_SUPABASE_URL"],
    optionalEnv: ["POSTMARK_API_TOKEN"],
    guardrails: ["Never double-sells city/category exclusivity.", "Payment actions must use existing Stripe flows."],
    nextActions: ["Audit public CTA routes weekly.", "Create abandoned-intake follow-up tasks for admin review."],
    phaseNow: "Shared campaign funnel and availability surfaces exist.",
    phaseNext: "Exclusivity-aware next-best-action and abandoned-flow recovery.",
  },
  {
    id: "creative-agent",
    name: "Creative Production Agent",
    dashboard: "Ad Designer / Postcards",
    route: "/admin/ad-designer",
    mission: "Generate postcard concepts, creative briefs, copy variants, and approval-ready production notes.",
    currentAutonomy: "advisory",
    targetAutonomy: "human_approval",
    connectedSystems: ["ad engine", "political creative concepts", "review queues"],
    primaryData: ["political_candidate_creative_concepts", "review_requests", "ad-engine templates"],
    requiredEnv: [],
    optionalEnv: ["OPENAI_API_KEY", "ANTHROPIC_API_KEY"],
    guardrails: ["Creative approval remains human-controlled.", "Political creative keeps compliance and disclaimer reminders visible."],
    nextActions: ["Connect Canva/template export workflow.", "Persist selected creative and revision history across dashboards."],
    phaseNow: "Local ad designer and political creative concepts exist.",
    phaseNext: "Shared creative approval and export workflow.",
  },
  {
    id: "customer-success-agent",
    name: "Customer Success Agent",
    dashboard: "Customer Dashboard",
    route: "/dashboard",
    mission: "Guide customers through campaign status, replies, billing, approvals, and next steps.",
    currentAutonomy: "manual",
    targetAutonomy: "human_approval",
    connectedSystems: ["customer dashboard", "campaign status", "billing", "reply tracking"],
    primaryData: ["businesses", "orders", "marketing_campaigns", "outreach_replies"],
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    optionalEnv: ["POSTMARK_API_TOKEN", "TWILIO_ACCOUNT_SID"],
    guardrails: ["No customer-visible fake progress.", "Billing and campaign status must come from verified records."],
    nextActions: ["Replace placeholder reply tracking with live message threads.", "Add customer next-step guidance for approvals and billing issues."],
    phaseNow: "Customer dashboard exists with campaign/billing surfaces.",
    phaseNext: "Customer next-best-action and campaign health guidance.",
  },
  {
    id: "qa-watchtower-agent",
    name: "QA Watchtower Agent",
    dashboard: "QA / Health / Hardening",
    route: "/admin/qa",
    mission: "Monitor broken flows, missing env, failed automations, data drift, and risky dashboard actions.",
    currentAutonomy: "scheduled_monitor",
    targetAutonomy: "assisted_autopilot",
    connectedSystems: ["health checks", "QA knowledge", "agent run logs", "operator summary"],
    primaryData: ["qa_questions", "qa_answers", "agent_run_log", "webhook_events"],
    requiredEnv: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    optionalEnv: ["ANTHROPIC_API_KEY"],
    guardrails: ["Auto-fixes must be reversible.", "Revenue and messaging flows require explicit approval before mutation."],
    nextActions: ["Create route/button smoke-test backlog.", "Add dashboard-specific error budgets and regression watchlists."],
    phaseNow: "Health route and QA subsystem exist.",
    phaseNext: "Automated smoke-test queue and release-readiness scoring.",
  },
];

function envReady(key: string) {
  return Boolean(process.env[key]);
}

export function getDashboardAgentMatrix(): DashboardAgentRuntime[] {
  return DASHBOARD_AGENT_DEFINITIONS.map((agent) => {
    const missingRequiredEnv = agent.requiredEnv.filter((key) => !envReady(key));
    const missingOptionalEnv = (agent.optionalEnv ?? []).filter((key) => !envReady(key));
    const manualBlockers = agent.manualBlockers ?? [];
    const requiredTotal = agent.requiredEnv.length || 1;
    const requiredPassed = agent.requiredEnv.length
      ? agent.requiredEnv.length - missingRequiredEnv.length
      : 1;
    const blockerPenalty = manualBlockers.length * 25;
    const optionalPenalty = missingOptionalEnv.length > 0 ? 10 : 0;
    const readinessScore = Math.max(
      0,
      Math.min(100, Math.round((requiredPassed / requiredTotal) * 100) - blockerPenalty - optionalPenalty)
    );
    const status: DashboardAgentStatus =
      missingRequiredEnv.length > 0
        ? "blocked"
        : manualBlockers.length > 0 || missingOptionalEnv.length > 0
          ? "partial"
          : "ready";

    return {
      ...agent,
      status,
      missingRequiredEnv,
      missingOptionalEnv,
      readinessScore,
    };
  });
}

export function getDashboardAgentSummary(agents = getDashboardAgentMatrix()) {
  return {
    total: agents.length,
    ready: agents.filter((agent) => agent.status === "ready").length,
    partial: agents.filter((agent) => agent.status === "partial").length,
    blocked: agents.filter((agent) => agent.status === "blocked").length,
    averageReadiness:
      agents.length > 0
        ? Math.round(agents.reduce((sum, agent) => sum + agent.readinessScore, 0) / agents.length)
        : 0,
  };
}
