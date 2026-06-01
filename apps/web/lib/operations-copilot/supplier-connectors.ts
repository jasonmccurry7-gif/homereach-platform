import type { IndustryPriceCatalog } from "@/lib/operations-copilot/industry-catalog";

export type SupplierConnectorMode =
  | "api_ready"
  | "edi_cxml_ready"
  | "csv_import"
  | "manual_quote"
  | "search_reference";

export type SupplierConnector = {
  supplierName: string;
  categories: string[];
  mode: SupplierConnectorMode;
  searchUrlPattern?: string;
  supportsDelivery: boolean;
  supportsPickup: boolean;
  supportsSupplierTruck: boolean;
  estimatedDeliveryFeeCents: number;
  freeDeliveryMinimumCents: number | null;
  defaultLeadTimeDays: number;
  confidenceScore: number;
  lastCheckedLabel: string;
  complianceNotes: string;
  liveOrderingEnabled: false;
};

const connectorCatalog: SupplierConnector[] = [
  {
    supplierName: "Amazon Business",
    categories: ["office", "janitorial", "packaging", "tools", "consumables"],
    mode: "api_ready",
    searchUrlPattern: "https://business.amazon.com/search?keywords={query}",
    supportsDelivery: true,
    supportsPickup: false,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 74,
    lastCheckedLabel: "Connector ready, credentials not connected",
    complianceNotes:
      "Use official Amazon Business APIs, Punchout/Punch-in workflows, or approved account exports. Do not store supplier credentials here.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Costco Business",
    categories: ["foodservice", "janitorial", "packaging", "office"],
    mode: "edi_cxml_ready",
    searchUrlPattern: "https://www.costcobusinessdelivery.com/CatalogSearch?keyword={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: 25000,
    defaultLeadTimeDays: 2,
    confidenceScore: 68,
    lastCheckedLabel: "Manual quote/search mode",
    complianceNotes:
      "Use approved business delivery exports or manual quote review before creating order actions.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Sam's Club",
    categories: ["foodservice", "janitorial", "packaging", "office"],
    mode: "manual_quote",
    searchUrlPattern: "https://www.samsclub.com/s/{query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 799,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 66,
    lastCheckedLabel: "Manual quote/search mode",
    complianceNotes:
      "Use member-approved exports or manual review. Delivery fees and availability must be verified at checkout.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Walmart Business",
    categories: ["office", "janitorial", "packaging", "foodservice", "tools"],
    mode: "api_ready",
    searchUrlPattern: "https://www.walmart.com/search?q={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 699,
    freeDeliveryMinimumCents: 3500,
    defaultLeadTimeDays: 2,
    confidenceScore: 70,
    lastCheckedLabel: "Connector ready, credentials not connected",
    complianceNotes:
      "Use approved APIs or CSV exports. Public search links are reference only and are not automated purchasing.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Restaurant Depot",
    categories: ["foodservice", "bakery", "restaurant"],
    mode: "manual_quote",
    searchUrlPattern: "https://www.restaurantdepot.com/catalogsearch/result/?q={query}",
    supportsDelivery: false,
    supportsPickup: true,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 0,
    confidenceScore: 62,
    lastCheckedLabel: "Pickup/manual quote mode",
    complianceNotes:
      "Pickup and member pricing must be validated manually before savings are marked verified.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "WebstaurantStore",
    categories: ["foodservice", "bakery", "restaurant", "packaging"],
    mode: "manual_quote",
    searchUrlPattern: "https://www.webstaurantstore.com/search/{query}.html",
    supportsDelivery: true,
    supportsPickup: false,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 1299,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 4,
    confidenceScore: 64,
    lastCheckedLabel: "Manual quote/search mode",
    complianceNotes:
      "Freight, shipping, and Plus pricing must be verified before quote lock.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Sysco",
    categories: ["foodservice", "restaurant", "bakery"],
    mode: "manual_quote",
    supportsDelivery: true,
    supportsPickup: false,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 58,
    lastCheckedLabel: "EDI/cXML-ready, credentials not connected",
    complianceNotes:
      "Requires approved account pricing through EDI, cXML/Punchout, portal export, route schedule, or rep quote before ordering.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "US Foods",
    categories: ["foodservice", "restaurant", "bakery"],
    mode: "edi_cxml_ready",
    supportsDelivery: true,
    supportsPickup: false,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 58,
    lastCheckedLabel: "EDI/cXML-ready, credentials not connected",
    complianceNotes:
      "Requires approved account pricing through EDI, cXML/Punchout, portal export, route schedule, or rep quote before ordering.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Gordon Food Service",
    categories: ["foodservice", "restaurant", "bakery"],
    mode: "edi_cxml_ready",
    searchUrlPattern: "https://gfsstore.com/search/?text={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 0,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 66,
    lastCheckedLabel: "EDI/cXML-ready, credentials not connected",
    complianceNotes:
      "Delivery eligibility, route day, and business account pricing must be verified through EDI 832, cXML/Punchout, portal export, or quote import.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Home Depot Pro",
    categories: ["roofing", "landscaping", "hvac", "janitorial", "tools"],
    mode: "search_reference",
    searchUrlPattern: "https://www.homedepot.com/s/{query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 799,
    freeDeliveryMinimumCents: 4500,
    defaultLeadTimeDays: 2,
    confidenceScore: 78,
    lastCheckedLabel: "Reference link mode",
    complianceNotes:
      "Public prices are reference only. Pro account price, delivery fee, and local stock must be verified.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Lowe's Pro",
    categories: ["roofing", "landscaping", "hvac", "janitorial", "tools"],
    mode: "search_reference",
    searchUrlPattern: "https://www.lowes.com/search?searchTerm={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 799,
    freeDeliveryMinimumCents: 4500,
    defaultLeadTimeDays: 2,
    confidenceScore: 76,
    lastCheckedLabel: "Reference link mode",
    complianceNotes:
      "Public prices are reference only. Pro account price, delivery fee, and local stock must be verified.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Grainger",
    categories: ["industrial", "janitorial", "safety", "hvac", "tools"],
    mode: "api_ready",
    searchUrlPattern: "https://www.grainger.com/search?searchQuery={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: false,
    estimatedDeliveryFeeCents: 999,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 72,
    lastCheckedLabel: "Connector ready, credentials not connected",
    complianceNotes:
      "Use approved account integrations or CSV exports. Account-specific pricing must be verified.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Fastenal",
    categories: ["industrial", "fasteners", "safety", "tools"],
    mode: "manual_quote",
    searchUrlPattern: "https://www.fastenal.com/product?q={query}",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 999,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 70,
    lastCheckedLabel: "Manual quote/search mode",
    complianceNotes:
      "Local branch quote and account pricing must be verified before approval.",
    liveOrderingEnabled: false,
  },
  {
    supplierName: "Local distributor",
    categories: ["roofing", "landscaping", "janitorial", "packaging", "restaurant"],
    mode: "manual_quote",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 2500,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 2,
    confidenceScore: 52,
    lastCheckedLabel: "Manual quote mode",
    complianceNotes:
      "Use quote request workflow. Do not represent estimates as verified account pricing.",
    liveOrderingEnabled: false,
  },
];

