export type ApprovalPriority = "critical" | "high" | "normal";

export type ApprovalDomain =
  | "revenue"
  | "political"
  | "procurement"
  | "gov_contracts"
  | "creative"
  | "ai_assets"
  | "daily_content"
  | "social"
  | "seo"
  | "ad_tech"
  | "operations"
  | "campaigns"
  | "other";

export type ApprovalLane =
  | "blocked"
  | "needs_approval"
  | "ready_to_send"
  | "ready_to_publish"
  | "learning";

export type ApprovalActionTarget =
  | {
      kind: "daily_video";
      id: string;
      status: string;
    }
  | {
      kind: "platform_post";
      id: string;
      videoId: string;
      status: string;
    }
  | {
      kind: "facebook_draft";
      id: string;
      status: string;
    }
  | {
      kind: "ai_output";
      id: string;
      status: string;
      isWinning?: boolean;
    }
  | {
      kind: "revenue_approval";
      id: string;
      status: string;
      channel: string;
      messageBody: string | null;
    }
  | {
      kind: "link_only";
      id: string;
      status: string;
    };

export type ApprovalSpineItem = {
  id: string;
  sourceKey: string;
  sourceSystem: string;
  sourceTable: string | null;
  sourceId: string;
  domain: ApprovalDomain;
  approvalKind: string;
  source: string;
  title: string;
  detail: string;
  status: string;
  href: string;
  priority: ApprovalPriority;
  lane: ApprovalLane;
  nextAction: string;
  guardrail: string;
  createdAt?: string | null;
  dueAt?: string | null;
  actionTarget: ApprovalActionTarget;
};

export type ApprovalSpineSummary = {
  total: number;
  blocked: number;
  needsApproval: number;
  readyToSend: number;
  readyToPublish: number;
  learning: number;
  highPriority: number;
  providerBlocked: number;
  publishReady: number;
  nextFocus: string;
  sourceCounts: {
    revenue: number;
    procurement: number;
    govContracts: number;
    political: number;
    aiAssets: number;
    creative: number;
    dailyContent: number;
    platformPosts: number;
    facebookDrafts: number;
  };
};
