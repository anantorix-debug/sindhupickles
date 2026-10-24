import "server-only";
import type { Order, OrderSummary } from "@/types";
import { getOrder, listOrders } from "@/server/repositories/orders";

export const listCustomerOrders = (customerId: string): Promise<OrderSummary[]> => listOrders({ customerId, limit: 100 });

/** Returns the order only if it belongs to this customer — otherwise null, so existence isn't leaked. */
export async function getCustomerOrder(customerId: string, orderId: string): Promise<Order | null> {
  const order = await getOrder(orderId);
  return order && order.customerId === customerId ? order : null;
}
