export function isOperationsCopilotEnabled() {
  return process.env.ENABLE_OPERATIONS_COPILOT !== "false";
}
