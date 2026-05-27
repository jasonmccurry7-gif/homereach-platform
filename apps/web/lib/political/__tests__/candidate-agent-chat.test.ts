import { afterEach, describe, expect, it } from "vitest";
import {
  answerCandidateAgentChat,
  resolveCandidateAgentChatContext,
} from "../candidate-agent-chat";
import { OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS } from "../ohio-candidate-selector";

describe("candidate agent chat", () => {
  const originalDisablePoliticalAi = process.env.DISABLE_POLITICAL_AI;
  const originalOpenAiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalDisablePoliticalAi === undefined) {
      delete process.env.DISABLE_POLITICAL_AI;
    } else {
      process.env.DISABLE_POLITICAL_AI = originalDisablePoliticalAi;
    }

    if (originalOpenAiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiKey;
    }
  });

  it("uses the static fallback when political AI is disabled", async () => {
    process.env.DISABLE_POLITICAL_AI = "true";
    process.env.OPENAI_API_KEY = "sk-test-should-not-be-used";

    const candidate = OHIO_TOP_CANDIDATE_SELECTOR_OPTIONS[0];
    const context = resolveCandidateAgentChatContext(candidate.value);

    expect(context).not.toBeNull();
    if (!context) return;

    const result = await answerCandidateAgentChat("Compare the coverage options", [], context);

    expect(result.mode).toBe("fallback");
    expect(result.reply).toContain(candidate.candidateName);
  });
});
