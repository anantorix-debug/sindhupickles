import type { Order, OrderStatus } from "@/types";
import { api } from "./api-client";

export const updateOrderStatus = (id: string, status: OrderStatus) =>
  api<Order>(`/orders/${id}`, { method: "PATCH", body: { status } });

export const updateOrderTracking = (id: string, input: { carrier: string; number: string }) =>
  api<Order>(`/orders/${id}/tracking`, { method: "PATCH", body: input });
