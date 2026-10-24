import { ok, adminRoute } from "@/server/http";
import { listCustomers } from "@/server/repositories/customers";

export const GET = adminRoute(async () => ok(await listCustomers()));
