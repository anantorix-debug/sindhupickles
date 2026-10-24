import type { OrderStatus } from "@/types";

/**
 * Order status rules (same logic as Kuttima's admin): an order only moves
 * forward along the fulfilment flow, can be cancelled before it's delivered,
 * and a cancelled order is locked. Shared by the API and the status dialog.
 */
export const FULFILMENT_FLOW: OrderStatus[] = [
  "pending_payment",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

/** Statuses in which stock is still reserved (not yet consumed by shipping). */
export const STOCK_RESERVED_STATUSES: OrderStatus[] = ["pending_payment", "confirmed", "processing", "packed"];

export function allowedNextStatuses(current: OrderStatus): OrderStatus[] {
  const idx = FULFILMENT_FLOW.indexOf(current);
  if (idx !== -1) {
    if (current === "delivered") return ["return_requested"];
    return [...FULFILMENT_FLOW.slice(idx + 1), "cancelled"];
  }
  switch (current) {
    case "payment_failed":
      return ["cancelled"];
    case "return_requested":
      return ["returned", "refunded"];
    default:
      return []; // cancelled, returned, refunded — locked
  }
}

export const canTransition = (from: OrderStatus, to: OrderStatus) => allowedNextStatuses(from).includes(to);
