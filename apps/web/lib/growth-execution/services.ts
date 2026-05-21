export type GrowthServiceStatus = "live" | "enhanced" | "preview" | "future_ready" | "needs_integration";

export type GrowthServiceCategory =
  | "postcards"
  | "lead_capture"
  | "follow_up"
  | "seo"
  | "reputation"
  | "content"
  | "paid_media"
  | "procurement"
  | "government";

export type GrowthPublicExposure =
  | "core_public"
  | "premium_service_page"
  | "guided_preview"
  | "admin_only"
  | "future_ready";

export type GrowthApprovalGate =
  | "human_review"
  | "manual_send"
  | "payment_protected"
  | "publish_approval"
  | "political_compliance"
  | "bid_approval"
  | "ad_launch_approval";

export interface GrowthServiceMetric {
  label: string;
  value: string;
  detail: string;
}

export interface GrowthServiceModule {
  slug: string;
  title: string;
  shortTitle: string;
  category: GrowthServiceCategory;
  status: GrowthServiceStatus;
  publicExposure: GrowthPublicExposure;
  publicPath: string;
  adminPath: string;
  customerPath: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  headline: string;
  outcome: string;
  whoFor: string;
  whatItDoes: string;
  publicPromise: string;
  preservedSystems: string[];
  enhancements: string[];
  executionActions: string[];
  eventTypes: string[];
  dataEntities: string[];
  aiAgents: string[];
  approvalGates: GrowthApprovalGate[];
  crossSells: string[];
  integrationGaps: string[];
  metrics: GrowthServiceMetric[];
}

export interface GrowthExecutionAgent {
  name: string;
  moduleSlug: string;
  purpose: string;
  allowedActions: string[];
  requiresApprovalFor: string[];
  activityLogSource: string;
  performanceMetric: string;
  adminPath: string;
}

export interface GrowthEventModel {
  entity: string;
  currentSource: string;
  eventExamples: string[];
  auditFields: string[];
  adminPath: string;
}

export interface GrowthIntegrationGap {
  system: string;
  impact: string;
  safeCurrentBehavior: string;
  nextStep: string;
  severity: "low" | "medium" | "high";
}

export interface GrowthAuditFinding {
  area: string;
  finding: string;
  decision: string;
  protectedFlow: boolean;
}

export interface GrowthNextBuildStep {
  phase: string;
  title: string;
  objective: string;
  ownerSurface: string;
  risk: "low" | "medium" | "high";
}

export interface GrowthExecutionSnapshot {
  services: GrowthServiceModule[];
  agents: GrowthExecutionAgent[];
  eventModel: GrowthEventModel[];
  integrationGaps: GrowthIntegrationGap[];
  auditFindings: GrowthAuditFinding[];
  nextBuildSequence: GrowthNextBuildStep[];
}

