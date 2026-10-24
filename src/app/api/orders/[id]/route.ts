import { orderStatusUpdateSchema } from "@/lib/validation/api";
import { notFound, ok, parseId, readJson, adminRoute } from "@/server/http";
import { getOrder, updateOrderStatus } from "@/server/repositories/orders";

export const GET = adminRoute(async (_req, { params }) => {
  const order = await getOrder(parseId((await params).id, "Order"));
  if (!order) throw notFound("Order");
  return ok(order);
});

export const PATCH = adminRoute(async (req, { params }) => {
  const id = parseId((await params).id, "Order");
  const { status } = await readJson(req, orderStatusUpdateSchema);
  return ok(await updateOrderStatus(id, status));
});
