export type OutreachIntent = "transactional" | "prospecting" | "follow_up" | "internal";

export interface OwnerIdentity {
  name: string;
  cellPhone: string;
  personalEmail: string;
  secondaryEmail: string;
  domainEmail: string;
  defaultFromEmail: string;
  defaultReplyToEmail: string;
  fallbackReplyToEmail: string;
}

export interface EmailIdentityOptions {
  fromEmail?: string | null;
  fromName?: string | null;
  replyTo?: string | null;
}

export interface SmsIdentityOptions {
  fromNumber?: string | null;
  messagingServiceSid?: string | null;
}

export interface OutreachSafetyConfig {
  testMode: boolean;
  manualApprovalMode: boolean;
  smsProspectingLiveEnabled: boolean;
  defaultTimeZone: string;
  weekdayOnly: boolean;
  businessStartMinutes: number;
  businessEndMinutes: number;
  dailySmsCap: number;
  dailyEmailCapPerSender: number;
  emailRotationEnabled: boolean;
}

const OWNER_DEFAULTS = {
  name: "Jason McCurry",
  cellPhone: "+13302069639",
  personalEmail: "Jasonmccurry7@gmail.com",
  secondaryEmail: "Livetogivemarketing@gmail.com",
  domainEmail: "Jason@home-reach.com",
};