export const growthServiceModules: GrowthServiceModule[] = [
  {
    slug: "direct-mail-postcards",
    title: "Direct Mail and Postcard Campaigns",
    shortTitle: "Postcards",
    category: "postcards",
    status: "live",
    publicExposure: "core_public",
    publicPath: "/shared-postcards",
    adminPath: "/admin/spots",
    customerPath: "/dashboard",
    primaryCtaLabel: "Reserve My Spot",
    primaryCtaHref: "/get-started",
    headline: "Premium postcard campaigns remain the wedge that makes HomeReach visible and memorable.",
    outcome: "Stay in front of local households with shared, targeted, route-based, and political mail.",
    whoFor: "Local businesses, campaign teams, nonprofits, and organizations that need physical visibility.",
    whatItDoes:
      "Preserves shared postcard campaigns, targeted neighborhood campaigns, political postcard campaigns, QR tracking, campaign performance, production status, and multi-drop scheduling.",
    publicPromise: "HomeReach gets you into the mailbox with clear pricing, clean approvals, and execution handled.",
    preservedSystems: [
      "Shared postcard checkout and category exclusivity",
      "Targeted route campaign flow",
      "Political campaign mail planner",
      "Campaign records, QR tracking, maps, Stripe, and fulfillment status",
    ],
    enhancements: [
      "Position postcards as the primary execution channel inside a multi-channel growth engine",
      "Connect postcard records to SEO pages, follow-up, reputation asks, and procurement cross-sells",
      "Use visuals, maps, and proposal assets in outreach packages",
    ],
    executionActions: [
      "Launch campaign",
      "Attach map and postcard proof",
      "Schedule drop",
      "Send proposal",
      "Track QR and reply events",
    ],
    eventTypes: ["campaign_created", "proof_ready", "payment_received", "drop_scheduled", "qr_scan", "reply_received"],
    dataEntities: [
      "orders",
      "spot_assignments",
      "marketing_campaigns",
      "targeted_route_campaigns",
      "political_campaigns",
      "political_orders",
      "campaign_map_plans",
    ],
    aiAgents: ["Postcard Campaign Agent", "Political Campaign Agent", "Creative Agent", "Fulfillment Agent"],
    approvalGates: ["human_review", "payment_protected", "political_compliance"],
    crossSells: ["AI Website Assistant", "Local SEO", "Reputation", "Procurement", "Social Content"],
    integrationGaps: ["Print vendor APIs remain a future handoff if not already configured."],
    metrics: [
      { label: "Primary wedge", value: "Physical mail", detail: "The differentiator stays protected." },
      { label: "Execution routes", value: "4", detail: "Shared, targeted, political, and route-based campaigns." },
      { label: "Safety", value: "Approval-first", detail: "Proofs and payments remain controlled." },
    ],
  },
  {
    slug: "ai-website-assistant",
    title: "AI Website Assistant and Lead Capture",
    shortTitle: "AI Website Assistant",
    category: "lead_capture",
    status: "preview",
    publicExposure: "premium_service_page",
    publicPath: "/services/ai-website-assistant",
    adminPath: "/admin/crm",
    customerPath: "/dashboard",
    primaryCtaLabel: "Request Website Assistant",
    primaryCtaHref: "/waitlist?product=ai-website-assistant",
    headline: "A simple website chat product that captures, qualifies, and routes leads into HomeReach.",
    outcome: "Turn website visitors into named leads, callbacks, and postcard or SEO opportunities.",
    whoFor: "Small businesses that need a low-cost entry product before a larger growth plan.",
    whatItDoes:
      "Answers business FAQs, captures leads, qualifies customers, requests callbacks, routes leads into admin CRM, and triggers approved follow-up paths.",
    publicPromise: "Your website stops letting interested customers disappear.",
    preservedSystems: [
      "CRM and sales lead tables",
      "Revenue messaging engine",
      "Admin inbox",
      "Existing intake and waitlist pathways",
    ],
    enhancements: [
      "Define the chat assistant as a gateway product",
      "Route captured leads into follow-up, postcard, SEO, reputation, procurement, and AI agent offers",
      "Keep chat configuration admin-side instead of exposing agent controls publicly",
    ],
    executionActions: ["Capture lead", "Qualify inquiry", "Request callback", "Create CRM task", "Draft follow-up"],
    eventTypes: ["chat_started", "faq_answered", "lead_captured", "callback_requested", "crm_task_created"],
    dataEntities: ["sales_leads", "sales_events", "revenue_message_threads", "intake_submissions", "waitlist_entries"],
    aiAgents: ["Sales Agent", "Follow-Up Agent", "Revenue Agent"],
    approvalGates: ["human_review", "manual_send"],
    crossSells: ["Shared Postcards", "Targeted Campaigns", "Local SEO", "Reputation", "Procurement"],
    integrationGaps: ["Embeddable widget install script and per-client knowledge base are not fully wired yet."],
    metrics: [
      { label: "Entry product", value: "Low friction", detail: "Easy first sale before a full campaign." },
      { label: "Lead path", value: "CRM", detail: "Routes into existing admin lead systems." },
      { label: "Automation", value: "Approval-aware", detail: "Sensitive sends stay manual." },
    ],
  },
  {
    slug: "follow-up-engine",
    title: "Text and Email Follow-Up Engine",
    shortTitle: "Follow-Up",
    category: "follow_up",
    status: "enhanced",
    publicExposure: "admin_only",
    publicPath: "/services/follow-up-engine",
    adminPath: "/admin/inbox",
    customerPath: "/replies",
    primaryCtaLabel: "See Follow-Up Support",
    primaryCtaHref: "/services/follow-up-engine",
    headline: "Centralized follow-up that keeps leads, replies, proposals, and approvals from going cold.",
    outcome: "Respond faster, nurture leads, and recover stale opportunities without risky autopilot.",
    whoFor: "Internal HomeReach operators and clients that want simple, done-for-you communication.",
    whatItDoes:
      "Supports SMS and email sequences, reply detection, admin notification, manual takeover, approval controls, throttling, and channel performance metrics.",
    publicPromise: "HomeReach helps you stay on top of interested customers.",
    preservedSystems: [
      "Admin inbox",
      "Sales events",
      "Outreach campaigns, messages, and replies",
      "Twilio and email observability",
      "Revenue messaging approval queue",
    ],
    enhancements: [
      "Treat one follow-up engine as the reusable layer for every service line",
      "Surface approval requirements directly in the service registry",
      "Connect proposal and visual attachments to follow-up actions",
    ],
    executionActions: ["One-click email", "One-click text", "Copy DM", "Schedule follow-up", "Log outreach"],
    eventTypes: ["message_drafted", "message_sent", "reply_received", "follow_up_due", "manual_takeover"],
    dataEntities: [
      "sales_events",
      "outreach_contacts",
      "outreach_messages",
      "outreach_replies",
      "revenue_message_events",
      "revenue_message_approval_queue",
      "twilio_message_status",
      "email_events",
    ],
    aiAgents: ["Follow-Up Agent", "Sales Agent", "Revenue Integrity Agent"],
    approvalGates: ["human_review", "manual_send", "political_compliance"],
    crossSells: ["Postcards", "AI Website Assistant", "SEO", "Reputation"],
    integrationGaps: ["High-volume sending limits and channel-specific compliance settings need operator confirmation before scale."],
    metrics: [
      { label: "Channels", value: "SMS + email", detail: "Facebook and LinkedIn use copy/open workflows." },
      { label: "Reply path", value: "Inbox", detail: "Responses surface for manual takeover." },
      { label: "Risk mode", value: "Guarded", detail: "Political and sensitive outreach require review." },
    ],
  },
  {
    slug: "local-seo-landing-pages",
    title: "Local SEO and Landing Page Engine",
    shortTitle: "Local SEO",
    category: "seo",
    status: "enhanced",
    publicExposure: "premium_service_page",
    publicPath: "/services/local-seo",
    adminPath: "/admin/marketing/seo-command-center",
    customerPath: "/dashboard",
    primaryCtaLabel: "Get My Local SEO Plan",
    primaryCtaHref: "/waitlist?product=local-seo",
    headline: "Landing pages that turn local search, postcard QR scans, and campaign traffic into leads.",
    outcome: "Create city, service, campaign, QR, and political landing pages that convert.",
    whoFor: "Businesses and campaigns that need more inbound visibility and better QR destinations.",
    whatItDoes:
      "Generates and manages city pages, service pages, campaign landing pages, QR destinations, political landing pages, local keyword targeting, SEO scoring, forms, and conversion tracking.",
    publicPromise: "People can find you locally, understand the offer, and take the next step.",
    preservedSystems: [
      "SEO authority pages",
      "SEO command center",
      "Sitemap and image sitemap",
      "Existing public premium website",
      "Growth engine page registry",
    ],
    enhancements: [
      "Tie QR destinations and campaign pages to postcard attribution",
      "Keep the homepage simple while service pages and local pages carry SEO depth",
      "Add SEO as a service path in public navigation",
    ],
    executionActions: ["Create page draft", "Score page", "Attach visual proof", "Publish after review", "Track conversion"],
    eventTypes: ["seo_page_drafted", "seo_page_reviewed", "seo_page_published", "qr_visit", "lead_form_submitted"],
    dataEntities: ["seo_pages", "sales_leads", "waitlist_entries", "campaign_map_plans"],
    aiAgents: ["SEO Agent", "Creative Agent", "Sales Agent"],
    approvalGates: ["human_review", "publish_approval"],
    crossSells: ["Postcards", "AI Website Assistant", "Reputation", "Targeted Campaigns"],
    integrationGaps: ["Search Console, rank tracking, and per-client analytics imports should be connected before live reporting promises."],
    metrics: [
      { label: "Page types", value: "5", detail: "City, service, campaign, QR, political." },
      { label: "Quality rule", value: "No thin pages", detail: "Human approval before publishing." },
      { label: "Attribution", value: "QR-ready", detail: "Landing pages connect back to mail." },
    ],
  },
  {
    slug: "reputation-review-management",
    title: "Reputation and Review Management",
    shortTitle: "Reputation",
    category: "reputation",
    status: "enhanced",
    publicExposure: "premium_service_page",
    publicPath: "/services/reputation",
    adminPath: "/admin/reviews",
    customerPath: "/dashboard",
    primaryCtaLabel: "Improve My Reviews",
    primaryCtaHref: "/waitlist?product=reputation",
    headline: "Review requests, response guidance, and reputation signals that make local proof easier.",
    outcome: "Turn happy customers into visible proof and catch reputation risk early.",
    whoFor: "Local businesses that rely on trust, repeat customers, and Google review visibility.",
    whatItDoes:
      "Supports review request campaigns, Google review links, monitoring placeholders, AI-suggested responses, low-rating alerts, scorecards, and admin visibility by client.",
    publicPromise: "HomeReach helps good work become visible online.",
    preservedSystems: ["Review engine", "Admin reviews dashboard", "Sales lead rating and review counts", "Customer dashboard"],
    enhancements: [
      "Connect review requests to postcard follow-up and customer success",
      "Surface reputation as a simple customer metric rather than an internal workflow",
      "Use AI for suggested responses only, with approval before posting",
    ],
    executionActions: ["Send review request", "Draft response", "Flag low rating", "Show reputation score", "Suggest testimonial"],
    eventTypes: ["review_request_sent", "review_link_clicked", "review_detected", "low_rating_alert", "response_drafted"],
    dataEntities: ["review engine records", "sales_leads", "sales_events", "outreach_messages"],
    aiAgents: ["Reputation Agent", "Client Success Agent", "Follow-Up Agent"],
    approvalGates: ["human_review", "manual_send", "publish_approval"],
    crossSells: ["Local SEO", "Postcards", "AI Website Assistant", "Follow-Up"],
    integrationGaps: ["Google Business Profile read/write integration is still a placeholder unless connected."],
    metrics: [
      { label: "Trust layer", value: "Reviews", detail: "Supports local proof and SEO conversion." },
      { label: "Posting", value: "Manual", detail: "AI drafts responses, humans approve." },
      { label: "Customer view", value: "Simple", detail: "Score, requests, and next action." },
    ],
  },
  {
    slug: "social-content-engine",
    title: "Social Content Engine",
    shortTitle: "Social Content",
    category: "content",
    status: "preview",
    publicExposure: "premium_service_page",
    publicPath: "/services/social-content",
    adminPath: "/admin/content-intel",
    customerPath: "/dashboard",
    primaryCtaLabel: "Request Social Content",
    primaryCtaHref: "/waitlist?product=social-content",
    headline: "Done-for-you local visibility prompts, posts, and creative briefs for social channels.",
    outcome: "Keep businesses and campaigns visible without making owners manage a content machine.",
    whoFor: "Local businesses, political campaigns, nonprofits, and service providers.",
    whatItDoes:
      "Creates post ideas, Facebook group drafts, business page drafts, political campaign drafts, seasonal content, and Canva/Figma-ready creative prompts with admin approval.",
    publicPromise: "You get useful local content ideas without staring at a blank page.",
    preservedSystems: ["Content intelligence", "Canva Design OS", "Growth activity logs", "Facebook engine"],
    enhancements: [
      "Position content as a simple visibility service",
      "Keep publishing/export approvals in admin",
      "Use creative briefs as inputs for Canva/Figma visuals",
    ],
    executionActions: ["Draft post", "Create creative brief", "Queue approval", "Export prompt", "Log publish status"],
    eventTypes: ["social_post_drafted", "creative_prompt_created", "approval_requested", "post_published", "engagement_logged"],
    dataEntities: ["growth_activity_logs", "ci_market_signals", "ci_scripts", "sales_events"],
    aiAgents: ["Social Content Agent", "Creative Agent", "Revenue Agent"],
    approvalGates: ["human_review", "publish_approval", "political_compliance"],
    crossSells: ["Canva Design", "Postcards", "SEO", "Reputation"],
    integrationGaps: ["Native publishing APIs are not assumed; current safe path is draft/export/approve."],
    metrics: [
      { label: "Complexity", value: "Low", detail: "Drafts and prompts, not a heavy scheduler." },
      { label: "Creative", value: "Canva-ready", detail: "Briefs can become visual assets." },
      { label: "Safety", value: "Approve first", detail: "No political publishing without review." },
    ],
  },
  {
    slug: "paid-ads-retargeting",
    title: "Paid Ads and Retargeting Readiness",
    shortTitle: "Ads Readiness",
    category: "paid_media",
    status: "future_ready",
    publicExposure: "future_ready",
    publicPath: "/services/paid-ads-retargeting",
    adminPath: "/admin/traffic-engine",
    customerPath: "/dashboard",
    primaryCtaLabel: "Plan Retargeting",
    primaryCtaHref: "/waitlist?product=paid-ads-retargeting",
    headline: "A future-ready structure for postcard plus digital retargeting without pretending integrations exist.",
    outcome: "Prepare Facebook, Google, retargeting, and QR visitor audiences for later activation.",
    whoFor: "Businesses already running postcards or SEO pages that want digital follow-up next.",
    whatItDoes:
      "Creates the module structure for Facebook ads, Google ads, retargeting, QR visitor retargeting, and postcard plus digital follow-up campaigns.",
    publicPromise: "Your mail campaigns can be designed to support future digital follow-up.",
    preservedSystems: ["Traffic engine", "Growth activity logs", "QR and campaign tracking", "Sales events"],
    enhancements: [
      "Make ad readiness visible without launching ad buying",
      "Flag missing provider integrations clearly",
      "Keep paid media actions behind explicit approval",
    ],
    executionActions: ["Define audience", "Attach QR destination", "Draft ad concept", "Request approval", "Log readiness"],
    eventTypes: ["audience_defined", "pixel_needed", "ad_concept_drafted", "approval_requested", "campaign_ready"],
    dataEntities: ["growth_activity_logs", "sales_events", "campaign_map_plans", "seo_pages"],
    aiAgents: ["Revenue Agent", "Creative Agent", "QA / Revenue Integrity Agent"],
    approvalGates: ["human_review", "ad_launch_approval", "payment_protected"],
    crossSells: ["Postcards", "Local SEO", "AI Website Assistant"],
    integrationGaps: ["Facebook Ads, Google Ads, pixels, consent, and billing integrations are not enabled in this phase."],
    metrics: [
      { label: "Build mode", value: "Future-ready", detail: "No autonomous ad buying." },
      { label: "Best use", value: "QR retargeting", detail: "Prepared for later attribution." },
      { label: "Approval", value: "Required", detail: "Ads cannot launch automatically." },
    ],
  },
  {
    slug: "procurement-inventory-intelligence",
    title: "Procurement and Inventory Intelligence",
    shortTitle: "Procurement",
    category: "procurement",
    status: "live",
    publicExposure: "guided_preview",
    publicPath: "/inventory-purchasing",
    adminPath: "/admin/procurement",
    customerPath: "/operations-copilot",
    primaryCtaLabel: "See Savings Opportunities",
    primaryCtaHref: "/operations-copilot",
    headline: "A purchasing intelligence layer that turns marketing customers into operating system customers.",
    outcome: "Find supply savings, compare vendors, and make recurring purchasing visible.",
    whoFor: "Businesses with recurring supplies, vendor price variance, inventory risk, or delivery coordination needs.",
    whatItDoes:
      "Preserves supplier pricing, vendor comparison, inventory visibility, savings recommendations, smart-buy approvals, and cross-sell logic.",
    publicPromise: "HomeReach can help you grow revenue and catch recurring cost leaks.",
    preservedSystems: [
      "Operations Copilot",
      "Supplier price snapshots",
      "Inventory items",
      "Action requests",
      "Approval policies",
      "Procurement admin dashboard",
    ],
    enhancements: [
      "Connect procurement offers to marketing customers",
      "Use savings snapshots as outreach/proposal visuals",
      "Route inventory-purchasing dashboard intents correctly into Operations Copilot",
    ],
    executionActions: ["Compare suppliers", "Draft smart buy", "Request approval", "Export savings snapshot", "Create cross-sell task"],
    eventTypes: ["price_snapshot_captured", "savings_detected", "smart_buy_drafted", "approval_requested", "vendor_selected"],
    dataEntities: [
      "opcopilot_business_contexts",
      "opcopilot_inventory_items",
      "opcopilot_suppliers",
      "opcopilot_supplier_quotes",
      "opcopilot_price_snapshots",
      "opcopilot_action_requests",
      "opcopilot_ai_events",
    ],
    aiAgents: ["Procurement Agent", "Revenue Agent", "QA / Revenue Integrity Agent"],
    approvalGates: ["human_review", "payment_protected"],
    crossSells: ["Shared Postcards", "AI Website Assistant", "Local SEO", "Follow-Up"],
    integrationGaps: ["Supplier ordering APIs remain approval-only/manual unless a connector is explicitly configured."],
    metrics: [
      { label: "Customer promise", value: "Save money", detail: "Makes HomeReach feel like an operating system." },
      { label: "Current source", value: "Ops Copilot", detail: "No duplicate procurement module." },
      { label: "Autonomy", value: "Approval", detail: "Smart buys require human confirmation." },
    ],
  },
  {
    slug: "government-contracts",
    title: "Government Contract Support",
    shortTitle: "Gov Contracts",
    category: "government",
    status: "live",
    publicExposure: "premium_service_page",
    publicPath: "/services/government-contracts",
    adminPath: "/admin/gov-contracts",
    customerPath: "/dashboard",
    primaryCtaLabel: "Review Contract Support",
    primaryCtaHref: "/waitlist?product=government-contracts",
    headline: "A human-approved SAM.gov and bid support module for long-tail revenue opportunities.",
    outcome: "Track opportunities, decide bid/no-bid, organize documents, and manage pipeline value.",
    whoFor: "HomeReach and clients pursuing government, subcontractor, or vendor opportunities.",
    whatItDoes:
      "Supports SAM.gov opportunity tracking, bid/no-bid workflow, subcontractor/vendor tracking, document checklists, admin review, AI summaries, CRM pipeline stages, and revenue opportunity tracking.",
    publicPromise: "HomeReach can help spot and organize public-sector opportunities without risky autonomous bidding.",
    preservedSystems: ["Gov contracts admin", "SAM.gov sync", "Bid rooms", "Audit logs", "Fit scoring"],
    enhancements: [
      "Promote government contracts to a top-level ecosystem module",
      "Keep all bid decisions and submissions behind human approval",
      "Connect opportunity value into the unified revenue cockpit",
    ],
    executionActions: ["Sync opportunity", "Score fit", "Create bid room", "Assign checklist", "Approve bid/no-bid"],
    eventTypes: ["sam_sync_completed", "opportunity_scored", "bid_room_created", "document_checked", "bid_decision_logged"],
    dataEntities: ["gov_contract_opportunities", "gov_contract_sync_runs", "gov_contract_audit_logs"],
    aiAgents: ["Government Contract Agent", "Revenue Agent", "QA / Revenue Integrity Agent"],
    approvalGates: ["human_review", "bid_approval", "payment_protected"],
    crossSells: ["Capability Statements", "Postcards", "Procurement", "Website Assistant"],
    integrationGaps: ["SAM.gov API key and downstream document-generation tools must be confirmed per environment."],
    metrics: [
      { label: "Submission", value: "Never auto", detail: "AI summarizes and prepares only." },
      { label: "Pipeline", value: "Admin-only", detail: "Bid rooms stay protected." },
      { label: "Audit", value: "Logged", detail: "Decisions should be traceable." },
    ],
  },
];

