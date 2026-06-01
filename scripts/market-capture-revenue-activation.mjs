import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const requireFromWeb = createRequire(path.join(rootDir, "apps/web/package.json"));
const { createClient } = requireFromWeb("@supabase/supabase-js");

const DEFAULT_LIMIT = 25;
const DEFAULT_SOURCE_LIMIT = 1200;
const MANAGEMENT_FEE_CENTS = 49900;
const PHASE = "G_revenue_activation";

function parseArgs(argv) {
  const parsed = {
    limit: DEFAULT_LIMIT,
    writeReport: true,
    json: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--json") parsed.json = true;
    if (arg === "--no-write-report") parsed.writeReport = false;
    if (arg === "--limit" && argv[index + 1]) {
      parsed.limit = Math.max(1, Number(argv[index + 1]) || DEFAULT_LIMIT);
      index += 1;
    }
    if (arg.startsWith("--limit=")) {
      parsed.limit = Math.max(1, Number(arg.split("=")[1]) || DEFAULT_LIMIT);
    }
  }

  return parsed;
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;
    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).trim();
    }
    env[key] = value;
  }

  return env;
}

function loadEnv() {
  return {
    ...parseEnvFile(path.join(rootDir, ".env")),
    ...parseEnvFile(path.join(rootDir, ".env.local")),
    ...parseEnvFile(path.join(rootDir, "apps/web/.env.local")),
    ...process.env,
  };
}

function toText(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function toLower(value) {
  return toText(value).toLowerCase();
}

function compact(values) {
  return values.map(toText).filter(Boolean);
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
}

function normalizePhone(value) {
  const digits = toText(value).replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}

function normalizeName(value) {
  return toLower(value)
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function daysSince(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function stableIndex(seed, length) {
  if (length <= 0) return 0;
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return hash % length;
}

function pick(values, seed) {
  return values[stableIndex(seed, values.length)] ?? values[0] ?? "";
}

function titleCase(value) {
  return toText(value)
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : part))
    .join(" ");
}

const LOCAL_GROWTH_INDUSTRIES = [
  "roof",
  "hvac",
  "heating",
  "cooling",
  "lawn",
  "landscap",
  "concrete",
  "pest",
  "real estate",
  "realtor",
  "med spa",
  "spa",
  "dentist",
  "dental",
  "restaurant",
  "pizza",
  "cafe",
  "bakery",
  "plumb",
  "electric",
  "remodel",
  "floor",
  "fence",
  "garage",
  "window",
  "gutter",
  "pressure washing",
  "cleaning",
];

const HOME_SERVICE_SIGNALS = [
  "roof",
  "hvac",
  "heating",
  "cooling",
  "lawn",
  "landscap",
  "concrete",
  "pest",
  "plumb",
  "electric",
  "remodel",
  "floor",
  "fence",
  "garage",
  "window",
  "gutter",
  "pressure washing",
  "cleaning",
];

const PREMIUM_LOCAL_SIGNALS = ["med spa", "spa", "dentist", "dental", "real estate", "realtor"];
const FOOD_SERVICE_SIGNALS = ["restaurant", "pizza", "cafe", "bakery", "coffee", "bar"];
const POLITICAL_SIGNALS = ["political", "campaign", "candidate", "committee", "county party", "election"];
const DIRECT_MAIL_SIGNALS = ["targeted", "postcard", "mail", "shared postcard", "direct mail", "route"];
const SUPPLY_SIGNALS = ["supply", "supplify", "procurement", "ingredient", "vendor"];

const SUPPRESSED_STATUSES = new Set([
  "archived",
  "dead",
  "lost",
  "closed lost",
  "do not contact",
  "do_not_contact",
  "suppressed",
  "paused",
  "cancelled",
  "canceled",
]);

function hasAnySignal(text, signals) {
  const normalized = toLower(text);
  return signals.some((signal) => normalized.includes(signal));
}

function getMetadata(row) {
  const metadata = row?.metadata ?? row?.revenue_metadata ?? {};
  return metadata && typeof metadata === "object" && !Array.isArray(metadata) ? metadata : {};
}

function sourceValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== null && value !== undefined && toText(value)) return value;
  }
  return null;
}

