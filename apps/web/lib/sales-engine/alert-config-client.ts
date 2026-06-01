export const ALERT_CONFIG = {
  recipientPhone: process.env.NEXT_PUBLIC_ALERT_PHONE_NUMBER ?? "Configured in Vercel",
  fromNumber: "Configured in Vercel",
  dedupeWindowMs: 30 * 60 * 1000,
  maxAlertsPerLead: 3,
} as const;
