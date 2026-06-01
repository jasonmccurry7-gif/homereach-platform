import "server-only";

import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { mkdir, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import type { DailyVideoContentRow } from "./types";

export type HiggsfieldRenderResult = {
  ok: boolean;
  dryRun: boolean;
  provider: "higgsfield";
  requestId: string;
  providerJobId: string | null;
  providerStatus: "configured" | "queued" | "completed" | "failed" | "dry_run";
  model: string;
  command: string;
  argsPreview: string[];
  prompt: string;
  fileUrl: string | null;
  thumbnailUrl: string | null;
  sourceUrl: string | null;
  responsePayload: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt: string;
};

type HiggsfieldCliConfig = {
  command: string;
  baseArgs: string[];
  model: string;
  aspectRatio: string;
  durationSeconds: string;
  extraArgs: string[];
  waitTimeout: string;
  dryRun: boolean;
};

export function getHiggsfieldCliStatus() {
  const config = getHiggsfieldCliConfig();
  return {
    provider: "higgsfield",
    configured: Boolean(config.command),
    mode: config.dryRun ? "dry_run" : "cli",
    command: config.command,
    model: config.model,
    message: config.dryRun
      ? "Higgsfield dry-run is enabled. The system will build the exact render prompt without spending credits."
      : "Higgsfield CLI render is enabled. Server-side jobs use the authenticated CLI session and never expose credentials to the browser.",
  };
}

export async function renderDailyVideoWithHiggsfield(video: DailyVideoContentRow): Promise<HiggsfieldRenderResult> {
  const config = getHiggsfieldCliConfig();
  const requestId = randomUUID();
  const prompt = buildHiggsfieldPrompt(video);
  const startedAt = new Date().toISOString();
  const args = [
    ...config.baseArgs,
    "generate",
    "create",
    config.model,
    "--prompt",
    prompt,
    "--aspect_ratio",
    config.aspectRatio,
    "--duration",
    config.durationSeconds,
    ...config.extraArgs,
    "--wait",
    "--wait-timeout",
    config.waitTimeout,
    "--json",
    "--no-color",
  ];
  const argsPreview = args.map((arg) => (arg === prompt ? "[prompt omitted from command preview]" : arg));

  if (config.dryRun) {
    return {
      ok: true,
      dryRun: true,
      provider: "higgsfield",
      requestId,
      providerJobId: `dry_run_${requestId}`,
      providerStatus: "dry_run",
      model: config.model,
      command: config.command,
      argsPreview,
      prompt,
      fileUrl: null,
      thumbnailUrl: null,
      sourceUrl: null,
      responsePayload: {
        requestId,
        mode: "dry_run",
        note: "Set HIGGSFIELD_DRY_RUN=false and authenticate the Higgsfield CLI to render live video.",
      },
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }

  try {
    const execution = await runCli(config.command, args);
    const parsed = parseCliJson(execution.stdout);
    const urls = collectUrls(parsed ?? execution.stdout);
    const fileUrl =
      findVideoUrl(urls) ??
      urls.find((url) => /result|render|download|cloudfront|higgsfield/i.test(url)) ??
      null;
    const sourceUrl =
      urls.find((url) => /higgsfield|job|generation|history/i.test(url)) ??
      fileUrl;
    const providerJobId = findProviderJobId(parsed) ?? `higgsfield_${requestId}`;
    const status = findProviderStatus(parsed);
    const providerStatus = fileUrl ? "completed" : status === "failed" ? "failed" : "queued";
    const error = providerStatus === "failed"
      ? findProviderFailureMessage(parsed) ?? "Higgsfield job failed before returning a video URL."
      : undefined;

    return {
      ok: Boolean(fileUrl) && providerStatus !== "failed",
      dryRun: false,
      provider: "higgsfield",
      requestId,
      providerJobId,
      providerStatus,
      model: config.model,
      command: config.command,
      argsPreview,
      prompt,
      fileUrl,
      thumbnailUrl: findImageUrl(urls),
      sourceUrl,
      responsePayload: {
        parsed,
        stdoutTail: execution.stdout.slice(-4000),
        stderrTail: execution.stderr.slice(-2000),
        exitCode: execution.exitCode,
        runtimeCommand: execution.runtimeCommand,
      },
      error,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Higgsfield render failed";
    const message = normalizeHiggsfieldError(rawMessage);
    return {
      ok: false,
      dryRun: false,
      provider: "higgsfield",
      requestId,
      providerJobId: null,
      providerStatus: "failed",
      model: config.model,
      command: config.command,
      argsPreview,
      prompt,
      fileUrl: null,
      thumbnailUrl: null,
      sourceUrl: null,
      responsePayload: {},
      error: message,
      startedAt,
      completedAt: new Date().toISOString(),
    };
  }
}

function normalizeHiggsfieldError(message: string) {
  if (message.includes("job_minimum_basic_plan_required")) {
    return "Higgsfield video rendering requires a Basic or higher Higgsfield plan for this model. Upgrade or connect a Basic+ Higgsfield account, then click Retry Higgsfield.";
  }

  if (/Unknown params:\s*sound/i.test(message)) {
    return "The selected Higgsfield model does not accept the configured sound parameter. Remove HIGGSFIELD_EXTRA_ARGS or use a model-specific sound value before retrying.";
  }

  if (/Invalid values:\s*sound=(false|true)/i.test(message)) {
    return "The selected Higgsfield model rejected the configured sound value. Set HIGGSFIELD_EXTRA_ARGS to the model-supported sound option, or remove the sound flag before retrying.";
  }

  if (/Session expired|Not authenticated|auth login/i.test(message)) {
    return "Higgsfield authentication has expired. Reconnect the Higgsfield CLI with `higgsfield auth login`, update the production HIGGSFIELD_CREDENTIALS_JSON value, then retry the render.";
  }

  return message;
}

function getHiggsfieldCliConfig(): HiggsfieldCliConfig {
  return {
    ...parseCommand(process.env.HIGGSFIELD_MCP_COMMAND || process.env.HIGGSFIELD_CLI_COMMAND || "higgsfield"),
    model: (process.env.HIGGSFIELD_VIDEO_MODEL || "kling2_6").trim(),
    aspectRatio: (process.env.HIGGSFIELD_VIDEO_ASPECT_RATIO || "9:16").trim(),
    durationSeconds: (process.env.HIGGSFIELD_VIDEO_DURATION_SECONDS || "10").trim(),
    extraArgs: splitCommand(process.env.HIGGSFIELD_EXTRA_ARGS || "--sound true"),
    waitTimeout: (process.env.HIGGSFIELD_WAIT_TIMEOUT || "10m").trim(),
    dryRun: process.env.HIGGSFIELD_DRY_RUN === "true",
  };
}

function parseCommand(value: string): Pick<HiggsfieldCliConfig, "command" | "baseArgs"> {
  const parts = splitCommand(value.trim() || "higgsfield");
  return {
    command: parts[0] ?? "higgsfield",
    baseArgs: parts.slice(1),
  };
}

function splitCommand(value: string) {
  const matches = value.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [value];
  return matches.map((part) => part.replace(/^"|"$/g, ""));
}

function buildHiggsfieldPrompt(video: DailyVideoContentRow) {
  const isProcurement = video.vertical === "procurement";
  const brandName = isProcurement ? "Supplyfy" : "HomeReach";
  const concept = isProcurement ? buildSupplyfyValueSequence() : buildTargetedMailValueSequence();
  const duration = (process.env.HIGGSFIELD_VIDEO_DURATION_SECONDS || "10").trim();
  return [
    `Create realistic raw b-roll for one vertical 9:16 ${brandName} direct-response reel, exactly ${duration} seconds.`,
    "This is not the finished ad. HomeReach will add all English captions, logo, CTA, dashboard overlays, voiceover, and music in the editor after the render.",
    concept,
    "Quality rules: ultra-realistic small-business footage, natural lighting, believable human emotion, authentic hands, real environments, smooth social-ad pacing.",
    "Critical text rule: show ZERO readable text anywhere. No words, letters, numbers, logos, captions, documents, invoices, receipts, dashboards with text, menus, signs, labels, shirt text, vehicle text, packaging text, or pseudo-language. Avoid any generated text surfaces entirely.",
    "Audio rule: if the model supports audio, use only a low-volume modern inspirational instrumental bed. No vocals and no spoken words.",
    "Do not create abstract animation, futuristic UI, floating random graphics, cartoon style, distorted faces, distorted hands, fake app screens, or stock-footage corporate scenes.",
  ].join(" ");
}

function buildSupplyfyValueSequence() {
  return [
    "Shot 1: inside a real small bakery, a tired owner hands a supplier a large stack of cash for plain ingredient bags and boxes, then looks frustrated and worried.",
    "Shot 2: close-up of the owner counting what is left from the cash stack beside identical plain ingredient containers, making the financial pain obvious without showing any paper or text.",
    "Shot 3: the owner looks at a blurred, unreadable laptop or tablet with only simple green and red blocks visible, no text, no numbers, no fake dashboard words.",
    "Shot 4: the owner pays a visibly smaller cash stack to a different supplier for the same amount of plain ingredients.",
    "Shot 5: the owner smiles with relief while holding saved cash and looking back at the same ingredients.",
  ].join(" ");
}

function buildTargetedMailValueSequence() {
  return [
    "Shot 1: a real home-service crew finishes a clean suburban job at one house; show the street, neighboring homes, driveways, and curbside mailboxes so the local opportunity is obvious.",
    "Shot 2: smooth drone zoom-out from that completed job into a bird's-eye neighborhood view where surrounding homes form a tight cluster around the original customer address.",
    "Shot 3: a contractor or owner looks at a simple physical route map with colored blank circles and pins but absolutely no readable words, numbers, street names, or labels.",
    "Shot 4: a real mail carrier opens curbside mailboxes and places blank postcards directly inside several neighboring mailboxes one by one.",
    "Shot 5: return to aerial neighborhood view as the homes closest to the original job subtly glow as one dense local service route; no text, no labels, no random floating mail on lawns.",
    "Mandatory action details: the completed job must visually anchor the neighborhood; mail must go into mailboxes; show route density as nearby homes around one customer, not a citywide random mailing.",
  ].join(" ");
}

async function runCli(command: string, args: string[]) {
  const authEnv = await prepareHiggsfieldAuthEnv();
  return new Promise<{ stdout: string; stderr: string; exitCode: number | null; runtimeCommand: string }>(
    (resolve, reject) => {
      const timeoutMs = Number(process.env.HIGGSFIELD_PROCESS_TIMEOUT_MS || 600000);
      const childEnv = {
        ...process.env,
        ...authEnv,
        PATH: buildChildPath(process.env.PATH || ""),
        HIGGSFIELD_INSTALL_METHOD: "npm",
        HIGGSFIELD_PACKAGE_MANAGER: process.env.HIGGSFIELD_PACKAGE_MANAGER || "pnpm",
      };
      const invocation = resolveCliInvocation(command, args);
      const child = spawn(invocation.command, invocation.args, {
        cwd: process.env.CREATIVE_PROVIDER_MCP_WORKDIR || process.cwd(),
        env: childEnv,
        shell: false,
        windowsHide: true,
      });
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      const timer = windowlessSetTimeout(() => {
        child.kill();
        reject(new Error(`Higgsfield CLI timed out after ${timeoutMs}ms.`));
      }, timeoutMs);
      child.on("error", (error) => {
        clearTimeout(timer);
        reject(new Error(`Higgsfield CLI failed to start via ${invocation.label}: ${error.message}`));
      });
      child.on("close", (exitCode) => {
        clearTimeout(timer);
        if (exitCode === 0) {
          resolve({ stdout, stderr, exitCode, runtimeCommand: invocation.label });
          return;
        }
        reject(new Error(`Higgsfield CLI exited with ${exitCode}. ${stderr || stdout || "No output returned."}`));
      });
    },
  );
}

function resolveCliInvocation(command: string, args: string[]) {
  const bundledCli = isBareHiggsfieldCommand(command) ? resolveBundledHiggsfieldCli() : null;
  if (bundledCli) {
    return {
      command: bundledCli.command,
      args: [...bundledCli.args, ...args],
      label: bundledCli.label,
    };
  }

  return {
    command,
    args,
    label: command,
  };
}

function isBareHiggsfieldCommand(command: string) {
  if (!command || command.includes("/") || command.includes("\\")) return false;
  const normalized = command.toLowerCase().replace(/\.(cmd|ps1|exe)$/i, "");
  return normalized === "higgsfield" || normalized === "higgs";
}

function resolveBundledHiggsfieldCli(): { command: string; args: string[]; label: string } | null {
  const packageRoots = getHiggsfieldPackageRootCandidates();
  for (const packageRoot of packageRoots) {
    const vendorBinary = path.join(packageRoot, "vendor", process.platform === "win32" ? "hf.exe" : "hf");
    if (existsSync(vendorBinary)) {
      return {
        command: vendorBinary,
        args: [],
        label: "@higgsfield/cli/vendor/hf",
      };
    }

    const binScript = path.join(packageRoot, "bin", "higgsfield.js");
    if (existsSync(binScript)) {
      return {
        command: process.execPath,
        args: [binScript],
        label: "node @higgsfield/cli/bin/higgsfield.js",
      };
    }
  }

  return null;
}

function getHiggsfieldPackageRootCandidates() {
  const candidates = new Set<string>();

  [
    path.join(process.cwd(), "node_modules", "@higgsfield", "cli"),
    path.join(process.cwd(), "apps", "web", "node_modules", "@higgsfield", "cli"),
    path.join(process.cwd(), "..", "node_modules", "@higgsfield", "cli"),
    path.join(process.cwd(), "..", "..", "node_modules", "@higgsfield", "cli"),
  ].forEach((candidate) => candidates.add(path.resolve(candidate)));

  return [...candidates];
}

async function prepareHiggsfieldAuthEnv() {
  const credentials = process.env.HIGGSFIELD_CREDENTIALS_JSON;
  if (!credentials?.trim()) return {};

  const home = path.join(tmpdir(), "homereach-higgsfield");
  const configDir = path.join(home, ".config", "higgsfield");
  const credentialsPath = path.join(configDir, "credentials.json");
  const body = decodeCredentials(credentials);

  await mkdir(configDir, { recursive: true });
  await writeFile(credentialsPath, body, { mode: 0o600 });

  return {
    HOME: home,
    USERPROFILE: home,
    APPDATA: path.join(home, "AppData", "Roaming"),
  };
}

function decodeCredentials(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("{")) return trimmed;
  try {
    return Buffer.from(trimmed, "base64").toString("utf8");
  } catch {
    return trimmed;
  }
}

function buildChildPath(existingPath: string) {
  const candidates = [
    path.join(process.cwd(), "node_modules", ".bin"),
    path.join(process.cwd(), "apps", "web", "node_modules", ".bin"),
    path.join(process.cwd(), "..", "node_modules", ".bin"),
  ];
  return [...candidates, existingPath].filter(Boolean).join(path.delimiter);
}

function windowlessSetTimeout(callback: () => void, timeoutMs: number) {
  return setTimeout(callback, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 600000);
}

function parseCliJson(stdout: string): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    for (const line of lines.reverse()) {
      try {
        return JSON.parse(line);
      } catch {
        continue;
      }
    }
  }
  return { raw: trimmed };
}

