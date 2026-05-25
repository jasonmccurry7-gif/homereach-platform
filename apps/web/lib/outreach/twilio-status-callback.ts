import { getPublicAppBaseUrl } from "../runtime/app-url";

export function getTwilioStatusCallbackUrl(): string {
  return `${getPublicAppBaseUrl()}/api/webhooks/twilio/status`;
}
