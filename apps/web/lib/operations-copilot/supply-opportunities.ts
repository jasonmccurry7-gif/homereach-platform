import type { IndustryPriceCatalog } from "@/lib/operations-copilot/industry-catalog";
import type { SupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";

export type SupplyOpportunityRow = {
  sku: string;
  itemName: string;
  category: string;
  unit: string;
  supplierName: string;
  bestTodayPriceCents: number;
  baselinePriceCents: number;
  varianceCents: number;
  savingsOpportunityCents: number;
  estimatedWeeklyQuantity: number;
  status: "under_baseline" | "over_baseline" | "in_line";
  sourceLabel: string;
  sourceQuality: "verified" | "observed" | "estimated";
  sourceQualityLabel: string;
  freshnessLabel: string;
  lastUpdatedLabel: string;
  confidence: "low" | "medium" | "high";
  capturedAt: Date | null;
};

export type SupplyOpportunityBoard = {
  industryId: string;
  industryLabel: string;
  operatingModel: string;
  asOfDate: Date;
  region: string;
  zipCode: string;
  rowCount: number;
  underBaselineCount: number;
  overBaselineCount: number;
  totalSavingsOpportunityCents: number;
  rows: SupplyOpportunityRow[];
};

const baselineOverrides: Record<string, number> = {
  "ROOF-SHINGLES-ARCH": 4650,
  "ROOF-UNDERLAY-SYN": 9800,
  "ROOF-ICE-WATER": 8200,
  "ROOF-NAILS-COIL": 5600,
  "ROOF-VENT-RIDGE": 290,
  "ROOF-STARTER-STRIP": 5100,
  "ROOF-HIP-RIDGE-CAP": 7200,
  "ROOF-DRIP-EDGE": 920,
  "ROOF-STEP-FLASHING": 145,
  "ROOF-PIPE-BOOT": 1700,
  "ROOF-ROOF-CEMENT": 2400,
  "ROOF-SEALANT-POLY": 925,
  "ROOF-OSB-716": 1950,
  "ROOF-PLYWOOD-12": 3650,
  "ROOF-VENT-BOX": 1800,
  "ROOF-VENT-POWER": 11800,
  "ROOF-CAP-NAILS": 3400,
  "ROOF-NAILER": 28500,
  "ROOF-TARP": 4200,
  "ROOF-DUMPSTER": 48500,
  "BAKERY-FLOUR-AP-50": 2650,
  "BAKERY-FLOUR-CAKE-50": 3450,
  "BAKERY-FLOUR-BREAD-50": 3150,
  "BAKERY-SUGAR-GRAN-50": 4200,
  "BAKERY-SUGAR-POWDERED-50": 5200,
  "BAKERY-BUTTER-CASE": 14800,
  "BAKERY-EGGS-LARGE": 8200,
  "BAKERY-CREAM-CHEESE": 9450,
  "BAKERY-CHOCOLATE-CHIPS": 11400,
  "BAKERY-COCOA-POWDER": 9250,
  "BAKERY-BOX-CUPCAKE-12": 7800,
  "BAKERY-BOX-CAKE-10": 6400,
  "BAKERY-CLAMSHELL-CUPCAKE": 8600,
  "BAKERY-LINERS-CUPCAKE": 4200,
  "LAND-MULCH-HARDWOOD": 4200,
  "LAND-MULCH-DYED-BROWN": 4600,
  "LAND-MULCH-DYED-BLACK": 4800,
  "LAND-TOPSOIL-SCREENED": 3900,
  "LAND-COMPOST": 4400,
  "LAND-POTTING-MIX": 1850,
  "LAND-RIVER-ROCK": 7600,
  "LAND-LIMESTONE-57": 5200,
  "LAND-GRAVEL-PEA": 6900,
  "LAND-PAVER-BASE": 5800,
  "LAND-POLYMERIC-SAND": 3200,
  "LAND-PAVERS": 52000,
  "LAND-RETAINING-BLOCK": 68000,
  "LAND-WALL-CAPS": 72000,
  "LAND-FERTILIZER-TURF": 2850,
  "LAND-FERTILIZER-STARTER": 3200,
  "LAND-FERTILIZER-PREEMERGENT": 4200,
  "LAND-LIME-PELLETIZED": 750,
  "LAND-HERBICIDE-SELECTIVE": 4200,
  "LAND-GLYPHOSATE": 5800,
  "LAND-SEED-FESCUE": 12200,
  "LAND-SEED-SUNSHADE": 9800,
  "LAND-STRAW-BALES": 850,
  "LAND-EROSION-BLANKET": 9800,
  "LAND-SOD": 23500,
  "LAND-SHRUBS-3GAL": 3600,
  "LAND-PERENNIALS-1GAL": 1450,
  "LAND-ANNUALS-FLAT": 2600,
  "LAND-TREES-15GAL": 18500,
  "LAND-IRRIGATION-HEAD": 1450,
  "LAND-IRRIGATION-PIPE-POLY": 9800,
  "LAND-DRIP-TUBING": 6400,
  "LAND-IRRIGATION-VALVE": 2600,
  "LAND-IRRIGATION-CONTROLLER": 12500,
  "LAND-DRAIN-PIPE": 7400,
  "LAND-CATCH-BASIN": 3600,
  "LAND-ICE-MELT": 1850,
  "LAND-ROCK-SALT": 12500,
  "LAND-MOWER-BLADES": 6400,
  "LAND-TRIMMER-LINE": 4200,
  "LAND-2CYCLE-OIL": 2800,
  "LAND-LEAF-BAGS": 2400,
  "LAND-CONTRACTOR-BAGS": 2800,
  "HVAC-FILTER-MERV8": 7200,
  "HVAC-FILTER-MERV11": 8800,
  "HVAC-FILTER-MERV13": 10400,
  "HVAC-MEDIA-FILTER": 12800,
  "HVAC-CAPACITOR-RUN": 1800,
  "HVAC-CAPACITOR-DUAL": 2600,
  "HVAC-CAPACITOR-BLOWER": 1600,
  "HVAC-CONTACTOR-2POLE": 2400,
  "HVAC-FAN-MOTOR-CONDENSER": 18500,
  "HVAC-BLOWER-MOTOR-PSC": 21000,
  "HVAC-BLOWER-MOTOR-ECM": 48000,
  "HVAC-IGNITOR-HSI": 3500,
  "HVAC-FLAME-SENSOR": 1800,
  "HVAC-PRESSURE-SWITCH": 6800,
  "HVAC-CONTROL-BOARD": 28500,
  "HVAC-TRANSFORMER-24V": 2400,
  "HVAC-FUSES": 1800,
  "HVAC-RELAY-FAN": 2200,
  "HVAC-CONDENSATE-PUMP": 6800,
  "HVAC-FLOAT-SWITCH": 2400,
  "HVAC-DRAIN-TABLETS": 1800,
  "HVAC-PVC-CONDENSATE": 3200,
  "HVAC-REFRIGERANT-R410A": 41000,
  "HVAC-R407C": 39500,
  "HVAC-R32": 36000,
  "HVAC-R454B": 43000,
  "HVAC-FILTER-DRIER": 2200,
  "HVAC-TXV": 12500,
  "HVAC-RECOVERY-CYLINDER": 9800,
  "HVAC-NITROGEN": 6400,
  "HVAC-VACUUM-OIL": 1400,
  "HVAC-BRAZING-ROD": 9200,
  "HVAC-COPPER-LINESET": 29500,
  "HVAC-LINESET-INSULATION": 5600,
  "HVAC-ELECTRICAL-WHIP": 1900,
  "HVAC-DISCONNECT": 2400,
  "HVAC-CONCRETE-PAD": 8400,
  "HVAC-WALL-BRACKET": 7800,
  "HVAC-THERMOSTAT-WIFI": 14500,
  "HVAC-THERMOSTAT-NONPROG": 3600,
  "HVAC-THERMOSTAT-PROG": 6200,
  "HVAC-ZONE-DAMPER": 16500,
  "HVAC-DUCT-MASTIC": 4800,
  "HVAC-FOIL-TAPE": 5400,
  "HVAC-FLEX-DUCT-8": 8900,
  "HVAC-FLEX-DUCT-12": 14200,
  "HVAC-SHEET-METAL": 2600,
  "HVAC-REGISTER": 1800,
  "HVAC-RETURN-GRILLE": 4200,
  "HVAC-GAS-VALVE": 18500,
  "HVAC-INDUCER-MOTOR": 24500,
  "HVAC-HUMIDIFIER-PAD": 7600,
  "HVAC-UV-LAMP": 9800,
  "HVAC-MINI-SPLIT-LINESET": 18500,
  "HVAC-MINI-SPLIT-CONDENSATE-PUMP": 12800,
  "HVAC-EQUIP-FURNACE": 145000,
  "HVAC-EQUIP-CONDENSER": 210000,
  "HVAC-EQUIP-EVAP-COIL": 68000,
  "HVAC-EQUIP-HEAT-PUMP": 315000,
};

const categoryBaselines: Record<string, number> = {
  "roof covering": 5200,
  underlayment: 9200,
  fasteners: 3800,
  ventilation: 2200,
  "metal flashing": 850,
  flashing: 1600,
  sealants: 1400,
  decking: 2650,
  safety: 7800,
  "jobsite protection": 3600,
  "tear-off": 2400,
  disposal: 48500,
  gutters: 1150,
  "low-slope roofing": 16500,
  "roof accessories": 4200,
  flour: 3050,
  sugar: 4600,
  dairy: 8800,
  eggs: 8200,
  fats: 6100,
  leavening: 4800,
  chocolate: 9800,
  inclusions: 8400,
  flavorings: 6200,
  fillings: 7600,
  decorations: 5400,
  produce: 4200,
  packaging: 6800,
  disposables: 3800,
  sanitation: 5200,
  beverages: 6100,
  "bulk material": 4600,
  "soil amendments": 3900,
  stone: 6400,
  hardscape: 52000,
  "bed prep": 2800,
  chemicals: 4200,
  "erosion control": 9200,
  turf: 9800,
  nursery: 3600,
  irrigation: 3400,
  drainage: 6200,
  snow: 2400,
  "equipment consumables": 4600,
  maintenance: 7600,
  "service parts": 12500,
  refrigerant: 39500,
  "install material": 8800,
  controls: 9800,
  electrical: 2400,
  condensate: 4800,
  ductwork: 5200,
  IAQ: 8200,
  equipment: 145000,
  tools: 9800,
  consumables: 4200,
};

export function buildSupplyOpportunityBoard({
  catalog,
  intelligence,
}: {
  catalog: IndustryPriceCatalog;
  intelligence: SupplierPriceIntelligence;
}): SupplyOpportunityBoard {
  const rows = catalog.items.map((item, index) => {
    const priceRow = intelligence.rows.find((row) => row.sku === item.sku);
    const baselinePriceCents = resolveBaselinePrice(item.sku, item.category);
    const benchmarkPriceCents = resolveBenchmarkBestPrice(baselinePriceCents, item.sku, index);
    const bestTodayPriceCents = priceRow?.bestPriceCents ?? benchmarkPriceCents;
    const varianceCents = baselinePriceCents - bestTodayPriceCents;
    const estimatedWeeklyQuantity = resolveEstimatedWeeklyQuantity(item.sku, item.unit);
    const status =
      varianceCents > 25
        ? "under_baseline"
        : varianceCents < -25
          ? "over_baseline"
          : "in_line";

    return {
      sku: item.sku,
      itemName: item.itemName,
      category: item.category,
      unit: item.unit,
      supplierName: priceRow?.bestSupplierName ?? item.suppliers[0] ?? "Supplier TBD",
      bestTodayPriceCents,
      baselinePriceCents,
      varianceCents,
      savingsOpportunityCents: Math.max(0, varianceCents) * estimatedWeeklyQuantity,
      estimatedWeeklyQuantity,
      status,
      sourceLabel: priceRow?.bestPriceCents
        ? "Captured price snapshot"
        : "Benchmark until live capture",
      sourceQuality: priceRow?.bestSourceQuality ?? "estimated",
      sourceQualityLabel: priceRow?.bestSourceQualityLabel ?? "Estimated",
      freshnessLabel: priceRow?.bestFreshnessLabel ?? "No snapshot",
      lastUpdatedLabel: priceRow?.latestUpdatedLabel ?? "Not updated",
      confidence: priceRow?.bestPriceCents ? "high" : "low",
      capturedAt: priceRow?.latestCapturedAt ?? null,
    } satisfies SupplyOpportunityRow;
  });

  rows.sort(
    (a, b) =>
      b.savingsOpportunityCents - a.savingsOpportunityCents ||
      Math.abs(b.varianceCents) - Math.abs(a.varianceCents)
  );

  return {
    industryId: catalog.id,
    industryLabel: catalog.label,
    operatingModel: catalog.operatingModel,
    asOfDate: new Date(),
    region: catalog.defaultRegion,
    zipCode: catalog.defaultZip,
    rowCount: rows.length,
    underBaselineCount: rows.filter((row) => row.status === "under_baseline").length,
    overBaselineCount: rows.filter((row) => row.status === "over_baseline").length,
    totalSavingsOpportunityCents: rows.reduce(
      (sum, row) => sum + row.savingsOpportunityCents,
      0
    ),
    rows,
  };
}

function resolveBaselinePrice(sku: string, category: string) {
  return baselineOverrides[sku] ?? categoryBaselines[category] ?? 2500;
}

function resolveBenchmarkBestPrice(
  baselinePriceCents: number,
  sku: string,
  index: number
) {
  const signal = Array.from(sku).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const discountSteps = [0.04, 0.07, 0.1, 0.12, -0.03, 0.02];
  const factor = discountSteps[(signal + index) % discountSteps.length] ?? 0.04;
  return roundToNearestCents(baselinePriceCents * (1 - factor), 25);
}

function resolveEstimatedWeeklyQuantity(sku: string, unit: string) {
  if (sku.startsWith("BAKERY-")) return resolveBakeryWeeklyQuantity(sku, unit);
  if (sku.startsWith("LAND-")) return resolveLandscapingWeeklyQuantity(sku, unit);
  if (sku.startsWith("HVAC-")) return resolveHvacWeeklyQuantity(sku, unit);
  if (sku.includes("SHINGLES-ARCH")) return 42;
  if (sku.includes("STARTER") || sku.includes("HIP-RIDGE")) return 7;
  if (sku.includes("UNDERLAY") || sku.includes("ICE-WATER")) return 5;
  if (sku.includes("NAILS")) return 8;
  if (sku.includes("DRIP") || sku.includes("FLASH")) return 40;
  if (sku.includes("OSB") || sku.includes("PLYWOOD")) return 24;
  if (sku.includes("DUMPSTER")) return 1;
  if (unit === "linear foot") return 180;
  if (unit === "tube" || unit === "piece") return 24;
  if (unit === "box" || unit === "roll") return 6;
  return 4;
}

function resolveBakeryWeeklyQuantity(sku: string, unit: string) {
  if (sku.includes("FLOUR")) return 8;
  if (sku.includes("SUGAR")) return 6;
  if (sku.includes("BUTTER")) return 5;
  if (sku.includes("EGGS")) return 8;
  if (sku.includes("CREAM-CHEESE") || sku.includes("HEAVY-CREAM")) return 4;
  if (sku.includes("MILK")) return 6;
  if (sku.includes("CHOCOLATE") || sku.includes("COCOA")) return 3;
  if (sku.includes("VANILLA") || sku.includes("EXTRACT")) return 2;
  if (sku.includes("FILLING") || sku.includes("FRUIT") || sku.includes("JAM")) return 3;
  if (sku.includes("BOX") || sku.includes("CLAMSHELL") || sku.includes("BAG")) return 6;
  if (sku.includes("LINER") || sku.includes("BOARD") || sku.includes("CIRCLE")) return 5;
  if (sku.includes("GLOVE") || sku.includes("PARCHMENT")) return 4;
  if (sku.includes("LABEL") || sku.includes("STICKER")) return 2;
  if (unit === "case") return 3;
  if (unit === "50 lb bag") return 5;
  if (unit === "gallon") return 4;
  return 2;
}

function resolveLandscapingWeeklyQuantity(sku: string, unit: string) {
  if (sku.includes("MULCH")) return 45;
  if (sku.includes("TOPSOIL") || sku.includes("COMPOST")) return 12;
  if (
    sku.includes("RIVER-ROCK") ||
    sku.includes("LIMESTONE") ||
    sku.includes("GRAVEL") ||
    sku.includes("PAVER-BASE")
  ) {
    return 8;
  }
  if (sku.includes("PAVERS") || sku.includes("RETAINING") || sku.includes("WALL-CAPS")) {
    return 2;
  }
  if (sku.includes("FERTILIZER") || sku.includes("SEED") || sku.includes("LIME")) return 12;
  if (sku.includes("HERBICIDE") || sku.includes("GLYPHOSATE")) return 4;
  if (sku.includes("STRAW")) return 20;
  if (sku.includes("EROSION")) return 3;
  if (sku.includes("SOD")) return 3;
  if (
    sku.includes("SHRUBS") ||
    sku.includes("PERENNIALS") ||
    sku.includes("ANNUALS") ||
    sku.includes("TREES")
  ) {
    return 18;
  }
  if (sku.includes("IRRIGATION-PIPE") || sku.includes("DRIP")) return 4;
  if (sku.includes("IRRIGATION") || sku.includes("DRAIN") || sku.includes("CATCH-BASIN")) return 10;
  if (sku.includes("ICE-MELT") || sku.includes("ROCK-SALT")) return 20;
  if (sku.includes("MOWER") || sku.includes("TRIMMER") || sku.includes("2CYCLE")) return 4;
  if (sku.includes("BAGS")) return 6;
  if (unit === "cubic yard") return 10;
  if (unit === "pallet") return 2;
  if (unit === "bag") return 10;
  return 4;
}

function resolveHvacWeeklyQuantity(sku: string, unit: string) {
  if (sku.includes("FILTER")) return 12;
  if (sku.includes("CAPACITOR")) return 10;
  if (sku.includes("CONTACTOR")) return 6;
  if (
    sku.includes("MOTOR") ||
    sku.includes("IGNITOR") ||
    sku.includes("FLAME") ||
    sku.includes("PRESSURE") ||
    sku.includes("CONTROL-BOARD") ||
    sku.includes("GAS-VALVE") ||
    sku.includes("INDUCER") ||
    sku.includes("TXV") ||
    sku.includes("REVERSING")
  ) {
    return 4;
  }
  if (
    sku.includes("REFRIGERANT") ||
    sku.includes("R410A") ||
    sku.includes("R407C") ||
    sku.includes("R32") ||
    sku.includes("R454B")
  ) {
    return 2;
  }
  if (
    sku.includes("LINESET") ||
    sku.includes("PAD") ||
    sku.includes("BRACKET") ||
    sku.includes("PVC") ||
    sku.includes("DUCT")
  ) {
    return 4;
  }
  if (sku.includes("THERMOSTAT") || sku.includes("DAMPER")) return 4;
  if (sku.includes("WHIP") || sku.includes("DISCONNECT") || sku.includes("TRANSFORMER") || sku.includes("FUSES") || sku.includes("RELAY")) {
    return 6;
  }
  if (sku.includes("CONDENSATE") || sku.includes("FLOAT") || sku.includes("DRAIN")) return 6;
  if (sku.includes("REGISTER") || sku.includes("GRILLE") || sku.includes("SHEET-METAL")) return 8;
  if (sku.includes("HUMIDIFIER") || sku.includes("UV-LAMP")) return 4;
  if (sku.includes("EQUIP")) return 1;
  if (unit === "case") return 6;
  if (unit === "unit") return 4;
  if (unit === "cylinder") return 2;
  return 4;
}

function roundToNearestCents(value: number, nearestCents: number) {
  return Math.round(value / nearestCents) * nearestCents;
}
