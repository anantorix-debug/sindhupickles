import { z } from "zod";

export const ORDER_STATUSES = [
  "pending_payment",
  "payment_failed",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
  "cancelled",
  "return_requested",
  "returned",
  "refunded",
] as const;

export const orderStatusUpdateSchema = z.object({
  status: z.enum(ORDER_STATUSES, { error: "Unknown order status" }),
});

export const stockAdjustSchema = z.object({
  onHand: z.number({ error: "Enter the new stock count" }).int("Must be a whole number").min(0, "Stock cannot be negative").max(100000, "That looks too high"),
  reason: z.string().trim().max(255).optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;
