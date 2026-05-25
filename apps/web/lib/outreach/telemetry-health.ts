export type TelemetryRow = Record<string, unknown>;

export type TelemetryWarning = {
  id: string;
  severity: "medium" | "high";
  channel: "email" | "sms";
  message: string;
};

export type ChannelTelemetryFreshness = {
  latest_received_at: string | null;
  latest_age_hours: number | null;
  events_sampled_7d: number;
  send_activity_today: number;
  stale: boolean;
};

export type ProviderTelemetryFreshness = {
  stale_after_hours: number;
  email: ChannelTelemetryFreshness;
  sms: ChannelTelemetryFreshness;
  warnings: TelemetryWarning[];
};

type BuildProviderTelemetryFreshnessInput = {
  now?: Date;
  staleAfterHours?: number;
  emailEvents: TelemetryRow[];
  twilioEvents: TelemetryRow[];
  autoSendsToday: TelemetryRow[];
  salesEventsToday: TelemetryRow[];
  sourceErrors?: {
    emailEvents?: string;
    twilioMessageStatus?: string;
  };
};

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function latestIsoTimestamp(
  rows: TelemetryRow[],
  key: string,
): string | null {
  let latestMs: number | null = null;

  for (const row of rows) {
    const raw = asString(row[key]);
    const timestamp = Date.parse(raw);
    if (!Number.isFinite(timestamp)) continue;
    if (latestMs === null || timestamp > latestMs) {
      latestMs = timestamp;
    }
  }

  return latestMs === null ? null : new Date(latestMs).toISOString();
}

function ageHours(latestIso: string | null, now: Date): number | null {
  if (!latestIso) return null;
  const age = (now.getTime() - Date.parse(latestIso)) / (60 * 60 * 1000);
  if (!Number.isFinite(age) || age < 0) return null;
  return Number(age.toFixed(2));
}

function rowMatchesChannel(row: TelemetryRow, channel: "email" | "sms"): boolean {
  const value = asString(row.channel).toLowerCase();
  const action = asString(row.action_type).toLowerCase();

  if (channel === "email") {
    return value === "email" || action.includes("email");
  }

  return value === "sms" || value === "text" || action.includes("sms") || action.includes("text");
}

function countSendActivity(
  rows: TelemetryRow[],
  channel: "email" | "sms",
): number {
  return rows.filter((row) => rowMatchesChannel(row, channel)).length;
}

function buildChannelFreshness(params: {
  now: Date;
  staleAfterHours: number;
  telemetryRows: TelemetryRow[];
  sendActivityToday: number;
}): ChannelTelemetryFreshness {
  const latest = latestIsoTimestamp(params.telemetryRows, "received_at");
  const latestAge = ageHours(latest, params.now);

  return {
    latest_received_at: latest,
    latest_age_hours: latestAge,
    events_sampled_7d: params.telemetryRows.length,
    send_activity_today: params.sendActivityToday,
    stale: params.sendActivityToday > 0 &&
      (latestAge === null || latestAge > params.staleAfterHours),
  };
}

function addSourceErrorWarning(
  warnings: TelemetryWarning[],
  channel: "email" | "sms",
  error: string | undefined,
): void {
  if (!error) return;

  warnings.push({
    id: `${channel}-telemetry-source-error`,
    severity: "high",
    channel,
    message: `Could not read ${channel} provider telemetry: ${error}`,
  });
}

function addFreshnessWarning(
  warnings: TelemetryWarning[],
  channel: "email" | "sms",
  freshness: ChannelTelemetryFreshness,
  staleAfterHours: number,
): void {
  if (freshness.send_activity_today === 0 || !freshness.stale) return;

  if (!freshness.latest_received_at) {
    warnings.push({
      id: `${channel}-telemetry-missing`,
      severity: "high",
      channel,
      message: `${channel} send activity exists today, but no provider telemetry was found in the last 7 days.`,
    });
    return;
  }

  warnings.push({
    id: `${channel}-telemetry-stale`,
    severity: "medium",
    channel,
    message: `${channel} send activity exists today, but the newest provider telemetry is ${freshness.latest_age_hours} hours old. Expected freshness under ${staleAfterHours} hours.`,
  });
}

export function buildProviderTelemetryFreshness(
  input: BuildProviderTelemetryFreshnessInput,
): ProviderTelemetryFreshness {
  const now = input.now ?? new Date();
  const staleAfterHours = input.staleAfterHours ?? 48;
  const emailSendActivityToday =
    countSendActivity(input.autoSendsToday, "email") +
    countSendActivity(input.salesEventsToday, "email");
  const smsSendActivityToday =
    countSendActivity(input.autoSendsToday, "sms") +
    countSendActivity(input.salesEventsToday, "sms");

  const email = buildChannelFreshness({
    now,
    staleAfterHours,
    telemetryRows: input.emailEvents,
    sendActivityToday: emailSendActivityToday,
  });
  const sms = buildChannelFreshness({
    now,
    staleAfterHours,
    telemetryRows: input.twilioEvents,
    sendActivityToday: smsSendActivityToday,
  });

  const warnings: TelemetryWarning[] = [];
  addSourceErrorWarning(warnings, "email", input.sourceErrors?.emailEvents);
  addSourceErrorWarning(warnings, "sms", input.sourceErrors?.twilioMessageStatus);
  addFreshnessWarning(warnings, "email", email, staleAfterHours);
  addFreshnessWarning(warnings, "sms", sms, staleAfterHours);

  return {
    stale_after_hours: staleAfterHours,
    email,
    sms,
    warnings,
  };
}