export const growthExecutionAgents: GrowthExecutionAgent[] = [
  {
    name: "Revenue Agent",
    moduleSlug: "direct-mail-postcards",
    purpose: "Prioritize service opportunities, proposal moments, cross-sells, and next best actions.",
    allowedActions: ["Recommend next offer", "Draft outreach", "Summarize account activity", "Flag stuck revenue"],
    requiresApprovalFor: ["Sending outreach", "Changing payments", "Launching paid ads", "Charging customers"],
    activityLogSource: "sales_events + revenue_message_events",
    performanceMetric: "Pipeline value moved and stale opportunities recovered",
    adminPath: "/admin/revenue-operations",
  },
  {
    name: "Follow-Up Agent",
    moduleSlug: "follow-up-engine",
    purpose: "Draft follow-ups, identify stale leads, and recommend channels without high-risk autonomous sending.",
    allowedActions: ["Draft email", "Draft SMS", "Create follow-up task", "Recommend cadence"],
    requiresApprovalFor: ["Bulk send", "Political outreach", "Sensitive or compliance-heavy messages"],
    activityLogSource: "sales_events + outreach_replies + revenue_message_approval_queue",
    performanceMetric: "Replies, booked calls, recovered proposals",
    adminPath: "/admin/inbox",
  },
  {
    name: "Postcard Campaign Agent",
    moduleSlug: "direct-mail-postcards",
    purpose: "Connect postcard plans, route maps, proofs, QR destinations, and fulfillment readiness.",
    allowedActions: ["Recommend drop timing", "Draft proposal copy", "Surface proof blockers", "Prepare campaign package"],
    requiresApprovalFor: ["Proof approval", "Mail schedule commitment", "Customer-facing claims"],
    activityLogSource: "marketing_campaigns + targeted_route_campaigns + campaign_map_plans",
    performanceMetric: "Campaigns launched, proof cycle time, QR engagement",
    adminPath: "/admin/campaigns",
  },
  {
    name: "SEO Agent",
    moduleSlug: "local-seo-landing-pages",
    purpose: "Recommend local pages, QR landing pages, metadata, schema, and internal links.",
    allowedActions: ["Draft page", "Score quality", "Suggest keyword", "Recommend internal links"],
    requiresApprovalFor: ["Publishing pages", "Changing homepage messaging", "Making performance claims"],
    activityLogSource: "seo_pages + SEO registry",
    performanceMetric: "Pages approved, leads from SEO, page health score",
    adminPath: "/admin/marketing/seo-command-center",
  },
  {
    name: "Reputation Agent",
    moduleSlug: "reputation-review-management",
    purpose: "Recommend review requests, draft responses, and flag low-rating risk.",
    allowedActions: ["Draft review request", "Draft response", "Summarize reputation trend", "Create task"],
    requiresApprovalFor: ["Sending review asks", "Posting public responses", "Contacting unhappy customers"],
    activityLogSource: "review engine + sales_events",
    performanceMetric: "Reviews requested, response drafts approved, reputation risks closed",
    adminPath: "/admin/reviews",
  },
  {
    name: "Government Contract Agent",
    moduleSlug: "government-contracts",
    purpose: "Summarize opportunities, recommend bid/no-bid, and organize bid room tasks.",
    allowedActions: ["Summarize opportunity", "Draft checklist", "Recommend subcontractor search", "Score fit"],
    requiresApprovalFor: ["Bid/no-bid decision", "Submissions", "Legal/compliance claims", "Pricing commitments"],
    activityLogSource: "gov_contract_opportunities + gov_contract_audit_logs",
    performanceMetric: "Reviewed opportunities and bid rooms moved forward",
    adminPath: "/admin/gov-contracts",
  },
];

