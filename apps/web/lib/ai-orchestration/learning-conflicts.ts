import { createServiceClient } from "@/lib/supabase/service";
import { getDashboardAgentMatrix } from "./dashboard-agents";

type ConflictSeverity = "high" | "medium" | "low";

export interface LearningConflict {
  id: string;
  source: "ci_insights" | "ci_enhancements" | "ci_automations";
  category: string;
  title: string;
  summary: string;
  status: string;
  risk: ConflictSeverity;
  matchType: "dashboard_agent" | "open_action" | "similar_learning_item";
  matchLabel: string;
  matchRoute: string;
  reason: string;
  recommendedAction: string;
  createdAt: string | null;
}

export interface LearningConflictReport {
  generatedAt: string;
  summary: {
    total: number;
    high: number;
    medium: number;
    low: number;
    candidatesChecked: number;
  };
  rows: LearningConflict[];
  sourceHealth: Array<{ source: string; status: "ok" | "unavailable"; note?: string }>;
}

type LearningCandidate = {
  id: string;
  source: LearningConflict["source"];
  category: string;
  title: string;
  summary: string;
  status: string;
  created_at: string | null;
  text: string;
};

function nowIso() {
  return new Date().toISOString();
}

function hasSupabaseEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function tokenize(input: string) {
  return new Set(
    input
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3)
      .filter((token) => !["home", "reach", "homereach", "system", "dashboard", "engine"].includes(token)),
  );
}

