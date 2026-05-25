export type InboundSmsBridgeResult =
  | {
      processed: false;
      reason?: string;
    }
  | {
      processed: true;
      eventId?: string | null;
    };

export function shouldRetryUnmatchedInboundSmsReply({
  bridgeFailed,
  bridgeResult,
}: {
  bridgeFailed: boolean;
  bridgeResult?: InboundSmsBridgeResult | null;
}): boolean {
  if (bridgeFailed) return true;
  return bridgeResult?.processed === true && !bridgeResult.eventId;
}
