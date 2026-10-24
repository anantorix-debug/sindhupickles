import { ok } from "@/server/http";
import { listCustomerOrders } from "@/server/store/customer-orders";
import { requireCustomer, storeRoute } from "@/server/store/http";

export const GET = storeRoute(async () => ok(await listCustomerOrders(await requireCustomer()), { headers: { "Cache-Control": "no-store" } }));
