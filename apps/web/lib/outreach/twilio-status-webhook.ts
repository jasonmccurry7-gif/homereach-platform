export type TwilioStatusParams = Record<string, string>;

export type TwilioMessageStatusInsert = {
  message_sid: string;
  message_status: string;
  error_code: string | null;
  error_message: string | null;
  to_number: string | null;
  from_number: string | null;
  messaging_service_sid: string | null;
  sms_sid: string | null;
  account_sid: string | null;
  api_version: string | null;
  raw_payload: TwilioStatusParams;
};

export type TwilioStatusInsertError = {
  message?: string;
} | null | undefined;

export function parseTwilioStatusForm(rawText: string): TwilioStatusParams {
  const params: TwilioStatusParams = {};
  for (const [key, value] of new URLSearchParams(rawText)) {
    params[key] = value;
  }
  return params;
}

export function buildTwilioStatusCallbackUrl(
  requestUrl: string,
  appUrl?: string,
): string {
  return appUrl ? `${appUrl}/api/webhooks/twilio/status` : requestUrl;
}

export function buildTwilioMessageStatusInsert(
  params: TwilioStatusParams,
): TwilioMessageStatusInsert | null {
  const messageSid = params["MessageSid"] ?? params["SmsSid"] ?? null;
  const messageStatus = params["MessageStatus"] ?? params["SmsStatus"] ?? null;

  if (!messageSid || !messageStatus) {
    return null;
  }

  return {
    message_sid: messageSid,
    message_status: messageStatus,
    error_code: params["ErrorCode"] ?? null,
    error_message: params["ErrorMessage"] ?? null,
    to_number: params["To"] ?? null,
    from_number: params["From"] ?? null,
    messaging_service_sid: params["MessagingServiceSid"] ?? null,
    sms_sid: params["SmsSid"] ?? null,
    account_sid: params["AccountSid"] ?? null,
    api_version: params["ApiVersion"] ?? null,
    raw_payload: params,
  };
}

export function shouldRetryTwilioStatusInsert(
  error: TwilioStatusInsertError,
): error is { message?: string } {
  return Boolean(error);
}