function normalizeCandidate(source, row) {
  const metadata = getMetadata(row);
  const candidate = {
    source,
    sourceId: toText(row.id ?? row.source_id ?? row.sourceId),
    businessName:
      toText(
        sourceValue(row, [
          "organization_name",
          "business_name",
          "businessName",
          "campaign_name",
          "campaignName",
          "candidate_name",
        ]),
      ) || "Unknown business",
    contactName: toText(sourceValue(row, ["lead_name", "contact_name", "contactName", "owner_contact_name", "name"])),
    email: toText(sourceValue(row, ["contact_email", "email"])).toLowerCase(),
    phone: toText(sourceValue(row, ["contact_phone", "phone"])),
    website: toText(sourceValue(row, ["source_url", "website", "facebook_url", "messenger_url"])),
    city: toText(sourceValue(row, ["city", "geography_value"])),
    county: toText(sourceValue(row, ["county"])),
    state: toText(sourceValue(row, ["state"])),
    category: toText(sourceValue(row, ["category", "industry", "business_type", "vertical", "office_sought", "geography_type"])),
    businessLine: toText(sourceValue(row, ["business_line", "campaign_type"])),
    campaignType: toText(sourceValue(row, ["campaign_type", "type"])),
    primaryStage: toText(sourceValue(row, ["primary_stage", "revenue_stage", "status"])),
    status: toText(sourceValue(row, ["status"])),
    priority: toText(sourceValue(row, ["priority", "score_label"])),
    assignedOwnerKey: toText(sourceValue(row, ["assigned_owner_key", "assigned_sender"])),
    latestOutreachAt: toText(sourceValue(row, ["latest_outreach_at", "last_contacted_at"])),
    latestReplyAt: toText(sourceValue(row, ["latest_reply_at", "last_reply_at"])),
    nextAction: toText(sourceValue(row, ["next_action", "today_suggested_action"])),
    recommendedOffer: toText(sourceValue(row, ["recommended_offer"])),
    notes: toText(sourceValue(row, ["notes", "call_script"])),
    existingScore: Number(
      sourceValue(row, [
        "revenue_priority_score",
        "outreach_priority_score",
        "conversion_probability_score",
        "score",
      ]) ?? 0,
    ),
    estimatedValueCents: Number(sourceValue(row, ["estimated_value_cents"]) ?? 0),
    doNotContact: Boolean(row.do_not_contact) || Boolean(row.opted_out_at),
    smsOptOut: Boolean(row.sms_opt_out),
    metadata,
    raw: row,
  };

  candidate.contextText = compact([
    candidate.businessName,
    candidate.contactName,
    candidate.category,
    candidate.businessLine,
    candidate.campaignType,
    candidate.primaryStage,
    candidate.status,
    candidate.priority,
    candidate.recommendedOffer,
    candidate.notes,
    JSON.stringify(candidate.metadata),
  ]).join(" ");

  return candidate;
}

function isQaLike(candidate) {
  const text = toLower(`${candidate.businessName} ${candidate.email} ${candidate.notes}`);
  return (
    candidate.email.startsWith("qa+") ||
    text.includes("homereach qa") ||
    text.includes("smoke test") ||
    text.includes("internal test only")
  );
}

function suppressionReason(candidate) {
  const stage = toLower(candidate.primaryStage).replace(/[_-]+/g, " ");
  const status = toLower(candidate.status).replace(/[_-]+/g, " ");
  if (isQaLike(candidate)) return "QA/test record";
  if (candidate.doNotContact) return "Do-not-contact or opted-out record";
  if (candidate.smsOptOut && !candidate.email && !candidate.website) return "SMS opt-out with no alternate safe channel";
  if (SUPPRESSED_STATUSES.has(stage) || SUPPRESSED_STATUSES.has(status)) return "Suppressed or closed status";
  if (stage === "closed won" || status === "closed won") return "Already closed won";
  if (!candidate.email && !candidate.phone && !candidate.website) return "No usable contact path";
  return null;
}

function candidateDedupeKey(candidate) {
  if (candidate.email) return `email:${candidate.email}`;
  const phone = normalizePhone(candidate.phone);
  if (phone) return `phone:${phone}`;
  return `business:${normalizeName(candidate.businessName)}:${normalizeName(candidate.city)}:${toLower(candidate.state)}`;
}

