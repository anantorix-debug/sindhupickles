import { ok, adminRoute } from "@/server/http";
import { listEnquiries } from "@/server/repositories/enquiries";

export const GET = adminRoute(async () => ok(await listEnquiries()));
