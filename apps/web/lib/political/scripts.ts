// ─────────────────────────────────────────────────────────────────────────────
// HomeReach — Political Script Library
//
// Server-only reads + a pure template interpolator. Scripts seed from
// migration 063; admins can add more via SQL (admin UI lands later).
//
// Template variables (whitelist):
//   {{candidate_name}}  {{office}}  {{district}}  {{state}}  {{rep_name}}
// Any other placeholder is left as-is so operators can add future vars
// without breaking existing scripts.
// ─────────────────────────────────────────────────────────────────────────────

import "server-only";
import { createClient as createUserClient } from "@/lib/supabase/server";

export type ScriptChannel = "call" | "sms" | "email" | "facebook_dm";

export interface ScriptRow {
  id: string;
  slug: string;
  channel: ScriptChannel;
  category: string;
  name: string;
  subject: string | null;
  body: string;
  state: string | null;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ScriptDbRow {
  id: string;
  slug: string;
  channel: ScriptChannel;
  category: string;
  name: string;
  subject: string | null;
  body: string;
  state: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const COLUMNS =
  "id, slug, channel, category, name, subject, body, state, sort_order, active, created_at, updated_at";

function rowToScript(r: ScriptDbRow): ScriptRow {
  return {
    id: r.id,
    slug: r.slug,
    channel: r.channel,
    category: r.category,
    name: r.name,
    subject: r.subject,
    body: r.body,
    state: r.state,
    sortOrder: r.sort_order,
    active: r.active,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Loads active scripts for a channel, optionally scoped to a state. */
export async function listScripts(
  channel: ScriptChannel,
  state?: string | null,
): Promise<ScriptRow[]> {
  const supabase = await createUserClient();
  let q = supabase
    .from("political_scripts")
    .select(COLUMNS)
    .eq("channel", channel)
    .eq("active", true);
  if (state) q = q.or(`state.is.null,state.eq.${state.toUpperCase()}`);
  else q = q.is("state", null);
  q = q.order("sort_order", { ascending: true }).order("created_at", { ascending: true });

  const { data, error } = await q;
  if (error) throw new Error(`listScripts: ${error.message}`);
  return ((data ?? []) as unknown as ScriptDbRow[]).map(rowToScript);
}

/** Loads ALL active scripts across channels, scoped to optional state.
 *  Used by the Outreach tab so switching channels doesn't re-query. */
export async function listAllActiveScripts(
  state?: string | null,
): Promise<ScriptRow[]> {
  const supabase = await createUserClient();
  let q = supabase
    .from("political_scripts")
    .select(COLUMNS)
    .eq("active", true);
  if (state) q = q.or(`state.is.null,state.eq.${state.toUpperCase()}`);
  else q = q.is("state", null);
  q = q.order("channel", { ascending: true })
       .order("sort_order", { ascending: true });
  const { data, error } = await q;
  if (error) throw new Error(`listAllActiveScripts: ${error.message}`);
  return ((data ?? []) as unknown as ScriptDbRow[]).map(rowToScript);
}

/** Interpolates {{variables}} in a template. Whitespace-tolerant.
 *  Unknown placeholders are LEFT AS-IS so adding vars later won't break
 *  existing scripts at runtime (the operator just sees {{future_var}}). */
export function renderScript(
  template: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return template.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (match, key: string) => {
    const v = variables[key];
    if (v === undefined || v === null || v === "") return match;
    return String(v);
  });
}
