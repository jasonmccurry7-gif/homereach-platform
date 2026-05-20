export function isAiIntakeAgentEnabled(): boolean {
  return (
    process.env.ENABLE_AI_INTAKE_AGENT === "true" ||
    process.env.NEXT_PUBLIC_ENABLE_AI_INTAKE_AGENT === "true"
  );
}