export function getSupplierConnectors() {
  return connectorCatalog;
}

export function resolveSupplierConnector(supplierName: string) {
  const normalized = normalizeSupplierName(supplierName);
  return (
    connectorCatalog.find((connector) =>
      normalized.includes(normalizeSupplierName(connector.supplierName))
    ) ??
    connectorCatalog.find((connector) =>
      normalizeSupplierName(connector.supplierName).includes(normalized)
    ) ??
    buildFallbackConnector(supplierName)
  );
}

export function buildSupplierConnectorControlPanel({
  catalog,
}: {
  catalog: IndustryPriceCatalog;
}) {
  const uniqueSupplierNames = Array.from(
    new Set(catalog.items.flatMap((item) => item.suppliers))
  ).sort((a, b) => a.localeCompare(b));

  return uniqueSupplierNames.map((supplierName) => {
    const connector = resolveSupplierConnector(supplierName);
    const itemCount = catalog.items.filter((item) =>
      item.suppliers.includes(supplierName)
    ).length;

    return {
      ...connector,
      supplierName,
      itemCount,
      status:
        connector.mode === "api_ready"
          ? "API-ready, credentials needed"
          : connector.mode === "edi_cxml_ready"
            ? "EDI/cXML-ready, credentials needed"
          : connector.mode === "csv_import"
            ? "CSV import ready"
            : connector.mode === "manual_quote"
              ? "Manual quote workflow"
              : "Reference search workflow",
    };
  });
}

export function buildSupplierSearchUrl({
  supplierName,
  query,
}: {
  supplierName: string;
  query: string;
}) {
  const connector = resolveSupplierConnector(supplierName);
  if (!connector.searchUrlPattern) return null;
  return connector.searchUrlPattern.replace("{query}", encodeURIComponent(query));
}

function buildFallbackConnector(supplierName: string): SupplierConnector {
  return {
    supplierName,
    categories: ["local distributor"],
    mode: "manual_quote",
    supportsDelivery: true,
    supportsPickup: true,
    supportsSupplierTruck: true,
    estimatedDeliveryFeeCents: 2500,
    freeDeliveryMinimumCents: null,
    defaultLeadTimeDays: 3,
    confidenceScore: 45,
    lastCheckedLabel: "Fallback manual quote mode",
    complianceNotes:
      "Supplier is not integrated yet. Use request quote and manual verification before approval.",
    liveOrderingEnabled: false,
  };
}

function normalizeSupplierName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
