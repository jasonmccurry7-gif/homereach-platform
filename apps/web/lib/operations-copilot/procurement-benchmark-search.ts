import "server-only";

export type BenchmarkSearchItem = {
  sku: string;
  itemName: string;
  category: string;
  unit?: string;
  baselinePriceCents?: number;
  supplierName?: string;
};

export type ObservedBenchmark = {
  sku: string;
  itemName: string;
  category: string;
  supplierName: string;
  sourceLabel: string;
  sourceUrl?: string;
  unit: string;
  observedPriceCents: number;
  normalizedUnitPriceCents?: number;
  confidence: "low" | "medium";
  priceBasis: string;
  notes?: string;
};

export type BenchmarkSearchResult = {
  provider: "serpapi" | "tavily" | "none";
  searched: number;
  benchmarks: ObservedBenchmark[];
  warnings: string[];
};

type SerpShoppingResult = {
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  link?: string;
  product_link?: string;
  delivery?: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  content?: string;
};

export async function searchObservedBenchmarks({
  items,
  region,
  zipCode,
  maxItems = 8,
}: {
  items: BenchmarkSearchItem[];
  region: string;
  zipCode: string;
  maxItems?: number;
}): Promise<BenchmarkSearchResult> {
  const scopedItems = dedupeItems(items)
    .filter((item) => item.itemName.trim())
    .slice(0, maxItems);

  if (scopedItems.length === 0) {
    return { provider: "none", searched: 0, benchmarks: [], warnings: ["No items available for benchmark search."] };
  }

  if (getSerpApiKey()) {
    return searchWithSerpApi({ items: scopedItems, region, zipCode });
  }

  if (process.env.TAVILY_API_KEY) {
    return searchWithTavily({ items: scopedItems, region, zipCode });
  }

  return {
    provider: "none",
    searched: 0,
    benchmarks: [],
    warnings: [
      "No public benchmark search provider is configured. Add SERP_API, SERPAPI_API_KEY, SERPAPI_KEY, or TAVILY_API_KEY.",
    ],
  };
}

async function searchWithSerpApi({
  items,
  region,
  zipCode,
}: {
  items: BenchmarkSearchItem[];
  region: string;
  zipCode: string;
}): Promise<BenchmarkSearchResult> {
  const apiKey = getSerpApiKey();
  if (!apiKey) return { provider: "none", searched: 0, benchmarks: [], warnings: [] };

  const benchmarks: ObservedBenchmark[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    const query = buildBenchmarkQuery(item, region, zipCode);
    try {
      const url = new URL("https://serpapi.com/search.json");
      url.searchParams.set("engine", "google_shopping");
      url.searchParams.set("q", query);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("gl", "us");
      url.searchParams.set("hl", "en");

      const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
      if (!response.ok) {
        warnings.push(`${item.itemName}: SerpAPI returned ${response.status}`);
        continue;
      }
      const payload = (await response.json()) as { shopping_results?: SerpShoppingResult[] };
      const result = pickBestSerpResult(payload.shopping_results ?? []);
      if (!result) {
        warnings.push(`${item.itemName}: no shopping benchmark found`);
        continue;
      }

      benchmarks.push({
        sku: item.sku,
        itemName: result.title || item.itemName,
        category: item.category,
        supplierName: result.source || "Google Shopping",
        sourceLabel: "SerpAPI Google Shopping benchmark",
        sourceUrl: result.link || result.product_link,
        unit: item.unit || "unit",
        observedPriceCents: result.priceCents,
        normalizedUnitPriceCents: result.priceCents,
        confidence: "medium",
        priceBasis: "observed public shopping result",
        notes: result.delivery ? `Delivery note: ${result.delivery}` : undefined,
      });
    } catch (error) {
      warnings.push(
        `${item.itemName}: ${
          error instanceof Error ? error.message : "public benchmark search failed"
        }`
      );
    }
  }

  return { provider: "serpapi", searched: items.length, benchmarks, warnings };
}

async function searchWithTavily({
  items,
  region,
  zipCode,
}: {
  items: BenchmarkSearchItem[];
  region: string;
  zipCode: string;
}): Promise<BenchmarkSearchResult> {
  const benchmarks: ObservedBenchmark[] = [];
  const warnings: string[] = [];

  for (const item of items) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          api_key: process.env.TAVILY_API_KEY,
          query: buildBenchmarkQuery(item, region, zipCode),
          max_results: 5,
          search_depth: "basic",
          include_answer: false,
        }),
      });
      if (!response.ok) {
        warnings.push(`${item.itemName}: Tavily returned ${response.status}`);
        continue;
      }

      const payload = (await response.json()) as { results?: TavilyResult[] };
      const result = pickBestTavilyResult(payload.results ?? []);
      if (!result) {
        warnings.push(`${item.itemName}: no priced benchmark found`);
        continue;
      }

      benchmarks.push({
        sku: item.sku,
        itemName: result.title || item.itemName,
        category: item.category,
        supplierName: extractHost(result.url) || "Public web",
        sourceLabel: "Tavily public web benchmark",
        sourceUrl: result.url,
        unit: item.unit || "unit",
        observedPriceCents: result.priceCents,
        normalizedUnitPriceCents: result.priceCents,
        confidence: "low",
        priceBasis: "observed public web result",
      });
    } catch (error) {
      warnings.push(
        `${item.itemName}: ${
          error instanceof Error ? error.message : "public benchmark search failed"
        }`
      );
    }
  }

  return { provider: "tavily", searched: items.length, benchmarks, warnings };
}

function buildBenchmarkQuery(item: BenchmarkSearchItem, region: string, zipCode: string) {
  const supplierHint = item.supplierName ? ` alternative to ${item.supplierName}` : "";
  return `${item.itemName} ${item.unit ?? ""} supplier price ${zipCode} ${region}${supplierHint}`.replace(
    /\s+/g,
    " "
  );
}

function pickBestSerpResult(results: SerpShoppingResult[]) {
  for (const result of results) {
    const priceCents =
      typeof result.extracted_price === "number"
        ? Math.round(result.extracted_price * 100)
        : parsePriceCents(result.price);
    if (priceCents && priceCents > 0) {
      return { ...result, priceCents };
    }
  }
  return null;
}

function pickBestTavilyResult(results: TavilyResult[]) {
  for (const result of results) {
    const priceCents = parsePriceCents(`${result.title ?? ""} ${result.content ?? ""}`);
    if (priceCents && priceCents > 0) {
      return { ...result, priceCents };
    }
  }
  return null;
}

function parsePriceCents(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (!value) return undefined;
  const match = String(value).match(/\$?\s*([0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (!match?.[1]) return undefined;
  const parsed = Number.parseFloat(match[1].replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed * 100);
}

function getSerpApiKey() {
  return process.env.SERPAPI_API_KEY || process.env.SERPAPI_KEY || process.env.SERP_API || "";
}

function extractHost(url?: string) {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function dedupeItems(items: BenchmarkSearchItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sku}:${item.itemName}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
