import { describe, expect, it } from "vitest";
import {
  buildProviderTelemetryFreshness,
  latestIsoTimestamp,
} from "../telemetry-health";

const now = new Date("2026-05-25T12:00:00.000Z");

describe("provider telemetry health", () => {
  it("returns the latest valid timestamp", () => {
    expect(
      latestIsoTimestamp(
        [
          { received_at: "not-a-date" },
          { received_at: "2026-05-25T09:00:00.000Z" },
          { received_at: "2026-05-25T11:00:00.000Z" },
        ],
        "received_at",
      ),
    ).toBe("2026-05-25T11:00:00.000Z");
  });

  it("does not warn when there is no send activity", () => {
    const result = buildProviderTelemetryFreshness({
      now,
      emailEvents: [],
      twilioEvents: [],
      autoSendsToday: [],
      salesEventsToday: [],
    });

    expect(result.warnings).toEqual([]);
    expect(result.email.stale).toBe(false);
    expect(result.sms.stale).toBe(false);
  });

  it("warns when sends happened today but no telemetry exists", () => {
    const result = buildProviderTelemetryFreshness({
      now,
      emailEvents: [],
      twilioEvents: [],
      autoSendsToday: [{ channel: "email" }, { channel: "sms" }],
      salesEventsToday: [],
    });

    expect(result.email.stale).toBe(true);
    expect(result.sms.stale).toBe(true);
    expect(result.warnings.map((warning) => warning.id)).toEqual([
      "email-telemetry-missing",
      "sms-telemetry-missing",
    ]);
  });

  it("warns when telemetry is stale for active send channels", () => {
    const result = buildProviderTelemetryFreshness({
      now,
      staleAfterHours: 24,
      emailEvents: [{ received_at: "2026-05-23T00:00:00.000Z" }],
      twilioEvents: [{ received_at: "2026-05-25T11:00:00.000Z" }],
      autoSendsToday: [],
      salesEventsToday: [{ action_type: "email_sent" }, { action_type: "text_sent" }],
    });

    expect(result.email.latest_age_hours).toBe(60);
    expect(result.email.stale).toBe(true);
    expect(result.sms.stale).toBe(false);
    expect(result.warnings.map((warning) => warning.id)).toEqual([
      "email-telemetry-stale",
    ]);
  });

  it("surfaces telemetry source errors independently of freshness", () => {
    const result = buildProviderTelemetryFreshness({
      now,
      emailEvents: [{ received_at: "2026-05-25T11:30:00.000Z" }],
      twilioEvents: [],
      autoSendsToday: [],
      salesEventsToday: [],
      sourceErrors: {
        emailEvents: "permission denied",
        twilioMessageStatus: "relation missing",
      },
    });

    expect(result.warnings).toMatchObject([
      { id: "email-telemetry-source-error", severity: "high" },
      { id: "sms-telemetry-source-error", severity: "high" },
    ]);
  });
});
