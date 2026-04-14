import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min — scraping takes time

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/agents/scraper
// Cron: every 3 hours (*/3 * * * * not supported — use 0 */3 * * *)
//
// For each city × category combo:
//   1. Skip if city already has MAX_PER_CITY leads
//   2. Query SerpAPI Google Maps for up to RESULTS_PER_RUN businesses
//   3. Try Hunter.io to find email for each business
//   4. Insert new leads into sales_leads (skip duplicates)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_PER_CITY      = 500;  // total leads per city
const RESULTS_PER_RUN   = 10; // 10 per category per city per run    // businesses scraped per category per city per run

// City+category search queries (maps to our DB category slugs)
const CITIES = [
  "Wooster OH", "Medina OH", "Massillon OH", "Cuyahoga Falls OH",
  "Canton OH", "Akron OH", "Brunswick OH", "Barberton OH",
  "Wadsworth OH", "Stow OH", "Kent OH",
];

// Category → search queries for Google Maps
const CATEGORY_QUERIES: Record<string, string[]> = {
  "plumbing":          ["plumber", "plumbing company"],
  "hvac":              ["HVAC contractor", "heating and cooling"],
  "roofing":           ["roofing company", "roofer"],
  "landscaping":       ["landscaping company", "lawn care"],
  "home-cleaning":     ["house cleaning service", "maid service"],
  "electrical":        ["electrician", "electrical contractor"],
  "painting":          ["painting contractor", "house painter"],
  "pressure-washing":  ["pressure washing", "power washing"],
  "junk-removal":      ["junk removal service"],
  "tree-service":      ["tree service", "tree trimming"],
  "garage-doors":      ["garage door repair", "garage door company"],
  "gutters":           ["gutter installation", "gutter cleaning"],
  "flooring":          ["flooring company", "floor installation"],
  "pest-control":      ["pest control", "exterminator"],
  "windows-doors":     ["window replacement", "door installation"],
  "concrete-masonry":  ["concrete contractor", "masonry"],
  "home-remodeling":   ["home remodeling", "home renovation contractor"],
  "real-estate":       ["real estate agent", "realtor"],
  "insurance":         ["insurance agency", "insurance agent"],
  "solar":             ["solar panel installation", "solar company"],
  "financial-services":["financial advisor", "accounting firm"],
};

// ── SerpAPI call ──────────────────────────────────────────────────────────────
async function searchGoogleMaps(query: string, city: string): Promise<SerpResult[]> {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) return [];

  try {
    const params = new URLSearchParams({
      engine:  "google_maps",
      q:       `${query} in ${city}`,
      api_key: apiKey,
      num:     String(RESULTS_PER_RUN * 2), // request extra to account for filtering
    });

    const res = await fetch(`https://serpapi.com/search?${params}`);
    if (!res.ok) return [];

    const data = await res.json() as { local_results?: SerpResult[] };
    return (data.local_results ?? []).slice(0, RESULTS_PER_RUN);
  } catch {
    return [];
  }
}

// ── Hunter.io email finder ─────────────────────────────────────────────────────
async function findEmail(businessName: string, domain?: string): Promise<string | null> {
  const apiKey = process.env.HUNTER_API_KEY;
  if (!apiKey || !domain) return null;

  try {
    const params = new URLSearchParams({
      domain:   domain,
      company:  businessName,
      api_key:  apiKey,
    });
    const res = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    if (!res.ok) return null;

    const data = await res.json() as HunterResponse;
    const emails = data.data?.emails ?? [];
    // Prefer generic/contact emails, then any first result
    const contact = emails.find(e =>
      ["contact", "info", "hello", "support", "admin"].some(prefix =>
        e.value.startsWith(prefix)
      )
    ) ?? emails[0];
    return contact?.value ?? null;
  } catch {
    return null;
  }
}

