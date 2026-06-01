import catalogData from "./production-service-catalog.json";

export type ProductionStatus =
  | "sellable_now"
  | "sellable_manual"
  | "sellable_manual_compliance_review"
  | "sellable_with_political_compliance"
  | "sellable_needs_fresh_smoke"
  | "sellable_needs_inventory_audit"
  | "manual_sellable"
  | "manual_sellable_with_publish_gate"
  | "sales_wedge_ready"
  | "pilot_only"
  | "internal_first"
  | "internal_foundation"
  | "internal_then_client"
  | "manual_launch_only"
  | "internal_only";

export type ProductionServiceOffer = {
  id: string;
  publicName: string;
  category: string;
  offerType: string;
  productionStatus: ProductionStatus;
  price: {
    public: string;
    billingMode: string;
    stripeStatus: string;
  };
  primaryOwner: string;
  publicPath: string;
  startPath: string;
  adminPath: string;
  customerPath: string;
  docs: string[];
  deliverables: string[];
  fulfillmentSteps: string[];
  reportingMetrics: string[];
  approvalGates: string[];
  smokeTests: string[];
  issueHandling: string[];
  renewalMotion: string;
  readinessNotes: string;
};

export const productionServiceCatalog = catalogData as ProductionServiceOffer[];

export function listProductionServiceOffers() {
  return productionServiceCatalog;
}

export function getProductionServiceOffer(id: string) {
  return productionServiceCatalog.find((offer) => offer.id === id) ?? null;
}

export function summarizeProductionServiceCatalog() {
  const sellable = productionServiceCatalog.filter((offer) =>
    [
      "sellable_now",
      "sellable_manual",
      "sellable_manual_compliance_review",
      "sellable_with_political_compliance",
      "manual_sellable",
      "manual_sellable_with_publish_gate",
      "sales_wedge_ready",
    ].includes(offer.productionStatus),
  ).length;

  const needsProof = productionServiceCatalog.filter((offer) =>
    ["sellable_needs_fresh_smoke", "sellable_needs_inventory_audit", "pilot_only"].includes(offer.productionStatus),
  ).length;

  const internal = productionServiceCatalog.filter((offer) =>
    ["internal_first", "internal_foundation", "internal_then_client", "manual_launch_only", "internal_only"].includes(
      offer.productionStatus,
    ),
  ).length;

  return {
    total: productionServiceCatalog.length,
    sellable,
    needsProof,
    internal,
  };
}
