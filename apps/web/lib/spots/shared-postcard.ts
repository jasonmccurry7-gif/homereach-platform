export const SHARED_POSTCARD_TOTAL_SPOTS = 12;
export const SHARED_POSTCARD_WIDTH_INCHES = 9;
export const SHARED_POSTCARD_HEIGHT_INCHES = 12;
export const SHARED_POSTCARD_SLOT_WIDTH_INCHES = 4;
export const SHARED_POSTCARD_SLOT_HEIGHT_INCHES = 3.5;

export const SHARED_POSTCARD_SIZE_LABEL = "9 x 12";
export const SHARED_POSTCARD_SLOT_SIZE_LABEL = "4 x 3.5";

export type SharedPostcardSlotStatus = "active" | "pending" | "available";

export type SharedPostcardSlot = {
  position: number;
  status: SharedPostcardSlotStatus;
  businessName: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  designUrl: string | null;
  source: "spot_assignments" | "orders" | "legacy_migration" | "open";
};

export type SharedPostcardSnapshot = {
  cityId: string;
  cityName: string;
  totalSpots: number;
  occupiedSpots: number;
  availableSpots: number;
  sizeLabel: string;
  slotSizeLabel: string;
  slots: SharedPostcardSlot[];
};
