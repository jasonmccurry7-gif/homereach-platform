import { BestPriceDeliveryDashboard } from "@/components/operations-copilot/best-price-delivery-dashboard";
import { buildBestPriceDeliveryBoard } from "@/lib/operations-copilot/delivery-intelligence";
import { getOperationsCopilotSessionUser } from "@/lib/operations-copilot/auth";
import {
  industryPriceCatalogs,
  type IndustryPriceCatalog,
} from "@/lib/operations-copilot/industry-catalog";

export const dynamic = "force-dynamic";

type DeliveryPageProps = {
  searchParams: Promise<{ industry?: IndustryPriceCatalog["id"] }>;
};

export default async function OperationsCopilotDeliveryPage({
  searchParams,
}: DeliveryPageProps) {
  const user = await getOperationsCopilotSessionUser();
  if (!user) return null;

  const { industry } = await searchParams;
  const activeIndustry =
    industryPriceCatalogs.some((catalog) => catalog.id === industry)
      ? industry
      : "roofing";
  const board = await buildBestPriceDeliveryBoard({
    userId: user.id,
    industryId: activeIndustry,
  });

  return (
    <BestPriceDeliveryDashboard
      activeIndustryId={board.industryId}
      board={board}
      catalogs={industryPriceCatalogs}
    />
  );
}