export const growthEventModel: GrowthEventModel[] = [
  {
    entity: "Customers and accounts",
    currentSource: "profiles, businesses, orders, spot_assignments",
    eventExamples: ["account_created", "service_attached", "payment_received", "renewal_due"],
    auditFields: ["actor_id", "customer_id", "service_slug", "source_system", "created_at"],
    adminPath: "/admin/businesses",
  },
  {
    entity: "Leads and outreach",
    currentSource: "sales_leads, sales_events, outreach_contacts, outreach_messages, outreach_replies",
    eventExamples: ["lead_created", "message_drafted", "message_sent", "reply_received", "manual_takeover"],
    auditFields: ["actor_id", "lead_id", "channel", "message_id", "ai_initiated", "human_approved_at"],
    adminPath: "/admin/inbox",
  },
  {
    entity: "Campaign execution",
    currentSource: "marketing_campaigns, targeted_route_campaigns, political_campaigns, political_orders",
    eventExamples: ["campaign_started", "proof_ready", "proof_approved", "drop_scheduled", "delivery_confirmed"],
    auditFields: ["actor_id", "campaign_id", "order_id", "status_before", "status_after", "created_at"],
    adminPath: "/admin/campaigns",
  },
  {
    entity: "AI assistant and website leads",
    currentSource: "sales_leads, intake_submissions, waitlist_entries, revenue_message_threads",
    eventExamples: ["chat_started", "lead_captured", "faq_answered", "callback_requested"],
    auditFields: ["session_id", "lead_id", "customer_id", "source_url", "consent_status", "created_at"],
    adminPath: "/admin/crm",
  },
  {
    entity: "SEO, reputation, and content",
    currentSource: "seo_pages, growth_activity_logs, review engine, content intelligence",
    eventExamples: ["page_drafted", "page_published", "review_request_sent", "social_post_drafted"],
    auditFields: ["actor_id", "artifact_id", "approval_id", "published_at", "source_campaign_id"],
    adminPath: "/admin/marketing/seo-command-center",
  },
  {
    entity: "Procurement and government contracts",
    currentSource: "opcopilot_* tables, gov_contract_opportunities, gov_contract_audit_logs",
    eventExamples: ["savings_detected", "smart_buy_drafted", "sam_sync_completed", "bid_decision_logged"],
    auditFields: ["actor_id", "customer_id", "opportunity_id", "approval_status", "estimated_value", "created_at"],
    adminPath: "/admin/procurement",
  },
];

