// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Q&A Retrieval Service
//
// Returns the context that the Intelligence Layer feeds to Claude when
// generating a new answer, and the hits returned by the Knowledge Layer
// search endpoint.
//
// V1a uses lexical search (ILIKE + full-text tsvector). Semantic search
// (pgvector) is available in the migration but only queried if an embedding
// provider key is configured. If not, we fall back to lexical-only and the
// system still works.
// ─────────────────────────────────────────────────────────────────────────────

import type { SupabaseClient } from "@supabase/supabase-js";
import type { QaRetrievedContext } from "./claude";

type SupaClient = SupabaseClient<any, any, any>;

const MAX_KNOWLEDGE = 5;
const MAX_PAST_ANSWERS = 5;

export async function buildRetrievalContext(
  supa: SupaClient,
  args: {
    questionText: string;
    leadId?: string | null;
    cityId?: string | null;
    categoryId?: string | null;
    categoryTags?: string[];
  },
): Promise<QaRetrievedContext> {
  const { questionText, leadId, cityId, categoryTags } = args;

  // ── 1) Knowledge entries: tsvector full-text match on title + body ────────
  const kq = supa
    .from("qa_knowledge_entries")
    .select("id, title, body, category_tags, city_scope")
    .limit(MAX_KNOWLEDGE)
    .textSearch("tsv", toTsQuery(questionText), { type: "plain" } as any);

  // Scope filtering — city_scope null = global; otherwise must contain cityId
  // We filter post-query because Supabase JS doesn't easily express this.
  const { data: knowledgeRaw } = await kq;
  const knowledgeEntries = (knowledgeRaw || [])
    .filter((k: any) => {
      if (!k.city_scope || k.city_scope.length === 0) return true;
      if (cityId && k.city_scope.includes(cityId)) return true;
      return false;
    })
    .slice(0, MAX_KNOWLEDGE)
    .map((k: any) => ({
      id: k.id as string,
      title: k.title as string,
      body: k.body as string,
    }));

  // ── 2) Past similar Q&A answers: ILIKE match on question_text ─────────────
  const pastQuery = supa
    .from("qa_questions")
    .select("id, question_text, qa_answers!qa_answers_question_fk(id, direct_answer)")
    .limit(MAX_PAST_ANSWERS * 2) // over-fetch then filter
    .ilike("question_text", `%${escapeIlike(questionText.slice(0, 60))}%`)
    .eq("status", "answered")
    .order("created_at", { ascending: false });

  const { data: pastRaw } = await pastQuery;
  const pastAnswers = (pastRaw || [])
    .flatMap((q: any) =>
      (q.qa_answers || []).slice(0, 1).map((a: any) => ({
        id: a.id as string,
        questionId: q.id as string,
        questionText: q.question_text as string,
        directAnswer: a.direct_answer as string,
      })),
    )
    .slice(0, MAX_PAST_ANSWERS);

  // ── 3) Lead context (opt-in enrichment) ───────────────────────────────────
  const leadContext: QaRetrievedContext["leadContext"] = {
    leadId: leadId ?? null,
  };
  if (cityId) {
    const { data: city } = await supa
      .from("cities")
      .select("name")
      .eq("id", cityId)
      .maybeSingle();
    leadContext.city = (city as any)?.name ?? null;
  }
  if (categoryTags && categoryTags.length > 0) {
    leadContext.category = categoryTags[0];
  }

  return {
    knowledgeEntries,
    pastAnswers,
    leadContext,
  };
}

/** Converts free text into a plain tsquery-safe phrase. */
function toTsQuery(s: string): string {
  // Simple heuristic: take top 6 distinct word-ish tokens
  const tokens = s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2)
    .slice(0, 6);
  return tokens.join(" ");
}

function escapeIlike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Knowledge search endpoint helper. Performs lexical full-text search
 * with optional category + city filters.
 */
export async function searchKnowledge(
  supa: SupaClient,
  args: { q: string; category?: string; cityId?: string; limit?: number },
): Promise<Array<{ id: string; title: string; body: string; tags: string[] }>> {
  const limit = Math.min(args.limit ?? 20, 50);
  let query = supa
    .from("qa_knowledge_entries")
    .select("id, title, body, category_tags, city_scope")
    .limit(limit);

  if (args.q.trim().length > 0) {
    query = query.textSearch("tsv", toTsQuery(args.q), { type: "plain" } as any);
  }

  if (args.category) {
    query = query.contains("category_tags", [args.category]);
  }

  const { data } = await query;
  return (data || [])
    .filter((k: any) => {
      if (!args.cityId) return true;
      if (!k.city_scope || k.city_scope.length === 0) return true;
      return k.city_scope.includes(args.cityId);
    })
    .map((k: any) => ({
      id: k.id,
      title: k.title,
      body: k.body,
      tags: k.category_tags || [],
    }));
}

/**
 * Dedupe check — given a draft question, return the top-3 semantically
 * similar existing knowledge entries. V1 implementation uses lexical match.
 */
export async function dedupeCheck(
  supa: SupaClient,
  draft: string,
): Promise<Array<{ id: string; title: string; body: string }>> {
  const { data } = await supa
    .from("qa_knowledge_entries")
    .select("id, title, body")
    .limit(3)
    .textSearch("tsv", toTsQuery(draft), { type: "plain" } as any);

  return (data || []).map((k: any) => ({
    id: k.id,
    title: k.title,
    body: k.body,
  }));
}