function marketCaptureDedupeKeys(leads) {
  const keys = new Set();
  for (const row of leads) {
    const candidate = normalizeCandidate("market_capture_leads", row);
    if (isQaLike(candidate)) continue;
    if (candidate.email) keys.add(`email:${candidate.email}`);
    const phone = normalizePhone(candidate.phone);
    if (phone) keys.add(`phone:${phone}`);
    keys.add(`business:${normalizeName(candidate.businessName)}:${normalizeName(candidate.city)}:${toLower(candidate.state)}`);
  }
  return keys;
}

function classifyCandidate(candidate) {
  const text = candidate.contextText;
  const isPolitical = hasAnySignal(text, POLITICAL_SIGNALS);
  const isHomeService = hasAnySignal(text, HOME_SERVICE_SIGNALS);
  const isPremiumLocal = hasAnySignal(text, PREMIUM_LOCAL_SIGNALS);
  const isFoodService = hasAnySignal(text, FOOD_SERVICE_SIGNALS);
  const hasDirectMail = hasAnySignal(text, DIRECT_MAIL_SIGNALS);
  const hasSupply = hasAnySignal(text, SUPPLY_SIGNALS);
  const isLocalGrowth = hasAnySignal(text, LOCAL_GROWTH_INDUSTRIES);

  let recommendedAngle = "Neighborhood Saturation";
  if (isPolitical) recommendedAngle = "Political District Saturation";
  else if (hasDirectMail) recommendedAngle = "Digital + Direct Mail Campaign";
  else if (isHomeService) recommendedAngle = "Jobsite Halo Campaign";
  else if (isPremiumLocal) recommendedAngle = "Competitor Area Campaign";
  else if (isFoodService) recommendedAngle = "Neighborhood Saturation";
  else if (hasSupply) recommendedAngle = "Margin + Market Capture Follow-Up";

  let sender = "josh";
  if (isPolitical) sender = "jason";
  else if (hasSupply) sender = "chelsi";
  else if (isPremiumLocal && candidate.existingScore >= 65) sender = "jason";

  return {
    isPolitical,
    isHomeService,
    isPremiumLocal,
    isFoodService,
    hasDirectMail,
    hasSupply,
    isLocalGrowth,
    recommendedAngle,
    recommendedSender: sender,
  };
}