export const growthIntegrationGaps: GrowthIntegrationGap[] = [
  {
    system: "AI Website Assistant widget",
    impact: "Needed before this can be sold as a fully self-serve embeddable website product.",
    safeCurrentBehavior: "Route interest through waitlist, CRM, and admin follow-up.",
    nextStep: "Create an embeddable script, per-client FAQ source, consent capture, and CRM lead writer.",
    severity: "medium",
  },
  {
    system: "Google Business Profile",
    impact: "Required for live review monitoring and response posting.",
    safeCurrentBehavior: "Use review links, request campaigns, and admin response drafts.",
    nextStep: "Connect GBP read scope first, then add approval-only response posting.",
    severity: "medium",
  },
  {
    system: "Paid ads providers",
    impact: "Facebook/Google campaign launch, pixel audiences, and retargeting cannot be promised as active automation.",
    safeCurrentBehavior: "Offer readiness planning and creative/ad concept drafts only.",
    nextStep: "Add provider auth, billing controls, consent checks, and ad launch approval queue.",
    severity: "high",
  },
  {
    system: "Supplier ordering connectors",
    impact: "Procurement recommendations cannot safely place real orders without confirmed supplier integrations.",
    safeCurrentBehavior: "Draft smart buys and require human approval/manual checkout.",
    nextStep: "Add supplier-specific connectors behind approval policies and spend limits.",
    severity: "medium",
  },
  {
    system: "Search Console and rank tracking",
    impact: "SEO dashboard can show architecture and page inventory, but live ranking metrics need provider data.",
    safeCurrentBehavior: "Use SEO registry, quality checks, sitemap, and manual keyword opportunities.",
    nextStep: "Connect Search Console, Analytics, and rank tracker imports.",
    severity: "low",
  },
];

