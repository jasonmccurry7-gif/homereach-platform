import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { getOutreachSafetyConfig } from "@homereach/services/outreach";

type SafeCount = {
  count: number;
  error: string | null;
};

type SafeRows<T> = {
  rows: T[];
  error: string | null;
};

export type ProductCommandMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "good" | "watch" | "danger" | "neutral";
};

export type ProductCommandProduct = {
  key: "stormreach" | "political" | "targeted";
  title: string;
  href: string;
  description: string;
  audience: string;
  primaryAction: string;
  secondaryAction: string;
  secondaryHref: string;
  accent: "storm" | "political" | "targeted";
  metrics: ProductCommandMetric[];
  automation: string[];
  designPresets: string[];
  paymentPath: string;
};

export type ProductCommandReadiness = {
  key: string;
  label: string;
  status: "ready" | "review" | "blocked";
  detail: string;
  route?: string;
};

export type ProductCommandData = {
  generatedAt: string;
  warnings: string[];
  products: ProductCommandProduct[];
  automationReadiness: ProductCommandReadiness[];
  paymentReadiness: ProductCommandReadiness[];
  twilioReadiness: ProductCommandReadiness[];
  teamAccess: {
    totalUsers: number;
    adminUsers: number;
    salesAgents: number;
    sourceError: string | null;
    brotherAccessNextStep: string;
  };
  sourceErrors: string[];
};

type GenericRow = Record<string, unknown>;

const ACTIVE_STORM_STATUSES = [
  "detected",
  "scored",
  "prospecting",
  "outreach_ready",
  "campaign_ready",
  "launched",
];

export async function loadMainProductCommandCenter(): Promise<ProductCommandData> {
  const generatedAt = new Date().toISOString();
  const hasSupabaseService = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  if (!hasSupabaseService) {
    const data = buildData({
      generatedAt,
      counts: zeroCounts(),
      twilioRows: [],
      warnings: ["Supabase service credentials are unavailable, so live product counts are hidden."],
      sourceErrors: ["Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY."],
    });
    return data;
  }

  const db = createServiceClient();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    stormActive,
    stormRecent,
    stormProspects,
    stormDrafts,
    stormPackages,
    stormAssets,
    politicalCandidates,
    politicalProposals,
    politicalOrders,
    targetedCampaigns,
    targetedQuoteReady,
    targetedPaid,
    creativeReview,
    automationTasks,
    users,
    twilioA2p,
  ] = await Promise.all([
    safeCount("storm_events.active", () =>
      db.from("storm_events").select("id", { count: "exact", head: true }).in("status", ACTIVE_STORM_STATUSES),
    ),
    safeCount("storm_events.last_24h", () =>
      db.from("storm_events").select("id", { count: "exact", head: true }).gte("detected_at", since24h),
    ),
    safeCount("storm_business_prospects", () =>
      db.from("storm_business_prospects").select("id", { count: "exact", head: true }),
    ),
    safeCount("storm_outreach_messages.needs_review", () =>
      db
        .from("storm_outreach_messages")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["needs_review", "approved"])
        .in("status", ["draft", "approved", "queued"]),
    ),
    safeCount("storm_marketing_packages.needs_review", () =>
      db
        .from("storm_marketing_packages")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["needs_review", "approved"])
        .in("status", ["draft", "ready", "campaign_ready"]),
    ),
    safeCount("storm_generated_assets.needs_review", () =>
      db
        .from("storm_generated_assets")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["needs_review", "approved"]),
    ),
    safeCount("campaign_candidates", () =>
      db.from("campaign_candidates").select("id", { count: "exact", head: true }),
    ),
    safeCount("political_proposals.open", () =>
      db
        .from("political_proposals")
        .select("id", { count: "exact", head: true })
        .in("status", ["draft", "sent", "viewed", "approved"]),
    ),
    safeCount("political_orders.open", () =>
      db
        .from("political_orders")
        .select("id", { count: "exact", head: true })
        .in("payment_status", ["pending", "deposit_paid", "paid"]),
    ),
    safeCount("targeted_route_campaigns", () =>
      db.from("targeted_route_campaigns").select("id", { count: "exact", head: true }),
    ),
    safeCount("targeted_route_campaigns.intake_complete", () =>
      db
        .from("targeted_route_campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "intake_complete"),
    ),
    safeCount("targeted_route_campaigns.paid_active", () =>
      db
        .from("targeted_route_campaigns")
        .select("id", { count: "exact", head: true })
        .in("status", ["paid", "design_queued", "design_in_progress", "design_ready", "approved", "mailed"]),
    ),
    safeCount("creative_assets.needs_review", () =>
      db
        .from("creative_assets")
        .select("id", { count: "exact", head: true })
        .in("approval_status", ["needs_review", "needs_revision"]),
    ),
    safeCount("ai_workforce_tasks.open", () =>
      db
        .from("ai_workforce_tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["open", "queued", "in_progress", "needs_review"]),
    ),
    safeRows<GenericRow>("profiles", () =>
      db.from("profiles").select("id, role").limit(1000),
    ),
    safeRows<GenericRow>("twilio_a2p_status", () =>
      db.from("twilio_a2p_status").select("*").order("updated_at", { ascending: false }).limit(5),
    ),
  ]);

  const sourceErrors = [
    stormActive,
    stormRecent,
    stormProspects,
    stormDrafts,
    stormPackages,
    stormAssets,
    politicalCandidates,
    politicalProposals,
    politicalOrders,
    targetedCampaigns,
    targetedQuoteReady,
    targetedPaid,
    creativeReview,
    automationTasks,
    users,
    twilioA2p,
  ].flatMap((result) => (result.error ? [result.error] : []));

  return buildData({
    generatedAt,
    counts: {
      stormActive: stormActive.count,
      stormRecent: stormRecent.count,
      stormProspects: stormProspects.count,
      stormDrafts: stormDrafts.count,
      stormPackages: stormPackages.count,
      stormAssets: stormAssets.count,
      politicalCandidates: politicalCandidates.count,
      politicalProposals: politicalProposals.count,
      politicalOrders: politicalOrders.count,
      targetedCampaigns: targetedCampaigns.count,
      targetedQuoteReady: targetedQuoteReady.count,
      targetedPaid: targetedPaid.count,
      creativeReview: creativeReview.count,
      automationTasks: automationTasks.count,
      totalUsers: users.rows.length,
      adminUsers: users.rows.filter((row) => row.role === "admin").length,
      salesAgents: users.rows.filter((row) => row.role === "sales_agent").length,
    },
    twilioRows: twilioA2p.rows,
    warnings: sourceErrors.length ? ["Some live product counts could not load. The dashboard is showing safe partial data."] : [],
    sourceErrors,
    userSourceError: users.error,
  });
}

