import { generateGrowthOsClaudeText } from "./claude";
import { formatCurrencyCents, formatPercent } from "./metrics";
import type { GrowthOsAiContext } from "./ai-context";

export async function generateGrowthOsChatAnswer({
  context,
  question,
}: {
  context: NonNullable<GrowthOsAiContext>;
  question: string;
}) {
  const claudeAnswer = await generateGrowthOsClaudeText({
    model: process.env.FSGOS_CLAUDE_CHAT_MODEL ?? process.env.FSGOS_CLAUDE_MODEL,
    maxTokens: 1200,
    temperature: 0.2,
    system:
      "You are the Food Service Growth OS advisor. Answer using only the user's supplied business data, active lever, recommendations, and wins. Be specific, concise, and action-oriented. If data is thin, say what is known and give the safest next action. Cite dollar impact when relevant.",
    prompt: JSON.stringify({
      businessContext: context.summary,
      latestWeeklyInputs: context.weeklyInputs.slice(0, 6),
      activeLever: context.activeLever,
      recentWins: context.recentWins,
      topRecommendations: context.recommendations.slice(0, 3),
      question,
    }),
  });

  return claudeAnswer ?? buildDeterministicChatAnswer(context, question);
}

function buildDeterministicChatAnswer(
  context: NonNullable<GrowthOsAiContext>,
  question: string
) {
  const activeLever = context.activeLever;
  const topRecommendation = context.recommendations[0];
  const latestMetrics = context.currentMetrics;
  const latestWin = context.recentWins[0];
  const lines = [
    `Based on ${context.profile.companyName}'s current Growth OS data:`,
  ];

  if (latestMetrics) {
    lines.push(
      `Current weekly revenue is ${formatCurrencyCents(
        latestMetrics.revenueCents
      )}, AOV is ${formatCurrencyCents(
        latestMetrics.aovCents
      )}, food cost is ${formatPercent(
        latestMetrics.foodCostPercent
      )}, and labor is ${formatPercent(latestMetrics.laborPercent)}.`
    );
  } else {
    lines.push(
      "There is no weekly input yet, so I am using the business profile and cold-start recommendation logic."
    );
  }

  if (activeLever) {
    lines.push(
      `Your active lever is "${activeLever.recommendation?.title ?? "current lever"}". Current estimated impact is ${
        activeLever.impact
          ? `${formatCurrencyCents(activeLever.impact.estimatedMonthlyImpactCents)}/mo`
          : "not calculated yet"
      }.`
    );
  } else if (topRecommendation) {
    lines.push(
      `The next best lever is "${topRecommendation.title}" with estimated impact of ${formatCurrencyCents(
        topRecommendation.estimatedMonthlyImpactCents
      )}/mo.`
    );
  }

  if (latestWin) {
    lines.push(
      `Your most recent completed win was "${latestWin.title}" at ${formatCurrencyCents(
        latestWin.impactCents
      )}/mo.`
    );
  }

  lines.push(
    `Recommended next action: ${activeLever?.recommendation?.actionText ?? topRecommendation?.actionText ?? "Submit this week's Growth OS input so recommendations can tighten up."}`
  );

  if (question.trim()) {
    lines.push(
      "For that question, I would focus on the lever above before adding another change, so the impact remains attributable."
    );
  }

  return lines.join("\n\n");
}
