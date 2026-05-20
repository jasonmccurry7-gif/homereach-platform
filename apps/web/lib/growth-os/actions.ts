import { generateGrowthOsClaudeText } from "./claude";
import { formatCurrencyCents } from "./metrics";
import type { GrowthOsAiContext } from "./ai-context";

export type GrowthOsActionArtifactType =
  | "pricing_script"
  | "weekly_action_plan"
  | "bundle_configuration"
  | "staffing_schedule"
  | "customer_message";

const ARTIFACT_LABELS: Record<GrowthOsActionArtifactType, string> = {
  pricing_script: "Pricing Change Script",
  weekly_action_plan: "Weekly Action Plan",
  bundle_configuration: "Bundle Configuration",
  staffing_schedule: "Staffing Schedule Recommendation",
  customer_message: "Customer Message Template",
};

export async function generateGrowthOsActionArtifact({
  context,
  artifactType,
}: {
  context: NonNullable<GrowthOsAiContext>;
  artifactType: GrowthOsActionArtifactType;
}) {
  const lever = context.activeLever?.recommendation ?? context.recommendations[0];
  if (!lever) {
    return {
      title: "Weekly Action Plan",
      filename: "growth-os-weekly-action-plan.md",
      content:
        "# Weekly Action Plan\n\nSubmit this week's Growth OS input first so the system can generate a specific lever-based artifact.",
      usedFallback: true,
    };
  }

  const claudeContent = await generateGrowthOsClaudeText({
    model:
      process.env.FSGOS_CLAUDE_ACTION_MODEL ??
      process.env.FSGOS_CLAUDE_MODEL,
    maxTokens: 1600,
    temperature: 0.2,
    system:
      "You generate practical execution artifacts for small food-service operators. Use only the supplied business context and lever. Return clean Markdown, no preamble. Make the artifact specific, copyable, and immediately usable.",
    prompt: JSON.stringify({
      artifactType,
      artifactLabel: ARTIFACT_LABELS[artifactType],
      businessContext: context.summary,
      lever,
      activeImpact: context.activeLever?.impact,
      recentWins: context.recentWins,
      requirements:
        "Include concrete steps, owners/timing where useful, and simple tracking instructions. Keep weekly data entry under 60 seconds. Do not suggest another primary lever if one is already active.",
    }),
  });
  const content =
    claudeContent ??
    buildDeterministicArtifact({
      context,
      artifactType,
      title: ARTIFACT_LABELS[artifactType],
      lever,
    });

  return {
    title: ARTIFACT_LABELS[artifactType],
    filename: `growth-os-${artifactType.replaceAll("_", "-")}.md`,
    content,
    usedFallback: !claudeContent,
  };
}

function buildDeterministicArtifact({
  context,
  artifactType,
  title,
  lever,
}: {
  context: NonNullable<GrowthOsAiContext>;
  artifactType: GrowthOsActionArtifactType;
  title: string;
  lever: {
    title: string;
    actionText: string;
    estimatedMonthlyImpactCents?: number;
    leverCategory?: string;
  };
}) {
  const impact =
    context.activeLever?.impact?.estimatedMonthlyImpactCents ??
    lever.estimatedMonthlyImpactCents ??
    0;
  const header = [
    `# ${title}`,
    "",
    `Business: ${context.profile.companyName}`,
    `Primary lever: ${lever.title}`,
    `Estimated impact: ${formatCurrencyCents(impact)}/mo`,
    "",
  ].join("\n");

  if (artifactType === "pricing_script") {
    return `${header}## POS Update Steps
1. Pick the three items tied to this lever.
2. Raise each item by 25 to 50 cents or apply the bundle price exactly as planned.
3. Add a note in the POS item description: Growth OS pricing test.
4. Track order count and revenue in next week's Growth OS input.

## Counter Script
"We are featuring ${lever.title.toLowerCase()} this week. Would you like to add it to your order?"

## Tracking
Record weekly revenue, weekly orders, AOV, and any promotion flag next Monday.`;
  }

  if (artifactType === "bundle_configuration") {
    return `${header}## Bundle
- Anchor item: highest-margin item connected to the lever.
- Add-on: drink, mini item, topping, or side that is easy to prep.
- Price cue: show the bundle as a small savings or simple upgrade.

## Setup
1. Add the bundle to the POS.
2. Place the bundle sign at the counter.
3. Coach the team to ask every customer during peak hours.

## Tracking
Count bundle orders separately and enter the result in weekly notes.`;
  }

  if (artifactType === "staffing_schedule") {
    return `${header}## Schedule Adjustment
1. Identify the slowest hour from the last submitted week.
2. Move one prep or cleanup task outside that hour.
3. Keep customer-facing coverage unchanged during peak periods.

## Team Note
"This week we are testing task timing, not cutting service. The goal is the same output with less idle labor."

## Tracking
Enter labor cost and staffing_issue flag only if staffing disrupted the test.`;
  }

  if (artifactType === "customer_message") {
    return `${header}## Customer Message
Try this this week:

"Fresh this week: ${lever.title}. It is a quick way to get more of what customers already love, and we are featuring it for a limited run."

## Where To Use It
- Counter script
- Instagram caption
- Email or SMS
- Small counter sign

## Tracking
Use the promotion_running flag if this message is posted publicly.`;
  }

  return `${header}## This Week's Plan
1. Run this lever only: ${lever.actionText}
2. Assign one person to update the POS, signage, or prep sheet.
3. Track the result in one place: weekly Growth OS input.
4. Do not launch a second primary lever this week.
5. Review estimated impact after the next weekly input.

## Success Check
The test is working if revenue, AOV, waste, or labor moves in the expected direction without major context flags.`;
}
