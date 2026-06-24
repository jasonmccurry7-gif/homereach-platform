import "server-only";

import { ingestStormReachEvents, runStormReachContinuousSweep } from "./repository";
import { fetchWeatherProviderEvents } from "./weather-providers";

export { fetchWeatherProviderEvents, ingestStormReachEvents, runStormReachContinuousSweep };

export const STORM_EVENT_INGESTION_GUARDRAILS = {
  sourceAttributionRequired: true,
  sourcePayloadStored: true,
  dedupeKey: "event_id",
  humanApprovalBeforeOutreach: true,
};
