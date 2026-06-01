import "server-only";

import type {
  CreativeGenerationInput,
  CreativeProviderStatus,
  CreativeQualityReview,
  CreativeStoryboardScene,
} from "./types";

export type CreativeProviderRequest = {
  requestId: string;
  input: CreativeGenerationInput;
  prompt: string;
  script: string;
  storyboard: CreativeStoryboardScene[];
  qualityReview: CreativeQualityReview;
};

export type CreativeProviderResult = {
  providerKey: string;
  providerJobId: string;
  providerStatus: "mock_ready" | "queued" | "completed" | "failed";
  fileUrl: string | null;
  thumbnailUrl: string | null;
  responsePayload: Record<string, unknown>;
};

export interface CreativeProviderAdapter {
  providerKey: string;
  displayName: string;
  connectionStatus(): CreativeProviderStatus;
  generate(request: CreativeProviderRequest): Promise<CreativeProviderResult>;
}

class MockCreativeProviderAdapter implements CreativeProviderAdapter {
  providerKey: string;
  displayName: string;

  constructor(providerKey = "mock", displayName = "Mock Creative Provider") {
    this.providerKey = providerKey;
    this.displayName = displayName;
  }

  connectionStatus(): CreativeProviderStatus {
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configured: true,
      mode: "mock",
      message:
        "Mock provider is active. It creates script, storyboard, caption, and review-ready records without calling an external generator.",
    };
  }

  async generate(request: CreativeProviderRequest): Promise<CreativeProviderResult> {
    return {
      providerKey: this.providerKey,
      providerJobId: `mock_${request.requestId}`,
      providerStatus: "mock_ready",
      fileUrl: null,
      thumbnailUrl: null,
      responsePayload: {
        requestId: request.requestId,
        outputMode: "mock_structured_asset",
        handoff:
          "Connect an MCP-compatible image/video generator to turn this structured storyboard into rendered media.",
        storyboardSceneCount: request.storyboard.length,
        reviewScore: request.qualityReview.overallScore,
      },
    };
  }
}

class MpcReadyPlaceholderAdapter extends MockCreativeProviderAdapter {
  constructor(providerKey: string, displayName: string) {
    super(providerKey, displayName);
  }

  override connectionStatus(): CreativeProviderStatus {
    return {
      providerKey: this.providerKey,
      displayName: this.displayName,
      configured: true,
      mode: "adapter_ready",
      message:
        "Provider adapter is registered, but external execution is intentionally disabled until MCP credentials, CLI command, and approval policy are configured server-side.",
    };
  }
}

export function getCreativeProviderAdapter(): CreativeProviderAdapter {
  const providerKey = (process.env.CREATIVE_PROVIDER ?? "mock").trim().toLowerCase();

  if (providerKey === "mock" || providerKey.length === 0) {
    return new MockCreativeProviderAdapter();
  }

  if (providerKey === "higgsfield_mcp") {
    return new MpcReadyPlaceholderAdapter("higgsfield_mcp", "Higgsfield MCP Adapter");
  }

  if (providerKey.endsWith("_mcp") || providerKey === "generic_mcp") {
    return new MpcReadyPlaceholderAdapter(providerKey, "MCP-Compatible Creative Adapter");
  }

  return new MockCreativeProviderAdapter("mock", `Mock fallback for ${providerKey}`);
}

export function getCreativeProviderStatus(): CreativeProviderStatus {
  return getCreativeProviderAdapter().connectionStatus();
}