function buildData({
  generatedAt,
  counts,
  twilioRows,
  warnings,
  sourceErrors,
  userSourceError,
}: {
  generatedAt: string;
  counts: ReturnType<typeof zeroCounts>;
  twilioRows: GenericRow[];
  warnings: string[];
  sourceErrors: string[];
  userSourceError?: string | null;
}): ProductCommandData {
  const safety = getOutreachSafetyConfig();
  const stripeConfigured = hasEnv("STRIPE_SECRET_KEY");
  const stripeWebhookConfigured = hasEnv("STRIPE_WEBHOOK_SECRET");
  const appUrlConfigured = hasEnv("NEXT_PUBLIC_APP_URL");
  const tokenSecretConfigured = hasAnyEnv([
    "CHECKOUT_TOKEN_SECRET",
    "PUBLIC_FLOW_TOKEN_SECRET",
    "INTERNAL_APP_SECRET",
    "NEXTAUTH_SECRET",
    "CRON_SECRET",
  ]);
  const twilioCredentials = hasEnv("TWILIO_ACCOUNT_SID") && hasEnv("TWILIO_AUTH_TOKEN");
  const twilioSender = hasAnyEnv([
    "TWILIO_MESSAGING_SERVICE_SID",
    "OUTREACH_TWILIO_MESSAGING_SERVICE_SID",
    "TWILIO_PHONE_NUMBER",
    "OUTREACH_SMS_FROM_NUMBER",
  ]);
  const emailProvider = hasAnyEnv(["POSTMARK_API_TOKEN", "RESEND_API_KEY"]);
  const latestA2p = twilioRows[0] ?? null;
  const a2pText = latestA2p ? Object.values(latestA2p).filter(Boolean).map(String).join(" ").toLowerCase() : "";
  const a2pApproved = /approved|verified|active/.test(a2pText) && !/rejected|failed|suspended/.test(a2pText);

  return {
    generatedAt,
    warnings,
    sourceErrors,
    products: [
      {
        key: "stormreach",
        title: "StormReach",
        href: "/admin/stormreach",
        description:
          "Severe-weather response engine for roofers, siding, tree service, restoration, generators, fencing, dumpsters, and mitigation contractors.",
        audience: "Storm-response home service businesses",
        primaryAction: "Open StormReach",
        secondaryAction: "Generate Storm Creative",
        secondaryHref: "/admin/creative-studio",
        accent: "storm",
        metrics: [
          metric("Active events", counts.stormActive, `${counts.stormRecent} detected in the last 24 hours`, counts.stormActive > 0 ? "watch" : "neutral"),
          metric("Prospects", counts.stormProspects, "50-mile storm contractor list", counts.stormProspects > 0 ? "good" : "watch"),
          metric("Outreach drafts", counts.stormDrafts, "Email, SMS, and Messenger review queue", counts.stormDrafts > 0 ? "good" : "neutral"),
          metric("Packages", counts.stormPackages + counts.stormAssets, "Geofence, postcard, and image assets", counts.stormPackages > 0 ? "good" : "neutral"),
        ],
        automation: [
          "Weather ingestion and 24-hour sweep",
          "50-mile contractor prospecting",
          "Email, SMS, and Messenger drafts",
          "Geofence plus postcard campaign package",
        ],
        designPresets: ["Storm opportunity image", "Postcard follow-up", "Social proof image", "Contractor proposal"],
        paymentPath: "Package approval first, then payment handoff or custom Stripe link.",
      },
      {
        key: "political",
        title: "Political Campaigns",
        href: "/admin/political",
        description:
          "Geography-safe political mail planning with candidate intake, route strategy, proposals, approvals, payments, and fulfillment visibility.",
        audience: "Candidates, campaign managers, consultants, and PAC teams",
        primaryAction: "Open Political",
        secondaryAction: "Create Political Creative",
        secondaryHref: "/admin/creative-studio",
        accent: "political",
        metrics: [
          metric("Candidates", counts.politicalCandidates, "Campaign records available", counts.politicalCandidates > 0 ? "good" : "neutral"),
          metric("Open proposals", counts.politicalProposals, "Draft, sent, viewed, or approved", counts.politicalProposals > 0 ? "watch" : "neutral"),
          metric("Orders", counts.politicalOrders, "Pending, deposit, or paid", counts.politicalOrders > 0 ? "good" : "neutral"),
          metric("Creative review", counts.creativeReview, "Approval-first assets", counts.creativeReview > 0 ? "watch" : "neutral"),
        ],
        automation: [
          "Candidate and campaign research drafts",
          "Proposal and route-plan assembly",
          "Compliance-neutral outreach drafts",
          "Payment and fulfillment gate tracking",
        ],
        designPresets: ["Campaign mailer", "Candidate explainer", "Route map brief", "Proposal one-pager"],
        paymentPath: "Public proposal page supports deposit or full Stripe checkout after approval.",
      },
      {
        key: "targeted",
        title: "Targeted Local Campaigns",
        href: "/admin/targeted-campaigns",
        description:
          "Premium targeted campaigns for car dealerships, doctors, dentists, churches, and local service organizations.",
        audience: "Dealerships, medical offices, dental practices, churches, and community organizations",
        primaryAction: "Open Targeted",
        secondaryAction: "Build Vertical Creative",
        secondaryHref: "/admin/creative-studio",
        accent: "targeted",
        metrics: [
          metric("Campaigns", counts.targetedCampaigns, "Targeted route campaigns", counts.targetedCampaigns > 0 ? "good" : "neutral"),
          metric("Need checkout", counts.targetedQuoteReady, "Completed intakes waiting on payment clarity", counts.targetedQuoteReady > 0 ? "watch" : "neutral"),
          metric("Paid/active", counts.targetedPaid, "Paid, design, approved, or mailed", counts.targetedPaid > 0 ? "good" : "neutral"),
          metric("Automation tasks", counts.automationTasks, "AI workforce queue", counts.automationTasks > 0 ? "watch" : "neutral"),
        ],
        automation: [
          "Vertical-specific email, SMS, and Messenger drafts",
          "Route and audience package builder",
          "Postcard, social, and landing copy engine",
          "Payment recovery and follow-up queue",
        ],
        designPresets: ["Dealership conquest", "Doctor office trust", "Dentist new-patient", "Church community invite"],
        paymentPath: "Signed targeted checkout token protects customer payment links.",
      },
    ],
    automationReadiness: [
      {
        key: "email-provider",
        label: "Email provider",
        status: emailProvider ? "ready" : "blocked",
        detail: emailProvider
          ? "Postmark or Resend is configured for approved sends."
          : "Set POSTMARK_API_TOKEN or RESEND_API_KEY before live email sends.",
        route: "/admin/email-infrastructure",
      },
      {
        key: "manual-approval",
        label: "Approval gate",
        status: safety.manualApprovalMode ? "ready" : "review",
        detail: safety.manualApprovalMode
          ? "Manual approval mode is active for protected prospecting."
          : "Manual approval is enforced in product flows, but OUTREACH_MANUAL_APPROVAL_MODE is not globally enabled.",
        route: "/admin/outreach-command",
      },
      {
        key: "facebook",
        label: "Facebook Messenger",
        status: "review",
        detail: "Messenger remains copy/open-link based. No automated platform send is enabled.",
        route: "/admin/facebook",
      },
    ],
    paymentReadiness: [
      {
        key: "stripe-secret",
        label: "Stripe secret key",
        status: stripeConfigured ? "ready" : "blocked",
        detail: stripeConfigured
          ? "Checkout routes can create Stripe sessions."
          : "Set STRIPE_SECRET_KEY before shared, targeted, or political checkout can run.",
        route: "/admin/profit-center",
      },
      {
        key: "stripe-webhook",
        label: "Stripe webhook",
        status: stripeWebhookConfigured ? "ready" : "review",
        detail: stripeWebhookConfigured
          ? "Webhook secret is present for payment reconciliation."
          : "Set STRIPE_WEBHOOK_SECRET and verify the production webhook endpoint.",
        route: "/admin/profit-center",
      },
      {
        key: "checkout-token",
        label: "Signed checkout tokens",
        status: tokenSecretConfigured ? "ready" : "blocked",
        detail: tokenSecretConfigured
          ? "Signed checkout and proposal links can be issued."
          : "Set CHECKOUT_TOKEN_SECRET or another server-side token secret.",
        route: "/admin/targeted-campaigns",
      },
      {
        key: "app-url",
        label: "Production app URL",
        status: appUrlConfigured ? "ready" : "review",
        detail: appUrlConfigured
          ? "Checkout success and cancel URLs use NEXT_PUBLIC_APP_URL."
          : "Set NEXT_PUBLIC_APP_URL so checkout links return to the correct domain.",
        route: "/admin/profit-center",
      },
    ],
    twilioReadiness: [
      {
        key: "twilio-credentials",
        label: "Twilio credentials",
        status: twilioCredentials ? "ready" : "blocked",
        detail: twilioCredentials
          ? "Account SID and auth token are configured."
          : "Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.",
        route: "/admin/outreach-command",
      },
      {
        key: "twilio-sender",
        label: "SMS sender",
        status: twilioSender ? "ready" : "blocked",
        detail: twilioSender
          ? "Messaging Service SID or phone number is configured."
          : "Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_PHONE_NUMBER.",
        route: "/admin/outreach-command",
      },
      {
        key: "twilio-a2p",
        label: "A2P / compliance",
        status: a2pApproved ? "ready" : twilioRows.length ? "review" : "blocked",
        detail: a2pApproved
          ? "Database status indicates Twilio/A2P is approved or active."
          : twilioRows.length
            ? "Twilio/A2P rows exist, but approval should be reviewed before prospecting SMS volume."
            : "No Twilio/A2P status row is visible yet.",
        route: "/admin/outreach-command",
      },
      {
        key: "sms-live",
        label: "Prospecting SMS live",
        status: safety.smsProspectingLiveEnabled ? "ready" : "review",
        detail: safety.smsProspectingLiveEnabled
          ? "Live prospecting SMS is enabled after approval gates."
          : "OUTREACH_SMS_PROSPECTING_LIVE_ENABLED is off. Manual phone SMS links can still be used.",
        route: "/admin/outreach-command",
      },
    ],
    teamAccess: {
      totalUsers: counts.totalUsers,
      adminUsers: counts.adminUsers,
      salesAgents: counts.salesAgents,
      sourceError: userSourceError ?? null,
      brotherAccessNextStep:
        "Create a Supabase Auth user with app_metadata.user_role=admin, then ensure public.profiles.role=admin.",
    },
  };
}

