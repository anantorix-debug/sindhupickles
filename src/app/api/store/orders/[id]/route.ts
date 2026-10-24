import { notFound, ok, parseId } from "@/server/http";
import { getCustomerOrder } from "@/server/store/customer-orders";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const GET = storeRoute(async (_req, { params }) => {
  const order = await getCustomerOrder(await requireCustomer(), parseId((await params).id, "Order"));
  if (!order) throw notFound("Order");
  return ok(order, { headers: { "Cache-Control": "no-store" } });
});
