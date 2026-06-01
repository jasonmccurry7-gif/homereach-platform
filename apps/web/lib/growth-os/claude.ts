import type { GrowthOsRecommendation } from "./types";

type RecommendationLanguagePatch = {
  title?: string;
  problem?: string;
  whyItMatters?: string;
  actionText?: string;
  confidenceReasoning?: string;
};

type RefineRecommendationLanguageArgs = {
  companyName: string;
  businessType: string;
  ownerGoal: string;
  recommendations: GrowthOsRecommendation[];
};

export async function refineRecommendationLanguageWithClaude({
  companyName,
  businessType,
  ownerGoal,
  recommendations,
}: RefineRecommendationLanguageArgs) {
  if (process.env.FSGOS_RECOMMENDATIONS_AI_ENABLED !== "true") {
    return recommendations;
  }

  const apiKey = process.env.FSGOS_ANTHROPIC_API_KEY;
  if (!apiKey) return recommendations;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model:
          process.env.FSGOS_CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: 1800,
        temperature: 0.2,
        system:
          "You write concise, specific recommendations for small food-service operators. Preserve the provided math, categories, confidence, ranking, and fast_win flags. Return only valid JSON.",
        messages: [
          {
            role: "user",
            content: JSON.stringify({
              companyName,
              businessType,
              ownerGoal,
              instructions:
                "Rewrite only title, problem, whyItMatters, actionText, and confidenceReasoning for clarity. Keep each action executable this week. Return an array with the same length and order.",
              recommendations,
            }),
          },
        ],
      }),
    });

    if (!response.ok) return recommendations;

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const text = payload.content?.find((item) => item.text)?.text;
    if (!text) return recommendations;

    const patches = JSON.parse(text) as RecommendationLanguagePatch[];
    if (!Array.isArray(patches) || patches.length !== recommendations.length) {
      return recommendations;
    }

    return recommendations.map((recommendation, index) => {
      const patch = patches[index] ?? {};
      return {
        ...recommendation,
        title: sanitizePatch(patch.title) ?? recommendation.title,
        problem: sanitizePatch(patch.problem) ?? recommendation.problem,
        whyItMatters:
          sanitizePatch(patch.whyItMatters) ?? recommendation.whyItMatters,
        actionText: sanitizePatch(patch.actionText) ?? recommendation.actionText,
        confidenceReasoning:
          sanitizePatch(patch.confidenceReasoning) ??
          recommendation.confidenceReasoning,
      };
    });
  } catch {
    return recommendations;
  }
}

export async function generateGrowthOsClaudeText({
  system,
  prompt,
  maxTokens = 1200,
  temperature = 0.2,
  model,
}: {
  system: string;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  model?: string;
}) {
  const apiKey = process.env.FSGOS_ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model ?? process.env.FSGOS_CLAUDE_MODEL ?? "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    return payload.content?.find((item) => item.text)?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

function sanitizePatch(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