// ── Extract domain from URL ───────────────────────────────────────────────────
function extractDomain(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

// ── Score lead quality ────────────────────────────────────────────────────────
function scoreLead(result: SerpResult): number {
  let score = 50;
  if (result.rating && result.rating >= 4.0)   score += 15;
  if (result.reviews && result.reviews >= 10)  score += 10;
  if (result.website)                           score += 10;
  if (result.phone)                             score += 10;
  if (result.reviews && result.reviews >= 50)  score += 5;
  return Math.min(100, score);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SerpResult {
  title?:        string;
  phone?:        string;
  website?:      string;
  address?:      string;
  rating?:       number;
  reviews?:      number;
  place_id?:     string;
  thumbnail?:    string;
}

interface HunterResponse {
  data?: { emails?: Array<{ value: string; type: string }> };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = createServiceClient();
  const summary = {
    cities_processed: 0,
    categories_processed: 0,
    new_leads_inserted: 0,
    emails_found: 0,
    cities_skipped_full: 0,
    errors: 0,
  };

  // Get all active categories from DB
  const { data: dbCategories } = await db
    .from("categories")
    .select("id, slug, name")
    .eq("is_active", true);

  if (!dbCategories?.length) {
    return NextResponse.json({ error: "No categories found" }, { status: 500 });
  }

  // Get current lead counts per city to enforce MAX_PER_CITY
  const { data: cityCountsRaw } = await db
    .from("sales_leads")
    .select("city");

  const cityTotals: Record<string, number> = {};
  for (const row of cityCountsRaw ?? []) {
    const c = row.city ?? "unknown";
    cityTotals[c] = (cityTotals[c] ?? 0) + 1;
  }

  // Process each city × category combo
  for (const city of CITIES) {
    const cityName = city.split(" ")[0]; // "Wooster OH" → "Wooster"
    const currentCount = cityTotals[cityName] ?? 0;

    if (currentCount >= MAX_PER_CITY) {
      summary.cities_skipped_full++;
      continue;
    }

    summary.cities_processed++;
    const spotsLeft = MAX_PER_CITY - currentCount;

    for (const dbCat of dbCategories) {
      const queries = CATEGORY_QUERIES[dbCat.slug];
      if (!queries?.length) continue;

      summary.categories_processed++;

      // Pick one query per run (rotate by hour to get variety)
      const query = queries[Math.floor(Date.now() / 3_600_000) % queries.length];

      const results = await searchGoogleMaps(query, city);

      for (const result of results) {
        if (!result.title) continue;

        // Check for existing lead (dedup by business name + city)
        const { count: existing } = await db
          .from("sales_leads")
          .select("id", { count: "exact" })
          .eq("business_name", result.title)
          .eq("city", cityName);

        if ((existing ?? 0) > 0) continue;

        // Stop if city is now full
        if ((cityTotals[cityName] ?? 0) >= MAX_PER_CITY) break;

        // Try to find email via Hunter.io
        const domain = extractDomain(result.website);
        let email: string | null = null;
        try {
          email = await findEmail(result.title, domain);
          if (email) summary.emails_found++;
        } catch { /* non-critical */ }

        const score = scoreLead(result);

        // Insert new lead
        const { error: insertErr } = await db.from("sales_leads").insert({
          business_name:   result.title,
          phone:           result.phone ?? null,
          email:           email,
          website:         result.website ?? null,
          address:         result.address ?? null,
          city:            cityName,
          state:           "OH",
          category:        dbCat.name,
          category_id:     dbCat.id,
          score,
          status:          "queued",
          source:          "serpapi",
          do_not_contact:  false,
          sms_opt_out:     false,
          pipeline_stage:  "new",
          buying_signal:   result.rating ? result.rating >= 4.0 : false,
        });

        if (!insertErr) {
          summary.new_leads_inserted++;
          cityTotals[cityName] = (cityTotals[cityName] ?? 0) + 1;
        } else {
          summary.errors++;
        }
      }

      // Small delay to respect SerpAPI rate limits
      await new Promise(r => setTimeout(r, 800));
    }
  }

  return NextResponse.json({
    status: "ok",
    summary,
    ran_at: new Date().toISOString(),
  });
}

// GET: run status check
export async function GET() {
  const db = createServiceClient();
  const { data } = await db
    .from("sales_leads")
    .select("city, status")
    .eq("source", "serpapi");

  const byCity: Record<string, number> = {};
  for (const row of data ?? []) {
    const c = row.city ?? "unknown";
    byCity[c] = (byCity[c] ?? 0) + 1;
  }

  return NextResponse.json({
    serpapi_leads_by_city: byCity,
    total: Object.values(byCity).reduce((a, b) => a + b, 0),
    max_per_city: MAX_PER_CITY,
    results_per_run: RESULTS_PER_RUN,
  });
}
