import { SuppliesOpportunityTable } from "@/components/operations-copilot/supplies-opportunity-table";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import {
  industryPriceCatalogs,
  type IndustryPriceCatalog,
} from "@/lib/operations-copilot/industry-catalog";
import { buildSupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";
import { buildSupplyOpportunityBoard } from "@/lib/operations-copilot/supply-opportunities";

export const dynamic = "force-dynamic";

type SuppliesPageProps = {
  searchParams: Promise<{ industry?: IndustryPriceCatalog["id"] }>;
};

export default async function OperationsCopilotSuppliesPage({
  searchParams,
}: SuppliesPageProps) {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const { industry } = await searchParams;
  const activeIndustry =
    industryPriceCatalogs.some((catalog) => catalog.id === industry)
      ? industry
      : "roofing";
  const activeCatalog =
    industryPriceCatalogs.find((catalog) => catalog.id === activeIndustry) ??
    industryPriceCatalogs[0];
  if (!activeCatalog) return null;

  const priceIntelligence = await buildSupplierPriceIntelligence({
    catalog: activeCatalog,
    userId: user.id,
    loadSnapshots: false,
  });
  const board = buildSupplyOpportunityBoard({
    catalog: activeCatalog,
    intelligence: priceIntelligence,
  });

  return (
    <SuppliesOpportunityTable
      activeIndustryId={activeCatalog.id}
      board={board}
      catalogs={industryPriceCatalogs}
    />
  );
}