function scoreCandidate(candidate, classification) {
  const reasons = [];
  let score = 25;

  const existing = Math.max(0, Math.min(100, Number(candidate.existingScore || 0)));
  if (existing > 0) {
    score += Math.round(existing * 0.25);
    reasons.push(`Existing revenue score ${existing}`);
  }

  if (classification.isLocalGrowth) {
    score += 16;
    reasons.push("Strong local-service or neighborhood buyer fit");
  }
  if (classification.isHomeService) {
    score += 12;
    reasons.push("Jobsite halo campaign fit");
  }
  if (classification.isPremiumLocal) {
    score += 10;
    reasons.push("Premium local category can benefit from repeat visibility");
  }
  if (classification.hasDirectMail) {
    score += 12;
    reasons.push("Direct mail signal creates digital-plus-postcard upsell path");
  }
  if (classification.isPolitical) {
    score += 12;
    reasons.push("Political geography saturation fit");
  }
  if (classification.hasSupply) {
    score += 6;
    reasons.push("Cost-control context creates warm cross-sell opening");
  }

  if (candidate.email) {
    score += 8;
    reasons.push("Email available for approval-ready one-to-one outreach");
  }
  if (candidate.phone && !candidate.smsOptOut) {
    score += 5;
    reasons.push("Phone available for manual call or compliant SMS review");
  }
  if (candidate.website) score += 3;
  if (candidate.city || candidate.county || candidate.state) {
    score += 5;
    reasons.push("Geography available for target-area pitch");
  }

  const stage = toLower(candidate.primaryStage);
  if (["replied", "interested", "proposal sent", "follow-up #1", "follow_up"].some((signal) => stage.includes(signal))) {
    score += 10;
    reasons.push("Existing sales stage suggests a warm or active lead");
  }
  if (toLower(candidate.priority).includes("high") || toLower(candidate.priority).includes("urgent")) {
    score += 8;
    reasons.push("High-priority source record");
  }

  const outreachAge = daysSince(candidate.latestOutreachAt);
  if (outreachAge === null) {
    score += 6;
    reasons.push("No recent outreach recorded");
  } else if (outreachAge >= 21) {
    score += 7;
    reasons.push(`No outreach in ${outreachAge} days`);
  } else if (outreachAge <= 2) {
    score -= 6;
    reasons.push("Recently contacted; use care with cadence");
  }

  if (!candidate.email && candidate.phone) {
    score -= 4;
    reasons.push("Phone-only path requires extra compliance review");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}

function firstName(candidate) {
  const name = toText(candidate.contactName);
  if (!name) return "";
  return name.split(/\s+/)[0] ?? "";
}

function locationLabel(candidate) {
  return compact([candidate.city, candidate.county, candidate.state]).join(", ") || "your local market";
}

function reasonLine(candidate, classification) {
  const area = locationLabel(candidate);
  if (classification.isPolitical) {
    return `your campaign can use geography-level visibility around ${area} without individual voter profiling`;
  }
  if (classification.hasDirectMail) {
    return `HomeReach can pair digital visibility with postcards in the same neighborhoods around ${area}`;
  }
  if (classification.isHomeService) {
    return `every jobsite can become a neighborhood visibility opportunity around ${area}`;
  }
  if (classification.isPremiumLocal) {
    return `higher-consideration local services need repeated visibility in the right neighborhoods around ${area}`;
  }
  if (classification.hasSupply) {
    return `there may be a clean way to pair margin visibility with a growth campaign in ${area}`;
  }
  return `your business can stay visible in the neighborhoods that matter around ${area}`;
}

function generateDrafts(candidate, classification) {
  const seed = `${candidate.source}:${candidate.sourceId}:${candidate.businessName}`;
  const senderName = {
    jason: "Jason",
    josh: "Josh",
    chelsi: "Chelsi",
    heather: "Heather",
  }[classification.recommendedSender] ?? "Josh";
  const greeting = firstName(candidate) ? `Hi ${firstName(candidate)},` : "Hi,";
  const business = candidate.businessName;
  const area = locationLabel(candidate);
  const angle = classification.recommendedAngle;
  const reason = reasonLine(candidate, classification);

  const subject = pick(
    [
      `A Market Capture idea for ${business}`,
      `${business}: neighborhood visibility plan`,
      `Quick target-area idea for ${business}`,
      `Market Capture around ${area}`,
    ],
    seed,
  );

  const opening = pick(
    [
      `I had a practical Market Capture idea for ${business}: ${reason}.`,
      `I was looking at where Market Capture fits best, and ${business} stood out because ${reason}.`,
      `Quick idea from HomeReach: ${angle} could give ${business} a cleaner way to stay visible around ${area}.`,
    ],
    `${seed}:opening`,
  );

  const value = pick(
    [
      "The goal is simple: choose the target area, keep the ad budget under your control, and use HomeReach to plan the campaign, creative direction, tracking, and optional postcard pairing.",
      "This is built for local visibility, not confusing ad-tech. HomeReach handles the campaign plan and keeps the next step easy to review before anything launches.",
      "It can start small: a clear target area, a simple monthly budget, basic creative guidance, and a campaign plan you can approve before spend begins.",
    ],
    `${seed}:value`,
  );

  const cta = pick(
    [
      "Would you like me to send a simple target-area plan?",
      "Should I put together the quick version for your market?",
      "Would a 10-minute walkthrough of the campaign plan be useful?",
    ],
    `${seed}:cta`,
  );

  const emailBody = [
    greeting,
    "",
    opening,
    "",
    value,
    "",
    "Market Capture is $499/month for HomeReach management. Ad spend is separate and stays client-funded. Results vary, and every campaign still depends on platform approval and human launch approval.",
    "",
    cta,
    "",
    senderName,
    "HomeReach",
  ].join("\n");

  const smsGreeting = firstName(candidate)
    ? `Hi ${firstName(candidate)}, ${senderName} with HomeReach.`
    : `Hi, ${senderName} with HomeReach.`;
  const smsBody = compact([
    smsGreeting,
    `Quick idea for ${business}: ${angle} around ${area}.`,
    "$499/mo management, ad spend separate.",
    "Want the simple target-area plan?",
    "Reply STOP to opt out.",
  ]).join(" ");

  const dmBody = [
    `Quick idea for ${business}: HomeReach could help you run a ${angle.toLowerCase()} plan around ${area}.`,
    "The simple version is target area, budget, creative direction, and optional postcards in the same neighborhoods.",
    "Want me to send the quick plan for review?",
  ].join("\n\n");

  const callOpening = [
    `This is ${senderName} with HomeReach. I had a Market Capture idea for ${business}, specifically ${angle} around ${area}.`,
    "The reason I am calling is not to pitch a complicated ad product. It is a simple local visibility plan: pick the area, set the ad budget, and let HomeReach build the campaign plan for approval.",
    "Would it be worth sending the target-area plan?",
  ].join(" ");

  return {
    email: {
      subject,
      body: emailBody,
      approvalRequired: true,
      sendMode: "manual_one_to_one_only",
    },
    sms: {
      body: smsBody,
      approvalRequired: true,
      sendMode: "manual_only_if_compliant_and_opted_in",
    },
    dm: {
      body: dmBody,
      approvalRequired: true,
      sendMode: "manual_one_to_one_only",
    },
    call: {
      opening: callOpening,
      approvalRequired: true,
      sendMode: "manual_call_only",
    },
  };
}

function firstAction(candidate, classification) {
  const sender = titleCase(classification.recommendedSender);
  if (candidate.email) return `Approve ${sender} one-to-one email draft, then send manually.`;
  if (candidate.phone && !candidate.smsOptOut) return `Approve ${sender} call opening, then call manually.`;
  if (candidate.website) return `Research contact path from website, then approve first-touch draft.`;
  return `Manual review required before contact.`;
}

async function selectRows(supabase, config) {
  async function run(selectClause) {
    let query = supabase.from(config.table).select(selectClause).limit(config.limit ?? DEFAULT_SOURCE_LIMIT);
    if (config.orderBy) {
      query = query.order(config.orderBy, { ascending: config.ascending ?? false, nullsFirst: false });
    }
    return query;
  }

  let result = await run(config.select);
  if (result.error && config.fallbackSelect) {
    result = await run(config.fallbackSelect);
  }

  if (result.error) {
    return {
      table: config.table,
      rows: [],
      warning: `${config.table}: ${result.error.message}`,
    };
  }

  return {
    table: config.table,
    rows: result.data ?? [],
    warning: null,
  };
}

const SOURCE_CONFIGS = [
  {
    table: "revenue_pipeline_items",
    source: "revenue_pipeline_items",
    orderBy: "revenue_priority_score",
    select:
      "id, source_system, source_id, business_line, primary_stage, lead_name, organization_name, contact_email, contact_phone, city, county, state, category, campaign_type, assigned_owner_key, estimated_value_cents, engagement_score, response_likelihood_score, urgency_score, conversion_probability_score, revenue_priority_score, latest_outreach_channel, latest_outreach_at, latest_reply_at, next_action, next_action_due_at, next_recommended_channel, status, source_url, metadata, created_at, updated_at",
  },
  {
    table: "sales_leads",
    source: "sales_leads",
    orderBy: "updated_at",
    select:
      "id, business_name, contact_name, email, phone, website, facebook_url, address, city, state, category, score, priority, rating, reviews_count, buying_signal, do_not_contact, sms_opt_out, status, notes, last_contacted_at, last_reply_at, next_follow_up_at, revenue_stage, assigned_owner_key, next_action, estimated_value_cents, engagement_score, response_likelihood_score, urgency_score, conversion_probability_score, revenue_priority_score, latest_outreach_channel, latest_outreach_at, next_recommended_channel, revenue_metadata, created_at, updated_at",
    fallbackSelect:
      "id, business_name, contact_name, email, phone, website, facebook_url, address, city, state, category, score, priority, buying_signal, do_not_contact, sms_opt_out, status, notes, last_contacted_at, last_reply_at, next_follow_up_at, created_at, updated_at",
  },
  {
    table: "outreach_prospects",
    source: "outreach_prospects",
    orderBy: "updated_at",
    select:
      "id, source_table, source_id, category, business_name, campaign_name, contact_name, owner_contact_name, industry, business_type, phone, email, website, facebook_url, messenger_url, priority, status, last_contacted_at, follow_up_date, notes, metadata, campaign_type, city, county, state, source, assigned_sender, opted_out_at, opt_out_reason, vertical, recommended_offer, outreach_priority_score, score_label, today_suggested_action, call_script, created_at, updated_at",
    fallbackSelect:
      "id, category, business_name, campaign_name, contact_name, phone, email, website, facebook_url, priority, status, last_contacted_at, follow_up_date, notes, metadata, created_at, updated_at",
  },
  {
    table: "leads",
    source: "leads",
    orderBy: "updated_at",
    select:
      "id, name, business_name, phone, email, source, status, city, notes, intake_sent_at, intake_submitted_at, paid_at, created_at, updated_at",
  },
  {
    table: "political_outreach_leads",
    source: "political_outreach_leads",
    orderBy: "updated_at",
    select:
      "id, contact_name, contact_email, contact_phone, candidate_name, office_sought, organization_name, state, geography_type, geography_value, district_type, election_date, budget_estimate_cents, desired_drop_count, notes, status, contacted_at, next_follow_up_at, consent_marketing, do_not_contact, source, created_at, updated_at",
    fallbackSelect:
      "id, contact_name, contact_email, contact_phone, candidate_name, organization_name, state, status, notes, do_not_contact, source, created_at, updated_at",
  },
];

async function getExistingMarketCaptureLeads(supabase) {
  const result = await selectRows(supabase, {
    table: "market_capture_leads",
    orderBy: "created_at",
    limit: 1000,
    select:
      "id, business_name, contact_name, email, phone, industry, status, payment_status, target_area, notes, created_at, updated_at",
    fallbackSelect: "id, business_name, contact_name, email, phone, status, created_at, updated_at",
  });

  return result;
}

function enrichCandidate(candidate) {
  const classification = classifyCandidate(candidate);
  const scoring = scoreCandidate(candidate, classification);
  return {
    ...candidate,
    score: scoring.score,
    reasons: scoring.reasons,
    recommendedAngle: classification.recommendedAngle,
    recommendedSender: classification.recommendedSender,
    recommendedFirstAction: firstAction(candidate, classification),
    approvalStatus: "approval_required_before_outreach",
    monthlyManagementFeeCents: MANAGEMENT_FEE_CENTS,
    estimatedMonthlyRecurringRevenueCents: MANAGEMENT_FEE_CENTS,
    estimatedThreeMonthManagementValueCents: MANAGEMENT_FEE_CENTS * 3,
    location: locationLabel(candidate),
    drafts: generateDrafts(candidate, classification),
  };
}

function compactCandidate(candidate) {
  return {
    rank: candidate.rank,
    score: candidate.score,
    source: candidate.source,
    sourceId: candidate.sourceId,
    businessName: candidate.businessName,
    contactName: candidate.contactName,
    email: candidate.email || null,
    phone: candidate.phone || null,
    website: candidate.website || null,
    city: candidate.city || null,
    county: candidate.county || null,
    state: candidate.state || null,
    category: candidate.category || null,
    businessLine: candidate.businessLine || null,
    stage: candidate.primaryStage || null,
    status: candidate.status || null,
    recommendedAngle: candidate.recommendedAngle,
    recommendedSender: candidate.recommendedSender,
    recommendedFirstAction: candidate.recommendedFirstAction,
    approvalStatus: candidate.approvalStatus,
    estimatedMrr: money(candidate.estimatedMonthlyRecurringRevenueCents),
    estimatedThreeMonthManagementValue: money(candidate.estimatedThreeMonthManagementValueCents),
    reasons: candidate.reasons,
    inputsUsed: {
      source: candidate.source,
      sourceId: candidate.sourceId,
      sourceStage: candidate.primaryStage || null,
      sourceStatus: candidate.status || null,
      category: candidate.category || null,
      city: candidate.city || null,
      state: candidate.state || null,
    },
    drafts: candidate.drafts,
  };
}

function markdownEscape(value) {
  return toText(value).replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderMarkdownReport(result) {
  const lines = [];
  lines.push("# Phase G Market Capture Revenue Activation");
  lines.push("");
  lines.push(`Generated: ${result.generatedAt}`);
  lines.push("");
  lines.push("## Guardrails");
  lines.push("");
  lines.push("- This report is read-only and local-only.");
  lines.push("- Human approval is required before any email, SMS, DM, call, payment action, pricing change, or campaign launch.");
  lines.push("- Drafts are one-to-one starting points. Do not send mass outreach or identical copy blocks.");
  lines.push("- SMS drafts require compliance review and an appropriate opt-in basis.");
  lines.push("- No lead, sales, ROI, visit, or savings guarantee is made.");
  lines.push("");
  lines.push("## Source Summary");
  lines.push("");
  lines.push(`- Total source rows read: ${result.sourceSummary.totalRowsRead}`);
  lines.push(`- Suppressed or unusable rows skipped: ${result.sourceSummary.skippedRows}`);
  lines.push(`- Existing Market Capture matches excluded: ${result.sourceSummary.existingMarketCaptureMatchesExcluded}`);
  lines.push(`- Unique candidates scored: ${result.sourceSummary.uniqueCandidatesScored}`);
  lines.push(`- Top candidates returned: ${result.candidates.length}`);
  if (result.warnings.length > 0) {
    lines.push("");
    lines.push("## Warnings");
    lines.push("");
    for (const warning of result.warnings) lines.push(`- ${warning}`);
  }
  lines.push("");
  lines.push("## Top Candidates");
  lines.push("");
  lines.push("| Rank | Score | Business | Category | Location | Angle | Sender | First Action |");
  lines.push("| --- | ---: | --- | --- | --- | --- | --- | --- |");
  for (const candidate of result.candidates) {
    lines.push(
      `| ${candidate.rank} | ${candidate.score} | ${markdownEscape(candidate.businessName)} | ${markdownEscape(
        candidate.category,
      )} | ${markdownEscape(compact([candidate.city, candidate.county, candidate.state]).join(", "))} | ${markdownEscape(
        candidate.recommendedAngle,
      )} | ${markdownEscape(candidate.recommendedSender)} | ${markdownEscape(candidate.recommendedFirstAction)} |`,
    );
  }
  lines.push("");
  lines.push("## First-Customer Sprint");
  lines.push("");
  lines.push("1. Pick the top 5 candidates with the cleanest contact path.");
  lines.push("2. Review each draft for accuracy, opt-in/compliance, and sender fit.");
  lines.push("3. Send only approved one-to-one outreach.");
  lines.push("4. Route interested prospects to /market-capture or /market-capture/intake.");
  lines.push("5. Run `pnpm monitor:market-capture:first-customer` after the first real intake.");
  lines.push("");
  lines.push("## Candidate Drafts");
  lines.push("");

  for (const candidate of result.candidates.slice(0, 10)) {
    lines.push(`### ${candidate.rank}. ${candidate.businessName}`);
    lines.push("");
    lines.push(`- Source: ${candidate.source} / ${candidate.sourceId}`);
    lines.push(`- Approval status: ${candidate.approvalStatus}`);
    lines.push(`- Recommended sender: ${candidate.recommendedSender}`);
    lines.push(`- Recommended angle: ${candidate.recommendedAngle}`);
    lines.push(`- First action: ${candidate.recommendedFirstAction}`);
    lines.push(`- Reasons: ${candidate.reasons.join("; ")}`);
    lines.push("");
    lines.push("Email subject:");
    lines.push("");
    lines.push("```text");
    lines.push(candidate.drafts.email.subject);
    lines.push("```");
    lines.push("");
    lines.push("Email body:");
    lines.push("");
    lines.push("```text");
    lines.push(candidate.drafts.email.body);
    lines.push("```");
    lines.push("");
    lines.push("SMS draft:");
    lines.push("");
    lines.push("```text");
    lines.push(candidate.drafts.sms.body);
    lines.push("```");
    lines.push("");
    lines.push("DM draft:");
    lines.push("");
    lines.push("```text");
    lines.push(candidate.drafts.dm.body);
    lines.push("```");
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function writeReports(result) {
  const outputDir = path.join(rootDir, "ai-workforce", "reports");
  fs.mkdirSync(outputDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outputDir, `market-capture-revenue-activation-${stamp}.json`);
  const markdownPath = path.join(outputDir, `market-capture-revenue-activation-${stamp}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(markdownPath, renderMarkdownReport(result));
  return { jsonPath, markdownPath };
}

const args = parseArgs(process.argv.slice(2));
const env = loadEnv();

if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for Phase G activation.");
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const warnings = [];
const sourceResults = await Promise.all(SOURCE_CONFIGS.map((config) => selectRows(supabase, config)));
for (const sourceResult of sourceResults) {
  if (sourceResult.warning) warnings.push(sourceResult.warning);
}

const existingMarketCapture = await getExistingMarketCaptureLeads(supabase);
if (existingMarketCapture.warning) warnings.push(existingMarketCapture.warning);
const existingKeys = marketCaptureDedupeKeys(existingMarketCapture.rows);

const candidatesByKey = new Map();
let skippedRows = 0;
let existingMarketCaptureMatchesExcluded = 0;
let totalRowsRead = 0;

for (const sourceResult of sourceResults) {
  totalRowsRead += sourceResult.rows.length;
  for (const row of sourceResult.rows) {
    const config = SOURCE_CONFIGS.find((item) => item.table === sourceResult.table);
    const candidate = normalizeCandidate(config?.source ?? sourceResult.table, row);
    const suppressed = suppressionReason(candidate);
    if (suppressed) {
      skippedRows += 1;
      continue;
    }

    const dedupeKey = candidateDedupeKey(candidate);
    if (existingKeys.has(dedupeKey)) {
      existingMarketCaptureMatchesExcluded += 1;
      continue;
    }

    const enriched = enrichCandidate(candidate);
    const existing = candidatesByKey.get(dedupeKey);
    if (!existing || enriched.score > existing.score) {
      candidatesByKey.set(dedupeKey, enriched);
    }
  }
}

const candidates = [...candidatesByKey.values()]
  .sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return toText(b.latestReplyAt).localeCompare(toText(a.latestReplyAt));
  })
  .slice(0, args.limit)
  .map((candidate, index) => compactCandidate({ ...candidate, rank: index + 1 }));

const result = {
  ok: true,
  phase: PHASE,
  generatedAt: new Date().toISOString(),
  mode: "read_only_local_report",
  approvalRequiredBeforeOutbound: true,
  noActionsTaken: [
    "No outreach sent",
    "No tasks inserted",
    "No leads modified",
    "No payments changed",
    "No campaigns launched",
  ],
  sourcesReferenced: SOURCE_CONFIGS.map((config) => config.table).concat("market_capture_leads"),
  sourceSummary: {
    totalRowsRead,
    skippedRows,
    existingMarketCaptureMatchesExcluded,
    uniqueCandidatesScored: candidatesByKey.size,
    sourceTables: Object.fromEntries(sourceResults.map((source) => [source.table, source.rows.length])),
  },
  pricingReference: {
    productName: "Market Capture",
    monthlyManagementFeeCents: MANAGEMENT_FEE_CENTS,
    monthlyManagementFee: money(MANAGEMENT_FEE_CENTS),
    adSpendPolicy: "Client-funded ad spend is separate.",
  },
  warnings,
  candidates,
};

if (args.writeReport) {
  result.reportPaths = writeReports(result);
}

if (args.json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        phase: result.phase,
        mode: result.mode,
        sourceSummary: result.sourceSummary,
        warnings: result.warnings,
        topCandidates: result.candidates.slice(0, 5).map((candidate) => ({
          rank: candidate.rank,
          score: candidate.score,
          businessName: candidate.businessName,
          category: candidate.category,
          location: compact([candidate.city, candidate.county, candidate.state]).join(", ") || null,
          recommendedAngle: candidate.recommendedAngle,
          recommendedSender: candidate.recommendedSender,
          recommendedFirstAction: candidate.recommendedFirstAction,
        })),
        reportPaths: result.reportPaths ?? null,
      },
      null,
      2,
    ),
  );
}