export const growthAuditFindings: GrowthAuditFinding[] = [
  {
    area: "Postcard systems",
    finding: "Shared, targeted, political, QR, map, payment, and fulfillment flows already exist.",
    decision: "Preserve them as the primary wedge and expose them through the growth execution registry.",
    protectedFlow: true,
  },
  {
    area: "Outreach and CRM",
    finding: "sales_events, outreach_messages, outreach_replies, inbox, and revenue messaging already cover the core follow-up model.",
    decision: "Enhance visibility and approval modeling instead of creating a second messaging system.",
    protectedFlow: true,
  },
  {
    area: "Procurement",
    finding: "Operations Copilot already covers inventory, supplier price snapshots, action requests, and approval policies.",
    decision: "Keep it as the source system and add cross-sell/OS positioning.",
    protectedFlow: true,
  },
  {
    area: "Government contracts",
    finding: "SAM.gov opportunity tracking, bid rooms, status changes, and audit logs already exist under admin.",
    decision: "Promote it as a top-level ecosystem module while keeping bid actions human-approved.",
    protectedFlow: true,
  },
  {
    area: "Public website",
    finding: "The homepage is already premium and simple; adding all operational detail there would create cognitive overload.",
    decision: "Add service pathways and public service pages while keeping admin complexity private.",
    protectedFlow: false,
  },
  {
    area: "Data model",
    finding: "Existing entities cover most requested event sources; missing systems are integration gaps rather than reasons to migrate immediately.",
    decision: "No database migration in this pass. Use a registry and admin read model until specific write flows are approved.",
    protectedFlow: true,
  },
];

