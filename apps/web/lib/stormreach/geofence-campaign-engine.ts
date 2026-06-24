import { buildGeofenceExport, recommendedGeofenceRadiusMiles } from "./packages";

export { buildGeofenceExport, recommendedGeofenceRadiusMiles };

export const GEOFENCE_CAMPAIGN_ENGINE_GUARDRAILS = {
  exportFirstWorkflow: true,
  noExternalAdLaunchWithoutApproval: true,
  polygonEditableBeforeLaunch: true,
  platformIntegrationsAreFutureWork: ["Meta Ads", "Google Display Network", "YouTube", "Programmatic display"],
};
