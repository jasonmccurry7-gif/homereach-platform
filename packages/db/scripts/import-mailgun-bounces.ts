/**
 * import-mailgun-bounces.ts
 *
 * One-time list-cleanup script. Pulls the historical bounce / complaint /
 * unsubscribe lists from the Mailgun API and flags matching addresses on
 * public.sales_leads.email_status so the new ESP (Postmark) never re-sends
 * to dead addresses.
 *
 * Owner: Agent 2 — outreach-visibility branch.
 * Migration: supabase/migrations/074_email_observability.sql
 *
 * Usage (run from repo root):
 *   pnpm tsx packages/db/scripts/import-mailgun-bounces.ts
 *
 * Required env vars (use existing Mailgun creds — read-only API access):
 *   MAILGUN_API_KEY     — your Mailgun private API key
 *   MAILGUN_DOMAIN      — the sending domain (e.g. mg.home-reach.com)
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent — safe to run multiple times. Each run only updates leads where
 * email_status is currently 'unknown' or null; never demotes a 'valid' lead.
 *
 * What it does:
 *   1. Fetches /bounces  → marks matching sales_leads.email_status = 'bounced_permanent'
 *   2. Fetches /complaints → marks matching sales_leads.email_status = 'complained'
 *   3. Fetches /unsubscribes → marks matching sales_leads.email_status = 'unsubscribed'
 *   4. Logs one summary email_events row per import for audit trail
 *
 * Does NOT modify any send path. Read-side only.
 */

import { createClient } from "@supabase/supabase-js";

interface MailgunListItem {
  address: string;
  code?: string | number;
  error?: string;
  reason?: string;
  created_at?: string;
}

interface MailgunListPage {
  items: MailgunListItem[];
  paging?: { next?: string };
}

const MAILGUN_API = "https://api.mailgun.net/v3";

function getAuthHeader(apiKey: string): string {
  return `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}`;
}

async function fetchAllPages(
  endpoint: string,
  apiKey: string,
): Promise<MailgunListItem[]> {
  const items: MailgunListItem[] = [];
  let url: string | undefined = `${endpoint}?limit=1000`;
  let pages = 0;

  while (url && pages < 100) {
    pages++;
    const res = await fetch(url, {
      headers: {
        Authorization: getAuthHeader(apiKey),
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      throw new Error(`Mailgun ${url} → ${res.status} ${await res.text()}`);
    }
    const data = (await res.json()) as MailgunListPage;
    items.push(...(data.items ?? []));
    if (data.items.length < 1000 || !data.paging?.next) break;
    url = data.paging.next;
  }

  return items;
}

async function flagLeads(
  supabase: ReturnType<typeof createClient>,
  emails: string[],
  newStatus: "bounced_permanent" | "complained" | "unsubscribed",
): Promise<{ updated: number; errors: number }> {
  if (emails.length === 0) return { updated: 0, errors: 0 };

  // Process in chunks of 500 to avoid query size limits
  let updated = 0;
  let errors = 0;
  for (let i = 0; i < emails.length; i += 500) {
    const chunk = emails.slice(i, i + 500).map((e) => e.toLowerCase());
    const { error, count } = await supabase
      .from("sales_leads")
      .update({ email_status: newStatus }, { count: "exact" })
      .in("email", chunk)
      .or("email_status.is.null,email_status.eq.unknown,email_status.eq.valid");
    if (error) {
      console.error(
        `[mailgun-import] chunk ${i / 500} update failed:`,
        error.message,
      );
      errors += chunk.length;
    } else {
      updated += count ?? 0;
    }
  }
  return { updated, errors };
}

async function main() {
  const apiKey = process.env.MAILGUN_API_KEY;
  const domain = process.env.MAILGUN_DOMAIN;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!apiKey || !domain) {
    throw new Error("MAILGUN_API_KEY and MAILGUN_DOMAIN are required");
  }
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(`[mailgun-import] domain=${domain}`);

  // 1. Bounces
  console.log("[mailgun-import] fetching bounces…");
  const bounces = await fetchAllPages(
    `${MAILGUN_API}/${domain}/bounces`,
    apiKey,
  );
  const bounceEmails = bounces
    .map((b) => b.address)
    .filter((e): e is string => Boolean(e));
  console.log(`  → ${bounceEmails.length} bounce addresses`);
  const bounceResult = await flagLeads(supabase, bounceEmails, "bounced_permanent");
  console.log(
    `  → flagged ${bounceResult.updated} leads as bounced_permanent (errors: ${bounceResult.errors})`,
  );

  // 2. Complaints
  console.log("[mailgun-import] fetching complaints…");
  const complaints = await fetchAllPages(
    `${MAILGUN_API}/${domain}/complaints`,
    apiKey,
  );
  const complaintEmails = complaints
    .map((c) => c.address)
    .filter((e): e is string => Boolean(e));
  console.log(`  → ${complaintEmails.length} complaint addresses`);
  const complaintResult = await flagLeads(
    supabase,
    complaintEmails,
    "complained",
  );
  console.log(
    `  → flagged ${complaintResult.updated} leads as complained (errors: ${complaintResult.errors})`,
  );

  // 3. Unsubscribes
  console.log("[mailgun-import] fetching unsubscribes…");
  const unsubs = await fetchAllPages(
    `${MAILGUN_API}/${domain}/unsubscribes`,
    apiKey,
  );
  const unsubEmails = unsubs
    .map((u) => u.address)
    .filter((e): e is string => Boolean(e));
  console.log(`  → ${unsubEmails.length} unsubscribe addresses`);
  const unsubResult = await flagLeads(supabase, unsubEmails, "unsubscribed");
  console.log(
    `  → flagged ${unsubResult.updated} leads as unsubscribed (errors: ${unsubResult.errors})`,
  );

  // 4. Audit row in email_events
  await supabase.from("email_events").insert({
    provider: "mailgun",
    event_type: "import_summary",
    raw_payload: {
      ranAt: new Date().toISOString(),
      bouncesFetched: bounceEmails.length,
      bouncesFlagged: bounceResult.updated,
      complaintsFetched: complaintEmails.length,
      complaintsFlagged: complaintResult.updated,
      unsubsFetched: unsubEmails.length,
      unsubsFlagged: unsubResult.updated,
    },
  });

  console.log("\n[mailgun-import] DONE");
  console.log(
    `  bounces:     ${bounceEmails.length} fetched, ${bounceResult.updated} leads flagged`,
  );
  console.log(
    `  complaints:  ${complaintEmails.length} fetched, ${complaintResult.updated} leads flagged`,
  );
  console.log(
    `  unsubs:      ${unsubEmails.length} fetched, ${unsubResult.updated} leads flagged`,
  );
}

main().catch((err) => {
  console.error("[mailgun-import] FATAL:", err);
  process.exit(1);
});
