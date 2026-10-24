import type { StockAdjustInput } from "@/lib/validation/api";
import type { InventoryItem } from "@/types";
import { api } from "./api-client";

export const adjustStock = (variantId: string, input: StockAdjustInput) =>
  api<InventoryItem>(`/inventory/${variantId}`, { method: "PATCH", body: input });