function env(key: string): string | undefined {
  const value = process.env[key];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function envFlag(key: string, defaultValue = false): boolean {
  const value = env(key);
  if (!value) return defaultValue;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function envInt(key: string, defaultValue: number): number {
  const parsed = Number.parseInt(env(key) ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export function getOwnerIdentity(): OwnerIdentity {
  const name = env("OWNER_NAME") ?? OWNER_DEFAULTS.name;
  const cellPhone = env("OWNER_CELL_PHONE") ?? OWNER_DEFAULTS.cellPhone;
  const personalEmail = env("OWNER_PERSONAL_EMAIL") ?? OWNER_DEFAULTS.personalEmail;
  const secondaryEmail = env("OWNER_SECONDARY_EMAIL") ?? OWNER_DEFAULTS.secondaryEmail;
  const domainEmail = env("OWNER_DOMAIN_EMAIL") ?? OWNER_DEFAULTS.domainEmail;
  const defaultFromEmail = env("DEFAULT_FROM_EMAIL") ?? domainEmail;
  const defaultReplyToEmail = env("DEFAULT_REPLY_TO_EMAIL") ?? domainEmail ?? personalEmail;

  return {
    name,
    cellPhone,
    personalEmail,
    secondaryEmail,
    domainEmail,
    defaultFromEmail,
    defaultReplyToEmail,
    fallbackReplyToEmail: personalEmail,
  };
}

export function getOwnerTemplateVars(identity = getOwnerIdentity()): Record<string, string> {
  return {
    ownerName: identity.name,
    ownerCellPhone: identity.cellPhone,
    ownerPersonalEmail: identity.personalEmail,
    ownerSecondaryEmail: identity.secondaryEmail,
    ownerDomainEmail: identity.domainEmail,
  };
}

export function renderOwnerTemplate(
  template: string,
  vars: Record<string, string | null | undefined> = {},
  identity = getOwnerIdentity(),
): string {
  const merged: Record<string, string> = {
    ...getOwnerTemplateVars(identity),
    ...Object.fromEntries(
      Object.entries(vars).map(([key, value]) => [key, value ?? ""]),
    ),
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => merged[key] ?? "");
}

export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(-10);
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : raw;
}

export function buildOwnerSignature(identity = getOwnerIdentity()): string {
  return [
    identity.name,
    "Founder | HomeReach",
    identity.domainEmail,
    `Call/Text: ${identity.cellPhone}`,
  ].join("\n");
}

export function appendSmsCompliance(
  body: string,
  options: { includeDirectLine?: boolean; includeStop?: boolean } = {},
): string {
  const identity = getOwnerIdentity();
  const includeDirectLine = options.includeDirectLine ?? true;
  const includeStop = options.includeStop ?? true;
  const trimmed = body.trim();
  const chunks = [trimmed];

  if (
    includeDirectLine &&
    !trimmed.includes(identity.cellPhone) &&
    !/call or text me directly/i.test(trimmed)
  ) {
    chunks.push(`Call or text me directly at ${identity.cellPhone}`);
  }

  if (includeStop && !/\bSTOP\b/i.test(trimmed)) {
    chunks.push("Reply STOP to unsubscribe.");
  }

  return chunks.join("\n\n");
}

export function appendEmailComplianceText(text: string, recipientEmail?: string): string {
  const unsubscribe = recipientEmail
    ? `https://home-reach.com/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
    : "https://home-reach.com/unsubscribe";
  return `${text.trim()}\n\n${buildOwnerSignature()}\n\nYou are receiving this because your business may be a fit for HomeReach. Unsubscribe: ${unsubscribe}`;
}

export function appendEmailComplianceHtml(html: string, recipientEmail?: string): string {
  const unsubscribe = recipientEmail
    ? `https://home-reach.com/unsubscribe?email=${encodeURIComponent(recipientEmail)}`
    : "https://home-reach.com/unsubscribe";
  return `
    ${html}
    <hr style="margin-top: 30px; border: none; border-top: 1px solid #eee;">
    <p style="color: #777; font-size: 12px; line-height: 1.5;">
      ${buildOwnerSignature().replace(/\n/g, "<br>")}<br><br>
      You are receiving this because your business may be a fit for HomeReach.
      <a href="${unsubscribe}">Unsubscribe</a>
    </p>
  `;
}

export function getDefaultEmailIdentity(options: EmailIdentityOptions = {}) {
  const identity = getOwnerIdentity();
  return {
    fromEmail:
      options.fromEmail ??
      env("DEFAULT_FROM_EMAIL") ??
      env("RESEND_FROM_EMAIL") ??
      env("MAILGUN_FROM_EMAIL") ??
      identity.defaultFromEmail,
    fromName:
      options.fromName ??
      env("RESEND_FROM_NAME") ??
      env("MAILGUN_FROM_NAME") ??
      identity.name,
    replyTo:
      options.replyTo ??
      env("DEFAULT_REPLY_TO_EMAIL") ??
      identity.defaultReplyToEmail ??
      identity.fallbackReplyToEmail,
  };
}

function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return size > 0 ? hash % size : 0;
}

export function getEmailRotationPool(identity = getOwnerIdentity()): string[] {
  return Array.from(new Set([
    identity.defaultFromEmail,
    identity.domainEmail,
    identity.personalEmail,
    identity.secondaryEmail,
  ].filter(Boolean)));
}

export function getRotatingEmailIdentity(
  seed: string,
  options: EmailIdentityOptions = {},
) {
  const base = getDefaultEmailIdentity(options);
  const owner = getOwnerIdentity();
  const ownerEmails = new Set(getEmailRotationPool(owner).map((email) => email.toLowerCase()));
  const explicitFrom = options.fromEmail?.toLowerCase();

  if (!envFlag("OUTREACH_EMAIL_ROTATION_ENABLED", false)) return base;
  if (explicitFrom && !ownerEmails.has(explicitFrom)) return base;

  const pool = getEmailRotationPool(owner);
  const fromEmail = pool[stableIndex(seed, pool.length)] ?? base.fromEmail;
  return {
    ...base,
    fromEmail,
    replyTo: base.replyTo ?? owner.defaultReplyToEmail ?? owner.fallbackReplyToEmail,
  };
}

export function getDefaultSmsIdentity(options: SmsIdentityOptions = {}) {
  return {
    fromNumber: options.fromNumber ?? env("OUTREACH_SMS_FROM_NUMBER") ?? env("TWILIO_PHONE_NUMBER"),
    messagingServiceSid:
      options.messagingServiceSid ??
      env("OUTREACH_TWILIO_MESSAGING_SERVICE_SID") ??
      env("TWILIO_MESSAGING_SERVICE_SID"),
  };
}

export function getOutreachSafetyConfig(): OutreachSafetyConfig {
  return {
    testMode: envFlag("OUTREACH_TEST_MODE", false),
    manualApprovalMode: envFlag("OUTREACH_MANUAL_APPROVAL_MODE", false),
    smsProspectingLiveEnabled: envFlag("OUTREACH_SMS_PROSPECTING_LIVE_ENABLED", false),
    defaultTimeZone: env("OUTREACH_DEFAULT_TIME_ZONE") ?? "America/New_York",
    weekdayOnly: envFlag("OUTREACH_WEEKDAY_ONLY", true),
    businessStartMinutes: envInt("OUTREACH_BUSINESS_START_MINUTES", 8 * 60 + 30),
    businessEndMinutes: envInt("OUTREACH_BUSINESS_END_MINUTES", 17 * 60 + 30),
    dailySmsCap: envInt("OUTREACH_DAILY_SMS_CAP", 30),
    dailyEmailCapPerSender: envInt("OUTREACH_DAILY_EMAIL_CAP_PER_SENDER", 30),
    emailRotationEnabled: envFlag("OUTREACH_EMAIL_ROTATION_ENABLED", false),
  };
}

export function isWithinOutreachWindow(
  date = new Date(),
  timeZone?: string,
  overrides: Partial<Pick<
    OutreachSafetyConfig,
    "weekdayOnly" | "businessStartMinutes" | "businessEndMinutes"
  >> = {},
): boolean {
  const cfg = getOutreachSafetyConfig();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timeZone ?? cfg.defaultTimeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  const weekday = parts.weekday ?? "";
  const hour = Number.parseInt(parts.hour ?? "0", 10);
  const minute = Number.parseInt(parts.minute ?? "0", 10);
  const minutes = hour * 60 + minute;

  const weekdayOnly = overrides.weekdayOnly ?? cfg.weekdayOnly;
  const businessStartMinutes = overrides.businessStartMinutes ?? cfg.businessStartMinutes;
  const businessEndMinutes = overrides.businessEndMinutes ?? cfg.businessEndMinutes;

  if (weekdayOnly && ["Sat", "Sun"].includes(weekday)) return false;
  return minutes >= businessStartMinutes && minutes <= businessEndMinutes;
}
