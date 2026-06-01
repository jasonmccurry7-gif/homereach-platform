import { IndustryPriceTabs } from "@/components/operations-copilot/industry-price-tabs";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import { industryPriceCatalogs } from "@/lib/operations-copilot/industry-catalog";
import { buildSupplierPriceIntelligence } from "@/lib/operations-copilot/price-intelligence";

export const dynamic = "force-dynamic";

export default async function OperationsCopilotSupplierPricesPage() {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const roofingCatalog =
    industryPriceCatalogs.find((catalog) => catalog.id === "roofing") ??
    industryPriceCatalogs[0];
  if (!roofingCatalog) return null;

  const priceIntelligence = await buildSupplierPriceIntelligence({
    catalog: roofingCatalog,
    userId: user.id,
  });

  return (
    <IndustryPriceTabs
      catalogs={industryPriceCatalogs}
      priceIntelligence={priceIntelligence}
    />
  );
}