function zeroCounts() {
  return {
    stormActive: 0,
    stormRecent: 0,
    stormProspects: 0,
    stormDrafts: 0,
    stormPackages: 0,
    stormAssets: 0,
    politicalCandidates: 0,
    politicalProposals: 0,
    politicalOrders: 0,
    targetedCampaigns: 0,
    targetedQuoteReady: 0,
    targetedPaid: 0,
    creativeReview: 0,
    automationTasks: 0,
    totalUsers: 0,
    adminUsers: 0,
    salesAgents: 0,
  };
}

function metric(
  label: string,
  value: number,
  detail: string,
  tone: ProductCommandMetric["tone"],
): ProductCommandMetric {
  return {
    label,
    value: value.toLocaleString("en-US"),
    detail,
    tone,
  };
}

async function safeCount(
  label: string,
  query: () => PromiseLike<{ count: number | null; error: { message: string } | null }>,
): Promise<SafeCount> {
  try {
    const result = await query();
    if (result.error) return { count: 0, error: `${label}: ${result.error.message}` };
    return { count: result.count ?? 0, error: null };
  } catch (error) {
    return { count: 0, error: `${label}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

async function safeRows<T extends GenericRow>(
  label: string,
  query: () => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<SafeRows<T>> {
  try {
    const result = await query();
    if (result.error) return { rows: [], error: `${label}: ${result.error.message}` };
    return { rows: result.data ?? [], error: null };
  } catch (error) {
    return { rows: [], error: `${label}: ${error instanceof Error ? error.message : String(error)}` };
  }
}

function hasEnv(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

function hasAnyEnv(keys: string[]): boolean {
  return keys.some(hasEnv);
}