function overlapScore(left: string, right: string) {
  const leftTokens = tokenize(left);
  const rightTokens = tokenize(right);
  if (leftTokens.size === 0 || rightTokens.size === 0) return 0;
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function summarize(rows: LearningConflict[], candidatesChecked: number): LearningConflictReport["summary"] {
  return {
    total: rows.length,
    high: rows.filter((row) => row.risk === "high").length,
    medium: rows.filter((row) => row.risk === "medium").length,
    low: rows.filter((row) => row.risk === "low").length,
    candidatesChecked,
  };
}

function riskFromScore(score: number): ConflictSeverity | null {
  if (score >= 0.72) return "high";
  if (score >= 0.48) return "medium";
  if (score >= 0.32) return "low";
  return null;
}

export async function getLearningConflictReport(limit = 30): Promise<LearningConflictReport> {
  const sourceHealth: LearningConflictReport["sourceHealth"] = [];
  const rows: LearningConflict[] = [];

  if (!hasSupabaseEnv()) {
    sourceHealth.push({ source: "supabase", status: "unavailable", note: "Supabase env is missing." });
    return { generatedAt: nowIso(), summary: summarize([], 0), rows: [], sourceHealth };
  }

  const supabase = createServiceClient();

  async function readSource<T>(source: string, fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      const result = await fn();
      sourceHealth.push({ source, status: "ok" });
      return result;
    } catch (error) {
      sourceHealth.push({ source, status: "unavailable", note: error instanceof Error ? error.message : String(error) });
      return fallback;
    }
  }

  const [insights, enhancements, automations, openActions] = await Promise.all([
    readSource("ci_insights", async () => {
      const { data, error } = await supabase
        .from("ci_insights")
        .select("id,category,theme,insight_text,status,apex_score,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_enhancements", async () => {
      const { data, error } = await supabase
        .from("ci_enhancements")
        .select("id,category,title,description,kind,status,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("ci_automations", async () => {
      const { data, error } = await supabase
        .from("ci_automations")
        .select("id,category,title,trigger_desc,action_desc,status,created_at")
        .in("status", ["pending", "approved"])
        .order("created_at", { ascending: false })
        .limit(24);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),

    readSource("unified_action_items", async () => {
      const { data, error } = await supabase
        .from("unified_action_items")
        .select("source_key,dashboard,route,title,reason,recommended_action,state,updated_at")
        .in("state", ["open", "snoozed"])
        .order("updated_at", { ascending: false })
        .limit(40);
      if (error) throw error;
      return data ?? [];
    }, [] as Array<Record<string, any>>),
  ]);

  const candidates: LearningCandidate[] = [
    ...insights.map((item) => ({
      id: item.id,
      source: "ci_insights" as const,
      category: item.category ?? "general",
      title: item.theme || `${item.category} insight`,
      summary: item.insight_text ?? "",
      status: item.status ?? "pending",
      created_at: item.created_at ?? null,
      text: [item.category, item.theme, item.insight_text].filter(Boolean).join(" "),
    })),
    ...enhancements.map((item) => ({
      id: item.id,
      source: "ci_enhancements" as const,
      category: item.category ?? "general",
      title: item.title ?? `${item.category} enhancement`,
      summary: item.description ?? "",
      status: item.status ?? "pending",
      created_at: item.created_at ?? null,
      text: [item.category, item.title, item.description, item.kind].filter(Boolean).join(" "),
    })),
    ...automations.map((item) => ({
      id: item.id,
      source: "ci_automations" as const,
      category: item.category ?? "general",
      title: item.title ?? `${item.category} automation`,
      summary: `${item.trigger_desc ?? ""} ${item.action_desc ?? ""}`.trim(),
      status: item.status ?? "pending",
      created_at: item.created_at ?? null,
      text: [item.category, item.title, item.trigger_desc, item.action_desc].filter(Boolean).join(" "),
    })),
  ];

  const dashboardMatches = getDashboardAgentMatrix().map((agent) => ({
    label: agent.name,
    route: agent.route ?? "/admin/agents",
    text: [
      agent.name,
      agent.dashboard,
      agent.mission,
      agent.connectedSystems.join(" "),
      agent.primaryData.join(" "),
      agent.guardrails.join(" "),
    ].join(" "),
  }));

  const actionMatches = openActions.map((action) => ({
    label: action.title ?? action.dashboard ?? "Open Action Center item",
    route: action.route ?? "/admin/agents",
    text: [action.dashboard, action.title, action.reason, action.recommended_action].filter(Boolean).join(" "),
  }));

  for (const candidate of candidates) {
    const text = candidate.text;
    const localMatches = [
      ...dashboardMatches.map((match) => ({
        type: "dashboard_agent" as const,
        label: match.label,
        route: match.route,
        score: overlapScore(text, match.text),
      })),
      ...actionMatches.map((match) => ({
        type: "open_action" as const,
        label: match.label,
        route: match.route,
        score: overlapScore(text, match.text),
      })),
      ...candidates
        .filter((other) => other.id !== candidate.id)
        .map((other) => ({
          type: "similar_learning_item" as const,
          label: other.title || other.category || "Similar Learning Engine item",
          route: "/admin/content-intel",
          score: overlapScore(text, other.text),
        })),
    ]
      .sort((a, b) => b.score - a.score)
      .slice(0, 2);

    for (const match of localMatches) {
      const risk = riskFromScore(match.score);
      if (!risk) continue;
      rows.push({
        id: `${candidate.source}-${candidate.id}-${match.type}-${match.label}`.slice(0, 240),
        source: candidate.source,
        category: candidate.category,
        title: candidate.title || `${candidate.category} item`,
        summary: String(candidate.summary ?? "").slice(0, 240),
        status: candidate.status,
        risk,
        matchType: match.type,
        matchLabel: match.label,
        matchRoute: match.route,
        reason: `Text overlap score ${Math.round(match.score * 100)}% against ${match.label}.`,
        recommendedAction:
          risk === "high"
            ? "Review for duplicate or conflicting workflow before creating an implementation task."
            : "Check whether this should merge into the existing workflow instead of becoming new work.",
        createdAt: candidate.created_at,
      });
    }
  }

  const sorted = rows
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, low: 1 };
      const riskDelta = rank[b.risk] - rank[a.risk];
      if (riskDelta !== 0) return riskDelta;
      return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime();
    })
    .slice(0, limit);

  return {
    generatedAt: nowIso(),
    summary: summarize(sorted, candidates.length),
    rows: sorted,
    sourceHealth,
  };
}
