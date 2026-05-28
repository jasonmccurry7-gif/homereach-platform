import "server-only";

type AiProvider = "openai" | "anthropic";

export interface GenerateTextArgs {
  feature: string;
  system: string;
  prompt: string;
  model?: string;
  anthropicDefaultModel?: string;
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json";
}

export interface GenerateTextResult {
  text: string;
  provider: AiProvider;
  modelName: string;
  tokensInput: number;
  tokensOutput: number;
}

const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

function isAnthropicModel(model: string): boolean {
  return model.toLowerCase().startsWith("claude");
}

function isCompatibleModel(provider: AiProvider, model: string): boolean {
  return provider === "anthropic" ? isAnthropicModel(model) : !isAnthropicModel(model);
}

function resolveProvider(feature: string): AiProvider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  throw new Error(
    `[ai:${feature}] OPENAI_API_KEY is not set. ANTHROPIC_API_KEY is also missing, so no fallback provider is available.`,
  );
}

function resolveModel(args: GenerateTextArgs, provider: AiProvider): string {
  const configured = args.model?.trim();
  if (configured && isCompatibleModel(provider, configured)) return configured;

  if (configured) {
    console.warn(`[ai:${args.feature}] Ignoring ${configured} because it is not compatible with ${provider}.`);
  }

  if (provider === "openai") return process.env.OPENAI_DEFAULT_MODEL || DEFAULT_OPENAI_MODEL;
  return args.anthropicDefaultModel || DEFAULT_ANTHROPIC_MODEL;
}

export async function generateText(args: GenerateTextArgs): Promise<GenerateTextResult> {
  const provider = resolveProvider(args.feature);
  const model = resolveModel(args, provider);

  if (provider === "openai") return generateOpenAiText(args, model);
  return generateAnthropicText(args, model);
}

async function generateOpenAiText(args: GenerateTextArgs, model: string): Promise<GenerateTextResult> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: args.system },
        { role: "user", content: args.prompt },
      ],
      max_tokens: args.maxTokens ?? 1000,
      temperature: args.temperature ?? 0.2,
      ...(args.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  return {
    text: data.choices?.[0]?.message?.content ?? "",
    provider: "openai",
    modelName: model,
    tokensInput: data.usage?.prompt_tokens ?? 0,
    tokensOutput: data.usage?.completion_tokens ?? 0,
  };
}

async function generateAnthropicText(args: GenerateTextArgs, model: string): Promise<GenerateTextResult> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: args.maxTokens ?? 1000,
      temperature: args.temperature ?? 0.2,
      system: args.system,
      messages: [{ role: "user", content: args.prompt }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };

  return {
    text: (data.content || [])
      .filter((block) => block.type === "text")
      .map((block) => block.text || "")
      .join(""),
    provider: "anthropic",
    modelName: model,
    tokensInput: data.usage?.input_tokens ?? 0,
    tokensOutput: data.usage?.output_tokens ?? 0,
  };
}
