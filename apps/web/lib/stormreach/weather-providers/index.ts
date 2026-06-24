import { femaProvider } from "./fema";
import { femaIpawsProvider } from "./fema-ipaws";
import { noaaSpcProvider } from "./noaa";
import { nwsProvider } from "./nws";
import type { WeatherProvider, WeatherProviderFetchOptions } from "./provider.types";

export const STORMREACH_WEATHER_PROVIDERS: WeatherProvider[] = [
  nwsProvider,
  noaaSpcProvider,
  femaIpawsProvider,
  femaProvider,
];

export async function fetchWeatherProviderEvents(options: WeatherProviderFetchOptions = {}) {
  const state = normalizeState(options.state);
  const results = await Promise.allSettled(
    STORMREACH_WEATHER_PROVIDERS.map((provider) => provider.fetchEvents(options)),
  );

  return results.map((result, index) => {
    const provider = STORMREACH_WEATHER_PROVIDERS[index];
    if (result.status === "fulfilled") {
      return state
        ? {
          ...result.value,
          events: result.value.events.filter((event) => normalizeState(event.impactedState) === state),
        }
        : result.value;
    }
    return {
      provider: provider?.key ?? "nws",
      sourceUrl: "",
      events: [],
      warnings: [result.reason instanceof Error ? result.reason.message : "Weather provider failed."],
    };
  });
}

function normalizeState(value: string | null | undefined) {
  return String(value ?? "").trim().toUpperCase();
}

export type { WeatherProvider, WeatherProviderFetchOptions, WeatherProviderResult } from "./provider.types";
