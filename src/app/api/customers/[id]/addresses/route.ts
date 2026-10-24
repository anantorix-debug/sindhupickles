import { ok, parseId, adminRoute } from "@/server/http";
import { listAddresses } from "@/server/repositories/customers";

export const GET = adminRoute(async (_req, { params }) => ok(await listAddresses(parseId((await params).id, "Customer"))));