function collectUrls(value: unknown): string[] {
  const urls = new Set<string>();
  function walk(input: unknown) {
    if (!input) return;
    if (typeof input === "string") {
      const matches = input.match(/https?:\/\/[^\s"'<>]+/gi) ?? [];
      matches.forEach((url) => urls.add(url.replace(/[),.;]+$/, "")));
      return;
    }
    if (Array.isArray(input)) {
      input.forEach(walk);
      return;
    }
    if (typeof input === "object") {
      Object.values(input as Record<string, unknown>).forEach(walk);
    }
  }
  walk(value);
  return [...urls];
}

function findVideoUrl(urls: string[]) {
  return urls.find((url) => /\.(mp4|mov|webm)(\?|#|$)/i.test(url)) ?? null;
}

function findImageUrl(urls: string[]) {
  return urls.find((url) => /\.(png|jpe?g|webp)(\?|#|$)/i.test(url)) ?? null;
}

function findProviderJobId(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["job_id", "jobId", "id", "generation_id", "generationId"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  for (const nested of Object.values(record)) {
    const found = findProviderJobId(nested);
    if (found) return found;
  }
  return null;
}

function findProviderStatus(value: unknown): "completed" | "queued" | "failed" | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const status = record.status ?? record.state ?? record.providerStatus;
  if (typeof status === "string") {
    const normalized = status.toLowerCase();
    if (["completed", "complete", "succeeded", "success", "done"].includes(normalized)) return "completed";
    if (["failed", "failure", "error", "cancelled", "canceled"].includes(normalized)) return "failed";
    if (["queued", "pending", "running", "processing", "created", "in_progress"].includes(normalized)) return "queued";
  }
  for (const nested of Object.values(record)) {
    const found = findProviderStatus(nested);
    if (found) return found;
  }
  return null;
}

function findProviderFailureMessage(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const key of ["error", "error_message", "message", "failure_reason", "reason"]) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return normalizeHiggsfieldError(candidate);
    if (candidate && typeof candidate === "object") {
      const nested = findProviderFailureMessage(candidate);
      if (nested) return nested;
    }
  }
  for (const nested of Object.values(record)) {
    const found = findProviderFailureMessage(nested);
    if (found) return found;
  }
  return null;
}