export const growthNextBuildSequence: GrowthNextBuildStep[] = [
  {
    phase: "1",
    title: "Embeddable AI Website Assistant",
    objective: "Create the lightweight script, client FAQ source, consent capture, and CRM lead writer.",
    ownerSurface: "/admin/crm",
    risk: "medium",
  },
  {
    phase: "2",
    title: "Unified service attachment model",
    objective: "Attach active service modules to accounts/customers without disturbing current order tables.",
    ownerSurface: "/admin/businesses",
    risk: "medium",
  },
  {
    phase: "3",
    title: "Follow-up approval queue hardening",
    objective: "Normalize approval states across SMS, email, political, reputation, and social drafts.",
    ownerSurface: "/admin/inbox",
    risk: "medium",
  },
  {
    phase: "4",
    title: "SEO and QR landing page publishing workflow",
    objective: "Connect campaign QR destinations, SEO quality checks, page approval, and conversion tracking.",
    ownerSurface: "/admin/marketing/seo-command-center",
    risk: "low",
  },
  {
    phase: "5",
    title: "Reputation and GBP integration",
    objective: "Connect Google Business Profile monitoring and approval-only response publishing.",
    ownerSurface: "/admin/reviews",
    risk: "medium",
  },
  {
    phase: "6",
    title: "Ads and supplier connector enablement",
    objective: "Add provider auth, consent, spend locks, supplier limits, and approval gates before execution.",
    ownerSurface: "/admin/control-center",
    risk: "high",
  },
];

export function listGrowthServiceModules() {
  return growthServiceModules;
}

export function getGrowthServiceModule(slug: string) {
  return growthServiceModules.find((service) => service.slug === slug || getPublicServiceSlug(service) === slug);
}

export function getPublicServiceSlug(service: GrowthServiceModule) {
  return service.publicPath.startsWith("/services/")
    ? service.publicPath.replace("/services/", "")
    : service.slug;
}

export function listPublicGrowthServiceSlugs() {
  return growthServiceModules.map((service) => ({ serviceSlug: getPublicServiceSlug(service) }));
}

export function getGrowthExecutionSnapshot(): GrowthExecutionSnapshot {
  return {
    services: growthServiceModules,
    agents: growthExecutionAgents,
    eventModel: growthEventModel,
    integrationGaps: growthIntegrationGaps,
    auditFindings: growthAuditFindings,
    nextBuildSequence: growthNextBuildSequence,
  };
}
