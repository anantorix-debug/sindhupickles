import { ORDER_STATUSES } from "@/lib/validation/api";
import { ApiError, ok, parseId, adminRoute } from "@/server/http";
import { listOrders } from "@/server/repositories/orders";
import type { OrderStatus } from "@/types";

export const GET = adminRoute(async (req) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  if (status && !(ORDER_STATUSES as readonly string[]).includes(status)) {
    throw new ApiError(422, "Unknown order status", "validation_error", { status: "Unknown order status" });
  }
  const customerId = sp.get("customerId");
  return ok(
    await listOrders({
      status: (status as OrderStatus | null) ?? undefined,
      customerId: customerId ? parseId(customerId, "Customer") : undefined,
    }),
  );
});
