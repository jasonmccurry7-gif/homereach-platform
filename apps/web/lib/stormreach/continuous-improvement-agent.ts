import "server-only";

import { buildDailyStormReachReport, generateStormReachRecommendations } from "./agent";
import { runStormReachStrategist } from "./repository";

export { buildDailyStormReachReport, generateStormReachRecommendations, runStormReachStrategist };

export const STORMREACH_STRATEGIST_AGENT = {
  name: "StormReach Strategist",
  morningSchedule: "0 7 * * *",
  weeklySchedule: "0 7 * * 1",
  mayDraftImprovements: true,
  mayCreateTasks: true,
  mayDeployCode: false,
  mayChangePricing: false,
  maySendOutreach: false,
  mayLaunchCampaigns: false,
};
